package com.hrm.telegram;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

/**
 * Dùng Gemini AI để phân tích câu hỏi tự nhiên của giám đốc
 * và trả về intent (loại dữ liệu cần truy vấn).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramAiIntentService {

    private final WebClient.Builder webClientBuilder;

    @Value("${app.gemini.api-key}")
    private String geminiApiKey;

    @Value("${app.gemini.base-url}")
    private String geminiBaseUrl;

    /**
     * Intent của câu hỏi Telegram.
     */
    public enum Intent {
        EMPLOYEE_SUMMARY,
        ATTENDANCE_TODAY,
        PAYROLL_SUMMARY,
        RECRUITMENT_SUMMARY,
        PENDING_REQUESTS,
        FULL_DASHBOARD,
        HELP,
        UNKNOWN
    }

    /**
     * Phân tích câu hỏi tự nhiên → Intent.
     * Dùng Gemini để hiểu ngữ cảnh tiếng Việt.
     */
    public Intent detectIntent(String message) {
        try {
            String prompt = buildIntentPrompt(message);
            String response = callGemini(prompt).block();
            return parseIntentFromResponse(response);
        } catch (Exception e) {
            log.warn("Gemini intent detection failed, falling back to keyword matching: {}", e.getMessage());
            return fallbackKeywordMatch(message);
        }
    }

    private String buildIntentPrompt(String message) {
        return """
                Bạn là hệ thống phân loại intent cho HRM chatbot.
                Phân loại câu hỏi sau của người dùng vào ĐÚNG MỘT trong các intent sau:
                
                EMPLOYEE_SUMMARY - hỏi về số nhân viên, nhân sự, headcount, phòng ban
                ATTENDANCE_TODAY - hỏi về chấm công, điểm danh, ai đi muộn, ai vắng mặt hôm nay
                PAYROLL_SUMMARY - hỏi về lương, bảng lương, chi phí nhân sự, payroll
                RECRUITMENT_SUMMARY - hỏi về tuyển dụng, ứng viên, vị trí tuyển, job posting
                PENDING_REQUESTS - hỏi về yêu cầu nhân viên, đơn nghỉ phép, request chờ duyệt
                FULL_DASHBOARD - hỏi tổng quan, dashboard, báo cáo tổng hợp, mọi thông tin
                HELP - hỏi cách dùng bot, hỗ trợ, danh sách lệnh
                UNKNOWN - không rõ ý định
                
                Câu hỏi: "%s"
                
                Chỉ trả về đúng một trong các từ khóa intent (in hoa), không giải thích thêm.
                """.formatted(message);
    }

    private Mono<String> callGemini(String prompt) {
        String modelName = "gemini-1.5-flash";
        String url = geminiBaseUrl + "/models/" + modelName + ":generateContent?key=" + geminiApiKey;

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                ))
        );

        return webClientBuilder.build()
                .post()
                .uri(url)
                .header("Content-Type", "application/json")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .map(resp -> {
                    try {
                        @SuppressWarnings("unchecked")
                        var candidates = (List<Map<String, Object>>) resp.get("candidates");
                        @SuppressWarnings("unchecked")
                        var content = (Map<String, Object>) candidates.get(0).get("content");
                        @SuppressWarnings("unchecked")
                        var parts = (List<Map<String, Object>>) content.get("parts");
                        return parts.get(0).get("text").toString().trim();
                    } catch (Exception e) {
                        return "UNKNOWN";
                    }
                })
                .onErrorReturn("UNKNOWN");
    }

    private Intent parseIntentFromResponse(String response) {
        if (response == null) return Intent.UNKNOWN;
        String upper = response.toUpperCase().trim();
        for (Intent intent : Intent.values()) {
            if (upper.contains(intent.name())) {
                return intent;
            }
        }
        return Intent.UNKNOWN;
    }

    /**
     * Fallback: phân tích keyword đơn giản nếu Gemini fail.
     */
    private Intent fallbackKeywordMatch(String message) {
        if (message == null) return Intent.UNKNOWN;
        String lower = message.toLowerCase();

        if (lower.contains("nhân viên") || lower.contains("headcount") || lower.contains("nhân sự")
                || lower.contains("phòng ban") || lower.contains("bao nhiêu người")) {
            return Intent.EMPLOYEE_SUMMARY;
        }
        if (lower.contains("chấm công") || lower.contains("điểm danh") || lower.contains("đi muộn")
                || lower.contains("vắng mặt") || lower.contains("hôm nay") || lower.contains("attendance")) {
            return Intent.ATTENDANCE_TODAY;
        }
        if (lower.contains("lương") || lower.contains("payroll") || lower.contains("bảng lương")
                || lower.contains("tiền lương") || lower.contains("salary")) {
            return Intent.PAYROLL_SUMMARY;
        }
        if (lower.contains("tuyển") || lower.contains("ứng viên") || lower.contains("tuyển dụng")
                || lower.contains("phỏng vấn") || lower.contains("job") || lower.contains("recruitment")) {
            return Intent.RECRUITMENT_SUMMARY;
        }
        if (lower.contains("yêu cầu") || lower.contains("xin nghỉ") || lower.contains("đơn")
                || lower.contains("nghỉ phép") || lower.contains("chờ duyệt") || lower.contains("request")) {
            return Intent.PENDING_REQUESTS;
        }
        if (lower.contains("tổng quan") || lower.contains("dashboard") || lower.contains("overview")
                || lower.contains("báo cáo") || lower.contains("toàn bộ") || lower.contains("tất cả")) {
            return Intent.FULL_DASHBOARD;
        }
        if (lower.contains("help") || lower.contains("hướng dẫn") || lower.contains("lệnh")
                || lower.contains("giúp") || lower.contains("/help")) {
            return Intent.HELP;
        }

        return Intent.UNKNOWN;
    }
}
