package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class CvExtractionService {

    private final GeminiClientService geminiClientService;
    private final DecisionLogService decisionLogService;
    private final ObjectMapper objectMapper;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[0-9]{9,15}$");
    private static final Pattern CCCD_PATTERN = Pattern.compile("^[0-9]{12}$");

    public String extractCvData(Long applicationId, String rawCvText) {
        String prompt = "Trích xuất thông tin từ nội dung CV sau. \n" +
                "Vui lòng trả về ĐÚNG MỘT JSON OBJECT theo cấu trúc sau, không có markdown (```json), chỉ chuỗi JSON thô:\n" +
                "{\n" +
                "  \"fullName\": {\"value\": \"...\", \"confidence\": 90},\n" +
                "  \"email\": {\"value\": \"...\", \"confidence\": 90},\n" +
                "  \"phone\": {\"value\": \"...\", \"confidence\": 90},\n" +
                "  \"cccd\": {\"value\": \"...\", \"confidence\": 90},\n" +
                "  \"dob\": {\"value\": \"...\", \"confidence\": 90},\n" +
                "  \"gender\": {\"value\": \"...\", \"confidence\": 90},\n" +
                "  \"education\": [{\"degree\": \"...\", \"school\": \"...\"}],\n" +
                "  \"experience\": [{\"role\": \"...\", \"company\": \"...\", \"duration\": \"...\"}],\n" +
                "  \"careerObjective\": \"...\",\n" +
                "  \"suggestedQuestions\": [\"question 1\", \"question 2\", \"question 3\"]\n" +
                "}\n" +
                "Với các trường thông tin cơ bản, hãy đánh giá độ tự tin (confidence) từ 0 đến 100 dựa trên độ rõ ràng của thông tin.\n" +
                "Ở mảng suggestedQuestions, hãy gợi ý 3-5 câu hỏi phỏng vấn thực tế, có độ khó cao, dựa trực tiếp vào kinh nghiệm và kỹ năng ghi trong CV này.\n" +
                "Nội dung CV:\n" + rawCvText;

        try {
            String aiResponse = geminiClientService.callGemini(prompt).block();
            
            // Lọc bỏ markdown nếu có
            if (aiResponse != null && aiResponse.contains("```json")) {
                aiResponse = aiResponse.substring(aiResponse.indexOf("{"), aiResponse.lastIndexOf("}") + 1);
            } else if (aiResponse != null) {
                // Gemini thường trả JSON nằm trong parts
                JsonNode root = objectMapper.readTree(aiResponse);
                if (root.has("candidates") && root.get("candidates").isArray() && root.get("candidates").size() > 0) {
                    JsonNode content = root.get("candidates").get(0).get("content");
                    if (content != null && content.has("parts") && content.get("parts").isArray() && content.get("parts").size() > 0) {
                        String text = content.get("parts").get(0).get("text").asText();
                        if (text.contains("```json")) {
                            text = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
                        }
                        aiResponse = text;
                    }
                }
            }

            // Validate Regex & Modify Confidence
            JsonNode extractedData = objectMapper.readTree(aiResponse);
            validateField(extractedData, "email", EMAIL_PATTERN);
            validateField(extractedData, "phone", PHONE_PATTERN);
            validateField(extractedData, "cccd", CCCD_PATTERN);

            String finalJson = objectMapper.writeValueAsString(extractedData);

            decisionLogService.logDecision(
                    applicationId,
                    "OCR",
                    prompt,
                    finalJson,
                    "CV Extraction successful",
                    true,
                    null
            );

            return finalJson;
        } catch (Exception e) {
            log.error("Error during CV Extraction: ", e);
            decisionLogService.logDecision(
                    applicationId,
                    "OCR",
                    prompt,
                    null,
                    "CV Extraction failed",
                    false,
                    e.getMessage()
            );
            throw new RuntimeException("Lỗi trích xuất CV: " + e.getMessage());
        }
    }

    private void validateField(JsonNode root, String fieldName, Pattern pattern) {
        if (root.has(fieldName) && root.get(fieldName).isObject()) {
            ObjectNode fieldNode = (ObjectNode) root.get(fieldName);
            if (fieldNode.has("value") && !fieldNode.get("value").isNull()) {
                String value = fieldNode.get("value").asText();
                if (!value.isEmpty() && !pattern.matcher(value).matches()) {
                    fieldNode.put("confidence", 30); // Hạ confidence nếu sai format
                }
            }
        }
    }
}
