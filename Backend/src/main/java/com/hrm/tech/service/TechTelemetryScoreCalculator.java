package com.hrm.tech.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.payroll.entity.Holiday;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.tech.dto.TechTelemetryBreakdownResponse;
import com.hrm.tech.dto.TechWorklogResponse;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechTelemetryScoreCalculator {

    private static final double HOURS_PER_WORKDAY = 8.0;
    private static final Set<WorklogType> CORE_ENGINEERING_TYPES = EnumSet.of(
            WorklogType.ARCHITECTURE,
            WorklogType.CODE_REVIEW,
            WorklogType.DEPLOYMENT,
            WorklogType.DEVELOPMENT,
            WorklogType.TESTING_QA
    );
    private static final Set<WorklogType> RD_VALUE_TYPES = EnumSet.of(
            WorklogType.DEVELOPMENT,
            WorklogType.ARCHITECTURE,
            WorklogType.DEPLOYMENT
    );
    private static final Map<ProficiencyLevel, Integer> LEVEL_WEIGHTS = Map.of(
            ProficiencyLevel.FRESHER, 1,
            ProficiencyLevel.JUNIOR, 2,
            ProficiencyLevel.MIDDLE, 3,
            ProficiencyLevel.SENIOR, 4,
            ProficiencyLevel.EXPERT, 5
    );
    private static final Set<RequestType> EXCUSED_ABSENCE_TYPES = EnumSet.of(
            RequestType.NORMAL_LEAVE,
            RequestType.HALF_DAY_LEAVE,
            RequestType.SPECIAL_WFH_LEAVE,
            RequestType.UNPAID_LEAVE
    );

    private final TechProjectMemberRepository memberRepository;
    private final TechProjectMilestoneRepository milestoneRepository;
    private final TechWorklogRepository worklogRepository;
    private final TechWorklogService techWorklogService;
    private final UserTechSkillRepository userSkillRepository;
    private final UserTechCertificateRepository certificateRepository;
    private final AttendanceRepository attendanceRepository;
    private final EmployeeRequestRepository employeeRequestRepository;
    private final HolidayRepository holidayRepository;

    public TechTelemetryBreakdownResponse calculateTelemetry(
            Long employeeId,
            LocalDate periodStart,
            LocalDate periodEnd) {

        LocalDate today = LocalDate.now();
        LocalDate start = periodStart != null ? periodStart : today.withDayOfMonth(1);
        LocalDate end = periodEnd != null ? periodEnd : today;
        if (end.isBefore(start)) {
            LocalDate tmp = start;
            start = end;
            end = tmp;
        }

        // 1. Working days & standard period hours
        Set<LocalDate> holidays = Optional.ofNullable(holidayRepository.findByNgayLeBetween(start, end))
                .orElse(Collections.emptyList())
                .stream()
                .map(Holiday::getNgayLe)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        int workingDays = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            DayOfWeek dow = d.getDayOfWeek();
            if (dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY && !holidays.contains(d)) {
                workingDays++;
            }
        }
        int effectiveWorkingDays = Math.max(1, workingDays);
        double standardPeriodHours = round2(effectiveWorkingDays * HOURS_PER_WORKDAY);

        // 2. Active memberships & approved worklogs in range
        List<TechProjectMember> activeMemberships = Optional.ofNullable(
                memberRepository.findActiveMembershipsWithProject(employeeId)
        ).orElse(Collections.emptyList());

        int activeAllocationPercent = activeMemberships.stream()
                .mapToInt(m -> m.getAllocationPercent() != null ? Math.max(0, m.getAllocationPercent()) : 0)
                .sum();
        double expectedHours = round2((activeAllocationPercent / 100.0) * standardPeriodHours);
        boolean isBench = activeAllocationPercent <= 0 || expectedHours <= 0.0;

        List<TechWorklog> approvedWorklogs = Optional.ofNullable(
                worklogRepository.findMyWorklogsWithFilters(employeeId, null, WorklogApprovalStatus.APPROVED, start, end)
        ).orElse(Collections.emptyList());

        double approvedHours = round2(approvedWorklogs.stream()
                .filter(w -> w.getHoursSpent() != null)
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum());

        // Pillar 1A: Coverage score (max 15.0)
        double coverageScore;
        String coverageLabel;
        if (!isBench) {
            coverageScore = Math.min(15.0, (approvedHours / expectedHours) * 15.0);
            coverageLabel = String.format(Locale.US, "%.1fh / %.1fh kỳ vọng (%d%% tải)",
                    approvedHours, expectedHours, activeAllocationPercent);
        } else {
            if (approvedHours > 0) {
                double benchBonus = Math.min(7.5, (approvedHours / Math.max(8.0, standardPeriodHours * 0.5)) * 7.5);
                coverageScore = Math.min(15.0, 7.5 + benchBonus);
                coverageLabel = String.format(Locale.US, "Đang ở Bench — ghi nhận %.1fh nội bộ/đào tạo", approvedHours);
            } else {
                coverageScore = 7.5;
                coverageLabel = "Đang ở Bench — không có định mức dự án (mức cơ sở 7.5/15đ)";
            }
        }
        coverageScore = round2(coverageScore);

        // Pillar 1B: Clean Audit Rate (max 10.0)
        int totalApprovedWorklogs = approvedWorklogs.size();
        int cleanAuditWorklogs = 0;
        if (totalApprovedWorklogs > 0) {
            List<TechWorklogResponse> enriched = techWorklogService != null
                    ? techWorklogService.enrichWorklogsWithAudit(approvedWorklogs)
                    : Collections.emptyList();
            if (enriched.size() == totalApprovedWorklogs) {
                cleanAuditWorklogs = (int) enriched.stream()
                        .filter(w -> !Boolean.TRUE.equals(w.getHasAuditWarning()))
                        .count();
            } else {
                cleanAuditWorklogs = (int) approvedWorklogs.stream()
                        .filter(w -> {
                            boolean reqRef = w.getWorkType() == WorklogType.DEVELOPMENT || w.getWorkType() == WorklogType.BUG_FIX;
                            double hrs = w.getHoursSpent() != null ? w.getHoursSpent().doubleValue() : 0.0;
                            boolean hasRef = w.getReferenceUrl() != null && !w.getReferenceUrl().isBlank();
                            return !(reqRef && hrs >= 2.0 && !hasRef);
                        })
                        .count();
            }
        }
        double cleanAuditRatePercent = totalApprovedWorklogs > 0
                ? round2((cleanAuditWorklogs * 100.0) / totalApprovedWorklogs)
                : 0.0;
        double auditScore = round2(((double) cleanAuditWorklogs / Math.max(1, totalApprovedWorklogs)) * 10.0);

        // Pillar 1C: On-time Milestones (max 10.0)
        Set<Long> projectIds = new LinkedHashSet<>();
        Map<Long, String> projectLabelById = new LinkedHashMap<>();
        for (TechProjectMember m : activeMemberships) {
            if (m.getProject() != null && m.getProject().getId() != null) {
                projectIds.add(m.getProject().getId());
                projectLabelById.putIfAbsent(m.getProject().getId(),
                        "[" + m.getProject().getProjectCode() + "] " + m.getProject().getProjectName()
                                + " (" + (m.getProjectRole() != null ? m.getProjectRole().name() : "MEMBER")
                                + ", " + m.getAllocationPercent() + "%)");
            }
        }
        for (TechWorklog w : approvedWorklogs) {
            if (w.getProject() != null && w.getProject().getId() != null) {
                projectIds.add(w.getProject().getId());
                projectLabelById.putIfAbsent(w.getProject().getId(),
                        "[" + w.getProject().getProjectCode() + "] " + w.getProject().getProjectName());
            }
        }

        int dueMilestonesCount = 0;
        int onTimeMilestonesCount = 0;
        for (Long pid : projectIds) {
            List<TechProjectMilestone> milestones = Optional.ofNullable(
                    milestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(pid)
            ).orElse(Collections.emptyList());
            for (TechProjectMilestone ms : milestones) {
                if (ms.getDueDate() == null) continue;
                boolean inPeriod = !ms.getDueDate().isBefore(start) && !ms.getDueDate().isAfter(end);
                if (!inPeriod) continue;
                boolean isDueOrCompleted = ms.getStatus() == MilestoneStatus.COMPLETED || !ms.getDueDate().isAfter(today);
                if (!isDueOrCompleted) continue;

                dueMilestonesCount++;
                boolean onTime;
                if (ms.getStatus() == MilestoneStatus.COMPLETED) {
                    onTime = ms.getCompletedAt() == null || !ms.getCompletedAt().toLocalDate().isAfter(ms.getDueDate());
                } else {
                    onTime = !TechMilestoneService.isMilestoneOverdue(ms, today);
                }
                if (onTime) {
                    onTimeMilestonesCount++;
                }
            }
        }
        double milestoneScore = dueMilestonesCount == 0
                ? 8.0
                : round2(((double) onTimeMilestonesCount / dueMilestonesCount) * 10.0);

        double deliveryScore = round2(Math.min(35.0, coverageScore + auditScore + milestoneScore));

        // Pillar 2: Technical Impact & Value (max 25.0)
        double coreHours = round2(approvedWorklogs.stream()
                .filter(w -> CORE_ENGINEERING_TYPES.contains(w.getWorkType()) && w.getHoursSpent() != null)
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum());
        double coreWorkRatioPercent = approvedHours > 0 ? round2((coreHours * 100.0) / approvedHours) : 0.0;
        boolean isTechLead = activeMemberships.stream()
                .anyMatch(m -> m.getProjectRole() == ProjectRole.TECH_LEAD);
        boolean leadBonusApplied = isTechLead && approvedHours > 0;
        double coreEngScore = approvedHours > 0
                ? round2(Math.min(15.0, ((coreHours / approvedHours) * 15.0) + (leadBonusApplied ? 3.0 : 0.0)))
                : 0.0;

        boolean hasClientProjects = activeMemberships.stream()
                .anyMatch(m -> m.getProject() != null && m.getProject().getProjectType() == ProjectType.CLIENT)
                || approvedWorklogs.stream()
                .anyMatch(w -> w.getProject() != null && w.getProject().getProjectType() == ProjectType.CLIENT);

        double clientApprovedHours = round2(approvedWorklogs.stream()
                .filter(w -> w.getProject() != null && w.getProject().getProjectType() == ProjectType.CLIENT && w.getHoursSpent() != null)
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum());
        double clientBillableHours = round2(approvedWorklogs.stream()
                .filter(w -> w.getProject() != null && w.getProject().getProjectType() == ProjectType.CLIENT
                        && Boolean.TRUE.equals(w.getIsBillable()) && w.getHoursSpent() != null)
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum());
        double rdImpactHours = round2(approvedWorklogs.stream()
                .filter(w -> RD_VALUE_TYPES.contains(w.getWorkType()) && w.getHoursSpent() != null)
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum());

        double valueEfficiencyScore;
        String impactMethodLabel;
        if (hasClientProjects && clientApprovedHours > 0) {
            valueEfficiencyScore = round2(Math.min(10.0, (clientBillableHours / clientApprovedHours) * 10.0));
            impactMethodLabel = String.format(Locale.US, "Dự án Client: %.1fh / %.1fh Billable", clientBillableHours, clientApprovedHours);
        } else if (!hasClientProjects) {
            valueEfficiencyScore = approvedHours > 0
                    ? round2(Math.min(10.0, (rdImpactHours / approvedHours) * 10.0))
                    : 0.0;
            impactMethodLabel = String.format(Locale.US, "R&D Nội bộ: %.1fh / %.1fh giá trị lõi", rdImpactHours, approvedHours);
        } else {
            // Có gán dự án CLIENT nhưng kỳ này mới log trên nội bộ
            valueEfficiencyScore = approvedHours > 0
                    ? round2(Math.min(10.0, (rdImpactHours / approvedHours) * 10.0))
                    : 0.0;
            impactMethodLabel = String.format(Locale.US, "Hỗn hợp (chưa phát sinh giờ Client): %.1fh / %.1fh", rdImpactHours, approvedHours);
        }

        double impactScore = round2(Math.min(25.0, coreEngScore + valueEfficiencyScore));

        // Pillar 3: Capability & Certificates (max 20.0)
        List<UserTechSkill> skills = Optional.ofNullable(userSkillRepository.findByUserId(employeeId))
                .orElse(Collections.emptyList());
        int totalSkillsCount = skills.size();
        List<UserTechSkill> verifiedSkills = skills.stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsVerified()))
                .collect(Collectors.toList());
        int verifiedSkillsCount = verifiedSkills.size();

        double skillScore = 0.0;
        if (totalSkillsCount > 0 && verifiedSkillsCount > 0) {
            double verifiedRatioScore = ((double) verifiedSkillsCount / totalSkillsCount) * 6.0;
            int top3VerifiedWeightSum = verifiedSkills.stream()
                    .mapToInt(s -> LEVEL_WEIGHTS.getOrDefault(s.getProficiencyLevel(), 1))
                    .boxed()
                    .sorted(Comparator.reverseOrder())
                    .limit(3)
                    .mapToInt(Integer::intValue)
                    .sum();
            double depthScore = Math.min(6.0, top3VerifiedWeightSum * 0.6);
            skillScore = round2(Math.min(12.0, verifiedRatioScore + depthScore));
        }

        List<UserTechCertificate> certs = Optional.ofNullable(
                certificateRepository.findByUserIdOrderByIssueDateDesc(employeeId)
        ).orElse(Collections.emptyList());
        int validCertCount = 0;
        int expiringSoonCertCount = 0;
        int expiredCertCount = 0;
        for (UserTechCertificate cert : certs) {
            LocalDate exp = cert.getExpiryDate();
            if (exp == null) {
                validCertCount++;
            } else {
                long daysLeft = ChronoUnit.DAYS.between(today, exp);
                if (daysLeft < 0) {
                    expiredCertCount++;
                } else if (daysLeft <= 30) {
                    expiringSoonCertCount++;
                } else {
                    validCertCount++;
                }
            }
        }

        double certScore;
        String certStatusLabel;
        if (expiredCertCount > 0) {
            certScore = 2.0;
            certStatusLabel = "Có " + expiredCertCount + " chứng chỉ đã hết hạn chưa cập nhật";
        } else if (expiringSoonCertCount > 0) {
            certScore = 6.0;
            certStatusLabel = "Có " + expiringSoonCertCount + " chứng chỉ sắp hết hạn (<= 30 ngày)";
        } else if (validCertCount > 0) {
            certScore = 8.0;
            certStatusLabel = validCertCount + " chứng chỉ quốc tế còn hiệu lực";
        } else if (verifiedSkillsCount >= 3) {
            certScore = 5.0;
            certStatusLabel = "Chưa có chứng chỉ (hưởng 5đ cơ bản do >= 3 kỹ năng tích xanh)";
        } else {
            certScore = 0.0;
            certStatusLabel = "Chưa khai báo chứng chỉ quốc tế";
        }

        double capabilityScore = round2(Math.min(20.0, skillScore + certScore));

        // Pillar 4: Discipline & Attendance (max 20.0)
        List<Attendance> attendances = Optional.ofNullable(
                attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, start, end)
        ).orElse(Collections.emptyList());

        List<EmployeeRequest> approvedRequests = Optional.ofNullable(
                employeeRequestRepository.findApprovedRequestsForMonth(employeeId, start, end)
        ).orElse(Collections.emptyList());

        Set<LocalDate> excusedDates = new HashSet<>();
        for (EmployeeRequest req : approvedRequests) {
            if (req.getRequestType() == null || !EXCUSED_ABSENCE_TYPES.contains(req.getRequestType())) {
                continue;
            }
            if (req.getStartDate() == null || req.getEndDate() == null) continue;
            LocalDate rs = req.getStartDate().isBefore(start) ? start : req.getStartDate();
            LocalDate re = req.getEndDate().isAfter(end) ? end : req.getEndDate();
            for (LocalDate d = rs; !d.isAfter(re); d = d.plusDays(1)) {
                excusedDates.add(d);
            }
        }

        int lateCount = 0;
        int unexcusedAbsentCount = 0;
        for (Attendance att : attendances) {
            if (att.getDate() == null) continue;
            boolean hasApprovedException = "APPROVED".equalsIgnoreCase(att.getExceptionStatus());
            boolean isExcusedDay = hasApprovedException || excusedDates.contains(att.getDate());
            String st = att.getStatus() != null ? att.getStatus().trim().toUpperCase(Locale.ROOT) : "";

            if ("LATE".equals(st) && !isExcusedDay) {
                lateCount++;
            } else if ("ABSENT".equals(st)) {
                if (isExcusedDay) {
                    excusedDates.add(att.getDate());
                } else {
                    unexcusedAbsentCount++;
                }
            }
        }

        long monthsInPeriod = Math.max(1L, ChronoUnit.MONTHS.between(YearMonth.from(start), YearMonth.from(end)) + 1L);
        int freeLateQuota = (int) monthsInPeriod;
        int penalizedLateCount = Math.max(0, lateCount - freeLateQuota);
        double disciplineScore = round2(Math.max(0.0, 20.0 - (penalizedLateCount * 1.0) - (unexcusedAbsentCount * 3.0)));

        double telemetryTotalScore = round2(Math.min(100.0, deliveryScore + impactScore + capabilityScore + disciplineScore));

        return TechTelemetryBreakdownResponse.builder()
                .deliveryScore(deliveryScore)
                .impactScore(impactScore)
                .capabilityScore(capabilityScore)
                .disciplineScore(disciplineScore)
                .telemetryTotalScore(telemetryTotalScore)
                .workingDaysInPeriod(effectiveWorkingDays)
                .standardPeriodHours(standardPeriodHours)
                .activeAllocationPercent(activeAllocationPercent)
                .expectedHours(expectedHours)
                .approvedHours(approvedHours)
                .isBench(isBench)
                .coverageScore(coverageScore)
                .coverageLabel(coverageLabel)
                .totalApprovedWorklogs(totalApprovedWorklogs)
                .cleanAuditWorklogs(cleanAuditWorklogs)
                .cleanAuditRatePercent(cleanAuditRatePercent)
                .auditScore(auditScore)
                .dueMilestonesCount(dueMilestonesCount)
                .onTimeMilestonesCount(onTimeMilestonesCount)
                .milestoneScore(milestoneScore)
                .coreHours(coreHours)
                .coreWorkRatioPercent(coreWorkRatioPercent)
                .isTechLead(isTechLead)
                .leadBonusApplied(leadBonusApplied)
                .coreEngScore(coreEngScore)
                .hasClientProjects(hasClientProjects)
                .clientApprovedHours(clientApprovedHours)
                .clientBillableHours(clientBillableHours)
                .rdImpactHours(rdImpactHours)
                .valueEfficiencyScore(valueEfficiencyScore)
                .impactMethodLabel(impactMethodLabel)
                .totalSkillsCount(totalSkillsCount)
                .verifiedSkillsCount(verifiedSkillsCount)
                .skillScore(skillScore)
                .validCertCount(validCertCount)
                .expiringSoonCertCount(expiringSoonCertCount)
                .expiredCertCount(expiredCertCount)
                .certScore(certScore)
                .certStatusLabel(certStatusLabel)
                .lateCount(lateCount)
                .freeLateQuota(freeLateQuota)
                .penalizedLateCount(penalizedLateCount)
                .unexcusedAbsentCount(unexcusedAbsentCount)
                .excusedLeaveOrWfhDays(excusedDates.size())
                .projectHighlights(new ArrayList<>(projectLabelById.values()))
                .build();
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
