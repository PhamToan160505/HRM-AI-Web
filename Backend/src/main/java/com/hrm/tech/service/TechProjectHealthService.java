package com.hrm.tech.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.ai.service.GeminiClientService;
import com.hrm.tech.dto.ProjectHealthBriefResponse;
import com.hrm.tech.dto.ProjectMilestonesSummaryResponse;
import com.hrm.tech.dto.TechMilestoneResponse;
import com.hrm.tech.dto.TechProjectMemberResponse;
import com.hrm.tech.dto.TechProjectResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechProjectHealthService {

    private final TechProjectService techProjectService;
    private final TechMilestoneService techMilestoneService;
    private final GeminiClientService geminiClientService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ProjectHealthBriefResponse generateHealthBrief(Long projectId) {
        TechProjectResponse project = techProjectService.getProjectById(projectId);
        ProjectMilestonesSummaryResponse milestoneSummary = techMilestoneService.getProjectMilestones(projectId);

        LocalDate today = LocalDate.now();
        int elapsedPercent = computeElapsedPercent(project, today);
        Integer actualProgress = milestoneSummary.getActualProgressPercent();

        List<TechProjectMemberResponse> activeMembers = (project.getMembers() != null ? project.getMembers() : List.<TechProjectMemberResponse>of())
                .stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .collect(Collectors.toList());

        long overloadedCount = activeMembers.stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsOverloaded()) || (m.getTotalCurrentAllocation() != null && m.getTotalCurrentAllocation() > 100))
                .count();

        double fteAllocated = (project.getTotalAllocationSum() != null ? project.getTotalAllocationSum() : 0) / 100.0;
        double plannedMonthlyHours = fteAllocated * 176.0;
        double approvedHours = project.getTotalApprovedHours() != null ? project.getTotalApprovedHours() : 0.0;
        double pendingHours = project.getTotalPendingHours() != null ? project.getTotalPendingHours() : 0.0;

        String milestoneDetails = milestoneSummary.getMilestones().isEmpty()
                ? "Chưa thiết lập mốc tiến độ."
                : milestoneSummary.getMilestones().stream()
                        .map(m -> "- " + m.getTitle() + " (trọng số " + m.getWeightPercent() + "%, hoàn thành "
                                + m.getCompletionPercent() + "%, hạn " + m.getDueDate() + ", trạng thái "
                                + m.getStatus() + (Boolean.TRUE.equals(m.getIsOverdue()) ? " [QUÁ HẠN]" : "") + ")")
                        .collect(Collectors.joining("\n"));

        String prompt = """
                Bạn là Giám đốc Kỹ thuật (CTO Advisor). Hãy phân tích sức khỏe dự án phần mềm dưới đây dựa hoàn toàn vào số liệu thực tế (tiếng Việt, chuyên nghiệp, súc tích, không bịa đặt số liệu):

                - Mã & Tên dự án: %s - %s (%s, trạng thái %s)
                - Lịch trình: %s -> %s (độ phủ thời gian lịch: %d%%)
                - Tiến độ nghiệm thu Milestone thực tế: %s (%d/%d mốc hoàn thành, %d mốc quá hạn, %d mốc sắp đến hạn)
                - Chi tiết Milestones:
                %s
                - Đội ngũ: %d kỹ sư active (~%.1f FTE, định mức ~%.0fh/tháng), Tech Lead: %s, số kỹ sư quá tải (>100%% trên toàn phòng): %d
                - Giờ công thực tế ghi nhận: %.1fh đã duyệt, %.1fh đang chờ duyệt.

                Trả về DUY NHẤT một JSON object hợp lệ (không thêm markdown hay văn bản ngoài JSON) đúng schema sau:
                {
                  "healthTone": "HEALTHY | WARNING | CRITICAL",
                  "healthLabel": "Nhãn ngắn 2-4 chữ",
                  "headline": "1 câu kết luận điều hành ngắn gọn",
                  "scheduleAssessment": "2-3 câu đánh giá độ lệch giữa lịch trình thời gian và tiến độ Milestone thực tế",
                  "capacityAssessment": "2-3 câu đánh giá công suất FTE, tình trạng quá tải kỹ sư và nhịp độ ghi giờ công",
                  "recommendations": ["Khuyến nghị hành động cụ thể 1", "Khuyến nghị 2", "Khuyến nghị 3"]
                }
                """.formatted(
                project.getProjectCode(),
                project.getProjectName(),
                project.getProjectType(),
                project.getStatus(),
                project.getStartDate(),
                project.getEndDate(),
                elapsedPercent,
                actualProgress != null ? actualProgress + "%" : "Chưa có mốc tiến độ",
                milestoneSummary.getCompletedCount(),
                milestoneSummary.getTotalCount(),
                milestoneSummary.getOverdueCount(),
                milestoneSummary.getDueSoonCount(),
                milestoneDetails,
                activeMembers.size(),
                fteAllocated,
                plannedMonthlyHours,
                project.getTechLeadName(),
                overloadedCount,
                approvedHours,
                pendingHours
        );

        try {
            if (geminiClientService != null) {
                String raw = geminiClientService.callGemini(prompt, 18, 0).block();
                String text = geminiClientService.extractTextFromGeminiResponse(raw);
                ProjectHealthBriefResponse aiBrief = parseAiJson(text, project);
                if (aiBrief != null) {
                    return aiBrief;
                }
            }
        } catch (Exception e) {
            log.warn("[Tech AI] Gemini fallback sang Java Rule Engine cho dự án {}: {}", project.getProjectCode(), e.getMessage());
        }

        return buildDeterministicFallback(project, milestoneSummary, elapsedPercent, activeMembers.size(), overloadedCount, approvedHours, pendingHours);
    }

    private ProjectHealthBriefResponse parseAiJson(String rawText, TechProjectResponse project) {
        if (rawText == null || rawText.trim().isEmpty()) return null;
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
            String tone = root.path("healthTone").asText("WARNING").toUpperCase();
            if (!List.of("HEALTHY", "WARNING", "CRITICAL").contains(tone)) {
                tone = "WARNING";
            }

            List<String> recs = new ArrayList<>();
            if (root.has("recommendations") && root.get("recommendations").isArray()) {
                for (JsonNode n : root.get("recommendations")) {
                    if (!n.asText("").isBlank()) {
                        recs.add(n.asText().trim());
                    }
                }
            }
            if (recs.isEmpty()) {
                return null;
            }

            return ProjectHealthBriefResponse.builder()
                    .projectId(project.getId())
                    .projectCode(project.getProjectCode())
                    .projectName(project.getProjectName())
                    .healthTone(tone)
                    .healthLabel(root.path("healthLabel").asText("Phân tích AI"))
                    .headline(root.path("headline").asText(""))
                    .scheduleAssessment(root.path("scheduleAssessment").asText(""))
                    .capacityAssessment(root.path("capacityAssessment").asText(""))
                    .recommendations(recs)
                    .generatedByAi(true)
                    .generatedAt(LocalDateTime.now())
                    .build();
        } catch (Exception e) {
            log.warn("[Tech AI] Không parse được JSON Gemini: {}", e.getMessage());
            return null;
        }
    }

    private ProjectHealthBriefResponse buildDeterministicFallback(
            TechProjectResponse project,
            ProjectMilestonesSummaryResponse ms,
            int elapsedPercent,
            int activeCount,
            long overloadedCount,
            double approvedHours,
            double pendingHours) {

        int overdue = ms.getOverdueCount() != null ? ms.getOverdueCount() : 0;
        int dueSoon = ms.getDueSoonCount() != null ? ms.getDueSoonCount() : 0;
        Integer actual = ms.getActualProgressPercent();
        boolean missingLead = project.getTechLeadName() == null || project.getTechLeadName().equalsIgnoreCase("Chưa chỉ định");
        boolean isProjectOverdue = project.getEndDate() != null
                && project.getEndDate().isBefore(LocalDate.now())
                && !"COMPLETED".equals(String.valueOf(project.getStatus()));

        String tone = "HEALTHY";
        String label = "Ổn định";
        if (isProjectOverdue || overdue >= 2 || (overdue >= 1 && overloadedCount > 0)) {
            tone = "CRITICAL";
            label = "Cần can thiệp ngay";
        } else if (overdue > 0 || dueSoon > 0 || overloadedCount > 0 || missingLead || actual == null
                || (elapsedPercent - actual >= 20)) {
            tone = "WARNING";
            label = "Cần theo dõi sát";
        }

        String headline = switch (tone) {
            case "CRITICAL" -> "Dự án " + project.getProjectCode() + " đang gặp áp lực tiến độ và cần điều phối xử lý điểm nghẽn.";
            case "WARNING" -> "Dự án " + project.getProjectCode() + " đang vận hành ở mức trung bình, có dấu hiệu cần cân đối nguồn lực hoặc mốc bàn giao.";
            default -> "Dự án " + project.getProjectCode() + " đang bám sát kế hoạch với nguồn lực ổn định.";
        };

        String scheduleText;
        if (actual == null) {
            scheduleText = "Dự án hiện đạt độ phủ thời gian lịch " + elapsedPercent
                    + "%, tuy nhiên chưa thiết lập các mốc bàn giao (Milestones) để nghiệm thu khối lượng kỹ thuật thực chất.";
        } else {
            int gap = elapsedPercent - actual;
            scheduleText = "Tiến độ nghiệm thu Milestone thực tế đạt " + actual + "% ("
                    + ms.getCompletedCount() + "/" + ms.getTotalCount() + " mốc hoàn thành) so với " + elapsedPercent
                    + "% thời gian lịch đã trôi qua. "
                    + (overdue > 0
                        ? "Hiện có " + overdue + " mốc đang quá hạn cần đẩy nhanh nghiệm thu."
                        : gap >= 20
                            ? "Tốc độ bàn giao thực tế đang chậm hơn chu kỳ thời gian khoảng " + gap + "%."
                            : "Nhịp độ nghiệm thu hiện khớp tốt với kế hoạch đề ra.");
        }

        double fte = (project.getTotalAllocationSum() != null ? project.getTotalAllocationSum() : 0) / 100.0;
        String capacityText = String.format(
                "Đội ngũ hiện có %d kỹ sư đang tham gia (~%.1f FTE). Đã ghi nhận %.1fh giờ công được duyệt và %.1fh chờ thẩm định. %s",
                activeCount,
                fte,
                approvedHours,
                pendingHours,
                overloadedCount > 0
                        ? "Cảnh báo có " + overloadedCount + " kỹ sư đang vượt ngưỡng 100% tải công suất trên toàn phòng."
                        : "Tải phân bổ các thành viên đang cân đối dưới ngưỡng tối đa."
        );

        List<String> recs = new ArrayList<>();
        if (ms.getTotalCount() == 0) {
            recs.add("Thiết lập ngay 3-5 Milestone trọng yếu kèm trọng số phần trăm để đo lường tiến độ thực chất.");
        }
        if (overdue > 0) {
            recs.add("Rà soát " + overdue + " mốc đang quá hạn và làm rõ các vướng mắc kỹ thuật với Tech Lead trong buổi stand-up kế tiếp.");
        }
        if (overloadedCount > 0) {
            recs.add("Giảm tải hoặc bổ sung nhân sự từ ghế chờ (Bench) cho " + overloadedCount + " kỹ sư đang vượt >100% tải để tránh giảm chất lượng code.");
        }
        if (missingLead) {
            recs.add("Bổ nhiệm chính thức một Tech Lead chịu trách nhiệm kiến trúc và review chất lượng kỹ thuật cho dự án.");
        }
        if (pendingHours > 0) {
            recs.add("Trưởng phòng cần thẩm định sớm " + String.format("%.1fh", pendingHours) + " giờ công đang chờ duyệt để phản ánh đúng burn-rate.");
        }
        if (recs.isEmpty()) {
            recs.add("Duy trì nhịp độ review Milestone định kỳ và tiếp tục ghi nhận Worklog hằng ngày để theo dõi hiệu suất FTE.");
            recs.add("Chuẩn hóa tài liệu nghiệm thu và liên kết Git/Jira trên các mốc sắp hoàn thành.");
        }

        return ProjectHealthBriefResponse.builder()
                .projectId(project.getId())
                .projectCode(project.getProjectCode())
                .projectName(project.getProjectName())
                .healthTone(tone)
                .healthLabel(label)
                .headline(headline)
                .scheduleAssessment(scheduleText)
                .capacityAssessment(capacityText)
                .recommendations(recs.stream().limit(4).collect(Collectors.toList()))
                .generatedByAi(false)
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private int computeElapsedPercent(TechProjectResponse p, LocalDate today) {
        if ("COMPLETED".equals(String.valueOf(p.getStatus()))) return 100;
        if (p.getStartDate() == null || p.getEndDate() == null) return 0;
        long totalDays = ChronoUnit.DAYS.between(p.getStartDate(), p.getEndDate());
        if (totalDays <= 0) return !today.isBefore(p.getEndDate()) ? 100 : 0;
        long elapsedDays = ChronoUnit.DAYS.between(p.getStartDate(), today);
        return (int) Math.max(0, Math.min(100, Math.round((elapsedDays * 100.0) / totalDays)));
    }
}

