package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class CccdExtractionService {

    private final GeminiClientService geminiClientService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Validates 12 digits
    private static final Pattern CCCD_PATTERN = Pattern.compile("^\\d{12}$");

    public String extractCccdInfo(String frontBase64, String backBase64) {
        log.info("[CCCD AI] Bắt đầu bóc tách CCCD...");

        // Strip data:image/...;base64, if present
        if (frontBase64 != null && frontBase64.contains(",")) frontBase64 = frontBase64.split(",")[1];
        if (backBase64 != null && backBase64.contains(",")) backBase64 = backBase64.split(",")[1];

        String prompt = """
                Bạn là một trợ lý AI chuyên nghiệp đọc thẻ Căn cước công dân Việt Nam.
                Nhiệm vụ: Trích xuất các trường thông tin từ mặt trước và mặt sau CCCD thành JSON.
                
                YÊU CẦU:
                - TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON SAU (không có markdown, không bọc bằng ```json).
                - Các trường nào không đọc được hoặc không có thì để rỗng ("").
                - Đánh giá "confidenceScore" (0-100) cho TỪNG TRƯỜNG để biết độ tin cậy của OCR.
                - Ngày tháng năm chuyển về định dạng yyyy-MM-dd.
                
                Mẫu JSON trả về:
                {
                  "cccd": {"value": "042...", "confidenceScore": 99},
                  "fullName": {"value": "NGUYỄN VĂN A", "confidenceScore": 98},
                  "dob": {"value": "1990-01-01", "confidenceScore": 95},
                  "gender": {"value": "Nam", "confidenceScore": 98},
                  "address": {"value": "123 Đường A, Quận B, TP HCM", "confidenceScore": 90},
                  "hometown": {"value": "Hà Nội", "confidenceScore": 90},
                  "issueDate": {"value": "2021-06-21", "confidenceScore": 85},
                  "issuePlace": {"value": "Cục cảnh sát quản lý hành chính về trật tự xã hội", "confidenceScore": 85},
                  "expiryDate": {"value": "2030-01-01", "confidenceScore": 85}
                }
                """;

        List<String> images = java.util.Arrays.asList(frontBase64, backBase64);
        
        try {
            String rawResponse = geminiClientService.callGeminiVision(images, prompt).block();
            String extractedJson = geminiClientService.extractTextFromGeminiResponse(rawResponse);
            
            // Dọn dẹp JSON
            extractedJson = extractedJson.replaceAll("```json", "").replaceAll("```", "").trim();
            
            // Validate JSON and Regex
            JsonNode root = objectMapper.readTree(extractedJson);
            if (root.has("cccd") && root.get("cccd").has("value")) {
                String cccdValue = root.get("cccd").get("value").asText("");
                if (!CCCD_PATTERN.matcher(cccdValue).matches()) {
                    log.warn("[CCCD AI] Số CCCD không hợp lệ: {}", cccdValue);
                    // Có thể đánh dấu lỗi hoặc hạ confidenceScore
                }
            }
            
            return extractedJson;
        } catch (Exception e) {
            log.error("[CCCD AI] Lỗi bóc tách CCCD: {}", e.getMessage());
            throw new RuntimeException("Không thể bóc tách CCCD bằng AI: " + e.getMessage());
        }
    }
}
