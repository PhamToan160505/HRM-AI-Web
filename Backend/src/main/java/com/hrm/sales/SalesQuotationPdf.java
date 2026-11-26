package com.hrm.sales;

import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SalesQuotationPdf {
    private final SalesCommercialService commercial;

    @SuppressWarnings("unchecked")
    public byte[] generate(long actorId,long quotationId) throws java.io.IOException {
        var detail = commercial.quotationDetail(actorId,quotationId);
        var quote = (Map<String,Object>) detail.get("quotation");
        var lines = (List<Map<String,Object>>) detail.get("lines");
        List<String> content = new ArrayList<>();
        content.add("BÁO GIÁ #" + quotationId + " / Phiên bản " + quote.get("revision"));
        content.add("Trạng thái: " + quote.get("status"));
        if (!Set.of("APPROVED","SENT","ACCEPTED").contains(String.valueOf(quote.get("status")))) {
            content.add("BẢN THAM KHẢO NỘI BỘ — CHƯA ĐỦ ĐIỀU KIỆN GỬI KHÁCH HÀNG");
        }
        content.add("Khách hàng: " + quote.get("customer_name"));
        content.add("Nhu cầu: " + quote.get("opportunity_title"));
        if (quote.get("customer_address") != null) content.add("Địa chỉ: " + quote.get("customer_address"));
        if (quote.get("customer_tax_code") != null) content.add("Mã số thuế: " + quote.get("customer_tax_code"));
        content.add("Có hiệu lực đến: " + quote.get("valid_until"));
        content.add("");
        for (var line : lines) {
            content.add(String.valueOf(line.get("description")));
            content.add("  " + line.get("quantity") + " " + line.get("unit") + " × "
                    + line.get("unit_price") + " VND");
        }
        content.add("Giảm giá: " + quote.get("discount_amount") + " VND");
        content.add("Tổng thanh toán: " + quote.get("total_amount") + " VND");
        content.add("");
        content.add("Điều khoản");
        content.add(String.valueOf(quote.get("terms")));
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream();
             var fontStream = Objects.requireNonNull(getClass().getResourceAsStream("/fonts/Roboto-Regular.ttf"))) {
            var font = PDType0Font.load(document,fontStream);
            PDPageContentStream stream = null;
            float y = 0;
            try {
                for (String paragraph : content) {
                    for (String line : wrap(paragraph,font)) {
                        if (y < 55) {
                            if (stream != null) stream.close();
                            var page = new PDPage(PDRectangle.A4);
                            document.addPage(page);
                            stream = new PDPageContentStream(document,page);
                            y = 790;
                        }
                        stream.beginText();
                        stream.setFont(font,11);
                        stream.newLineAtOffset(45,y);
                        stream.showText(line);
                        stream.endText();
                        y -= 18;
                    }
                }
            } finally {
                if (stream != null) stream.close();
            }
            document.save(output);
            return output.toByteArray();
        }
    }

    private List<String> wrap(String text, PDType0Font font) throws java.io.IOException {
        List<String> result = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (char character : text.replaceAll("[\\p{Cc}&&[^\\n]]", " ").toCharArray()) {
            String glyph = String.valueOf(character);
            if (character == '\n') { result.add(line.toString()); line.setLength(0); continue; }
            try { font.encode(glyph); } catch (IllegalArgumentException exception) { glyph = "?"; }
            if (font.getStringWidth(line + glyph) * 11 / 1000 > 500) {
                result.add(line.toString());
                line.setLength(0);
            }
            line.append(glyph);
        }
        result.add(line.toString());
        return result;
    }
}
