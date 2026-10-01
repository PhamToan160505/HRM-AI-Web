package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.exception.AppException;
import com.hrm.recruitment.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tạo câu hỏi phỏng vấn vòng 2 (onsite/trực tiếp) dựa trên:
 * - JD (mô tả công việc + tiêu chí)
 * - Kết luận và feedback từ vòng 1
 * - CV ứng viên (tóm tắt)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiInterviewQuestionService {

    private final JdbcTemplate jdbcTemplate;
    private final ApplicationRepository applicationRepository;
    private final GeminiClientService geminiClientService;
    private final ObjectMapper objectMapper;

    /**
     * Tạo câu hỏi phỏng vấn sơ bộ vòng 1 (online) cho ứng viên dựa trên CV và JD.
     *
     * @param applicationId ID hồ sơ ứng tuyển
     * @return Danh sách câu hỏi phỏng vấn vòng 1 (online)
     */
    public List<String> generateRound1Questions(Long applicationId) {
        var application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));

        String jdSummary = buildJdSummary(applicationId);
        String cvSummary = buildCvSummary(application.getRawCvText());
        String prompt = buildRound1Prompt(jdSummary, cvSummary);

        try {
            String response = geminiClientService.callGemini(prompt, 60, 1).block();
            String text = geminiClientService.extractTextFromGeminiResponse(response);
            return parseQuestions(text);
        } catch (Exception e) {
            log.error("[AiInterviewQuestion] Lỗi khi generate câu hỏi vòng 1 cho application {}: {}",
                    applicationId, e.getMessage());
            throw AppException.conflict("Không thể tạo câu hỏi phỏng vấn online: " + e.getMessage());
        }
    }

    /**
     * Tạo câu hỏi phỏng vấn trực tiếp vòng 2 cho ứng viên.
     *
     * @param applicationId ID hồ sơ ứng tuyển
     * @return Danh sách câu hỏi phỏng vấn vòng 2
     */
    public List<String> generateRound2Questions(Long applicationId) {
        var application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));

        // Lấy JD từ tiêu chí screening mới nhất
        String jdSummary = buildJdSummary(applicationId);

        // Lấy kết luận + feedback vòng 1 đã hoàn tất
        String round1Context = buildRound1Context(applicationId);

        // Tóm tắt CV
        String cvSummary = buildCvSummary(application.getRawCvText());

        String prompt = buildPrompt(jdSummary, cvSummary, round1Context);

        try {
            String response = geminiClientService.callGemini(prompt, 60, 1).block();
            String text = geminiClientService.extractTextFromGeminiResponse(response);
            return parseQuestions(text);
        } catch (Exception e) {
            log.error("[AiInterviewQuestion] Lỗi khi generate câu hỏi vòng 2 cho application {}: {}",
                    applicationId, e.getMessage());
            throw AppException.conflict("Không thể tạo câu hỏi phỏng vấn: " + e.getMessage());
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String buildJdSummary(Long applicationId) {
        try {
            // Lấy criteria snapshot từ lần chạy AI mới nhất
            List<String> snapshots = jdbcTemplate.queryForList("""
                    SELECT cs.criteria_snapshot
                    FROM ai_analyses aa
                    JOIN screening_criteria_sets cs ON cs.id = aa.criteria_version_id
                    WHERE aa.application_id = ? AND aa.status = 'COMPLETED'
                    ORDER BY aa.created_at DESC LIMIT 1
                    """, String.class, applicationId);

            if (!snapshots.isEmpty() && snapshots.get(0) != null) {
                JsonNode snap = objectMapper.readTree(snapshots.get(0));
                String title     = snap.path("title").asText("");
                String desc      = snap.path("description").asText("");
                String req       = snap.path("requirements").asText("");
                JsonNode criteria = snap.path("criteria");

                StringBuilder sb = new StringBuilder();
                if (!title.isBlank()) sb.append("Vị trí: ").append(title).append("\n");
                if (!desc.isBlank())  sb.append("Mô tả: ").append(truncate(desc, 600)).append("\n");
                if (!req.isBlank())   sb.append("Yêu cầu: ").append(truncate(req, 600)).append("\n");
                if (criteria.isArray()) {
                    sb.append("Tiêu chí đánh giá:\n");
                    criteria.forEach(c -> {
                        String name = c.path("name").asText("");
                        String detail = c.path("description").asText(c.path("details").asText(""));
                        if (!name.isBlank()) sb.append("- ").append(name)
                                .append(detail.isBlank() ? "" : ": " + truncate(detail, 200)).append("\n");
                    });
                }
                return sb.toString().trim();
            }
        } catch (Exception e) {
            log.warn("[AiInterviewQuestion] Không lấy được JD snapshot: {}", e.getMessage());
        }
        return "Không có thông tin JD chi tiết";
    }

    private String buildRound1Context(Long applicationId) {
        // Lấy kết luận của vòng 1 đã DONE
        List<String> conclusions = jdbcTemplate.queryForList("""
                SELECT conclusion FROM interviews
                WHERE application_id = ? AND round_number = 1 AND status = 'DONE'
                ORDER BY attempt_number DESC LIMIT 1
                """, String.class, applicationId);

        // Lấy tất cả feedback của vòng 1 (người phỏng vấn đã submit)
        List<String> feedbackRows = jdbcTemplate.queryForList("""
                SELECT CONCAT(u.ho_ten, ' (', f.recommendation, ', ', f.overall_score, ' điểm): ', f.comments) AS line
                FROM interview_feedbacks f
                JOIN interview_participants ip ON ip.interview_id = f.interview_id AND ip.user_id = f.interviewer_id
                JOIN interviews i ON i.id = f.interview_id
                JOIN users u ON u.id = f.interviewer_id
                WHERE i.application_id = ? AND i.round_number = 1 AND i.status = 'DONE'
                ORDER BY f.submitted_at
                """, String.class, applicationId);

        if (conclusions.isEmpty() && feedbackRows.isEmpty()) {
            return "Chưa có dữ liệu vòng phỏng vấn 1.";
        }

        StringBuilder sb = new StringBuilder();
        if (!conclusions.isEmpty() && conclusions.get(0) != null && !conclusions.get(0).isBlank()) {
            sb.append("Kết luận vòng 1: ").append(conclusions.get(0)).append("\n\n");
        }
        if (!feedbackRows.isEmpty()) {
            sb.append("Feedback từng người phỏng vấn:\n");
            feedbackRows.forEach(line -> sb.append("• ").append(line).append("\n"));
        }
        return sb.toString().trim();
    }

    private String buildCvSummary(String rawCvText) {
        if (rawCvText == null || rawCvText.isBlank()) return "Không có dữ liệu CV";
        return truncate(rawCvText, 1000);
    }

    private String buildRound1Prompt(String jd, String cv) {
        return """
                Bạn là chuyên gia tuyển dụng giúp chuẩn bị câu hỏi phỏng vấn VÒNG 1 (phỏng vấn ONLINE sơ bộ).

                Ngữ cảnh:
                - Đây là buổi phỏng vấn vòng 1 sơ bộ qua Google Meet / Zoom.
                - Mục tiêu: Kiểm tra kiến thức chuyên môn nền tảng, kinh nghiệm tổng quan trong CV, kỹ năng cốt lõi và mức độ phù hợp ban đầu với vị trí.

                MÔ TẢ CÔNG VIỆC (JD):
                %s

                TÓM TẮT CV ỨNG VIÊN:
                %s

                Hãy tạo ĐÚNG 8 câu hỏi phỏng vấn online vòng 1. Yêu cầu:
                1. Dành riêng cho phỏng vấn online sơ bộ, cô đọng, đi thẳng vào kiến thức nền tảng và kỹ năng chuyên môn cốt lõi.
                2. Kiểm tra tính xác thực và làm rõ thông tin kinh nghiệm nổi bật ghi trong CV so với JD.
                3. Đánh giá thái độ, phong cách giao tiếp trực tuyến và khả năng làm việc từ xa / độc lập (nếu vị trí yêu cầu).
                4. Viết bằng tiếng Việt, ngắn gọn, dễ hỏi và trả lời qua Google Meet / Zoom.

                Chỉ trả về danh sách 8 câu hỏi, mỗi câu trên một dòng, bắt đầu bằng số thứ tự (ví dụ: "1. Câu hỏi...").
                Không giải thích, không thêm tiêu đề, chỉ trả về đúng 8 dòng câu hỏi.
                """.formatted(jd, cv);
    }

    private String buildPrompt(String jd, String cv, String round1Context) {
        return """
                Bạn là chuyên gia tuyển dụng giúp chuẩn bị câu hỏi phỏng vấn VÒNG 2 (phỏng vấn TRỰC TIẾP, gặp mặt tại văn phòng).

                Ngữ cảnh:
                - Ứng viên đã qua vòng 1 (phỏng vấn online sơ bộ).
                - Vòng 2 là phỏng vấn chuyên sâu với cấp lãnh đạo, tập trung vào năng lực thực tế, tình huống cụ thể và văn hóa tổ chức.

                MÔ TẢ CÔNG VIỆC (JD):
                %s

                TÓM TẮT CV ỨNG VIÊN:
                %s

                KẾT QUẢ VÒNG 1:
                %s

                Hãy tạo ĐÚNG 8 câu hỏi phỏng vấn trực tiếp vòng 2. Yêu cầu:
                1. Câu hỏi phải dành cho phỏng vấn gặp mặt trực tiếp (không phải online), mang tính chuyên sâu.
                2. Bổ sung/đào sâu vào điểm còn nghi vấn hoặc chưa rõ từ vòng 1 (nếu có kết quả vòng 1).
                3. Bao gồm câu hỏi tình huống thực tế (STAR method: Situation, Task, Action, Result).
                4. Bao gồm câu hỏi về kỳ vọng nghề nghiệp, phong cách làm việc và văn hóa tổ chức.
                5. Tránh lặp lại câu hỏi lý thuyết cơ bản (đã hỏi vòng 1 online).
                6. Viết tiếng Việt, ngắn gọn, rõ ràng.

                Chỉ trả về danh sách 8 câu hỏi, mỗi câu trên một dòng, bắt đầu bằng số thứ tự (ví dụ: "1. Câu hỏi...").
                Không giải thích, không thêm tiêu đề, chỉ trả về đúng 8 dòng câu hỏi.
                """.formatted(jd, cv, round1Context);
    }

    private List<String> parseQuestions(String text) {
        if (text == null || text.isBlank()) return List.of();
        List<String> result = new ArrayList<>();
        // Thử parse từng dòng có dạng "1. ...", "2. ...", v.v.
        Pattern numbered = Pattern.compile("^\\s*\\d+[.):\\-]\\s*(.+)$");
        for (String line : text.split("\\r?\\n")) {
            Matcher m = numbered.matcher(line.trim());
            if (m.matches()) {
                String q = m.group(1).trim();
                if (!q.isBlank()) result.add(q);
            } else if (!line.isBlank() && result.size() < 8) {
                // Fallback: thêm dòng không trống nếu chưa có
                String trimmed = line.trim().replaceAll("^[-•*]+\\s*", "");
                if (!trimmed.isBlank()) result.add(trimmed);
            }
        }
        return result.isEmpty() ? List.of(text.trim()) : result;
    }

    private String truncate(String text, int maxChars) {
        if (text == null) return "";
        return text.length() <= maxChars ? text : text.substring(0, maxChars) + "...";
    }
}
