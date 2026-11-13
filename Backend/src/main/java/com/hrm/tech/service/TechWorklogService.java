package com.hrm.tech.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.Holiday;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechWorklogService {

    private static final double STANDARD_HOURS_PER_MONTH = 176.0;
    private static final double HOURS_PER_MAN_DAY = 8.0;
    private static final BigDecimal MAX_DAILY_HOURS = BigDecimal.valueOf(16.0);
    private static final double WFH_STANDARD_DAILY_HOURS = 8.0;
    private static final double HALF_DAY_MAX_HOURS = 4.5;
    private static final double PRESENCE_TOLERANCE_HOURS = 0.5;
    private static final double ALLOCATION_TOLERANCE_HOURS = 0.5;
    private static final double EVIDENCE_REQUIRED_MIN_HOURS = 2.0;
    private static final DateTimeFormatter VN_DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_HM_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final TechWorklogRepository worklogRepository;
    private final TechProjectRepository projectRepository;
    private final TechProjectMemberRepository memberRepository;
    private final TechProjectMilestoneRepository milestoneRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final NotificationService notificationService;
    private final AttendanceRepository attendanceRepository;
    private final EmployeeRequestRepository employeeRequestRepository;
    private final HolidayRepository holidayRepository;

    @Transactional(readOnly = true)
    public MyWorklogSummaryResponse getMyWorklogs(Long currentUserId, String monthStr, Long projectId, WorklogApprovalStatus status) {
        YearMonth ym = parseYearMonthOrDefault(monthStr);
        LocalDate monthStart = ym.atDay(1);
        LocalDate monthEnd = ym.atEndOfMonth();

        List<TechWorklog> allMyLogs = worklogRepository.findMyWorklogsWithFilters(
                currentUserId, projectId, status, null, null);

        List<TechWorklog> monthLogs = allMyLogs.stream()
                .filter(w -> !w.getWorkDate().isBefore(monthStart) && !w.getWorkDate().isAfter(monthEnd))
                .collect(Collectors.toList());

        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);

        double totalApproved = sumHours(allMyLogs, WorklogApprovalStatus.APPROVED);
        double totalPending = sumHours(allMyLogs, WorklogApprovalStatus.PENDING);
        double totalRejected = sumHours(allMyLogs, WorklogApprovalStatus.REJECTED);
        double monthApproved = sumHours(monthLogs, WorklogApprovalStatus.APPROVED);
        double monthPending = sumHours(monthLogs, WorklogApprovalStatus.PENDING);

        double weekHours = allMyLogs.stream()
                .filter(w -> w.getApprovalStatus() != WorklogApprovalStatus.REJECTED)
                .filter(w -> !w.getWorkDate().isBefore(weekStart) && !w.getWorkDate().isAfter(weekEnd))
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum();

        double billableApproved = monthLogs.stream()
                .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.APPROVED && Boolean.TRUE.equals(w.getIsBillable()))
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum();

        int billablePct = monthApproved > 0 ? (int) Math.round((billableApproved / monthApproved) * 100.0) : 0;

        return MyWorklogSummaryResponse.builder()
                .month(ym.toString())
                .totalApprovedHours(round2(totalApproved))
                .totalPendingHours(round2(totalPending))
                .totalRejectedHours(round2(totalRejected))
                .currentMonthApprovedHours(round2(monthApproved))
                .currentMonthPendingHours(round2(monthPending))
                .currentWeekHours(round2(weekHours))
                .billableApprovedHours(round2(billableApproved))
                .billablePercent(billablePct)
                .currentMonthManDays(round2(monthApproved / HOURS_PER_MAN_DAY))
                .worklogs(mapToResponsesWithAudit(allMyLogs))
                .build();
    }

    @Transactional
    public TechWorklogResponse createWorklog(CreateWorklogRequest req, Long currentUserId) {
        TechProject project = projectRepository.findById(req.getProjectId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + req.getProjectId()));

        boolean isActiveMember = memberRepository.existsByProjectIdAndUserIdAndIsActiveTrue(req.getProjectId(), currentUserId);
        if (!isActiveMember) {
            throw AppException.forbidden("Bạn chỉ được ghi nhận giờ công vào dự án mà mình đang là thành viên hoạt động!");
        }

        validateWorkDateAndHours(currentUserId, req.getWorkDate(), req.getHoursSpent(), null);
        TechProjectMilestone milestone = resolveValidMilestone(req.getMilestoneId(), project.getId());

        BigDecimal hoursBd = BigDecimal.valueOf(req.getHoursSpent()).setScale(2, RoundingMode.HALF_UP);
        boolean isBillable = req.getIsBillable() != null
                ? req.getIsBillable()
                : project.getProjectType() == ProjectType.CLIENT;

        TechWorklog worklog = TechWorklog.builder()
                .project(project)
                .milestone(milestone)
                .userId(currentUserId)
                .workDate(req.getWorkDate())
                .hoursSpent(hoursBd)
                .workType(req.getWorkType() != null ? req.getWorkType() : WorklogType.DEVELOPMENT)
                .isBillable(isBillable)
                .taskSummary(req.getTaskSummary().trim())
                .referenceUrl(normalizeUrl(req.getReferenceUrl()))
                .approvalStatus(WorklogApprovalStatus.PENDING)
                .build();

        TechWorklog saved = worklogRepository.save(worklog);
        notifyManagersOnSubmittedWorklog(currentUserId, saved);
        broadcastWorklogSync("CREATED", saved);
        log.info("[Tech] Kỹ sư {} đã log {}h cho dự án {} ngày {}", currentUserId, hoursBd, project.getProjectCode(), req.getWorkDate());
        return mapToResponse(saved);
    }

    @Transactional
    public TechWorklogResponse updateWorklog(Long id, UpdateWorklogRequest req, Long currentUserId) {
        TechWorklog worklog = worklogRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi giờ công với ID: " + id));

        if (!worklog.getUserId().equals(currentUserId)) {
            throw AppException.forbidden("Bạn không có quyền chỉnh sửa nhật ký giờ công của người khác!");
        }

        if (worklog.getApprovalStatus() == WorklogApprovalStatus.APPROVED) {
            throw AppException.badRequest("Nhật ký giờ công đã được phê duyệt, không thể chỉnh sửa!");
        }

        validateWorkDateAndHours(currentUserId, req.getWorkDate(), req.getHoursSpent(), id);
        TechProjectMilestone milestone = resolveValidMilestone(req.getMilestoneId(), worklog.getProject().getId());

        boolean wasRejected = worklog.getApprovalStatus() == WorklogApprovalStatus.REJECTED;

        worklog.setMilestone(milestone);
        worklog.setWorkDate(req.getWorkDate());
        worklog.setHoursSpent(BigDecimal.valueOf(req.getHoursSpent()).setScale(2, RoundingMode.HALF_UP));
        if (req.getWorkType() != null) {
            worklog.setWorkType(req.getWorkType());
        }
        if (req.getIsBillable() != null) {
            worklog.setIsBillable(req.getIsBillable());
        }
        worklog.setTaskSummary(req.getTaskSummary().trim());
        worklog.setReferenceUrl(normalizeUrl(req.getReferenceUrl()));

        if (wasRejected) {
            worklog.setApprovalStatus(WorklogApprovalStatus.PENDING);
            worklog.setRejectionReason(null);
            worklog.setApprovedBy(null);
            worklog.setApprovedAt(null);
        }

        TechWorklog saved = worklogRepository.save(worklog);
        if (wasRejected) {
            notifyManagersOnSubmittedWorklog(currentUserId, saved);
        }
        broadcastWorklogSync("UPDATED", saved);
        return mapToResponse(saved);
    }

    @Transactional
    public void deleteWorklog(Long id, Long currentUserId) {
        TechWorklog worklog = worklogRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi giờ công với ID: " + id));

        if (!worklog.getUserId().equals(currentUserId)) {
            throw AppException.forbidden("Bạn không có quyền xóa nhật ký giờ công của người khác!");
        }

        if (worklog.getApprovalStatus() == WorklogApprovalStatus.APPROVED) {
            throw AppException.badRequest("Nhật ký giờ công đã được phê duyệt, không thể xóa!");
        }

        worklogRepository.delete(worklog);
        broadcastWorklogSync("DELETED", worklog);
        log.info("[Tech] Kỹ sư {} đã xóa worklog ID {}", currentUserId, id);
    }

    @Transactional(readOnly = true)
    public List<TechWorklogResponse> getDepartmentWorklogs(
            Role callerRole,
            Long callerDeptId,
            Long projectId,
            Long userId,
            WorklogApprovalStatus status,
            String monthStr) {

        LocalDate startDate = null;
        LocalDate endDate = null;
        if (monthStr != null && !monthStr.isBlank()) {
            YearMonth ym = YearMonth.parse(monthStr.trim());
            startDate = ym.atDay(1);
            endDate = ym.atEndOfMonth();
        }

        List<TechWorklog> worklogs = worklogRepository.findDepartmentWorklogsWithFilters(
                projectId, userId, status, startDate, endDate);

        if (callerRole != Role.CEO && callerRole != Role.ADMIN && callerDeptId != null) {
            Set<Long> deptUserIds = userRepository.findByDepartmentId(callerDeptId).stream()
                    .map(User::getId)
                    .collect(Collectors.toSet());
            worklogs = worklogs.stream()
                    .filter(w -> deptUserIds.contains(w.getUserId()))
                    .collect(Collectors.toList());
        }

        return mapToResponsesWithAudit(worklogs);
    }

    @Transactional(readOnly = true)
    public DepartmentWorklogPageResponse getDepartmentWorklogsPaginated(
            Role callerRole,
            Long callerDeptId,
            Long projectId,
            Long userId,
            WorklogApprovalStatus status,
            String monthStr,
            String auditFilter,
            Long focusWorklogId,
            int page,
            int size) {

        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));

        LocalDate startDate = null;
        LocalDate endDate = null;
        if (monthStr != null && !monthStr.isBlank()) {
            YearMonth ym = parseYearMonthOrDefault(monthStr.trim());
            startDate = ym.atDay(1);
            endDate = ym.atEndOfMonth();
        }

        boolean scopeByDeptUsers = callerRole != Role.CEO && callerRole != Role.ADMIN && callerDeptId != null;
        Set<Long> deptUserIds = scopeByDeptUsers
                ? userRepository.findByDepartmentId(callerDeptId).stream()
                        .map(User::getId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toCollection(LinkedHashSet::new))
                : Collections.emptySet();

        if (scopeByDeptUsers && deptUserIds.isEmpty()) {
            return DepartmentWorklogPageResponse.builder()
                    .content(Collections.emptyList())
                    .number(0)
                    .size(safeSize)
                    .totalElements(0L)
                    .totalPages(0)
                    .first(true)
                    .last(true)
                    .monthTotalCount(0L)
                    .monthPendingCount(0L)
                    .warningCount(0L)
                    .missingEvidenceCount(0L)
                    .allocationOverloadCount(0L)
                    .wfhOrOtCount(0L)
                    .attendanceIssueCount(0L)
                    .build();
        }

        String normalizedAuditFilter = (auditFilter != null && !auditFilter.isBlank())
                ? auditFilter.trim().toUpperCase(Locale.ROOT)
                : null;

        List<TechWorklog> monthScopeRaw = worklogRepository.findDepartmentWorklogsWithFilters(
                null, null, null, startDate, endDate);
        List<TechWorklog> monthScopeEntities = filterEntitiesByScope(monthScopeRaw, scopeByDeptUsers, deptUserIds);
        List<TechWorklogResponse> monthAuditItems = mapToResponsesWithAudit(monthScopeEntities);

        List<TechWorklogResponse> content;
        int resolvedPage;
        int resolvedTotalPages;
        long resolvedTotalElements;
        boolean isFirst;
        boolean isLast;

        if (normalizedAuditFilter == null && focusWorklogId == null) {
            Pageable pageable = PageRequest.of(safePage, safeSize);
            Page<TechWorklog> entityPage = scopeByDeptUsers
                    ? worklogRepository.findScopedDepartmentWorklogsPage(
                            deptUserIds, projectId, userId, status, startDate, endDate, pageable)
                    : worklogRepository.findDepartmentWorklogsPage(
                            projectId, userId, status, startDate, endDate, pageable);

            if (entityPage == null) {
                entityPage = Page.empty(pageable);
            } else if (safePage > 0 && entityPage.getContent().isEmpty() && entityPage.getTotalElements() > 0) {
                int clampedPage = Math.max(0, entityPage.getTotalPages() - 1);
                entityPage = scopeByDeptUsers
                        ? worklogRepository.findScopedDepartmentWorklogsPage(
                                deptUserIds, projectId, userId, status, startDate, endDate, PageRequest.of(clampedPage, safeSize))
                        : worklogRepository.findDepartmentWorklogsPage(
                                projectId, userId, status, startDate, endDate, PageRequest.of(clampedPage, safeSize));
                if (entityPage == null) {
                    entityPage = Page.empty(PageRequest.of(clampedPage, safeSize));
                }
            }

            content = mapToResponsesWithAudit(entityPage.getContent());
            resolvedPage = entityPage.getNumber();
            resolvedTotalPages = entityPage.getTotalPages();
            resolvedTotalElements = entityPage.getTotalElements();
            isFirst = entityPage.isFirst();
            isLast = entityPage.isLast();
        } else {
            List<TechWorklogResponse> candidateItems;
            if (projectId == null && userId == null && status == null) {
                candidateItems = monthAuditItems;
            } else {
                List<TechWorklog> filteredRaw = worklogRepository.findDepartmentWorklogsWithFilters(
                        projectId, userId, status, startDate, endDate);
                candidateItems = mapToResponsesWithAudit(
                        filterEntitiesByScope(filteredRaw, scopeByDeptUsers, deptUserIds));
            }

            List<TechWorklogResponse> filteredItems = normalizedAuditFilter == null
                    ? candidateItems
                    : candidateItems.stream()
                            .filter(item -> matchesAuditFilter(item, normalizedAuditFilter))
                            .collect(Collectors.toList());

            int targetPage = safePage;
            if (focusWorklogId != null) {
                for (int i = 0; i < filteredItems.size(); i++) {
                    if (focusWorklogId.equals(filteredItems.get(i).getId())) {
                        targetPage = i / safeSize;
                        break;
                    }
                }
            }

            resolvedTotalElements = filteredItems.size();
            resolvedTotalPages = resolvedTotalElements == 0
                    ? 0
                    : (int) Math.ceil((double) resolvedTotalElements / safeSize);
            resolvedPage = resolvedTotalPages == 0
                    ? 0
                    : Math.min(targetPage, resolvedTotalPages - 1);

            int fromIdx = resolvedPage * safeSize;
            int toIdx = Math.min(fromIdx + safeSize, (int) resolvedTotalElements);
            content = fromIdx < toIdx
                    ? new ArrayList<>(filteredItems.subList(fromIdx, toIdx))
                    : Collections.emptyList();
            isFirst = resolvedPage == 0;
            isLast = resolvedTotalPages == 0 || resolvedPage >= resolvedTotalPages - 1;
        }

        List<TechWorklogResponse> summarySource = !monthAuditItems.isEmpty()
                ? monthAuditItems
                : (projectId == null && userId == null && status == null && normalizedAuditFilter == null
                        ? content
                        : Collections.emptyList());

        long monthTotalCount = !monthAuditItems.isEmpty()
                ? monthAuditItems.size()
                : (projectId == null && userId == null && status == null && normalizedAuditFilter == null
                        ? resolvedTotalElements
                        : 0L);
        long monthPendingCount = summarySource.stream()
                .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.PENDING)
                .count();
        long warningCount = summarySource.stream()
                .filter(w -> Boolean.TRUE.equals(w.getHasAuditWarning()))
                .count();
        long missingEvidenceCount = summarySource.stream()
                .filter(w -> hasAlertCode(w, "MISSING_EVIDENCE_URL"))
                .count();
        long allocationOverloadCount = summarySource.stream()
                .filter(w -> hasAlertCode(w, "ALLOCATION_OVERLOAD"))
                .count();
        long wfhOrOtCount = summarySource.stream()
                .filter(this::isWfhOrOtContext)
                .count();
        long attendanceIssueCount = summarySource.stream()
                .filter(this::hasAttendanceIssueAlert)
                .count();

        return DepartmentWorklogPageResponse.builder()
                .content(content)
                .number(resolvedPage)
                .size(safeSize)
                .totalElements(resolvedTotalElements)
                .totalPages(resolvedTotalPages)
                .first(isFirst)
                .last(isLast)
                .monthTotalCount(monthTotalCount)
                .monthPendingCount(monthPendingCount)
                .warningCount(warningCount)
                .missingEvidenceCount(missingEvidenceCount)
                .allocationOverloadCount(allocationOverloadCount)
                .wfhOrOtCount(wfhOrOtCount)
                .attendanceIssueCount(attendanceIssueCount)
                .build();
    }

    private List<TechWorklog> filterEntitiesByScope(
            List<TechWorklog> raw,
            boolean scopeByDeptUsers,
            Set<Long> deptUserIds) {
        if (raw == null || raw.isEmpty()) return Collections.emptyList();
        if (!scopeByDeptUsers) return raw;
        return raw.stream()
                .filter(w -> deptUserIds.contains(w.getUserId()))
                .collect(Collectors.toList());
    }

    private boolean matchesAuditFilter(TechWorklogResponse item, String auditFilter) {
        if (auditFilter == null || auditFilter.isBlank()) return true;
        return switch (auditFilter) {
            case "WARNING_ONLY" -> Boolean.TRUE.equals(item.getHasAuditWarning());
            case "WFH_OT" -> isWfhOrOtContext(item);
            case "MISSING_EVIDENCE" -> hasAlertCode(item, "MISSING_EVIDENCE_URL");
            case "ALLOCATION_OVERLOAD" -> hasAlertCode(item, "ALLOCATION_OVERLOAD");
            case "ATTENDANCE_ISSUE" -> hasAttendanceIssueAlert(item);
            default -> true;
        };
    }

    private boolean hasAlertCode(TechWorklogResponse item, String code) {
        if (item == null || item.getAuditAlerts() == null) return false;
        return item.getAuditAlerts().stream().anyMatch(a -> code.equals(a.getCode()));
    }

    private boolean isWfhOrOtContext(TechWorklogResponse item) {
        if (item == null || item.getAttendanceContextCode() == null) return false;
        return Set.of(
                "ATTENDANCE_WFH",
                "ATTENDANCE_WFH_OVER_HOURS",
                "ATTENDANCE_HALF_DAY",
                "ATTENDANCE_HALF_DAY_EXCEEDED",
                "ATTENDANCE_OVERTIME"
        ).contains(item.getAttendanceContextCode());
    }

    private boolean hasAttendanceIssueAlert(TechWorklogResponse item) {
        if (item == null || item.getAuditAlerts() == null) return false;
        return item.getAuditAlerts().stream().anyMatch(a ->
                "ATTENDANCE".equals(a.getCategory())
                        && ("WARNING".equals(a.getSeverity()) || "DANGER".equals(a.getSeverity())));
    }

    @Transactional
    public TechWorklogResponse approveWorklog(Long id, Long approverId) {
        User approver = validateApproverRole(approverId);
        TechWorklog worklog = worklogRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi giờ công với ID: " + id));

        validateApprovalTarget(worklog, approver);

        worklog.setApprovalStatus(WorklogApprovalStatus.APPROVED);
        worklog.setApprovedBy(approverId);
        worklog.setApprovedAt(LocalDateTime.now());
        worklog.setRejectionReason(null);

        TechWorklog saved = worklogRepository.save(worklog);
        notifyEngineerOnDecision(saved, approver, true, null);
        broadcastWorklogSync("APPROVED", saved);
        log.info("[Tech] {} đã duyệt worklog ID {} ({}h)", approver.getHoTen(), id, saved.getHoursSpent());
        return mapToResponse(saved);
    }

    @Transactional
    public TechWorklogResponse rejectWorklog(Long id, Long approverId, RejectWorklogRequest req) {
        if (req == null || req.getRejectionReason() == null || req.getRejectionReason().trim().isEmpty()) {
            throw AppException.badRequest("Vui lòng nhập lý do từ chối nhật ký giờ công!");
        }

        User approver = validateApproverRole(approverId);
        TechWorklog worklog = worklogRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi giờ công với ID: " + id));

        validateApprovalTarget(worklog, approver);

        String reason = req.getRejectionReason().trim();
        worklog.setApprovalStatus(WorklogApprovalStatus.REJECTED);
        worklog.setApprovedBy(approverId);
        worklog.setApprovedAt(LocalDateTime.now());
        worklog.setRejectionReason(reason);

        TechWorklog saved = worklogRepository.save(worklog);
        notifyEngineerOnDecision(saved, approver, false, reason);
        broadcastWorklogSync("REJECTED", saved);
        log.info("[Tech] {} đã từ chối worklog ID {}: {}", approver.getHoTen(), id, reason);
        return mapToResponse(saved);
    }

    @Transactional
    public List<TechWorklogResponse> batchApproveWorklogs(BatchApproveWorklogRequest req, Long approverId) {
        if (req == null || req.getWorklogIds() == null || req.getWorklogIds().isEmpty()) {
            throw AppException.badRequest("Vui lòng chọn ít nhất một bản ghi giờ công cần duyệt!");
        }

        User approver = validateApproverRole(approverId);
        List<TechWorklog> worklogs = worklogRepository.findAllById(req.getWorklogIds());
        if (worklogs.size() != new HashSet<>(req.getWorklogIds()).size()) {
            throw AppException.notFound("Một hoặc nhiều bản ghi giờ công không tồn tại!");
        }

        LocalDateTime now = LocalDateTime.now();
        for (TechWorklog w : worklogs) {
            validateApprovalTarget(w, approver);
            w.setApprovalStatus(WorklogApprovalStatus.APPROVED);
            w.setApprovedBy(approverId);
            w.setApprovedAt(now);
            w.setRejectionReason(null);
        }

        List<TechWorklog> saved = worklogRepository.saveAll(worklogs);
        for (TechWorklog w : saved) {
            notifyEngineerOnDecision(w, approver, true, null);
        }
        if (!saved.isEmpty()) {
            broadcastWorklogSync("BATCH_APPROVED", saved.get(0));
        }
        log.info("[Tech] {} đã duyệt hàng loạt {} worklogs", approver.getHoTen(), saved.size());
        return mapToResponsesWithAudit(saved);
    }

    @Transactional(readOnly = true)
    public WorklogAnalyticsResponse getAnalytics(String monthStr, Role callerRole, Long callerDeptId) {
        YearMonth ym = parseYearMonthOrDefault(monthStr);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        boolean canViewCost = callerRole == Role.CEO || callerRole == Role.GIAM_DOC_PHONG_BAN;
        Long scopedDeptId = (callerRole == Role.CEO || callerRole == Role.ADMIN) ? null : callerDeptId;

        List<User> engineers = getTechEngineers(scopedDeptId);
        Map<Long, User> userById = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        Set<Long> scopedEngineerIds = engineers.stream().map(User::getId).collect(Collectors.toSet());

        List<TechProject> projects = projectRepository.findAllByOrderByCreatedAtDesc();
        List<TechWorklog> monthWorklogs = worklogRepository.findAllForAnalyticsInRange(start, end);
        if (scopedDeptId != null) {
            monthWorklogs = monthWorklogs.stream()
                    .filter(w -> scopedEngineerIds.contains(w.getUserId())
                            || Optional.ofNullable(userById.get(w.getUserId()))
                                    .map(u -> scopedDeptId.equals(u.getDepartmentId()))
                                    .orElse(false))
                    .collect(Collectors.toList());
        }

        double totalApproved = sumHours(monthWorklogs, WorklogApprovalStatus.APPROVED);
        double totalPending = sumHours(monthWorklogs, WorklogApprovalStatus.PENDING);
        double totalRejected = sumHours(monthWorklogs, WorklogApprovalStatus.REJECTED);
        double billableApproved = monthWorklogs.stream()
                .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.APPROVED && Boolean.TRUE.equals(w.getIsBillable()))
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum();
        double internalApproved = Math.max(0.0, totalApproved - billableApproved);

        List<WorklogAnalyticsResponse.ProjectBurnItem> projectBreakdowns = new ArrayList<>();
        double totalPlannedHours = 0.0;
        double totalEstimatedCost = 0.0;
        int projectsWithSalary = 0;

        LocalDate today = LocalDate.now();
        for (TechProject p : projects) {
            List<TechProjectMember> activeMembers = memberRepository.findByProjectIdAndIsActiveTrue(p.getId());
            int allocSum = activeMembers.stream().mapToInt(TechProjectMember::getAllocationPercent).sum();
            double plannedHours = (allocSum / 100.0) * STANDARD_HOURS_PER_MONTH;
            totalPlannedHours += plannedHours;

            List<TechWorklog> pLogs = monthWorklogs.stream()
                    .filter(w -> w.getProject().getId().equals(p.getId()))
                    .collect(Collectors.toList());

            double pApproved = sumHours(pLogs, WorklogApprovalStatus.APPROVED);
            double pPending = sumHours(pLogs, WorklogApprovalStatus.PENDING);
            double pBillable = pLogs.stream()
                    .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.APPROVED && Boolean.TRUE.equals(w.getIsBillable()))
                    .mapToDouble(w -> w.getHoursSpent().doubleValue())
                    .sum();

            int pUtil = plannedHours > 0 ? (int) Math.round((pApproved / plannedHours) * 100.0) : 0;

            Double projectCost = null;
            boolean hasSalaryData = false;
            if (canViewCost) {
                double costSum = 0.0;
                for (TechWorklog w : pLogs) {
                    if (w.getApprovalStatus() != WorklogApprovalStatus.APPROVED) continue;
                    User owner = userById.get(w.getUserId());
                    if (owner != null && owner.getBaseSalary() != null && owner.getBaseSalary() > 0) {
                        double allowance = owner.getAllowance() != null ? owner.getAllowance() : 0.0;
                        double hourlyRate = (owner.getBaseSalary() + allowance) / STANDARD_HOURS_PER_MONTH;
                        costSum += w.getHoursSpent().doubleValue() * hourlyRate;
                        hasSalaryData = true;
                    }
                }
                if (hasSalaryData) {
                    projectCost = (double) Math.round(costSum);
                    totalEstimatedCost += costSum;
                    projectsWithSalary++;
                }
            }

            List<TechProjectMilestone> milestones = milestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(p.getId());
            int overdueMilestones = (int) milestones.stream()
                    .filter(m -> TechMilestoneService.isMilestoneOverdue(m, today))
                    .count();

            projectBreakdowns.add(WorklogAnalyticsResponse.ProjectBurnItem.builder()
                    .projectId(p.getId())
                    .projectCode(p.getProjectCode())
                    .projectName(p.getProjectName())
                    .projectType(p.getProjectType())
                    .status(p.getStatus())
                    .allocatedPercentSum(allocSum)
                    .plannedFteHours(round2(plannedHours))
                    .actualApprovedHours(round2(pApproved))
                    .pendingHours(round2(pPending))
                    .billableApprovedHours(round2(pBillable))
                    .burnUtilizationPercent(pUtil)
                    .approvedManDays(round2(pApproved / HOURS_PER_MAN_DAY))
                    .estimatedLaborCost(projectCost)
                    .hasSalaryData(hasSalaryData)
                    .actualProgressPercent(TechMilestoneService.calculateActualProgressPercent(milestones))
                    .overdueMilestonesCount(overdueMilestones)
                    .build());
        }

        List<WorklogAnalyticsResponse.EngineerBurnItem> engineerBreakdowns = new ArrayList<>();
        for (User eng : engineers) {
            Integer allocObj = memberRepository.getTotalActiveAllocationByUserId(eng.getId());
            int alloc = allocObj != null ? allocObj : 0;
            double planned = (alloc / 100.0) * STANDARD_HOURS_PER_MONTH;

            List<TechWorklog> uLogs = monthWorklogs.stream()
                    .filter(w -> w.getUserId().equals(eng.getId()))
                    .collect(Collectors.toList());

            double uApproved = sumHours(uLogs, WorklogApprovalStatus.APPROVED);
            double uPending = sumHours(uLogs, WorklogApprovalStatus.PENDING);
            double uBillable = uLogs.stream()
                    .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.APPROVED && Boolean.TRUE.equals(w.getIsBillable()))
                    .mapToDouble(w -> w.getHoursSpent().doubleValue())
                    .sum();
            int uUtil = planned > 0 ? (int) Math.round((uApproved / planned) * 100.0) : 0;

            engineerBreakdowns.add(WorklogAnalyticsResponse.EngineerBurnItem.builder()
                    .userId(eng.getId())
                    .hoTen(eng.getHoTen())
                    .maNhanVien(eng.getMaNhanVien())
                    .chucVu(eng.getChucVu())
                    .allocatedPercent(alloc)
                    .plannedHours(round2(planned))
                    .approvedHours(round2(uApproved))
                    .pendingHours(round2(uPending))
                    .billableHours(round2(uBillable))
                    .utilizationPercent(uUtil)
                    .approvedManDays(round2(uApproved / HOURS_PER_MAN_DAY))
                    .build());
        }

        engineerBreakdowns.sort((a, b) -> Double.compare(b.getApprovedHours(), a.getApprovedHours()));

        int billablePct = totalApproved > 0 ? (int) Math.round((billableApproved / totalApproved) * 100.0) : 0;
        int burnUtilPct = totalPlannedHours > 0 ? (int) Math.round((totalApproved / totalPlannedHours) * 100.0) : 0;

        return WorklogAnalyticsResponse.builder()
                .month(ym.toString())
                .totalPlannedFteHours(round2(totalPlannedHours))
                .totalApprovedHours(round2(totalApproved))
                .totalPendingHours(round2(totalPending))
                .totalRejectedHours(round2(totalRejected))
                .billableApprovedHours(round2(billableApproved))
                .internalApprovedHours(round2(internalApproved))
                .billablePercent(billablePct)
                .burnUtilizationPercent(burnUtilPct)
                .totalApprovedManDays(round2(totalApproved / HOURS_PER_MAN_DAY))
                .totalPendingManDays(round2(totalPending / HOURS_PER_MAN_DAY))
                .canViewCost(canViewCost)
                .estimatedTotalLaborCost(canViewCost && projectsWithSalary > 0 ? (double) Math.round(totalEstimatedCost) : null)
                .projectsWithConfiguredSalaryCount(projectsWithSalary)
                .projectBreakdowns(projectBreakdowns)
                .engineerBreakdowns(engineerBreakdowns)
                .build();
    }

    // ── Private Helpers ─────────────────────────────────────────────────────────

    private void validateWorkDateAndHours(Long userId, LocalDate workDate, Double hoursSpent, Long excludeId) {
        if (workDate == null) {
            throw AppException.badRequest("Vui lòng chọn ngày làm việc!");
        }
        if (workDate.isAfter(LocalDate.now())) {
            throw AppException.badRequest("Không được phép ghi nhận giờ công cho ngày trong tương lai!");
        }
        if (hoursSpent == null || hoursSpent <= 0.0 || hoursSpent > 16.0) {
            throw AppException.badRequest("Số giờ thực hiện phải lớn hơn 0 và tối đa 16 giờ mỗi bản ghi!");
        }

        BigDecimal newHours = BigDecimal.valueOf(hoursSpent).setScale(2, RoundingMode.HALF_UP);
        BigDecimal existingHours = worklogRepository.sumActiveHoursByUserIdAndWorkDateExcluding(userId, workDate, excludeId);
        if (existingHours == null) existingHours = BigDecimal.ZERO;

        if (existingHours.add(newHours).compareTo(MAX_DAILY_HOURS) > 0) {
            throw AppException.badRequest("Tổng giờ công trong ngày " + workDate + " vượt quá giới hạn tối đa 16 giờ/ngày "
                    + "(hiện đã ghi " + existingHours.stripTrailingZeros().toPlainString() + "h).");
        }
    }

    private TechProjectMilestone resolveValidMilestone(Long milestoneId, Long projectId) {
        if (milestoneId == null) return null;
        TechProjectMilestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy mốc tiến độ với ID: " + milestoneId));
        if (!milestone.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Mốc tiến độ được chọn không thuộc dự án này!");
        }
        return milestone;
    }

    private User validateApproverRole(Long approverId) {
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài khoản người duyệt!"));
        if (approver.getRole() != Role.GIAM_DOC_PHONG_BAN
                && approver.getRole() != Role.TRUONG_PHONG
                && approver.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Giám đốc phòng ban hoặc Trưởng phòng Công nghệ mới có quyền thẩm định giờ công!");
        }
        return approver;
    }

    private void validateApprovalTarget(TechWorklog worklog, User approver) {
        if (worklog.getUserId().equals(approver.getId())) {
            throw AppException.forbidden("Không được phép tự duyệt hoặc tự từ chối nhật ký giờ công của chính mình!");
        }
        if (worklog.getApprovalStatus() != WorklogApprovalStatus.PENDING) {
            throw AppException.badRequest("Chỉ có thể thẩm định nhật ký giờ công đang ở trạng thái Chờ duyệt (PENDING)!");
        }
        if (approver.getRole() != Role.ADMIN) {
            User owner = userRepository.findById(worklog.getUserId()).orElse(null);
            Long ownerDeptId = owner != null ? owner.getDepartmentId() : null;
            if (approver.getDepartmentId() == null || ownerDeptId == null || !approver.getDepartmentId().equals(ownerDeptId)) {
                throw AppException.forbidden("Bạn chỉ có quyền thẩm định giờ công của nhân sự thuộc phòng ban mình quản lý!");
            }
        }
    }

    private List<User> getTechEngineers(Long departmentId) {
        List<User> candidates;
        if (departmentId != null) {
            candidates = userRepository.findByDepartmentId(departmentId);
        } else {
            Optional<Department> techDept = departmentRepository.findByTenPhong("Công nghệ");
            if (techDept.isEmpty()) {
                techDept = departmentRepository.findByTenPhong("Kỹ thuật");
            }
            candidates = techDept.map(d -> userRepository.findByDepartmentId(d.getId()))
                    .orElseGet(userRepository::findAll);
        }

        return candidates.stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> u.getRole() == Role.NHAN_VIEN)
                .collect(Collectors.toList());
    }

    private void notifyManagersOnSubmittedWorklog(Long engineerId, TechWorklog worklog) {
        if (notificationService == null) return;
        try {
            User engineer = userRepository.findById(engineerId).orElse(null);
            String engineerName = engineer != null ? engineer.getHoTen() : "Kỹ sư";
            Long deptId = engineer != null ? engineer.getDepartmentId() : null;
            if (deptId == null) {
                deptId = departmentRepository.findByTenPhong("Công nghệ")
                        .or(() -> departmentRepository.findByTenPhong("Kỹ thuật"))
                        .map(Department::getId)
                        .orElse(null);
            }
            if (deptId == null) return;

            List<User> candidates = new ArrayList<>();
            candidates.addAll(userRepository.findByDepartmentIdAndRole(deptId, Role.TRUONG_PHONG));
            candidates.addAll(userRepository.findByDepartmentIdAndRole(deptId, Role.GIAM_DOC_PHONG_BAN));
            Map<Long, User> uniqueManagers = new LinkedHashMap<>();
            for (User m : candidates) {
                if (m != null && m.getId() != null) {
                    uniqueManagers.putIfAbsent(m.getId(), m);
                }
            }

            String hoursText = worklog.getHoursSpent().stripTrailingZeros().toPlainString();
            String title = "Nhật ký giờ công mới chờ duyệt";
            String content = engineerName + " vừa ghi nhận " + hoursText + "h vào dự án ["
                    + worklog.getProject().getProjectCode() + "] (" + worklog.getWorkDate() + ").";
            String query = buildWorklogLinkQuery(worklog);

            for (User mgr : uniqueManagers.values()) {
                if (Boolean.TRUE.equals(mgr.getActive()) && !mgr.getId().equals(engineerId)) {
                    String baseRoute = mgr.getRole() == Role.GIAM_DOC_PHONG_BAN
                            ? "/director/tech-projects"
                            : "/manager/tech-projects";
                    notificationService.createNotification(
                            mgr.getId(),
                            "TECH_WORKLOG_SUBMITTED",
                            title,
                            content,
                            "binh_thuong",
                            baseRoute + query);
                }
            }
        } catch (Exception e) {
            log.warn("[Tech] Không thể gửi thông báo worklog tới quản lý: {}", e.getMessage());
        }
    }

    private void notifyEngineerOnDecision(TechWorklog worklog, User approver, boolean approved, String reason) {
        if (notificationService == null) return;
        try {
            String hoursText = worklog.getHoursSpent().stripTrailingZeros().toPlainString();
            String title = approved ? "Nhật ký giờ công đã được duyệt" : "Nhật ký giờ công cần chỉnh sửa";
            String content = approved
                    ? "Bản ghi " + hoursText + "h ngày " + worklog.getWorkDate() + " tại dự án ["
                        + worklog.getProject().getProjectCode() + "] đã được " + approver.getHoTen() + " phê duyệt."
                    : "Bản ghi " + hoursText + "h ngày " + worklog.getWorkDate() + " tại dự án ["
                        + worklog.getProject().getProjectCode() + "] bị từ chối bởi " + approver.getHoTen()
                        + ". Lý do:" + (reason.contains("\n") || reason.startsWith("- ") ? "\n" : " ") + reason;

            notificationService.createNotification(
                    worklog.getUserId(),
                    approved ? "TECH_WORKLOG_APPROVED" : "TECH_WORKLOG_REJECTED",
                    title,
                    content,
                    "binh_thuong",
                    "/employee/my-projects" + buildWorklogLinkQuery(worklog));
        } catch (Exception e) {
            log.warn("[Tech] Không thể gửi thông báo kết quả worklog cho kỹ sư {}: {}", worklog.getUserId(), e.getMessage());
        }
    }

    private String buildWorklogLinkQuery(TechWorklog worklog) {
        if (worklog == null) return "?tab=timesheet";
        StringBuilder sb = new StringBuilder("?tab=timesheet");
        if (worklog.getId() != null) {
            sb.append("&worklogId=").append(worklog.getId());
        }
        if (worklog.getWorkDate() != null) {
            sb.append("&month=").append(YearMonth.from(worklog.getWorkDate()));
        }
        return sb.toString();
    }

    private void broadcastWorklogSync(String action, TechWorklog worklog) {
        if (notificationService == null || worklog == null) return;
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("domain", "TECH_WORKLOG");
            payload.put("action", action);
            payload.put("worklogId", worklog.getId() != null ? worklog.getId() : 0L);
            payload.put("projectId", worklog.getProject() != null && worklog.getProject().getId() != null
                    ? worklog.getProject().getId()
                    : 0L);
            payload.put("month", worklog.getWorkDate() != null ? YearMonth.from(worklog.getWorkDate()).toString() : "");
            notificationService.broadcastTopic("/topic/tech-updates", payload);
        } catch (Exception e) {
            log.warn("[Tech] Không thể broadcast sync worklog: {}", e.getMessage());
        }
    }

    public List<TechWorklogResponse> enrichWorklogsWithAudit(List<TechWorklog> worklogs) {
        return mapToResponsesWithAudit(worklogs);
    }

    private TechWorklogResponse mapToResponse(TechWorklog w) {
        List<TechWorklogResponse> list = mapToResponsesWithAudit(List.of(w));
        return list.isEmpty() ? null : list.get(0);
    }

    private List<TechWorklogResponse> mapToResponsesWithAudit(List<TechWorklog> worklogs) {
        if (worklogs == null || worklogs.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> allLookupUserIds = new LinkedHashSet<>();
        Set<Long> ownerIds = new LinkedHashSet<>();
        LocalDate minDate = null;
        LocalDate maxDate = null;

        for (TechWorklog w : worklogs) {
            if (w.getUserId() != null) {
                ownerIds.add(w.getUserId());
                allLookupUserIds.add(w.getUserId());
            }
            if (w.getApprovedBy() != null) {
                allLookupUserIds.add(w.getApprovedBy());
            }
            if (w.getWorkDate() != null) {
                if (minDate == null || w.getWorkDate().isBefore(minDate)) minDate = w.getWorkDate();
                if (maxDate == null || w.getWorkDate().isAfter(maxDate)) maxDate = w.getWorkDate();
            }
        }

        Map<Long, User> userCache = new HashMap<>();
        for (Long uid : allLookupUserIds) {
            userRepository.findById(uid).ifPresent(u -> userCache.put(uid, u));
        }

        Map<String, Attendance> attendanceByUserDate = new HashMap<>();
        Map<Long, List<EmployeeRequest>> approvedRequestsByUser = new HashMap<>();
        Set<LocalDate> holidayDates = new HashSet<>();
        Map<String, TechProjectMember> membershipByUserProject = new HashMap<>();
        Map<String, Double> dailyHoursByUserDate = new HashMap<>();
        Map<String, Double> projectDailyHoursByUserProjDate = new HashMap<>();

        if (!ownerIds.isEmpty() && minDate != null && maxDate != null) {
            List<Attendance> attendances = attendanceRepository.findByEmployeeIdInAndDateBetween(ownerIds, minDate, maxDate);
            if (attendances != null) {
                for (Attendance att : attendances) {
                    if (att.getEmployeeId() == null || att.getDate() == null) continue;
                    String key = userDateKey(att.getEmployeeId(), att.getDate());
                    Attendance existing = attendanceByUserDate.get(key);
                    if (existing == null || (att.getId() != null && (existing.getId() == null || att.getId() > existing.getId()))) {
                        attendanceByUserDate.put(key, att);
                    }
                }
            }

            List<EmployeeRequest> requests = employeeRequestRepository.findApprovedRequestsByUserIdsInRange(ownerIds, minDate, maxDate);
            if (requests != null) {
                for (EmployeeRequest req : requests) {
                    if (req.getUser() == null || req.getUser().getId() == null) continue;
                    approvedRequestsByUser
                            .computeIfAbsent(req.getUser().getId(), k -> new ArrayList<>())
                            .add(req);
                }
            }

            List<Holiday> holidays = holidayRepository.findByNgayLeBetween(minDate, maxDate);
            if (holidays != null) {
                for (Holiday h : holidays) {
                    if (h.getNgayLe() != null) holidayDates.add(h.getNgayLe());
                }
            }

            List<TechProjectMember> memberships = memberRepository.findAllByUserIdInWithProjectOrderByActiveDesc(ownerIds);
            if (memberships != null) {
                for (TechProjectMember m : memberships) {
                    if (m.getUserId() == null || m.getProject() == null || m.getProject().getId() == null) continue;
                    String key = userProjectKey(m.getUserId(), m.getProject().getId());
                    membershipByUserProject.putIfAbsent(key, m);
                }
            }

            Map<Long, TechWorklog> activePoolById = new LinkedHashMap<>();
            List<TechWorklog> untaggedActives = new ArrayList<>();

            List<TechWorklog> dbActives = worklogRepository.findActiveWorklogsByUserIdsInRange(ownerIds, minDate, maxDate);
            if (dbActives != null) {
                for (TechWorklog aw : dbActives) {
                    if (aw.getId() != null) activePoolById.put(aw.getId(), aw);
                    else untaggedActives.add(aw);
                }
            }
            for (TechWorklog inputW : worklogs) {
                if (inputW.getApprovalStatus() == WorklogApprovalStatus.PENDING
                        || inputW.getApprovalStatus() == WorklogApprovalStatus.APPROVED) {
                    if (inputW.getId() != null) activePoolById.putIfAbsent(inputW.getId(), inputW);
                    else untaggedActives.add(inputW);
                }
            }

            List<TechWorklog> combinedActives = new ArrayList<>(activePoolById.values());
            combinedActives.addAll(untaggedActives);
            for (TechWorklog aw : combinedActives) {
                if (aw.getUserId() == null || aw.getWorkDate() == null || aw.getHoursSpent() == null) continue;
                double hrs = aw.getHoursSpent().doubleValue();
                dailyHoursByUserDate.merge(userDateKey(aw.getUserId(), aw.getWorkDate()), hrs, Double::sum);
                if (aw.getProject() != null && aw.getProject().getId() != null) {
                    projectDailyHoursByUserProjDate.merge(
                            userProjectDateKey(aw.getUserId(), aw.getProject().getId(), aw.getWorkDate()),
                            hrs,
                            Double::sum
                    );
                }
            }
        }

        LocalDate today = LocalDate.now();
        List<TechWorklogResponse> responses = new ArrayList<>(worklogs.size());

        for (TechWorklog w : worklogs) {
            User owner = w.getUserId() != null ? userCache.get(w.getUserId()) : null;
            String approverName = w.getApprovedBy() != null && userCache.get(w.getApprovedBy()) != null
                    ? userCache.get(w.getApprovedBy()).getHoTen()
                    : null;

            double rowHours = w.getHoursSpent() != null ? w.getHoursSpent().doubleValue() : 0.0;
            Long projectId = w.getProject() != null ? w.getProject().getId() : null;

            double activeDayHours = (w.getUserId() != null && w.getWorkDate() != null)
                    ? dailyHoursByUserDate.getOrDefault(userDateKey(w.getUserId(), w.getWorkDate()), 0.0)
                    : 0.0;
            double evalDayHours = w.getApprovalStatus() == WorklogApprovalStatus.REJECTED
                    ? Math.max(rowHours, activeDayHours)
                    : (activeDayHours > 0.0 ? activeDayHours : rowHours);

            double activeProjDayHours = (w.getUserId() != null && projectId != null && w.getWorkDate() != null)
                    ? projectDailyHoursByUserProjDate.getOrDefault(userProjectDateKey(w.getUserId(), projectId, w.getWorkDate()), 0.0)
                    : 0.0;
            double evalProjDayHours = w.getApprovalStatus() == WorklogApprovalStatus.REJECTED
                    ? Math.max(rowHours, activeProjDayHours)
                    : (activeProjDayHours > 0.0 ? activeProjDayHours : rowHours);

            TechProjectMember member = (w.getUserId() != null && projectId != null)
                    ? membershipByUserProject.get(userProjectKey(w.getUserId(), projectId))
                    : null;
            Integer allocPct = member != null ? member.getAllocationPercent() : null;

            List<TechWorklogResponse.AuditAlertItem> auditAlerts = new ArrayList<>();
            TechWorklogResponse.AuditAlertItem attendanceAlert = null;
            boolean hasOvertime = false;

            if (w.getUserId() != null && w.getWorkDate() != null) {
                Attendance att = attendanceByUserDate.get(userDateKey(w.getUserId(), w.getWorkDate()));
                List<EmployeeRequest> userRequests = approvedRequestsByUser.getOrDefault(w.getUserId(), Collections.emptyList());
                Set<String> approvedTypeNames = resolveApprovedTypesOnDate(w.getWorkDate(), att, userRequests);
                hasOvertime = approvedTypeNames.contains(RequestType.OVERTIME.name());
                boolean isHoliday = holidayDates.contains(w.getWorkDate());

                attendanceAlert = evaluateAttendanceAlert(
                        w.getWorkDate(),
                        today,
                        att,
                        approvedTypeNames,
                        round2(evalDayHours),
                        isHoliday
                );
                auditAlerts.add(attendanceAlert);
            }

            // 2. Cảnh báo thiếu link bằng chứng (Git PR / Jira) cho DEVELOPMENT / BUG_FIX >= 2h
            boolean requiresEvidence = w.getWorkType() == WorklogType.DEVELOPMENT
                    || w.getWorkType() == WorklogType.BUG_FIX;
            boolean missingReference = w.getReferenceUrl() == null || w.getReferenceUrl().trim().isEmpty();
            if (requiresEvidence && rowHours >= EVIDENCE_REQUIRED_MIN_HOURS && missingReference) {
                auditAlerts.add(TechWorklogResponse.AuditAlertItem.builder()
                        .code("MISSING_EVIDENCE_URL")
                        .category("EVIDENCE")
                        .severity("WARNING")
                        .label("Thiếu link PR / Jira")
                        .detail("Công việc " + workTypeDisplayName(w.getWorkType()) + " từ "
                                + formatHoursShort(EVIDENCE_REQUIRED_MIN_HOURS)
                                + " trở lên (" + formatHoursShort(rowHours) + ") nhưng chưa đính kèm link Git PR / Jira Task.")
                        .build());
            }

            // 3. Cảnh báo lệch tải phân bổ ngày của dự án
            if (allocPct != null && allocPct > 0) {
                double expectedDailyHours = round2((allocPct / 100.0) * HOURS_PER_MAN_DAY);
                boolean overloadedAllocation = evalProjDayHours > expectedDailyHours + ALLOCATION_TOLERANCE_HOURS
                        && !(allocPct >= 100 && hasOvertime);
                if (overloadedAllocation) {
                    auditAlerts.add(TechWorklogResponse.AuditAlertItem.builder()
                            .code("ALLOCATION_OVERLOAD")
                            .category("ALLOCATION")
                            .severity("WARNING")
                            .label("Lệch tải " + allocPct + "% (" + formatHoursShort(evalProjDayHours) + "/" + formatHoursShort(expectedDailyHours) + ")")
                            .detail("Kỹ sư được phân bổ " + allocPct + "% tải (~" + formatHoursShort(expectedDailyHours)
                                    + "/ngày) cho dự án này, nhưng tổng giờ log trong ngày đã đạt " + formatHoursShort(evalProjDayHours) + ".")
                            .build());
                }
            }

            boolean hasAuditWarning = auditAlerts.stream()
                    .anyMatch(a -> "WARNING".equals(a.getSeverity()) || "DANGER".equals(a.getSeverity()));

            responses.add(TechWorklogResponse.builder()
                    .id(w.getId())
                    .projectId(projectId)
                    .projectCode(w.getProject() != null ? w.getProject().getProjectCode() : null)
                    .projectName(w.getProject() != null ? w.getProject().getProjectName() : null)
                    .projectType(w.getProject() != null ? w.getProject().getProjectType() : null)
                    .milestoneId(w.getMilestone() != null ? w.getMilestone().getId() : null)
                    .milestoneTitle(w.getMilestone() != null ? w.getMilestone().getTitle() : null)
                    .userId(w.getUserId())
                    .userName(owner != null ? owner.getHoTen() : "N/A")
                    .userMaNhanVien(owner != null ? owner.getMaNhanVien() : null)
                    .userEmail(owner != null ? owner.getEmail() : null)
                    .workDate(w.getWorkDate())
                    .hoursSpent(rowHours)
                    .workType(w.getWorkType())
                    .isBillable(w.getIsBillable())
                    .taskSummary(w.getTaskSummary())
                    .referenceUrl(w.getReferenceUrl())
                    .approvalStatus(w.getApprovalStatus())
                    .approvedBy(w.getApprovedBy())
                    .approverName(approverName)
                    .approvedAt(w.getApprovedAt())
                    .rejectionReason(w.getRejectionReason())
                    .createdAt(w.getCreatedAt())
                    .updatedAt(w.getUpdatedAt())
                    .attendanceContextCode(attendanceAlert != null ? attendanceAlert.getCode() : null)
                    .attendanceContextLabel(attendanceAlert != null ? attendanceAlert.getLabel() : null)
                    .attendanceSeverity(attendanceAlert != null ? attendanceAlert.getSeverity() : null)
                    .dailyLoggedHours(round2(evalDayHours))
                    .projectDailyLoggedHours(round2(evalProjDayHours))
                    .projectAllocationPercent(allocPct)
                    .hasAuditWarning(hasAuditWarning)
                    .auditAlerts(auditAlerts)
                    .build());
        }

        return responses;
    }

    private Set<String> resolveApprovedTypesOnDate(
            LocalDate date,
            Attendance att,
            List<EmployeeRequest> userRequests) {
        Set<String> types = new HashSet<>();
        boolean isWeekend = date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY;

        if (userRequests != null) {
            for (EmployeeRequest req : userRequests) {
                if (req.getRequestType() == null || req.getStartDate() == null || req.getEndDate() == null) continue;
                if (date.isBefore(req.getStartDate()) || date.isAfter(req.getEndDate())) continue;

                boolean include = req.getRequestType() == RequestType.OVERTIME
                        || !isWeekend
                        || req.getStartDate().equals(req.getEndDate());
                if (include) {
                    types.add(req.getRequestType().name());
                }
            }
        }

        if (att != null) {
            if ("APPROVED".equalsIgnoreCase(att.getExceptionStatus())
                    && att.getLoaiNghiPhep() != null
                    && !att.getLoaiNghiPhep().isBlank()) {
                types.add(att.getLoaiNghiPhep().trim().toUpperCase(Locale.ROOT));
            }
            if (att.getStatus() != null) {
                String st = att.getStatus().trim().toUpperCase(Locale.ROOT);
                if (Set.of("SPECIAL_WFH_LEAVE", "HALF_DAY_LEAVE", "HALF_DAY", "NORMAL_LEAVE", "UNPAID_LEAVE", "EXCUSED")
                        .contains(st)) {
                    types.add(st);
                }
            }
        }
        return types;
    }

    private TechWorklogResponse.AuditAlertItem evaluateAttendanceAlert(
            LocalDate workDate,
            LocalDate today,
            Attendance att,
            Set<String> approvedTypes,
            double evalDayHours,
            boolean isHoliday) {

        boolean hasWfh = approvedTypes.contains(RequestType.SPECIAL_WFH_LEAVE.name());
        boolean hasHalfDay = approvedTypes.contains(RequestType.HALF_DAY_LEAVE.name())
                || approvedTypes.contains("HALF_DAY");
        boolean hasOvertime = approvedTypes.contains(RequestType.OVERTIME.name());
        boolean hasNormalLeave = approvedTypes.contains(RequestType.NORMAL_LEAVE.name());
        boolean hasUnpaidLeave = approvedTypes.contains(RequestType.UNPAID_LEAVE.name());
        boolean hasExcusedLeave = approvedTypes.contains("EXCUSED");
        boolean hasFullLeave = hasNormalLeave || hasUnpaidLeave || hasExcusedLeave;

        boolean isWeekend = workDate.getDayOfWeek() == DayOfWeek.SATURDAY || workDate.getDayOfWeek() == DayOfWeek.SUNDAY;

        LocalTime timeIn = att != null ? att.getTimeIn() : null;
        LocalTime timeOut = att != null ? att.getTimeOut() : null;
        String attStatus = att != null && att.getStatus() != null ? att.getStatus().trim().toUpperCase(Locale.ROOT) : "";

        boolean validTimeIn = timeIn != null && !timeIn.equals(LocalTime.MIDNIGHT);
        boolean hasRealPunchIn = validTimeIn && (
                "PRESENT".equals(attStatus)
                        || "LATE".equals(attStatus)
                        || "HALF_DAY".equals(attStatus)
                        || timeOut != null
        );
        boolean hasRealPunchOut = hasRealPunchIn && timeOut != null && timeOut.isAfter(timeIn);
        double presenceHours = hasRealPunchOut
                ? round2(Duration.between(timeIn, timeOut).toMinutes() / 60.0)
                : 0.0;

        String dateLabel = workDate.format(VN_DATE_FMT);

        // 1. Làm việc tại nhà (WFH) đã duyệt — ưu tiên cao, không cảnh báo oan
        if (hasWfh) {
            double maxWfhHours = hasOvertime ? MAX_DAILY_HOURS.doubleValue() : WFH_STANDARD_DAILY_HOURS;
            if (evalDayHours > maxWfhHours) {
                return TechWorklogResponse.AuditAlertItem.builder()
                        .code("ATTENDANCE_WFH_OVER_HOURS")
                        .category("ATTENDANCE")
                        .severity("WARNING")
                        .label("WFH vượt 8h (chưa OT)")
                        .detail("Đã duyệt WFH ngày " + dateLabel + " (chuẩn " + formatHoursShort(WFH_STANDARD_DAILY_HOURS)
                                + "), nhưng tổng giờ log ngày đạt " + formatHoursShort(evalDayHours) + " và chưa có đơn Tăng ca (OT).")
                        .build();
            }
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_WFH")
                    .category("ATTENDANCE")
                    .severity("INFO")
                    .label(hasOvertime ? "WFH + OT đã duyệt" : "WFH đã duyệt")
                    .detail(hasOvertime
                            ? "Đã duyệt làm việc tại nhà (WFH) kèm đơn OT ngày " + dateLabel
                                + " (tổng log ngày: " + formatHoursShort(evalDayHours) + ")."
                            : "Đã duyệt làm việc tại nhà (WFH) ngày " + dateLabel
                                + " (tổng log ngày: " + formatHoursShort(evalDayHours) + " / " + formatHoursShort(WFH_STANDARD_DAILY_HOURS) + " chuẩn).")
                    .build();
        }

        // 2. Nghỉ nửa ngày đã duyệt
        if (hasHalfDay) {
            double halfDayCap = hasOvertime
                    ? 12.0
                    : (hasRealPunchOut ? Math.max(HALF_DAY_MAX_HOURS, presenceHours + PRESENCE_TOLERANCE_HOURS) : HALF_DAY_MAX_HOURS);
            String punchInfo = hasRealPunchOut
                    ? " (chấm công " + timeIn.format(TIME_HM_FMT) + "–" + timeOut.format(TIME_HM_FMT) + ")"
                    : (hasRealPunchIn ? " (check-in " + timeIn.format(TIME_HM_FMT) + ")" : "");
            if (evalDayHours > halfDayCap) {
                return TechWorklogResponse.AuditAlertItem.builder()
                        .code("ATTENDANCE_HALF_DAY_EXCEEDED")
                        .category("ATTENDANCE")
                        .severity("WARNING")
                        .label("Nghỉ 1/2 ngày • Vượt quỹ 4h")
                        .detail("Đã duyệt nghỉ nửa ngày " + dateLabel + punchInfo
                                + " (quỹ ~4h làm việc), nhưng tổng log ngày là " + formatHoursShort(evalDayHours) + " và chưa có đơn OT.")
                        .build();
            }
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_HALF_DAY")
                    .category("ATTENDANCE")
                    .severity("INFO")
                    .label(hasRealPunchOut
                            ? "Nghỉ 1/2 ngày • " + timeIn.format(TIME_HM_FMT) + "–" + timeOut.format(TIME_HM_FMT)
                            : "Nghỉ nửa ngày đã duyệt")
                    .detail("Đã duyệt nghỉ nửa ngày " + dateLabel + punchInfo
                            + "; tổng log ngày " + formatHoursShort(evalDayHours) + " phù hợp thời gian làm việc còn lại.")
                    .build();
        }

        // 3. Nghỉ phép cả ngày đã duyệt nhưng không đi làm/OT mà vẫn log giờ
        if (hasFullLeave && !hasRealPunchIn && !hasOvertime) {
            String leaveLabel = hasUnpaidLeave
                    ? "Nghỉ không lương"
                    : (hasExcusedLeave && !hasNormalLeave ? "Nghỉ có phép" : "Nghỉ phép");
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_LEAVE_CONFLICT")
                    .category("ATTENDANCE")
                    .severity("DANGER")
                    .label("Đang nghỉ phép vẫn log")
                    .detail("Nhân sự có đơn " + leaveLabel + " đã duyệt ngày " + dateLabel
                            + " nhưng vẫn ghi nhận tổng " + formatHoursShort(evalDayHours) + " worklog.")
                    .build();
        }

        // 4. Có đơn Tăng ca (OT) đã duyệt
        if (hasOvertime) {
            if (hasRealPunchOut) {
                return TechWorklogResponse.AuditAlertItem.builder()
                        .code("ATTENDANCE_OVERTIME")
                        .category("ATTENDANCE")
                        .severity("INFO")
                        .label("OT đã duyệt • " + timeIn.format(TIME_HM_FMT) + "–" + timeOut.format(TIME_HM_FMT))
                        .detail("Có đơn Tăng ca (OT) được duyệt cùng chấm công " + timeIn.format(TIME_HM_FMT)
                                + "–" + timeOut.format(TIME_HM_FMT) + " (tổng log ngày: " + formatHoursShort(evalDayHours) + ").")
                        .build();
            }
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_OVERTIME")
                    .category("ATTENDANCE")
                    .severity("INFO")
                    .label((isWeekend || isHoliday) ? "OT cuối tuần/lễ đã duyệt" : "OT đã duyệt")
                    .detail("Có đơn Tăng ca (OT) đã được phê duyệt ngày " + dateLabel
                            + " (tổng log ngày: " + formatHoursShort(evalDayHours) + ").")
                    .build();
        }

        // 5. Có chấm công đủ giờ vào & ra tại văn phòng
        if (hasRealPunchOut) {
            String span = timeIn.format(TIME_HM_FMT) + "–" + timeOut.format(TIME_HM_FMT);
            if (evalDayHours > presenceHours + PRESENCE_TOLERANCE_HOURS) {
                return TechWorklogResponse.AuditAlertItem.builder()
                        .code("ATTENDANCE_HOURS_EXCEEDED")
                        .category("ATTENDANCE")
                        .severity("DANGER")
                        .label("Vượt giờ hiện diện (" + formatHoursShort(presenceHours) + ")")
                        .detail("Chấm công " + span + " (" + formatHoursShort(presenceHours)
                                + "), nhưng tổng worklog ngày là " + formatHoursShort(evalDayHours) + " và không có đơn OT.")
                        .build();
            }
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_MATCHED")
                    .category("ATTENDANCE")
                    .severity("OK")
                    .label("Khớp chấm công (" + span + ")")
                    .detail("Hiện diện tại văn phòng " + span + " (" + formatHoursShort(presenceHours)
                            + "), tổng worklog ngày " + formatHoursShort(evalDayHours) + ".")
                    .build();
        }

        // 6. Mới check-in chưa check-out
        if (hasRealPunchIn) {
            String inText = timeIn.format(TIME_HM_FMT);
            if (!workDate.isBefore(today)) {
                return TechWorklogResponse.AuditAlertItem.builder()
                        .code("ATTENDANCE_CHECKED_IN_OPEN")
                        .category("ATTENDANCE")
                        .severity("INFO")
                        .label("Check-in " + inText + " (chưa ra)")
                        .detail("Đã chấm công vào lúc " + inText + " hôm nay, chưa có giờ ra (tổng log hiện tại: "
                                + formatHoursShort(evalDayHours) + ").")
                        .build();
            }
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_MISSING_CHECKOUT")
                    .category("ATTENDANCE")
                    .severity("WARNING")
                    .label("Thiếu check-out (" + inText + ")")
                    .detail("Ngày " + dateLabel + " chỉ ghi nhận giờ vào " + inText
                            + ", thiếu giờ ra trên máy chấm công để đối chiếu " + formatHoursShort(evalDayHours) + ".")
                    .build();
        }

        // 7. Cuối tuần hoặc Ngày lễ nhưng không có OT hay chấm công
        if (isWeekend || isHoliday) {
            return TechWorklogResponse.AuditAlertItem.builder()
                    .code("ATTENDANCE_WEEKEND_NO_OT")
                    .category("ATTENDANCE")
                    .severity("WARNING")
                    .label(isHoliday ? "Log ngày lễ (chưa OT)" : "Log cuối tuần (chưa OT)")
                    .detail("Ngày " + dateLabel + (isHoliday ? " là ngày nghỉ lễ" : " là cuối tuần")
                            + ", không có dữ liệu chấm công hay đơn Tăng ca (OT) được duyệt.")
                    .build();
        }

        // 8. Ngày làm việc bình thường nhưng không chấm công và không có đơn WFH/OT/Nghỉ phép
        return TechWorklogResponse.AuditAlertItem.builder()
                .code("ATTENDANCE_NO_CHECKIN")
                .category("ATTENDANCE")
                .severity("DANGER")
                .label("Không chấm công & đơn WFH")
                .detail("Ngày " + dateLabel + " không ghi nhận quét mặt chấm công và chưa có đơn WFH/OT được duyệt (tổng log: "
                        + formatHoursShort(evalDayHours) + ").")
                .build();
    }

    private String workTypeDisplayName(WorklogType type) {
        if (type == null) return "Kỹ thuật";
        return switch (type) {
            case DEVELOPMENT -> "Phát triển tính năng";
            case BUG_FIX -> "Sửa lỗi / Hotfix";
            case CODE_REVIEW -> "Review mã nguồn";
            case TESTING_QA -> "Kiểm thử & QA";
            case ARCHITECTURE -> "Thiết kế Kiến trúc";
            case DEPLOYMENT -> "Triển khai CI/CD";
            case MEETING -> "Họp kỹ thuật";
        };
    }

    private String formatHoursShort(double hours) {
        return BigDecimal.valueOf(round2(hours)).stripTrailingZeros().toPlainString() + "h";
    }

    private String userDateKey(Long userId, LocalDate date) {
        return userId + "|" + date;
    }

    private String userProjectKey(Long userId, Long projectId) {
        return userId + "|" + projectId;
    }

    private String userProjectDateKey(Long userId, Long projectId, LocalDate date) {
        return userId + "|" + projectId + "|" + date;
    }

    private YearMonth parseYearMonthOrDefault(String monthStr) {
        if (monthStr == null || monthStr.trim().isEmpty()) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(monthStr.trim());
        } catch (Exception e) {
            throw AppException.badRequest("Định dạng tháng không hợp lệ (cần YYYY-MM): " + monthStr);
        }
    }

    private double sumHours(List<TechWorklog> list, WorklogApprovalStatus status) {
        return list.stream()
                .filter(w -> w.getApprovalStatus() == status && w.getHoursSpent() != null)
                .mapToDouble(w -> w.getHoursSpent().doubleValue())
                .sum();
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String normalizeUrl(String url) {
        if (url == null || url.trim().isEmpty()) return null;
        return url.trim();
    }
}

