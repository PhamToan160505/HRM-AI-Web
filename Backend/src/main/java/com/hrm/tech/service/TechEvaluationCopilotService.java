package com.hrm.tech.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.ai.service.GeminiClientService;
import com.hrm.common.entity.User;
import com.hrm.tech.dto.TechAiCopilotResponse;
import com.hrm.tech.dto.TechTelemetryBreakdownResponse;
import com.hrm.tech.entity.TechPerformanceReview;
import com.hrm.tech.entity.TechSkillPromotionItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechEvaluationCopilotService {

    private final GeminiClientService geminiClientService;
    private final ObjectMapper objectMapper;

    public TechAiCopilotResponse generateReviewSummary(
            TechPerformanceReview review,
            User employee,
            TechTelemetryBreakdownResponse breakdown,
            List<TechSkillPromotionItem> promoItems) {

        String employeeName = employee != null ? employee.getHoTen() : "Kỹ sư";
        String chucVu = employee != null && employee.getChucVu() != null ? employee.getChucVu() : "Kỹ sư Công nghệ";
        String skillPromoText = (promoItems == null || promoItems.isEmpty())
                ? "Không có đề xuất nâng bậc kỹ năng trong kỳ này."
                : promoItems.stream()
                        .map(item -> "- " + item.getSkill().getSkillName() + ": "
                                + (item.getFromLevel() != null ? item.getFromLevel().name() : "MỚI")
                                + " -> " + item.getTargetLevel().name()
                                + " (Minh chứng: " + item.getEvidenceNote() + ")")
                        .collect(Collectors.joining("\n"));

        String projectsText = breakdown.getProjectHighlights() == null || breakdown.getProjectHighlights().isEmpty()
                ? "Chưa tham gia dự án hoạt động (Bench)"
                : String.join("; ", breakdown.getProjectHighlights());

        String prompt = """
                Bạn là Engineering Director Copilot chuyên đánh giá hiệu suất kỹ sư phần mềm (bằng tiếng Việt chuyên nghiệp, khách quan, súc tích, chỉ bám sát dữ liệu thực tế dưới đây):

                - Nhân sự: %s (%s), kỳ đánh giá: %s (%s -> %s)
                - Dự án tham gia: %s
                - Điểm Telemetry định lượng: %.1f/100
                  + Giao hàng & Độ tin cậy (Delivery): %.1f/35 (Giờ duyệt %.1fh / Kỳ vọng %.1fh, Clean Audit %.1f%%, Milestone đúng hạn %d/%d)
                  + Tác động Kỹ thuật (Impact): %.1f/25 (Tỷ trọng công việc kỹ thuật lõi %.1f%%, %s)
                  + Năng lực & Chứng chỉ (Capability): %.1f/20 (%d/%d kỹ năng tích xanh, %s)
                  + Kỷ luật chấm công (Discipline): %.1f/20 (Đi muộn %d lần, vắng không phép %d ngày)
                - Tự đánh giá (Self-Review): %s
                - Thành tựu nổi bật tự nêu: %s
                - Đề xuất nâng bậc kỹ năng:
                %s

                Hãy trả về DUY NHẤT một JSON object hợp lệ (không markdown, không văn bản thừa) với đúng 3 trường chuỗi:
                {
                  "strengths": "2-3 câu nêu điểm mạnh nổi bật dựa trên số liệu thật",
                  "growthAreas": "2-3 câu nêu điểm cần cải thiện (nếu có cảnh báo audit, chứng chỉ, kỹ năng chưa xác thực hoặc giờ công)",
                  "roadmap90Days": "2-3 gợi ý lộ trình hành động rõ ràng cho 90 ngày tiếp theo"
                }
                """.formatted(
                employeeName,
                chucVu,
                review.getPeriodLabel(),
                review.getPeriodStart(),
                review.getPeriodEnd(),
                projectsText,
                safeDouble(breakdown.getTelemetryTotalScore()),
                safeDouble(breakdown.getDeliveryScore()),
                safeDouble(breakdown.getApprovedHours()),
                safeDouble(breakdown.getExpectedHours()),
                safeDouble(breakdown.getCleanAuditRatePercent()),
                safeInt(breakdown.getOnTimeMilestonesCount()),
                safeInt(breakdown.getDueMilestonesCount()),
                safeDouble(breakdown.getImpactScore()),
                safeDouble(breakdown.getCoreWorkRatioPercent()),
                breakdown.getImpactMethodLabel() != null ? breakdown.getImpactMethodLabel() : "",
                safeDouble(breakdown.getCapabilityScore()),
                safeInt(breakdown.getVerifiedSkillsCount()),
                safeInt(breakdown.getTotalSkillsCount()),
                breakdown.getCertStatusLabel() != null ? breakdown.getCertStatusLabel() : "",
                safeDouble(breakdown.getDisciplineScore()),
                safeInt(breakdown.getLateCount()),
                safeInt(breakdown.getUnexcusedAbsentCount()),
                review.getSelfSummary() != null ? review.getSelfSummary() : "Kỹ sư chưa nộp tóm tắt tự đánh giá.",
                review.getSelfAchievements() != null ? review.getSelfAchievements() : "Không có ghi chú thêm.",
                skillPromoText
        );

        try {
            if (geminiClientService != null) {
                String raw = geminiClientService.callGemini(prompt, 18, 0).block();
                String text = geminiClientService.extractTextFromGeminiResponse(raw);
                TechAiCopilotResponse parsed = parseAiResponse(review.getId(), text);
                if (parsed != null) {
                    return parsed;
                }
            }
        } catch (Exception e) {
            log.warn("[Tech Copilot] Gemini fallback sang Java Rule Engine cho phiếu #{}: {}", review.getId(), e.getMessage());
        }

        return buildDeterministicFallback(review, employeeName, breakdown, promoItems);
    }

    private TechAiCopilotResponse parseAiResponse(Long reviewId, String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return null;
        }
        try {
            String cleaned = rawText.trim();
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "").trim();
            }
            int firstBrace = cleaned.indexOf('{');
            int lastBrace = cleaned.lastIndexOf('}');
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            }
            JsonNode root = objectMapper.readTree(cleaned);
            String strengths = root.path("strengths").asText("").trim();
            String growthAreas = root.path("growthAreas").asText("").trim();
            String roadmap = root.path("roadmap90Days").asText("").trim();
            if (strengths.isEmpty() || growthAreas.isEmpty() || roadmap.isEmpty()) {
                return null;
            }
            return TechAiCopilotResponse.builder()
                    .reviewId(reviewId)
                    .strengths(strengths)
                    .growthAreas(growthAreas)
                    .roadmap90Days(roadmap)
                    .formattedSummary(formatSummary(strengths, growthAreas, roadmap))
                    .generatedByAi(true)
                    .generatedAt(LocalDateTime.now())
                    .build();
        } catch (Exception e) {
            log.warn("[Tech Copilot] Không parse được JSON Gemini: {}", e.getMessage());
            return null;
        }
    }

    private TechAiCopilotResponse buildDeterministicFallback(
            TechPerformanceReview review,
            String employeeName,
            TechTelemetryBreakdownResponse b,
            List<TechSkillPromotionItem> promoItems) {

        double telemetryTotal = safeDouble(b.getTelemetryTotalScore());
        double delivery = safeDouble(b.getDeliveryScore());
        double impact = safeDouble(b.getImpactScore());
        double discipline = safeDouble(b.getDisciplineScore());

        StringBuilder strengths = new StringBuilder();
        strengths.append(String.format(Locale.US,
                "%s đạt điểm Telemetry %.1f/100 trong kỳ %s. ",
                employeeName, telemetryTotal, review.getPeriodLabel()));
        if (delivery >= 26.0) {
            strengths.append(String.format(Locale.US,
                    "Khối lượng & độ tin cậy giao hàng nổi bật (%.1f/35đ, tỷ lệ Worklog sạch cảnh báo đạt %.0f%%). ",
                    delivery, safeDouble(b.getCleanAuditRatePercent())));
        } else if (safeDouble(b.getApprovedHours()) > 0) {
            strengths.append(String.format(Locale.US,
                    "Đã ghi nhận %.1fh công việc kỹ thuật được thẩm định. ", safeDouble(b.getApprovedHours())));
        }
        if (impact >= 18.0) {
            strengths.append(String.format(Locale.US,
                    "Tỷ trọng đóng góp kỹ thuật cốt lõi đạt %.0f%% (%s)%s. ",
                    safeDouble(b.getCoreWorkRatioPercent()),
                    b.getImpactMethodLabel() != null ? b.getImpactMethodLabel() : "đạt chuẩn",
                    Boolean.TRUE.equals(b.getIsTechLead()) ? ", giữ vai trò Tech Lead dẫn dắt" : ""));
        }
        if (discipline >= 18.0) {
            strengths.append("Kỷ luật chuyên cần & tuân thủ giờ giấc ổn định (" + String.format(Locale.US, "%.1f/20đ", discipline) + ").");
        }

        StringBuilder growth = new StringBuilder();
        if (safeInt(b.getTotalApprovedWorklogs()) > 0 && safeDouble(b.getCleanAuditRatePercent()) < 90.0) {
            growth.append(String.format(Locale.US,
                    "Tỷ lệ Worklog sạch cảnh báo hiện ở mức %.0f%% (%d/%d bản ghi); cần đính kèm đầy đủ link Git PR/Jira và khớp chấm công/WFH trước khi gửi duyệt. ",
                    safeDouble(b.getCleanAuditRatePercent()), safeInt(b.getCleanAuditWorklogs()), safeInt(b.getTotalApprovedWorklogs())));
        }
        if (safeInt(b.getExpiredCertCount()) > 0 || safeInt(b.getExpiringSoonCertCount()) > 0) {
            growth.append("Tình trạng chứng chỉ cần xử lý sớm: " + b.getCertStatusLabel() + ". ");
        } else if (safeInt(b.getTotalSkillsCount()) > safeInt(b.getVerifiedSkillsCount())) {
            int unverified = safeInt(b.getTotalSkillsCount()) - safeInt(b.getVerifiedSkillsCount());
            growth.append("Còn " + unverified + " kỹ năng chưa được cấp tích xanh xác thực trong hồ sơ năng lực. ");
        }
        if (safeInt(b.getPenalizedLateCount()) > 0 || safeInt(b.getUnexcusedAbsentCount()) > 0) {
            growth.append(String.format(Locale.US,
                    "Cần cải thiện kỷ luật chuyên cần (vượt %d lần đi muộn miễn phạt, %d ngày vắng không đơn). ",
                    safeInt(b.getPenalizedLateCount()), safeInt(b.getUnexcusedAbsentCount())));
        }
        if (growth.isEmpty()) {
            growth.append("Các chỉ số vận hành hiện giữ cân bằng; nên tiếp tục mở rộng độ sâu kiến trúc hệ thống và chia sẻ kỹ thuật (code review/mentorship) cho nhóm.");
        }

        StringBuilder roadmap = new StringBuilder();
        if (promoItems != null && !promoItems.isEmpty()) {
            String targetSkills = promoItems.stream()
                    .map(i -> i.getSkill().getSkillName() + " (" + i.getTargetLevel().name() + ")")
                    .collect(Collectors.joining(", "));
            roadmap.append("Hoàn thiện mục tiêu nâng bậc chuyên môn cho kỹ năng " + targetSkills + " gắn với bàn giao dự án thực tế. ");
        } else {
            roadmap.append("Đề xuất 1-2 kỹ năng trọng tâm để nâng bậc chính thức trong kỳ đánh giá tiếp theo. ");
        }
        if (safeInt(b.getExpiredCertCount()) > 0 || safeInt(b.getExpiringSoonCertCount()) > 0 || safeDouble(b.getCertScore()) < 6.0) {
            roadmap.append("Ưu tiên thi mới hoặc gia hạn 01 chứng chỉ chuyên môn quốc tế trong 90 ngày tới. ");
        }
        roadmap.append("Duy trì tỷ lệ Worklog có đầy đủ link PR/Jira đạt 100% và phối hợp review chéo với Tech Lead theo từng Milestone.");

        String s = strengths.toString().trim();
        String g = growth.toString().trim();
        String r = roadmap.toString().trim();
        return TechAiCopilotResponse.builder()
                .reviewId(review.getId())
                .strengths(s)
                .growthAreas(g)
                .roadmap90Days(r)
                .formattedSummary(formatSummary(s, g, r))
                .generatedByAi(false)
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private String formatSummary(String strengths, String growthAreas, String roadmap90Days) {
        return "1. Điểm mạnh kỹ thuật:\n" + strengths
                + "\n\n2. Điểm cần cải thiện:\n" + growthAreas
                + "\n\n3. Lộ trình 90 ngày tới:\n" + roadmap90Days;
    }

    private double safeDouble(Double value) {
        return value != null ? value : 0.0;
    }

    private int safeInt(Integer value) {
        return value != null ? value : 0;
    }
}
