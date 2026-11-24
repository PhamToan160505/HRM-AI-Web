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
            List<String> parsed = parseQuestions(text);
            if (!parsed.isEmpty()) {
                return parsed;
            }
        } catch (Exception e) {
            log.warn("[AiInterviewQuestion] Gemini tạm gián đoạn khi tạo câu hỏi vòng 1 cho application {} ({}), dùng bộ câu hỏi chuẩn hóa dự phòng.",
                    applicationId, e.getMessage());
        }
        return buildFallbackRound1Questions(application);
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
            List<String> parsed = parseQuestions(text);
            if (!parsed.isEmpty()) {
                return parsed;
            }
        } catch (Exception e) {
            log.warn("[AiInterviewQuestion] Gemini tạm gián đoạn khi tạo câu hỏi vòng 2 cho application {} ({}), dùng bộ câu hỏi chuẩn hóa dự phòng.",
                    applicationId, e.getMessage());
        }
        return buildFallbackRound2Questions(application);
    }

    private List<String> buildFallbackRound1Questions(com.hrm.recruitment.entity.Application application) {
        String title = application.getJobPosting() != null && application.getJobPosting().getTitle() != null
                ? application.getJobPosting().getTitle() : "vị trí ứng tuyển";
        String level = application.getJobPosting() != null && application.getJobPosting().getCapBac() != null
                ? application.getJobPosting().getCapBac() : "chuyên môn";
        return List.of(
                "Hãy giới thiệu ngắn gọn về quá trình làm việc và dự án tiêu biểu nhất bạn đã triển khai liên quan đến vị trí " + title + ".",
                "Trong dự án gần nhất, bạn đảm nhiệm vai trò kỹ thuật cụ thể nào và phần kiến trúc nào do bạn trực tiếp thiết kế?",
                "Bạn đánh giá thế nào về độ thành thạo của mình với các công nghệ cốt lõi yêu cầu ở cấp bậc " + level + "? Hãy nêu một bài toán khó bạn từng giải quyết.",
                "Bạn đã áp dụng Clean Architecture, kiểm thử tự động (Unit/Integration Test) và Code Review như thế nào trong các dự án trước?",
                "Khi phát sinh lỗi hiệu năng hoặc sự cố trên môi trường production, quy trình khoanh vùng và xử lý của bạn là gì?",
                "Hãy mô tả cách bạn phối hợp với Backend/Frontend, QA và Product trong quy trình Agile/Scrum khi làm việc online hoặc hybrid.",
                "Trong CV bạn có nêu các chỉ số cải thiện hiệu năng/chất lượng — bạn có thể chia sẻ cách đo lường trước và sau khi tối ưu không?",
                "Kỳ vọng của bạn về lộ trình phát triển chuyên môn trong 1–2 năm tới khi gia nhập vị trí " + title + " là gì?"
        );
    }

    private List<String> buildFallbackRound2Questions(com.hrm.recruitment.entity.Application application) {
        String title = application.getJobPosting() != null && application.getJobPosting().getTitle() != null
                ? application.getJobPosting().getTitle() : "vị trí ứng tuyển";
        return List.of(
                "Hãy kể về một lần dự án bạn tham gia bị chậm tiến độ sát ngày bàn giao — bạn đã chủ động trao đổi với quản lý và cả nhóm như thế nào để gỡ nút thắt?",
                "Khi nhận một yêu cầu công việc từ Product hoặc khách hàng nhưng thông tin còn mơ hồ và thay đổi giữa chừng, bạn thường xử lý theo cách nào?",
                "Bạn từng gặp bất đồng quan điểm với đồng đội hoặc cấp trên trong quá trình làm việc chưa? Cuối cùng hai bên đã thống nhất giải pháp ra sao?",
                "Hãy chia sẻ một sai sót đáng nhớ nhất bạn từng mắc phải trong công việc, bạn đã chịu trách nhiệm khắc phục thế nào và rút ra bài học gì?",
                "Trong 30 đến 90 ngày đầu tiên khi gia nhập đội ngũ ở vị trí " + title + ", bạn dự định ưu tiên làm những gì để nhanh chóng hòa nhập và tạo giá trị?",
                "Bạn thích làm việc trong một đội ngũ và với phong cách quản lý như thế nào để phát huy tốt nhất năng lực của mình?",
                "Mục tiêu nghề nghiệp của bạn trong 1–2 năm tới là gì và bạn kỳ vọng công ty sẽ hỗ trợ những điều kiện nào cho lộ trình đó?",
                "Ngoài yếu tố thu nhập, đâu là 2–3 tiêu chí quan trọng nhất giúp bạn quyết định gắn bó lâu dài với một môi trường làm việc?"
        );
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
                Bạn là chuyên gia nhân sự hỗ trợ Trưởng phòng / Giám đốc phòng ban và HR chuẩn bị câu hỏi phỏng vấn VÒNG 2 (phỏng vấn TRỰC TIẾP tại văn phòng — Hiring Manager & Culture Fit trước khi chốt Offer).

                Ngữ cảnh quan trọng:
                - Ứng viên ĐÃ VƯỢT QUA VÒNG 1 (vòng kiểm tra chuyên môn kỹ thuật sâu: ngôn ngữ lập trình, framework, cơ sở dữ liệu, kiến trúc hệ thống và xác minh CV).
                - Vòng 2 diễn ra trực tiếp với cấp Quản lý phòng ban và HR, mục tiêu KHÔNG phải hỏi lại lý thuyết hay bài tập kỹ thuật thuần túy của Vòng 1, mà nhằm đánh giá: năng lực làm việc thực tế trong đội ngũ, tư duy giải quyết vấn đề & chịu trách nhiệm (ownership), độ phù hợp văn hóa doanh nghiệp (culture/team fit), làm rõ điểm hội đồng Vòng 1 còn băn khoăn, và định hướng gắn bó trước khi bước vào đàm phán Offer.

                MÔ TẢ CÔNG VIỆC (JD):
                %s

                TÓM TẮT CV ỨNG VIÊN:
                %s

                KẾT QUẢ & NHẬN XÉT VÒNG 1:
                %s

                Hãy tạo ĐÚNG 8 câu hỏi phỏng vấn trực tiếp Vòng 2 theo cơ cấu chuẩn sau:
                - 2–3 câu tình huống thực tế & phối hợp đội ngũ (xử lý áp lực deadline, xung đột quan điểm trong team, sai sót từng gặp và cách tự khắc phục, thích nghi khi yêu cầu thay đổi).
                - 2 câu về tư duy làm việc, tinh thần chủ động (ownership), kế hoạch hòa nhập 30–90 ngày đầu và cách phối hợp với quản lý/đồng nghiệp trực tiếp tại văn phòng.
                - 1–2 câu đào sâu các điểm còn lấn cấn hoặc cần kiểm chứng thêm từ nhận xét Vòng 1 (nếu Vòng 1 đã khen tốt thì hỏi về khả năng nâng tầm vai trò, ví dụ từ Junior lên Middle/Senior hoặc hỗ trợ team).
                - 1–2 câu về văn hóa tổ chức, định hướng nghề nghiệp 1–2 năm tới và yếu tố quyết định gắn bó lâu dài (KHÔNG hỏi trực tiếp mức lương cụ thể vì phần đàm phán lương thực hiện ở bước riêng).

                Quy tắc bắt buộc về giọng văn và nội dung:
                1. TUYỆT ĐỐI KHÔNG lặp lại các câu hỏi kiểm tra lý thuyết, cú pháp, framework, SQL/Transaction, JWT hay bài toán thuật toán/kiến trúc thuần túy vốn thuộc Vòng 1.
                2. KHÔNG dùng các cụm từ sáo rỗng hoặc thuật ngữ lý thuyết phỏng vấn như "theo phương pháp STAR", "mô hình STAR", "STAR method" trong câu hỏi — hãy hỏi tự nhiên như Giám đốc/Trưởng phòng đang đối thoại trực tiếp với ứng viên.
                3. Cá nhân hóa sát với cấp bậc, kinh nghiệm trong CV và nhận xét Vòng 1 của ứng viên.
                4. Viết tiếng Việt tự nhiên, ngắn gọn, súc tích, dễ trao đổi trực tiếp.

                Chỉ trả về danh sách 8 câu hỏi, mỗi câu trên một dòng, bắt đầu bằng số thứ tự (ví dụ: "1. Câu hỏi...").
                Không giải thích, không thêm tiêu đề hay phân nhóm, chỉ trả về đúng 8 dòng câu hỏi.
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
