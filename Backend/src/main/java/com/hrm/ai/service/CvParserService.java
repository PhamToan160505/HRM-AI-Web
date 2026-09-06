package com.hrm.ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * CvParserService: trích xuất văn bản từ file CV (PDF).
 *
 * Luồng xử lý:
 *  1. Thử đọc text layer bằng PDFBox (nhanh, miễn phí).
 *  2. Nếu không có text (PDF dạng ảnh/scan) → render từng trang thành ảnh PNG
 *     rồi gửi lên Gemini Vision để OCR.
 *     Gemini Vision hiểu bố cục 2D (2 cột) chính xác, không bị lệch như OCR truyền thống.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CvParserService {

    private final GeminiClientService geminiClientService;

    private static final String OCR_PROMPT =
        "Đây là các trang của một file CV (Curriculum Vitae) xin việc được scan. " +
        "Hãy đọc và trích xuất toàn bộ nội dung văn bản trong ảnh này một cách chính xác nhất. " +
        "Giữ nguyên cấu trúc thông tin (tên, liên hệ, kinh nghiệm làm việc, học vấn, kỹ năng...). " +
        "Nếu CV có 2 cột, hãy đọc cột trái trước rồi cột phải. " +
        "Chỉ trả về văn bản thuần túy, KHÔNG giải thích, KHÔNG thêm markdown.";

    /**
     * Hàm chính: nhận bytes file (PDF hoặc Image) → trả về text đầy đủ (từ text layer hoặc Vision OCR).
     */
    public String parseCvFile(byte[] fileBytes, String filename) {
        if (fileBytes == null || fileBytes.length == 0) {
            log.warn("[CvParser] Không có bytes để đọc");
            return "";
        }

        boolean isImage = false;
        if (filename != null) {
            String lower = filename.toLowerCase();
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png")) {
                isImage = true;
            }
        }

        if (isImage) {
            log.info("[CvParser] File là ảnh, gọi trực tiếp Gemini Vision OCR");
            String base64Image = java.util.Base64.getEncoder().encodeToString(fileBytes);
            return callGeminiForImages(java.util.Collections.singletonList(base64Image));
        }

        // Bước 1: Thử đọc text layer (nhanh)
        String textLayerContent = extractTextLayer(fileBytes);
        if (textLayerContent != null && textLayerContent.trim().length() > 50) {
            log.info("[CvParser] Đọc text layer thành công ({} ký tự)", textLayerContent.length());
            return textLayerContent.trim();
        }

        // Bước 2: PDF dạng ảnh → dùng Gemini Vision OCR
        log.info("[CvParser] Text layer trống/ngắn ({}ký tự) → chuyển sang Gemini Vision OCR",
                textLayerContent != null ? textLayerContent.trim().length() : 0);
        return extractTextViaGeminiVision(fileBytes);
    }

    // ─── Private Helpers ──────────────────────────────────────────────────────

    private String extractTextLayer(byte[] fileBytes) {
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(fileBytes))) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (Exception e) {
            log.warn("[CvParser] Không đọc được text layer PDF: {}", e.getMessage());
            return "";
        }
    }

    private String extractTextViaGeminiVision(byte[] fileBytes) {
        List<String> base64Pages = renderPdfToBase64Images(fileBytes);
        if (base64Pages.isEmpty()) {
            log.error("[CvParser] Không render được trang nào từ PDF");
            return "";
        }

        log.info("[CvParser] Render được {} trang → gửi lên Gemini Vision OCR", base64Pages.size());
        return callGeminiForImages(base64Pages);
    }

    private String callGeminiForImages(List<String> base64Pages) {
        try {
            String rawResponse = geminiClientService.callGeminiVision(base64Pages, OCR_PROMPT).block(java.time.Duration.ofSeconds(30));
            String ocrText = geminiClientService.extractTextFromGeminiResponse(rawResponse);

            if (ocrText != null && !ocrText.isBlank()) {
                log.info("[CvParser] Gemini Vision OCR thành công: {} ký tự", ocrText.length());
                return ocrText.trim();
            } else {
                log.warn("[CvParser] Gemini Vision trả về rỗng");
                return "";
            }
        } catch (Exception e) {
            log.error("[CvParser] Lỗi khi gọi Gemini Vision OCR: {}", e.getMessage());
            return "";
        }
    }

    /**
     * Render từng trang PDF thành ảnh PNG Base64.
     * Giới hạn 5 trang đầu (CV thường 1-3 trang, đủ dùng).
     */
    private List<String> renderPdfToBase64Images(byte[] fileBytes) {
        List<String> base64Images = new ArrayList<>();
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(fileBytes))) {
            PDFRenderer renderer = new PDFRenderer(document);
            int pageCount = Math.min(document.getNumberOfPages(), 5); // Tối đa 5 trang

            for (int i = 0; i < pageCount; i++) {
                // 150 DPI: cân bằng giữa chất lượng OCR và kích thước ảnh gửi lên API
                BufferedImage pageImage = renderer.renderImageWithDPI(i, 150, ImageType.RGB);

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(pageImage, "PNG", baos);
                String base64 = Base64.getEncoder().encodeToString(baos.toByteArray());
                base64Images.add(base64);

                log.debug("[CvParser] Render trang {} xong ({} bytes PNG)", i + 1, baos.size());
            }
        } catch (Exception e) {
            log.error("[CvParser] Lỗi render PDF thành ảnh: {}", e.getMessage());
        }
        return base64Images;
    }
}
