package com.hrm.ai.service;

import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.color.PDColor;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.pdfbox.util.Matrix;
import org.apache.pdfbox.util.Vector;
import org.springframework.stereotype.Service;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@RequiredArgsConstructor
public class CvFileSafetyService {

    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);
    private static final int ZIP_LOCAL_FILE_HEADER = 0x504B0304;

    private final ConfigurationService configurationService;

    public ValidatedCv validateAndExtract(byte[] bytes, String originalFilename) {
        if (bytes == null || bytes.length == 0) {
            throw AppException.badRequest("CV là bắt buộc");
        }
        long maxBytes = Math.multiplyExact((long) configurationService.requireInteger("upload.max_file_size_mb"),
                1024L * 1024L);
        if (bytes.length > maxBytes) {
            throw AppException.badRequest("CV vượt quá dung lượng cho phép");
        }
        int maxPages = configurationService.requireInteger("upload.max_pages");
        BigDecimal minFontSize = configurationService.requireDecimal("ai.hidden_text.min_font_size");

        if (startsWith(bytes, PDF_MAGIC)) {
            return validatePdf(bytes, safeOriginalName(originalFilename), maxPages, minFontSize.floatValue());
        }
        if (readInt(bytes) == ZIP_LOCAL_FILE_HEADER) {
            return validateDocx(bytes, safeOriginalName(originalFilename), maxPages, minFontSize.doubleValue());
        }
        throw AppException.badRequest("CV không đúng định dạng PDF hoặc DOCX");
    }

    private ValidatedCv validatePdf(byte[] bytes, String name, int maxPages, float minFontSize) {
        try (PDDocument document = PDDocument.load(bytes)) {
            if (document.isEncrypted()) {
                throw AppException.badRequest("Không nhận CV PDF đặt mật khẩu");
            }
            int pages = document.getNumberOfPages();
            if (pages <= 0 || pages > maxPages) {
                throw AppException.badRequest("Số trang CV phải từ 1 đến " + maxPages);
            }
            HiddenAwareStripper stripper = new HiddenAwareStripper(minFontSize);
            String visible = stripper.getText(document).trim();
            return new ValidatedCv(bytes, name, DetectedType.PDF, pages, visible,
                    stripper.hiddenChars(), ExtractionMethod.TEXT_LAYER);
        } catch (org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException exception) {
            throw AppException.badRequest("Không nhận CV PDF đặt mật khẩu");
        } catch (AppException exception) {
            throw exception;
        } catch (IOException exception) {
            throw AppException.badRequest("File PDF bị hỏng hoặc không đọc được");
        }
    }

    private ValidatedCv validateDocx(byte[] bytes, String name, int maxPages, double minFontSize) {
        try {
            List<ZipPart> parts = readZip(bytes);
            boolean hasContentTypes = parts.stream().anyMatch(part -> "[Content_Types].xml".equals(part.name()));
            ZipPart documentPart = parts.stream().filter(part -> "word/document.xml".equals(part.name()))
                    .findFirst().orElse(null);
            boolean hasMacro = parts.stream().anyMatch(part ->
                    part.name().toLowerCase(Locale.ROOT).contains("vbaproject.bin")
                            || part.name().toLowerCase(Locale.ROOT).endsWith(".bin"));
            String contentTypes = parts.stream()
                    .filter(part -> "[Content_Types].xml".equals(part.name()))
                    .findFirst().map(part -> new String(part.bytes(), StandardCharsets.UTF_8)).orElse("");
            if (!hasContentTypes || documentPart == null) {
                throw AppException.badRequest("File ZIP không phải DOCX hợp lệ");
            }
            if (hasMacro || contentTypes.toLowerCase(Locale.ROOT).contains("macroenabled")) {
                throw AppException.badRequest("Không nhận DOCX có macro");
            }
            DocxText text = extractDocxText(documentPart.bytes(), minFontSize);
            int pages = readDocxPageCount(parts, text.pageBreaks());
            if (pages <= 0 || pages > maxPages) {
                throw AppException.badRequest("Số trang CV phải từ 1 đến " + maxPages);
            }
            return new ValidatedCv(bytes, name, DetectedType.DOCX, pages, text.visibleText().trim(),
                    text.hiddenChars(), ExtractionMethod.DOCX_XML);
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            throw AppException.badRequest("File DOCX bị hỏng hoặc không đọc được");
        }
    }

    private List<ZipPart> readZip(byte[] bytes) throws IOException {
        List<ZipPart> parts = new ArrayList<>();
        long expandedBytes = 0;
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                input.transferTo(output);
                expandedBytes += output.size();
                if (expandedBytes > bytes.length * 100L || expandedBytes > 50L * 1024 * 1024) {
                    throw AppException.badRequest("DOCX có tỷ lệ giải nén không an toàn");
                }
                parts.add(new ZipPart(entry.getName(), output.toByteArray()));
            }
        }
        return parts;
    }

    private DocxText extractDocxText(byte[] xml, double minFontSize) throws Exception {
        DocumentBuilderFactory factory = secureDocumentBuilderFactory();
        org.w3c.dom.Document document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
        StringBuilder visible = new StringBuilder();
        int hidden = 0;
        int pageBreaks = 0;
        org.w3c.dom.NodeList nodes = document.getElementsByTagNameNS("*", "r");
        for (int i = 0; i < nodes.getLength(); i++) {
            org.w3c.dom.Element run = (org.w3c.dom.Element) nodes.item(i);
            boolean vanished = run.getElementsByTagNameNS("*", "vanish").getLength() > 0;
            boolean tiny = false;
            org.w3c.dom.NodeList sizes = run.getElementsByTagNameNS("*", "sz");
            if (sizes.getLength() > 0) {
                org.w3c.dom.Element size = (org.w3c.dom.Element) sizes.item(0);
                String raw = size.getAttributeNS(
                        "http://schemas.openxmlformats.org/wordprocessingml/2006/main", "val");
                if (raw.isBlank()) raw = size.getAttribute("w:val");
                if (!raw.isBlank()) tiny = Double.parseDouble(raw) / 2.0 < minFontSize;
            }
            StringBuilder runText = new StringBuilder();
            org.w3c.dom.NodeList texts = run.getElementsByTagNameNS("*", "t");
            for (int j = 0; j < texts.getLength(); j++) runText.append(texts.item(j).getTextContent());
            if (vanished || tiny) hidden += runText.length();
            else if (!runText.isEmpty()) visible.append(runText).append(' ');
            pageBreaks += run.getElementsByTagNameNS("*", "lastRenderedPageBreak").getLength();
            org.w3c.dom.NodeList breaks = run.getElementsByTagNameNS("*", "br");
            for (int j = 0; j < breaks.getLength(); j++) {
                org.w3c.dom.Element br = (org.w3c.dom.Element) breaks.item(j);
                if ("page".equals(br.getAttribute("w:type")) || "page".equals(br.getAttribute("type"))) {
                    pageBreaks++;
                }
            }
        }
        return new DocxText(visible.toString(), hidden, pageBreaks);
    }

    private int readDocxPageCount(List<ZipPart> parts, int pageBreaks) {
        try {
            ZipPart app = parts.stream().filter(part -> "docProps/app.xml".equals(part.name()))
                    .findFirst().orElse(null);
            if (app != null) {
                org.w3c.dom.Document document = secureDocumentBuilderFactory().newDocumentBuilder()
                        .parse(new ByteArrayInputStream(app.bytes()));
                org.w3c.dom.NodeList pages = document.getElementsByTagName("Pages");
                if (pages.getLength() > 0) return Math.max(1, Integer.parseInt(pages.item(0).getTextContent()));
            }
        } catch (Exception ignored) {
            // Page-break count is a safe fallback when app metadata is absent or stale.
        }
        return Math.max(1, pageBreaks + 1);
    }

    private DocumentBuilderFactory secureDocumentBuilderFactory() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        return factory;
    }

    private boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if (bytes[i] != prefix[i]) return false;
        return true;
    }

    private int readInt(byte[] bytes) {
        if (bytes.length < 4) return 0;
        return ((bytes[0] & 0xff) << 24) | ((bytes[1] & 0xff) << 16)
                | ((bytes[2] & 0xff) << 8) | (bytes[3] & 0xff);
    }

    private String safeOriginalName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) return "cv";
        String normalized = originalFilename.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1).substring(0,
                Math.min(255, normalized.substring(normalized.lastIndexOf('/') + 1).length()));
    }

    public enum DetectedType { PDF, DOCX }
    public enum ExtractionMethod { TEXT_LAYER, DOCX_XML, OCR }

    public record ValidatedCv(byte[] bytes, String originalFilename, DetectedType detectedType,
                              int pageCount, String visibleText, int hiddenTextRemovedChars,
                              ExtractionMethod extractionMethod) {
        public ValidatedCv withOcrText(String text) {
            return new ValidatedCv(bytes, originalFilename, detectedType, pageCount, text,
                    hiddenTextRemovedChars, ExtractionMethod.OCR);
        }
    }

    private record ZipPart(String name, byte[] bytes) {}
    private record DocxText(String visibleText, int hiddenChars, int pageBreaks) {}

    static final class HiddenAwareStripper extends PDFTextStripper {
        private final float minFontSize;
        private int hiddenChars;
        private float pageWidth;
        private float pageHeight;

        HiddenAwareStripper(float minFontSize) throws IOException {
            this.minFontSize = minFontSize;
            setSortByPosition(true);
        }

        @Override
        protected void startPage(PDPage page) throws IOException {
            pageWidth = page.getMediaBox().getWidth();
            pageHeight = page.getMediaBox().getHeight();
            super.startPage(page);
        }

        @Override
        protected void showGlyph(Matrix textRenderingMatrix, PDFont font, int code,
                                 String unicode, Vector displacement) throws IOException {
            boolean tiny = getGraphicsState().getTextState().getFontSize() < minFontSize;
            boolean outside = textRenderingMatrix.getTranslateX() < 0 || textRenderingMatrix.getTranslateY() < 0
                    || textRenderingMatrix.getTranslateX() > pageWidth
                    || textRenderingMatrix.getTranslateY() > pageHeight;
            boolean white = isWhite(getGraphicsState().getNonStrokingColor());
            if (tiny || outside || white) {
                hiddenChars += unicode == null ? 0 : unicode.length();
                return;
            }
            super.showGlyph(textRenderingMatrix, font, code, unicode, displacement);
        }

        @Override
        protected void processTextPosition(TextPosition text) {
            boolean outside = text.getXDirAdj() < 0 || text.getYDirAdj() < 0
                    || text.getXDirAdj() > pageWidth || text.getYDirAdj() > pageHeight;
            if (outside) {
                hiddenChars += text.getUnicode() == null ? 0 : text.getUnicode().length();
                return;
            }
            super.processTextPosition(text);
        }

        private boolean isWhite(PDColor color) {
            try {
                int rgb = color.toRGB();
                int red = (rgb >> 16) & 0xff;
                int green = (rgb >> 8) & 0xff;
                int blue = rgb & 0xff;
                return red >= 245 && green >= 245 && blue >= 245;
            } catch (Exception ignored) {
                return false;
            }
        }

        int hiddenChars() { return hiddenChars; }
    }
}
