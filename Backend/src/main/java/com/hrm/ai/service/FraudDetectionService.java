package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class FraudDetectionService {

    private final GeminiClientService geminiClientService;
    private final DecisionLogService decisionLogService;
    private final ObjectMapper objectMapper;

    public FraudResult detectFraud(Long applicationId, String cvContent) {
        String prompt = "Đóng vai một chuyên gia phân tích dữ liệu tuyển dụng. " +
                "Nhiệm vụ của bạn là kiểm tra xem CV sau có dấu hiệu gian lận không (ví dụ: thời gian làm việc phi lý, " +
                "chồng chéo các công ty full-time, kỹ năng vượt quá kinh nghiệm).\n" +
                "Nội dung CV:\n" + cvContent + "\n\n" +
                "Trả về ĐÚNG MỘT JSON OBJECT theo cấu trúc:\n" +
                "{\"isFraud\": true/false, \"reason\": \"...\"}";

        try {
            String aiResponse = geminiClientService.callGemini(prompt).block();
            String cleanJson = extractJson(aiResponse);

            JsonNode root = objectMapper.readTree(cleanJson);
            boolean isFraud = root.has("isFraud") && root.get("isFraud").asBoolean();
            String reason = root.has("reason") ? root.get("reason").asText() : "";

            decisionLogService.logDecision(
                    applicationId,
                    "FRAUD_DETECTION",
                    prompt,
                    cleanJson,
                    "Fraud flagged: " + isFraud + ". " + reason,
                    true,
                    null
            );

            return new FraudResult(isFraud, reason);
        } catch (Exception e) {
            log.error("Error during Fraud Detection: ", e);
            decisionLogService.logDecision(
                    applicationId,
                    "FRAUD_DETECTION",
                    prompt,
                    null,
                    "Failed to detect fraud",
                    false,
                    e.getMessage()
            );
            throw new RuntimeException("Lỗi kiểm tra gian lận CV: " + e.getMessage());
        }
    }

    private String extractJson(String aiResponse) throws Exception {
        if (aiResponse == null) throw new RuntimeException("Empty response from AI");
        if (aiResponse.contains("```json")) {
            return aiResponse.substring(aiResponse.indexOf("{"), aiResponse.lastIndexOf("}") + 1);
        }
        JsonNode root = objectMapper.readTree(aiResponse);
        if (root.has("candidates") && root.get("candidates").isArray() && root.get("candidates").size() > 0) {
            JsonNode content = root.get("candidates").get(0).get("content");
            if (content != null && content.has("parts") && content.get("parts").isArray() && content.get("parts").size() > 0) {
                String text = content.get("parts").get(0).get("text").asText();
                if (text.contains("```json")) {
                    text = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
                }
                return text;
            }
        }
        return aiResponse;
    }

    public record FraudResult(boolean isFraud, String reason) {}
}
