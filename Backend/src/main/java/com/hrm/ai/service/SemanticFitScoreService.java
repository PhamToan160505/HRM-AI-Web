package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class SemanticFitScoreService {

    private final GeminiClientService geminiClientService;
    private final DecisionLogService decisionLogService;
    private final ObjectMapper objectMapper;

    public FitScoreResult calculateFitScore(Long applicationId, String cvContent, String jobDescription, String jobLevel) {
        String levelContext = (jobLevel != null && !jobLevel.isEmpty()) ? "Cấp bậc yêu cầu: " + jobLevel + "\n" : "";
        String prompt = "Đóng vai một chuyên gia nhân sự. Dưới đây là Mô tả công việc (JD) và CV của ứng viên.\n" +
                "Mô tả công việc (JD):\n" + jobDescription + "\n" + levelContext + "\n" +
                "Nội dung CV:\n" + cvContent + "\n\n" +
                "Yêu cầu:\n" +
                "1. Chấm điểm độ phù hợp (Fit Score) từ 0 đến 100.\n" +
                "2. Đưa ra một bài phân tích chi tiết, chuyên sâu giải thích tại sao lại cho mức điểm này. Phân tích rõ ràng mức độ đáp ứng JD, các điểm mạnh (ưu điểm) và điểm yếu (nhược điểm hoặc kỹ năng bị thiếu sót) của ứng viên. Văn phong chuyên nghiệp, trình bày dưới dạng văn xuôi mạch lạc để Trưởng phòng nhân sự đọc và tham khảo làm cơ sở duyệt hồ sơ.\n" +
                "Trả về ĐÚNG MỘT JSON OBJECT theo cấu trúc:\n" +
                "{\"score\": 85, \"reason\": \"...\"}";

        try {
            String aiResponse = geminiClientService.callGemini(prompt).block();
            String cleanJson = extractJson(aiResponse);

            JsonNode root = objectMapper.readTree(cleanJson);
            int score = root.has("score") ? root.get("score").asInt() : 0;
            String reason = root.has("reason") ? root.get("reason").asText() : "No reason provided.";

            decisionLogService.logDecision(
                    applicationId,
                    "FIT_SCORE",
                    prompt,
                    cleanJson,
                    "Fit score: " + score + ". " + reason,
                    true,
                    null
            );

            return new FitScoreResult(score, reason);
        } catch (Exception e) {
            log.error("Error during Fit Score Calculation: ", e);
            decisionLogService.logDecision(
                    applicationId,
                    "FIT_SCORE",
                    prompt,
                    null,
                    "Failed to calculate fit score",
                    false,
                    e.getMessage()
            );
            throw new RuntimeException("Lỗi chấm điểm CV: " + e.getMessage());
        }
    }

    private String extractJson(String aiResponse) throws Exception {
        String text = geminiClientService.extractTextFromGeminiResponse(aiResponse);
        if (text == null || text.isEmpty()) {
            throw new RuntimeException("Empty response from AI");
        }
        if (text.contains("```json")) {
            return text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
        } else if (text.contains("{") && text.contains("}")) {
            return text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
        }
        return text;
    }

    public record FitScoreResult(int score, String reason) {}
}
