package com.hrm.techfinance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.approval.entity.ApprovalStep;
import com.hrm.approval.service.ApprovalService;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.entity.SalaryHistory;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.payroll.repository.SalaryHistoryRepository;
import com.hrm.common.payroll.service.FinanceAccess;
import com.hrm.common.payroll.service.PayrollPeriodLock;
import com.hrm.common.payroll.service.PayrollService;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.TechProjectRepository;
import com.hrm.tech.repository.TechWorklogRepository;
import com.hrm.tech.repository.UserTechCertificateRepository;
import com.hrm.techfinance.dto.TechFinanceDtos.*;
import com.hrm.techfinance.entity.TechCertReimbursement;
import com.hrm.techfinance.entity.TechCompensationSync;
import com.hrm.techfinance.entity.TechProjectCostReport;
import com.hrm.techfinance.repository.TechCertReimbursementRepository;
import com.hrm.techfinance.repository.TechCompensationSyncRepository;
import com.hrm.techfinance.repository.TechProjectCostReportRepository;
import com.hrm.techhr.entity.CrossDeptHandoffTask;
import com.hrm.techhr.entity.CrossDeptTaskPriority;
import com.hrm.techhr.entity.CrossDeptTaskStatus;
import com.hrm.techhr.entity.CrossDeptTaskType;
import com.hrm.techhr.repository.CrossDeptHandoffTaskRepository;
import com.hrm.techhr.service.CrossDeptHandoffService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechFinanceIntegrationService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final double STANDARD_HOURS_PER_MONTH = 176.0;
    private static final double HOURS_PER_MAN_DAY = 8.0;

    private final TechProjectCostReportRepository costReportRepository;
    private final TechCompensationSyncRepository compensationSyncRepository;
    private final TechCertReimbursementRepository certReimbursementRepository;
    private final TechProjectRepository techProjectRepository;
    private final TechWorklogRepository techWorklogRepository;
    private final UserTechCertificateRepository userTechCertificateRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PayrollReportRepository payrollReportRepository;
    private final SalaryHistoryRepository salaryHistoryRepository;
    private final EmployeeHistoryService employeeHistoryService;
    private final PayrollPeriodLock payrollPeriodLock;
    private final FinanceAccess financeAccess;
    private final CrossDeptHandoffService handoffService;
    private final CrossDeptHandoffTaskRepository handoffTaskRepository;
    private final JobRequisitionRepository jobRequisitionRepository;
    private final ApprovalService approvalService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    // ─── ROLE / ACCESS HELPERS ────────────────────────────────────────────────

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người dùng ID: " + userId));
    }

    private boolean isFinanceMember(User user) {
        if (user == null || user.getDepartmentId() == null) return false;
        if (user.getRole() == Role.ADMIN || user.getRole() == Role.CEO) return false;
        return financeAccess.financeDepartmentId().map(id -> id.equals(user.getDepartmentId())).orElse(false);
    }

    private boolean isFinanceChief(User user) {
        return isFinanceMember(user)
                && (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN);
    }

    private boolean isTechManager(User user) {
        if (user == null) return false;
        if (user.getRole() == Role.ADMIN) return true;
        return (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && handoffService.isTechDepartment(user.getDepartmentId());
    }

    private boolean canViewFinancialMoney(User user) {
        if (user == null) return false;
        if (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN) return true;
        if (isFinanceMember(user)) return true;
        return user.getRole() == Role.GIAM_DOC_PHONG_BAN && handoffService.isTechDepartment(user.getDepartmentId());
    }

    private LocalDateTime nowVn() {
        return LocalDateTime.now(VN_ZONE);
    }

    private YearMonth parseYearMonthOrCurrent(String monthStr) {
        if (monthStr == null || monthStr.isBlank()) {
            return YearMonth.now(VN_ZONE);
        }
        try {
            return YearMonth.parse(monthStr.trim());
        } catch (Exception e) {
            throw AppException.badRequest("Định dạng tháng không hợp lệ (cần YYYY-MM): " + monthStr);
        }
    }

    // ─── OVERVIEW KPI ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FinanceTechOverviewResponse getOverview(Long actorId) {
        User actor = requireUser(actorId);
        boolean allowMoney = canViewFinancialMoney(actor);

        long pendingBudgetReqs = jobRequisitionRepository.findByStatus(JobRequisitionStatus.PENDING_APPROVAL).stream()
                .filter(req -> {
                    ApprovalStep step = approvalService
                            .getCurrentPendingStep(ApprovalEntityType.JOB_REQUISITION, req.getId())
                            .orElse(null);
                    return step != null && "FINANCE_DEPARTMENT".equals(step.getStepScope());
                })
                .count();

        List<TechProjectCostReport> allReports = costReportRepository.findAllByOrderByReportMonthDescIdDesc();
        long submittedReports = allReports.stream().filter(r -> "SUBMITTED".equals(r.getStatus())).count();
        long confirmedReports = allReports.stream().filter(r -> "CONFIRMED".equals(r.getStatus())).count();
        BigDecimal totalSubmittedCost = allowMoney
                ? allReports.stream()
                    .filter(r -> "SUBMITTED".equals(r.getStatus()) || "CONFIRMED".equals(r.getStatus()))
                    .map(r -> r.getTotalLaborCost() != null ? r.getTotalLaborCost() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                : null;

        long pendingSyncs = compensationSyncRepository
                .findByStatusOrderByEffectiveMonthAscCreatedAtAsc("PENDING_FINANCE_APPLY").size();

        List<TechCertReimbursement> allCerts = certReimbursementRepository.findAllByOrderByCreatedAtDesc();
        long pendingCertFinance = allCerts.stream().filter(c -> "TECH_APPROVED".equals(c.getStatus())).count();
        long awaitingDisburse = allCerts.stream().filter(c -> "FINANCE_APPROVED".equals(c.getStatus())).count();
        BigDecimal totalDisbursed = allCerts.stream()
                .filter(c -> "DISBURSED".equals(c.getStatus()))
                .map(c -> c.getApprovedAmountVnd() != null ? c.getApprovedAmountVnd() : c.getRequestedAmountVnd())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return FinanceTechOverviewResponse.builder()
                .pendingBudgetRequisitionsCount(pendingBudgetReqs)
                .submittedCostReportsCount(submittedReports)
                .confirmedCostReportsCount(confirmedReports)
                .pendingCompensationSyncsCount(pendingSyncs)
                .pendingCertReimbursementsCount(pendingCertFinance)
                .approvedCertAwaitingDisbursementCount(awaitingDisburse)
                .totalDisbursedCertVnd(totalDisbursed)
                .totalSubmittedLaborCostVnd(totalSubmittedCost)
                .build();
    }

    // ─── MODULE F2: PROJECT BUDGET & MONTHLY COSTING SNAPSHOT ─────────────────

    @Transactional
    public Map<String, Object> updateProjectBudget(Long projectId, UpdateProjectBudgetRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!canViewFinancialMoney(actor)) {
            throw AppException.forbidden("Chỉ Giám đốc Công nghệ, Phòng Tài chính - Kế toán hoặc CEO mới có quyền cấu hình ngân sách dự án!");
        }
        if (req == null || req.getBudgetAmount() == null || req.getBudgetAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw AppException.badRequest("Ngân sách dự án phải lớn hơn hoặc bằng 0 VNĐ.");
        }
        TechProject project = techProjectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án ID: " + projectId));
        BigDecimal normalizedBudget = req.getBudgetAmount().setScale(0, RoundingMode.HALF_UP);
        project.setBudgetAmount(normalizedBudget);
        techProjectRepository.save(project);

        // Cập nhật lại ngân sách & % tiêu thụ trong các bảng đối soát đang chờ duyệt (SUBMITTED / DISPUTED)
        for (TechProjectCostReport report : costReportRepository.findAllByOrderByReportMonthDescIdDesc()) {
            if ("CONFIRMED".equals(report.getStatus())) continue;
            List<ProjectCostLineItem> lines = readProjectLines(report.getProjectBreakdownJson());
            boolean changed = false;
            for (ProjectCostLineItem item : lines) {
                if (Objects.equals(item.getProjectId(), projectId)) {
                    item.setProjectBudgetAmount(normalizedBudget);
                    if (normalizedBudget.compareTo(BigDecimal.ZERO) > 0 && item.getEstimatedLaborCost() != null) {
                        item.setBudgetUtilizationPercent(
                                item.getEstimatedLaborCost().multiply(BigDecimal.valueOf(100))
                                        .divide(normalizedBudget, 1, RoundingMode.HALF_UP)
                                        .doubleValue());
                    } else {
                        item.setBudgetUtilizationPercent(null);
                    }
                    changed = true;
                }
            }
            if (changed) {
                report.setProjectBreakdownJson(writeJson(lines));
                costReportRepository.save(report);
            }
        }

        broadcastSync("PROJECT_BUDGET_UPDATED", projectId);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("projectId", project.getId());
        res.put("projectCode", project.getProjectCode());
        res.put("budgetAmount", project.getBudgetAmount());
        return res;
    }

    @Transactional
    public ProjectCostReportResponse submitMonthlyProjectCostReport(
            SubmitProjectCostReportRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!isTechManager(actor)) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc Phòng Công nghệ mới có quyền chốt gửi bảng đối soát giờ công dự án!");
        }

        YearMonth ym = parseYearMonthOrCurrent(req != null ? req.getReportMonth() : null);
        String monthKey = ym.toString();
        Long techDeptId = handoffService.isTechDepartment(actor.getDepartmentId())
                ? actor.getDepartmentId()
                : handoffService.findTechDepartmentId();
        if (techDeptId == null) {
            throw AppException.badRequest("Không tìm thấy Phòng Công nghệ trong hệ thống.");
        }

        TechProjectCostReport existing = costReportRepository
                .findByReportMonthAndDepartmentId(monthKey, techDeptId)
                .orElse(null);
        if (existing != null && "CONFIRMED".equals(existing.getStatus())) {
            throw AppException.conflict("Bảng đối soát chi phí dự án tháng " + monthKey
                    + " đã được Phòng Tài chính xác nhận hạch toán, không thể ghi đè!");
        }

        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<User> techUsers = userRepository.findByDepartmentId(techDeptId);
        Map<Long, User> userById = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));
        Set<Long> techUserIds = techUsers.stream().map(User::getId).collect(Collectors.toSet());

        List<TechWorklog> monthWorklogs = techWorklogRepository.findAllForAnalyticsInRange(start, end).stream()
                .filter(w -> techUserIds.contains(w.getUserId())
                        || Optional.ofNullable(userById.get(w.getUserId()))
                                .map(u -> techDeptId.equals(u.getDepartmentId()))
                                .orElse(false))
                .toList();

        int pendingCount = (int) monthWorklogs.stream()
                .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.PENDING)
                .count();
        List<TechWorklog> approvedLogs = monthWorklogs.stream()
                .filter(w -> w.getApprovalStatus() == WorklogApprovalStatus.APPROVED)
                .toList();

        if (approvedLogs.isEmpty()) {
            throw AppException.badRequest("Chưa có bản ghi giờ công nào ở trạng thái Đã duyệt trong tháng " + monthKey
                    + " để gửi đối soát sang Phòng Tài chính!");
        }

        double totalApproved = 0.0;
        double totalBillable = 0.0;
        BigDecimal totalLaborCost = BigDecimal.ZERO;

        Map<Long, List<TechWorklog>> byProject = approvedLogs.stream()
                .collect(Collectors.groupingBy(w -> w.getProject().getId()));
        List<ProjectCostLineItem> projectLines = new ArrayList<>();

        for (Map.Entry<Long, List<TechWorklog>> entry : byProject.entrySet()) {
            List<TechWorklog> pLogs = entry.getValue();
            TechProject proj = pLogs.get(0).getProject();

            double pHours = 0.0;
            double pBillable = 0.0;
            BigDecimal pCost = BigDecimal.ZERO;
            for (TechWorklog w : pLogs) {
                double h = w.getHoursSpent() != null ? w.getHoursSpent().doubleValue() : 0.0;
                pHours += h;
                if (Boolean.TRUE.equals(w.getIsBillable())) {
                    pBillable += h;
                }
                pCost = pCost.add(computeLogLaborCost(userById.get(w.getUserId()), h));
            }
            double pInternal = Math.max(0.0, pHours - pBillable);
            totalApproved += pHours;
            totalBillable += pBillable;
            totalLaborCost = totalLaborCost.add(pCost);

            Double utilPct = null;
            if (proj.getBudgetAmount() != null && proj.getBudgetAmount().compareTo(BigDecimal.ZERO) > 0) {
                utilPct = pCost.multiply(BigDecimal.valueOf(100))
                        .divide(proj.getBudgetAmount(), 1, RoundingMode.HALF_UP)
                        .doubleValue();
            }

            projectLines.add(ProjectCostLineItem.builder()
                    .projectId(proj.getId())
                    .projectCode(proj.getProjectCode())
                    .projectName(proj.getProjectName())
                    .projectType(proj.getProjectType() != null ? proj.getProjectType().name() : "INTERNAL")
                    .approvedHours(round2(pHours))
                    .billableHours(round2(pBillable))
                    .internalHours(round2(pInternal))
                    .manDays(round2(pHours / HOURS_PER_MAN_DAY))
                    .fte(round2(pHours / STANDARD_HOURS_PER_MONTH))
                    .estimatedLaborCost(pCost.setScale(0, RoundingMode.HALF_UP))
                    .projectBudgetAmount(proj.getBudgetAmount())
                    .budgetUtilizationPercent(utilPct)
                    .build());
        }
        projectLines.sort(Comparator.comparingDouble(ProjectCostLineItem::getApprovedHours).reversed());

        Map<Long, List<TechWorklog>> byEngineer = approvedLogs.stream()
                .collect(Collectors.groupingBy(TechWorklog::getUserId));
        List<EngineerCostLineItem> engineerLines = new ArrayList<>();
        for (Map.Entry<Long, List<TechWorklog>> entry : byEngineer.entrySet()) {
            User eng = userById.get(entry.getKey());
            double eHours = 0.0;
            double eBillable = 0.0;
            BigDecimal eCost = BigDecimal.ZERO;
            for (TechWorklog w : entry.getValue()) {
                double h = w.getHoursSpent() != null ? w.getHoursSpent().doubleValue() : 0.0;
                eHours += h;
                if (Boolean.TRUE.equals(w.getIsBillable())) eBillable += h;
                eCost = eCost.add(computeLogLaborCost(eng, h));
            }
            engineerLines.add(EngineerCostLineItem.builder()
                    .userId(entry.getKey())
                    .employeeCode(eng != null ? eng.getMaNhanVien() : null)
                    .fullName(eng != null ? eng.getHoTen() : ("User #" + entry.getKey()))
                    .position(eng != null ? eng.getChucVu() : null)
                    .approvedHours(round2(eHours))
                    .billableHours(round2(eBillable))
                    .internalHours(round2(Math.max(0.0, eHours - eBillable)))
                    .manDays(round2(eHours / HOURS_PER_MAN_DAY))
                    .estimatedLaborCost(eCost.setScale(0, RoundingMode.HALF_UP))
                    .build());
        }
        engineerLines.sort(Comparator.comparingDouble(EngineerCostLineItem::getApprovedHours).reversed());

        double totalInternal = Math.max(0.0, totalApproved - totalBillable);
        TechProjectCostReport report = existing != null ? existing : new TechProjectCostReport();
        report.setReportMonth(monthKey);
        report.setDepartmentId(techDeptId);
        report.setStatus("SUBMITTED");
        report.setTotalApprovedHours(BigDecimal.valueOf(round2(totalApproved)));
        report.setTotalBillableHours(BigDecimal.valueOf(round2(totalBillable)));
        report.setTotalInternalHours(BigDecimal.valueOf(round2(totalInternal)));
        report.setTotalManDays(BigDecimal.valueOf(round2(totalApproved / HOURS_PER_MAN_DAY)));
        report.setTotalLaborCost(totalLaborCost.setScale(0, RoundingMode.HALF_UP));
        report.setPendingWorklogsAtSubmit(pendingCount);
        report.setProjectBreakdownJson(writeJson(projectLines));
        report.setEngineerBreakdownJson(writeJson(engineerLines));
        report.setSubmittedBy(actorId);
        report.setSubmittedAt(nowVn());
        report.setSubmitNote(req != null && req.getSubmitNote() != null ? req.getSubmitNote().trim() : null);
        report.setReviewedBy(null);
        report.setReviewedAt(null);
        report.setAccountingVoucherNo(null);
        report.setFinanceNote(null);

        TechProjectCostReport saved = costReportRepository.save(report);

        // Tạo tác vụ Handoff & thông báo tới Phòng Tài chính - Kế toán
        Long finDeptId = financeAccess.financeDepartmentId().orElse(null);
        if (finDeptId != null) {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("reportMonth", monthKey);
            meta.put("totalApprovedHours", round2(totalApproved));
            meta.put("totalManDays", round2(totalApproved / HOURS_PER_MAN_DAY));
            meta.put("totalLaborCost", saved.getTotalLaborCost());
            handoffService.createTaskIfNotOpen(
                    CrossDeptTaskType.FINANCE_PROJECT_COST_REVIEW,
                    techDeptId,
                    finDeptId,
                    actorId,
                    null,
                    "TECH_PROJECT_COST_REPORT",
                    saved.getId(),
                    "Đối soát giờ công & giá vốn dự án Công nghệ tháng " + monthKey,
                    actor.getHoTen() + " đã chốt gửi bảng đối soát " + round2(totalApproved) + "h ("
                            + round2(totalApproved / HOURS_PER_MAN_DAY) + " Man-days) của " + projectLines.size() + " dự án.",
                    meta,
                    CrossDeptTaskPriority.HIGH,
                    LocalDate.now(VN_ZONE).plusDays(3),
                    actorId
            );
            notifyFinanceMembers(
                    "FINANCE_PROJECT_COST_REVIEW",
                    "Bảng đối soát chi phí dự án Công nghệ tháng " + monthKey,
                    actor.getHoTen() + " đã chốt gửi bảng đối soát giờ công (" + round2(totalApproved) + "h / "
                            + round2(totalApproved / HOURS_PER_MAN_DAY) + " Man-days) chờ Phòng Tài chính xác nhận hạch toán.",
                    "THONG_TIN"
            );
        }

        broadcastSync("PROJECT_COST_SUBMITTED", saved.getId());
        return mapCostReport(saved, actor);
    }

    @Transactional(readOnly = true)
    public List<ProjectCostReportResponse> listProjectCostReports(Long actorId) {
        User actor = requireUser(actorId);
        List<TechProjectCostReport> list;
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN || isFinanceMember(actor)) {
            list = costReportRepository.findAllByOrderByReportMonthDescIdDesc();
        } else if (isTechManager(actor)) {
            list = costReportRepository.findByDepartmentIdOrderByReportMonthDescIdDesc(actor.getDepartmentId());
        } else {
            throw AppException.forbidden("Bạn không có quyền xem bảng đối soát chi phí dự án.");
        }
        return list.stream().map(r -> mapCostReport(r, actor)).toList();
    }

    @Transactional
    public ProjectCostReportResponse reviewProjectCostReport(
            Long reportId, ReviewProjectCostReportRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!isFinanceChief(actor) && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Kế toán trưởng hoặc Giám đốc Tài chính mới có quyền xác nhận/yêu cầu giải trình bảng đối soát chi phí dự án!");
        }
        TechProjectCostReport report = costReportRepository.findById(reportId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bảng đối soát ID: " + reportId));
        if (!"SUBMITTED".equals(report.getStatus())) {
            throw AppException.conflict("Chỉ có thể thẩm định bảng đối soát đang ở trạng thái Chờ xác nhận (SUBMITTED).");
        }
        String decision = req != null && req.getDecision() != null ? req.getDecision().trim().toUpperCase() : "";
        if (!"CONFIRMED".equals(decision) && !"DISPUTED".equals(decision)) {
            throw AppException.badRequest("Quyết định phải là CONFIRMED hoặc DISPUTED.");
        }
        String note = req.getFinanceNote() != null ? req.getFinanceNote().trim() : "";
        if ("DISPUTED".equals(decision) && note.length() < 5) {
            throw AppException.badRequest("Vui lòng nhập lý do yêu cầu giải trình (ít nhất 5 ký tự).");
        }

        report.setStatus(decision);
        report.setReviewedBy(actorId);
        report.setReviewedAt(nowVn());
        report.setFinanceNote(note.isEmpty() ? ("CONFIRMED".equals(decision) ? "Đã đối soát & xác nhận hạch toán giá vốn dự án." : null) : note);
        report.setAccountingVoucherNo(req.getAccountingVoucherNo() != null ? req.getAccountingVoucherNo().trim() : null);

        TechProjectCostReport saved = costReportRepository.save(report);

        // Đóng Handoff Task nếu CONFIRMED
        if ("CONFIRMED".equals(decision)) {
            completeRelatedHandoffTasks(
                    CrossDeptTaskType.FINANCE_PROJECT_COST_REVIEW,
                    "TECH_PROJECT_COST_REPORT",
                    saved.getId(),
                    actorId,
                    "Đã xác nhận hạch toán" + (saved.getAccountingVoucherNo() != null && !saved.getAccountingVoucherNo().isBlank()
                            ? " (Chứng từ: " + saved.getAccountingVoucherNo() + ")" : "")
            );
        }

        // Thông báo ngược cho Quản lý Phòng Công nghệ
        notifyTechManagers(
                saved.getDepartmentId(),
                "FINANCE_PROJECT_COST_REVIEW",
                ("CONFIRMED".equals(decision) ? "Tài chính đã xác nhận hạch toán tháng " : "Tài chính yêu cầu giải trình giờ công tháng ") + saved.getReportMonth(),
                actor.getHoTen() + ("CONFIRMED".equals(decision)
                        ? " đã xác nhận bảng đối soát chi phí dự án tháng " + saved.getReportMonth() + "."
                        : " yêu cầu giải trình bảng đối soát tháng " + saved.getReportMonth() + ": " + note),
                "DISPUTED".equals(decision) ? "CANH_BAO" : "THONG_TIN",
                "timesheet"
        );

        broadcastSync("PROJECT_COST_" + decision, saved.getId());
        return mapCostReport(saved, actor);
    }

    @Transactional(readOnly = true)
    public byte[] exportProjectCostReportExcel(Long reportId, Long actorId) {
        User actor = requireUser(actorId);
        TechProjectCostReport report = costReportRepository.findById(reportId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bảng đối soát ID: " + reportId));
        if (!isFinanceMember(actor) && !isTechManager(actor) && actor.getRole() != Role.CEO && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Bạn không có quyền xuất bảng đối soát này.");
        }
        ProjectCostReportResponse dto = mapCostReport(report, actor);
        boolean showMoney = dto.isCostVisible();

        try (Workbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            DataFormat df = wb.createDataFormat();
            CellStyle moneyStyle = wb.createCellStyle();
            moneyStyle.setDataFormat(df.getFormat("#,##0"));

            // Sheet 1: Tổng hợp Dự án
            Sheet s1 = wb.createSheet("TongHop_DuAn_" + dto.getReportMonth());
            String[] h1 = showMoney
                    ? new String[]{"Mã dự án", "Tên dự án", "Loại", "Giờ duyệt", "Giờ Billable", "Giờ Internal", "Man-days", "FTE", "Chi phí Nhân công (VNĐ)", "Ngân sách (VNĐ)", "% Ngân sách"}
                    : new String[]{"Mã dự án", "Tên dự án", "Loại", "Giờ duyệt", "Giờ Billable", "Giờ Internal", "Man-days", "FTE"};
            Row r0 = s1.createRow(0);
            for (int i = 0; i < h1.length; i++) {
                Cell c = r0.createCell(i);
                c.setCellValue(h1[i]);
                c.setCellStyle(headerStyle);
            }
            int rowIdx = 1;
            for (ProjectCostLineItem item : dto.getProjectBreakdowns()) {
                Row r = s1.createRow(rowIdx++);
                r.createCell(0).setCellValue(item.getProjectCode());
                r.createCell(1).setCellValue(item.getProjectName());
                r.createCell(2).setCellValue(item.getProjectType());
                r.createCell(3).setCellValue(item.getApprovedHours());
                r.createCell(4).setCellValue(item.getBillableHours());
                r.createCell(5).setCellValue(item.getInternalHours());
                r.createCell(6).setCellValue(item.getManDays());
                r.createCell(7).setCellValue(item.getFte());
                if (showMoney) {
                    Cell cCost = r.createCell(8);
                    cCost.setCellValue(item.getEstimatedLaborCost() != null ? item.getEstimatedLaborCost().doubleValue() : 0);
                    cCost.setCellStyle(moneyStyle);
                    Cell cBud = r.createCell(9);
                    cBud.setCellValue(item.getProjectBudgetAmount() != null ? item.getProjectBudgetAmount().doubleValue() : 0);
                    cBud.setCellStyle(moneyStyle);
                    r.createCell(10).setCellValue(item.getBudgetUtilizationPercent() != null ? item.getBudgetUtilizationPercent() + "%" : "—");
                }
            }
            for (int i = 0; i < h1.length; i++) s1.autoSizeColumn(i);

            // Sheet 2: Chi tiết Kỹ sư
            Sheet s2 = wb.createSheet("ChiTiet_KySu_" + dto.getReportMonth());
            String[] h2 = showMoney
                    ? new String[]{"Mã NV", "Họ tên", "Chức vụ", "Giờ duyệt", "Giờ Billable", "Giờ Internal", "Man-days", "Chi phí Nhân công (VNĐ)"}
                    : new String[]{"Mã NV", "Họ tên", "Chức vụ", "Giờ duyệt", "Giờ Billable", "Giờ Internal", "Man-days"};
            Row r20 = s2.createRow(0);
            for (int i = 0; i < h2.length; i++) {
                Cell c = r20.createCell(i);
                c.setCellValue(h2[i]);
                c.setCellStyle(headerStyle);
            }
            int rowIdx2 = 1;
            for (EngineerCostLineItem e : dto.getEngineerBreakdowns()) {
                Row r = s2.createRow(rowIdx2++);
                r.createCell(0).setCellValue(e.getEmployeeCode() != null ? e.getEmployeeCode() : "");
                r.createCell(1).setCellValue(e.getFullName() != null ? e.getFullName() : "");
                r.createCell(2).setCellValue(e.getPosition() != null ? e.getPosition() : "");
                r.createCell(3).setCellValue(e.getApprovedHours());
                r.createCell(4).setCellValue(e.getBillableHours());
                r.createCell(5).setCellValue(e.getInternalHours());
                r.createCell(6).setCellValue(e.getManDays());
                if (showMoney) {
                    Cell cCost = r.createCell(7);
                    cCost.setCellValue(e.getEstimatedLaborCost() != null ? e.getEstimatedLaborCost().doubleValue() : 0);
                    cCost.setCellStyle(moneyStyle);
                }
            }
            for (int i = 0; i < h2.length; i++) s2.autoSizeColumn(i);

            wb.write(bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Không thể xuất file Excel hạch toán dự án: " + e.getMessage(), e);
        }
    }

    // ─── MODULE F3: COMPENSATION SYNC & PAYROLL PERIOD LOCK ──────────────────

    @Transactional(readOnly = true)
    public PayrollLockHintResponse getPayrollLockHint(Long departmentId, String monthStr) {
        Long deptId = departmentId != null ? departmentId : handoffService.findTechDepartmentId();
        YearMonth ym = parseYearMonthOrCurrent(monthStr);
        String status = payrollPeriodLock.getDepartmentMonthStatus(deptId, ym).orElse(null);
        boolean locked = status != null;
        YearMonth suggested = locked ? ym.plusMonths(1) : ym;
        String msg = locked
                ? "Kỳ lương tháng " + ym.getMonthValue() + "/" + ym.getYear() + " đã bị khóa (" + status
                    + "). Đề xuất áp dụng từ tháng " + suggested.getMonthValue() + "/" + suggested.getYear() + "."
                : "Kỳ lương tháng " + ym.getMonthValue() + "/" + ym.getYear() + " đang mở — có thể áp dụng ngay hoặc hẹn sang tháng kế tiếp.";

        return PayrollLockHintResponse.builder()
                .departmentId(deptId)
                .requestedMonth(ym.toString())
                .locked(locked)
                .payrollStatus(status)
                .suggestedEffectiveMonth(suggested.toString())
                .message(msg)
                .build();
    }

    @Transactional(readOnly = true)
    public List<CompensationSyncResponse> listCompensationSyncs(Long actorId, String statusFilter) {
        User actor = requireUser(actorId);
        if (!canViewFinancialMoney(actor)) {
            throw AppException.forbidden("Theo nguyên tắc bảo mật lương B-10, chỉ Phòng Tài chính - Kế toán, Giám đốc Công nghệ và CEO mới có quyền xem danh sách đồng bộ tăng lương!");
        }
        List<TechCompensationSync> list = (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter))
                ? compensationSyncRepository.findByStatusOrderByEffectiveMonthAscCreatedAtAsc(statusFilter.toUpperCase())
                : compensationSyncRepository.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::mapCompSync).toList();
    }

    @Transactional
    public CompensationSyncResponse applyCompensationSync(
            Long syncId, ApplyCompensationSyncRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!isFinanceMember(actor) && actor.getRole() != Role.CEO && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Phòng Tài chính - Kế toán hoặc CEO mới có quyền xác nhận áp dụng điều chỉnh lương vào hồ sơ lương!");
        }
        TechCompensationSync sync = compensationSyncRepository.findById(syncId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy yêu cầu đồng bộ lương ID: " + syncId));
        if (!"PENDING_FINANCE_APPLY".equals(sync.getStatus())) {
            throw AppException.conflict("Bản ghi đồng bộ lương này đã được xử lý (" + sync.getStatus() + ").");
        }

        YearMonth effectiveYm = parseYearMonthOrCurrent(sync.getEffectiveMonth());
        if (payrollPeriodLock.isDepartmentMonthSubmittedOrPaid(sync.getDepartmentId(), effectiveYm)) {
            throw AppException.conflict("Bảng lương tháng " + effectiveYm.getMonthValue() + "/" + effectiveYm.getYear()
                    + " của Phòng Công nghệ đã gửi duyệt hoặc đã chi trả (kỳ lương đã khóa) — không thể áp dụng điều chỉnh lương vào kỳ này!");
        }

        User employee = userRepository.findById(sync.getEmployeeId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ sư ID: " + sync.getEmployeeId()));

        Double oldBs = employee.getBaseSalary();
        Double oldAl = employee.getAllowance();
        Double newBs = sync.getNewBaseSalary() != null ? sync.getNewBaseSalary().doubleValue() : oldBs;
        Double newAl = sync.getNewAllowance() != null ? sync.getNewAllowance().doubleValue() : oldAl;

        employee.setBaseSalary(newBs);
        employee.setAllowance(newAl);
        userRepository.save(employee);

        LocalDateTime now = nowVn();
        String finNote = (req != null && req.getFinanceNote() != null && !req.getFinanceNote().isBlank())
                ? req.getFinanceNote().trim()
                : "Phòng Tài chính đã đồng bộ mức lương mới áp dụng kỳ " + sync.getEffectiveMonth();

        salaryHistoryRepository.save(SalaryHistory.builder()
                .employeeId(employee.getId())
                .changedBy(actorId)
                .oldBaseSalary(oldBs)
                .newBaseSalary(newBs)
                .oldAllowance(oldAl)
                .newAllowance(newAl)
                .reason((sync.getCeoNote() != null ? sync.getCeoNote() : "Điều chỉnh lương từ đánh giá kỹ sư")
                        + " [Tài chính áp dụng kỳ " + sync.getEffectiveMonth() + "]")
                .changeDate(now)
                .build());

        employeeHistoryService.logHistory(
                employee.getId(),
                "SALARY_CHANGED",
                String.format("Lương CB: %.0f, Phụ cấp: %.0f", oldBs != null ? oldBs : 0, oldAl != null ? oldAl : 0),
                String.format("Lương CB: %.0f, Phụ cấp: %.0f", newBs != null ? newBs : 0, newAl != null ? newAl : 0),
                finNote
        );

        sync.setStatus("APPLIED");
        sync.setAppliedBy(actorId);
        sync.setAppliedAt(now);
        sync.setFinanceNote(finNote);
        TechCompensationSync saved = compensationSyncRepository.save(sync);

        completeRelatedHandoffTasks(
                CrossDeptTaskType.FINANCE_PAYROLL_SALARY_SYNC,
                "TECH_COMPENSATION_SYNC",
                saved.getId(),
                actorId,
                finNote
        );

        try {
            notificationService.createNotification(
                    employee.getId(),
                    "FINANCE_PAYROLL_SALARY_SYNC",
                    "Mức lương mới đã được áp dụng cho kỳ lương " + saved.getEffectiveMonth(),
                    "Phòng Tài chính - Kế toán đã cập nhật mức lương/phụ cấp mới theo quyết định của CEO vào kỳ lương " + saved.getEffectiveMonth() + ".",
                    "THONG_TIN",
                    "/employee/payroll"
            );
        } catch (Exception ignored) {}

        broadcastSync("COMPENSATION_SYNC_APPLIED", saved.getId());
        return mapCompSync(saved);
    }

    @Transactional(readOnly = true)
    public PayrollFinanceBannerResponse getPayrollBanner(int month, int year, Long actorId) {
        User actor = requireUser(actorId);
        YearMonth ym = YearMonth.of(year, month);
        String ymStr = ym.toString();

        if (!isFinanceMember(actor) && actor.getRole() != Role.CEO && actor.getRole() != Role.ADMIN) {
            return PayrollFinanceBannerResponse.builder()
                    .periodMonth(ymStr)
                    .pendingSalarySyncsCount(0)
                    .pendingSalarySyncs(Collections.emptyList())
                    .payrollCertReimbursementsCount(0)
                    .totalPayrollCertReimbursementsVnd(BigDecimal.ZERO)
                    .payrollCertReimbursements(Collections.emptyList())
                    .submittedCostReportsCount(0)
                    .build();
        }

        List<CompensationSyncResponse> pendingSyncs = compensationSyncRepository
                .findByStatusAndEffectiveMonthLessThanEqualOrderByEffectiveMonthAsc("PENDING_FINANCE_APPLY", ymStr)
                .stream()
                .map(this::mapCompSync)
                .toList();

        List<CertReimbursementResponse> payrollCerts = certReimbursementRepository
                .findByPayoutMethodAndPayoutPayrollMonthAndStatusIn("NEXT_PAYROLL", ymStr, List.of("FINANCE_APPROVED", "DISBURSED"))
                .stream()
                .map(this::mapCertReimb)
                .toList();

        BigDecimal totalCertVnd = payrollCerts.stream()
                .map(c -> c.getApprovedAmountVnd() != null ? c.getApprovedAmountVnd() : c.getRequestedAmountVnd())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int submittedCostCount = (int) costReportRepository.findByStatusOrderByReportMonthDescIdDesc("SUBMITTED").stream()
                .filter(r -> ymStr.equals(r.getReportMonth()))
                .count();

        return PayrollFinanceBannerResponse.builder()
                .periodMonth(ymStr)
                .pendingSalarySyncsCount(pendingSyncs.size())
                .pendingSalarySyncs(pendingSyncs)
                .payrollCertReimbursementsCount(payrollCerts.size())
                .totalPayrollCertReimbursementsVnd(totalCertVnd)
                .payrollCertReimbursements(payrollCerts)
                .submittedCostReportsCount(submittedCostCount)
                .build();
    }

    // ─── MODULE F4: CERTIFICATION REIMBURSEMENT WORKFLOW ─────────────────────

    @Transactional
    public CertReimbursementResponse createCertReimbursement(
            CreateCertReimbursementRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (req == null || req.getCertificateId() == null) {
            throw AppException.badRequest("Vui lòng chọn chứng chỉ quốc tế cần đề xuất hoàn ứng.");
        }
        UserTechCertificate cert = userTechCertificateRepository.findById(req.getCertificateId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chứng chỉ ID: " + req.getCertificateId()));

        boolean isOwner = cert.getUserId().equals(actorId);
        if (!isOwner && !isTechManager(actor)) {
            throw AppException.forbidden("Bạn chỉ có thể đề xuất hoàn ứng cho chứng chỉ của chính mình (hoặc Quản lý Công nghệ tạo hộ).");
        }
        if ((cert.getCredentialId() == null || cert.getCredentialId().isBlank())
                && (cert.getCredentialUrl() == null || cert.getCredentialUrl().isBlank())) {
            throw AppException.badRequest("Chứng chỉ cần có Mã xác thực (Credential ID) hoặc Link xác thực trước khi đề xuất hoàn ứng lệ phí!");
        }
        if (certReimbursementRepository.existsByCertificateIdAndStatusIn(
                cert.getId(), List.of("SUBMITTED", "TECH_APPROVED", "FINANCE_APPROVED", "DISBURSED"))) {
            throw AppException.conflict("Chứng chỉ này đã có yêu cầu hoàn ứng đang xử lý hoặc đã chi trả.");
        }
        if (req.getExamFeeVnd() == null || req.getExamFeeVnd().compareTo(BigDecimal.ZERO) <= 0) {
            throw AppException.badRequest("Lệ phí thi thực tế phải lớn hơn 0 VNĐ.");
        }
        BigDecimal requested = req.getRequestedAmountVnd() != null ? req.getRequestedAmountVnd() : req.getExamFeeVnd();
        if (requested.compareTo(BigDecimal.ZERO) <= 0 || requested.compareTo(req.getExamFeeVnd()) > 0) {
            throw AppException.badRequest("Số tiền đề xuất hỗ trợ phải > 0 và không vượt quá lệ phí thi thực tế.");
        }
        String invoice = req.getInvoiceNumber() != null ? req.getInvoiceNumber().trim() : "";
        String receiptUrl = req.getReceiptUrl() != null ? req.getReceiptUrl().trim() : "";
        if (invoice.isEmpty() && receiptUrl.isEmpty()) {
            throw AppException.badRequest("Vui lòng nhập Số hóa đơn/biên lai hoặc Link minh chứng thanh toán lệ phí.");
        }
        if (!receiptUrl.isEmpty() && !receiptUrl.matches("^https?://.*")) {
            throw AppException.badRequest("Link hóa đơn/biên lai phải bắt đầu bằng http:// hoặc https://");
        }

        User owner = requireUser(cert.getUserId());
        Long deptId = owner.getDepartmentId() != null ? owner.getDepartmentId() : handoffService.findTechDepartmentId();
        int supportPct = req.getSupportPercent() != null && req.getSupportPercent() > 0 && req.getSupportPercent() <= 100
                ? req.getSupportPercent()
                : requested.multiply(BigDecimal.valueOf(100))
                        .divide(req.getExamFeeVnd(), 0, RoundingMode.HALF_UP)
                        .intValue();
        int commitMonths = req.getCommitmentMonths() != null && req.getCommitmentMonths() >= 0
                ? Math.min(req.getCommitmentMonths(), 36) : 0;

        TechCertReimbursement entity = TechCertReimbursement.builder()
                .certificateId(cert.getId())
                .employeeId(owner.getId())
                .departmentId(deptId)
                .certificateName(cert.getCertificateName())
                .issuingOrganization(cert.getIssuingOrganization())
                .examFeeVnd(req.getExamFeeVnd().setScale(0, RoundingMode.HALF_UP))
                .requestedAmountVnd(requested.setScale(0, RoundingMode.HALF_UP))
                .supportPercent(supportPct)
                .invoiceNumber(invoice.isEmpty() ? null : invoice)
                .receiptUrl(receiptUrl.isEmpty() ? null : receiptUrl)
                .commitmentMonths(commitMonths)
                .employeeNote(req.getEmployeeNote() != null ? req.getEmployeeNote().trim() : null)
                .status("SUBMITTED")
                .build();

        TechCertReimbursement saved = certReimbursementRepository.save(entity);

        notifyTechManagers(
                deptId,
                "TECH_CERT_REIMBURSEMENT",
                "Đề xuất hoàn ứng chứng chỉ: " + owner.getHoTen() + " (" + cert.getCertificateName() + ")",
                owner.getHoTen() + " đề xuất hỗ trợ " + String.format("%,.0f", saved.getRequestedAmountVnd().doubleValue())
                        + " VNĐ lệ phí chứng chỉ " + cert.getCertificateName() + " — chờ Phòng Công nghệ xác thực chuyên môn.",
                "THONG_TIN",
                "skills"
        );

        broadcastSync("CERT_REIMB_CREATED", saved.getId());
        return mapCertReimb(saved);
    }

    @Transactional(readOnly = true)
    public List<CertReimbursementResponse> listCertReimbursements(Long actorId, String statusFilter) {
        User actor = requireUser(actorId);
        List<TechCertReimbursement> list;
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN || isFinanceMember(actor)) {
            list = certReimbursementRepository.findAllByOrderByCreatedAtDesc();
        } else if (isTechManager(actor)) {
            list = certReimbursementRepository.findByDepartmentIdOrderByCreatedAtDesc(actor.getDepartmentId());
        } else {
            list = certReimbursementRepository.findByEmployeeIdOrderByCreatedAtDesc(actorId);
        }
        if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
            String f = statusFilter.trim().toUpperCase();
            list = list.stream().filter(c -> f.equals(c.getStatus())).toList();
        }
        return list.stream().map(this::mapCertReimb).toList();
    }

    @Transactional
    public CertReimbursementResponse techReviewCertReimbursement(
            Long id, TechReviewCertReimbursementRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!isTechManager(actor)) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc Phòng Công nghệ mới có quyền xác thực chuyên môn chứng chỉ!");
        }
        TechCertReimbursement entity = certReimbursementRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy yêu cầu hoàn ứng chứng chỉ ID: " + id));
        if (!"SUBMITTED".equals(entity.getStatus())) {
            throw AppException.conflict("Chỉ có thể thẩm định yêu cầu đang ở trạng thái Chờ Công nghệ xác nhận (SUBMITTED).");
        }
        if (entity.getEmployeeId().equals(actorId)) {
            throw AppException.forbidden("Không được tự xác nhận yêu cầu hoàn ứng của chính mình!");
        }

        String decision = req != null && req.getDecision() != null ? req.getDecision().trim().toUpperCase() : "";
        String note = req != null && req.getNote() != null ? req.getNote().trim() : "";
        if (!"APPROVED".equals(decision) && !"REJECTED".equals(decision)) {
            throw AppException.badRequest("Quyết định phải là APPROVED hoặc REJECTED.");
        }
        if ("REJECTED".equals(decision) && note.length() < 5) {
            throw AppException.badRequest("Vui lòng nhập lý do từ chối (ít nhất 5 ký tự).");
        }

        entity.setTechReviewerId(actorId);
        entity.setTechReviewedAt(nowVn());
        entity.setTechNote(note.isEmpty() ? ("APPROVED".equals(decision) ? "Đã xác thực chứng chỉ hợp lệ và phù hợp định hướng chuyên môn." : null) : note);

        if ("APPROVED".equals(decision)) {
            entity.setStatus("TECH_APPROVED");
            TechCertReimbursement saved = certReimbursementRepository.save(entity);

            Long finDeptId = financeAccess.financeDepartmentId().orElse(null);
            User emp = userRepository.findById(saved.getEmployeeId()).orElse(null);
            String empName = emp != null ? emp.getHoTen() : ("User #" + saved.getEmployeeId());
            if (finDeptId != null) {
                Map<String, Object> meta = new LinkedHashMap<>();
                meta.put("certificateName", saved.getCertificateName());
                meta.put("requestedAmountVnd", saved.getRequestedAmountVnd());
                meta.put("invoiceNumber", saved.getInvoiceNumber());
                handoffService.createTaskIfNotOpen(
                        CrossDeptTaskType.FINANCE_CERT_REIMBURSEMENT,
                        saved.getDepartmentId(),
                        finDeptId,
                        saved.getEmployeeId(),
                        null,
                        "TECH_CERT_REIMBURSEMENT",
                        saved.getId(),
                        "Duyệt chi hoàn ứng Chứng chỉ Quốc tế: " + empName + " (" + saved.getCertificateName() + ")",
                        "Phòng Công nghệ đã xác thực chứng chỉ " + saved.getCertificateName()
                                + " (" + saved.getIssuingOrganization() + "). Số tiền đề xuất hỗ trợ: "
                                + String.format("%,.0f", saved.getRequestedAmountVnd().doubleValue()) + " VNĐ.",
                        meta,
                        CrossDeptTaskPriority.NORMAL,
                        LocalDate.now(VN_ZONE).plusDays(5),
                        actorId
                );
                notifyFinanceMembers(
                        "FINANCE_CERT_REIMBURSEMENT",
                        "Chờ duyệt chi chứng chỉ: " + empName + " (" + saved.getCertificateName() + ")",
                        actor.getHoTen() + " đã xác thực chuyên môn chứng chỉ " + saved.getCertificateName()
                                + " — đề xuất hoàn ứng " + String.format("%,.0f", saved.getRequestedAmountVnd().doubleValue()) + " VNĐ.",
                        "THONG_TIN"
                );
            }
            broadcastSync("CERT_REIMB_TECH_APPROVED", saved.getId());
            return mapCertReimb(saved);
        } else {
            entity.setStatus("REJECTED");
            entity.setRejectionReason(note);
            TechCertReimbursement saved = certReimbursementRepository.save(entity);
            try {
                notificationService.createNotification(
                        saved.getEmployeeId(),
                        "TECH_CERT_REIMBURSEMENT",
                        "Đề xuất hoàn ứng chứng chỉ chưa được duyệt: " + saved.getCertificateName(),
                        actor.getHoTen() + " đã từ chối yêu cầu. Lý do: " + note,
                        "CANH_BAO",
                        "/employee/my-projects"
                );
            } catch (Exception ignored) {}
            broadcastSync("CERT_REIMB_REJECTED", saved.getId());
            return mapCertReimb(saved);
        }
    }

    @Transactional
    public CertReimbursementResponse financeDecideCertReimbursement(
            Long id, FinanceDecisionCertReimbursementRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!isFinanceChief(actor) && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Kế toán trưởng hoặc Giám đốc Tài chính mới có quyền duyệt chi hoàn ứng chứng chỉ!");
        }
        TechCertReimbursement entity = certReimbursementRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy yêu cầu hoàn ứng ID: " + id));
        if (!"TECH_APPROVED".equals(entity.getStatus())) {
            throw AppException.conflict("Chỉ có thể duyệt chi cho yêu cầu đã được Phòng Công nghệ xác thực chuyên môn (TECH_APPROVED).");
        }
        String decision = req != null && req.getDecision() != null ? req.getDecision().trim().toUpperCase() : "";
        String note = req != null && req.getFinanceNote() != null ? req.getFinanceNote().trim() : "";
        if (!"APPROVED".equals(decision) && !"REJECTED".equals(decision)) {
            throw AppException.badRequest("Quyết định phải là APPROVED hoặc REJECTED.");
        }

        entity.setFinanceApproverId(actorId);
        entity.setFinanceApprovedAt(nowVn());

        if ("REJECTED".equals(decision)) {
            if (note.length() < 5) {
                throw AppException.badRequest("Vui lòng nhập lý do từ chối duyệt chi (ít nhất 5 ký tự).");
            }
            entity.setStatus("REJECTED");
            entity.setRejectionReason(note);
            entity.setFinanceNote(note);
            TechCertReimbursement saved = certReimbursementRepository.save(entity);
            completeRelatedHandoffTasks(
                    CrossDeptTaskType.FINANCE_CERT_REIMBURSEMENT,
                    "TECH_CERT_REIMBURSEMENT",
                    saved.getId(),
                    actorId,
                    "Tài chính từ chối: " + note
            );
            try {
                notificationService.createNotification(
                        saved.getEmployeeId(),
                        "FINANCE_CERT_REIMBURSEMENT",
                        "Phòng Tài chính từ chối hoàn ứng: " + saved.getCertificateName(),
                        actor.getHoTen() + " đã từ chối duyệt chi. Lý do: " + note,
                        "CANH_BAO",
                        "/employee/my-projects"
                );
            } catch (Exception ignored) {}
            broadcastSync("CERT_REIMB_REJECTED", saved.getId());
            return mapCertReimb(saved);
        }

        BigDecimal approvedAmt = req.getApprovedAmountVnd() != null ? req.getApprovedAmountVnd() : entity.getRequestedAmountVnd();
        if (approvedAmt.compareTo(BigDecimal.ZERO) <= 0 || approvedAmt.compareTo(entity.getExamFeeVnd()) > 0) {
            throw AppException.badRequest("Số tiền duyệt chi phải > 0 và không vượt quá lệ phí thi thực tế (" + entity.getExamFeeVnd() + " VNĐ).");
        }
        String payoutMethod = req.getPayoutMethod() != null ? req.getPayoutMethod().trim().toUpperCase() : "BANK_TRANSFER";
        if (!"BANK_TRANSFER".equals(payoutMethod) && !"NEXT_PAYROLL".equals(payoutMethod)) {
            throw AppException.badRequest("Phương thức chi phải là BANK_TRANSFER (Chuyển khoản riêng) hoặc NEXT_PAYROLL (Gộp kỳ lương).");
        }
        String payoutMonth = null;
        if ("NEXT_PAYROLL".equals(payoutMethod)) {
            YearMonth targetYm = parseYearMonthOrCurrent(req.getPayoutPayrollMonth());
            if (payrollPeriodLock.isDepartmentMonthSubmittedOrPaid(entity.getDepartmentId(), targetYm)) {
                throw AppException.conflict("Kỳ lương tháng " + targetYm.getMonthValue() + "/" + targetYm.getYear()
                        + " đã gửi duyệt hoặc đã chi trả (kỳ lương đã khóa). Vui lòng chọn tháng kế tiếp hoặc chuyển khoản riêng!");
            }
            payoutMonth = targetYm.toString();
        }

        entity.setStatus("FINANCE_APPROVED");
        entity.setApprovedAmountVnd(approvedAmt.setScale(0, RoundingMode.HALF_UP));
        entity.setPayoutMethod(payoutMethod);
        entity.setPayoutPayrollMonth(payoutMonth);
        entity.setFinanceNote(note.isEmpty() ? "Đã duyệt chi hoàn ứng lệ phí chứng chỉ." : note);
        TechCertReimbursement saved = certReimbursementRepository.save(entity);

        try {
            notificationService.createNotification(
                    saved.getEmployeeId(),
                    "FINANCE_CERT_REIMBURSEMENT",
                    "Đã duyệt chi hoàn ứng chứng chỉ: " + saved.getCertificateName(),
                    "Phòng Tài chính đã duyệt chi " + String.format("%,.0f", saved.getApprovedAmountVnd().doubleValue()) + " VNĐ ("
                            + ("NEXT_PAYROLL".equals(payoutMethod) ? "gộp kỳ lương " + payoutMonth : "chuyển khoản riêng") + ").",
                    "THONG_TIN",
                    "/employee/my-projects"
            );
        } catch (Exception ignored) {}

        broadcastSync("CERT_REIMB_FINANCE_APPROVED", saved.getId());
        return mapCertReimb(saved);
    }

    @Transactional
    public CertReimbursementResponse disburseCertReimbursement(
            Long id, DisburseCertReimbursementRequest req, Long actorId) {
        User actor = requireUser(actorId);
        if (!isFinanceMember(actor) && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ thành viên Phòng Tài chính - Kế toán mới có quyền xác nhận chi trả!");
        }
        TechCertReimbursement entity = certReimbursementRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy yêu cầu hoàn ứng ID: " + id));
        if (!"FINANCE_APPROVED".equals(entity.getStatus())) {
            throw AppException.conflict("Chỉ có thể xác nhận chi trả cho yêu cầu đã được Tài chính duyệt chi (FINANCE_APPROVED).");
        }
        String ref = req != null && req.getPaymentReference() != null ? req.getPaymentReference().trim() : "";
        if (ref.length() < 3) {
            throw AppException.badRequest("Vui lòng nhập Mã chứng từ / Mã giao dịch chi trả (ít nhất 3 ký tự).");
        }

        entity.setStatus("DISBURSED");
        entity.setPaymentReference(ref);
        entity.setDisbursedBy(actorId);
        entity.setDisbursedAt(nowVn());
        if (req.getFinanceNote() != null && !req.getFinanceNote().isBlank()) {
            entity.setFinanceNote(req.getFinanceNote().trim());
        }
        TechCertReimbursement saved = certReimbursementRepository.save(entity);

        completeRelatedHandoffTasks(
                CrossDeptTaskType.FINANCE_CERT_REIMBURSEMENT,
                "TECH_CERT_REIMBURSEMENT",
                saved.getId(),
                actorId,
                "Đã chi trả " + String.format("%,.0f", saved.getApprovedAmountVnd().doubleValue()) + " VNĐ (Mã CT: " + ref + ")"
        );

        try {
            notificationService.createNotification(
                    saved.getEmployeeId(),
                    "FINANCE_CERT_REIMBURSEMENT",
                    "Đã chi trả hoàn ứng chứng chỉ: " + saved.getCertificateName(),
                    "Phòng Tài chính đã hoàn tất chi trả " + String.format("%,.0f", saved.getApprovedAmountVnd().doubleValue())
                            + " VNĐ (Mã chứng từ: " + ref + ").",
                    "THONG_TIN",
                    "/employee/my-projects"
            );
        } catch (Exception ignored) {}

        broadcastSync("CERT_REIMB_DISBURSED", saved.getId());
        return mapCertReimb(saved);
    }

    // ─── INTERNAL HELPERS ─────────────────────────────────────────────────────

    private BigDecimal computeLogLaborCost(User eng, double hours) {
        if (eng == null || hours <= 0) return BigDecimal.ZERO;
        double bs = eng.getBaseSalary() != null ? eng.getBaseSalary() : 0.0;
        double al = eng.getAllowance() != null ? eng.getAllowance() : 0.0;
        if (bs <= 0 && al <= 0) return BigDecimal.ZERO;
        double hourlyRate = (bs + al) / STANDARD_HOURS_PER_MONTH;
        return BigDecimal.valueOf(hourlyRate * hours);
    }

    private ProjectCostReportResponse mapCostReport(TechProjectCostReport r, User viewer) {
        boolean showMoney = canViewFinancialMoney(viewer);
        List<ProjectCostLineItem> pLines = readProjectLines(r.getProjectBreakdownJson());
        List<EngineerCostLineItem> eLines = readEngineerLines(r.getEngineerBreakdownJson());

        if (!showMoney) {
            pLines = pLines.stream().map(p -> ProjectCostLineItem.builder()
                    .projectId(p.getProjectId())
                    .projectCode(p.getProjectCode())
                    .projectName(p.getProjectName())
                    .projectType(p.getProjectType())
                    .approvedHours(p.getApprovedHours())
                    .billableHours(p.getBillableHours())
                    .internalHours(p.getInternalHours())
                    .manDays(p.getManDays())
                    .fte(p.getFte())
                    .estimatedLaborCost(null)
                    .projectBudgetAmount(null)
                    .budgetUtilizationPercent(null)
                    .build()).toList();
            eLines = eLines.stream().map(e -> EngineerCostLineItem.builder()
                    .userId(e.getUserId())
                    .employeeCode(e.getEmployeeCode())
                    .fullName(e.getFullName())
                    .position(e.getPosition())
                    .approvedHours(e.getApprovedHours())
                    .billableHours(e.getBillableHours())
                    .internalHours(e.getInternalHours())
                    .manDays(e.getManDays())
                    .estimatedLaborCost(null)
                    .build()).toList();
        } else if (!pLines.isEmpty()) {
            // Đồng bộ ngân sách dự án mới nhất (đặc biệt khi Tài chính vừa cấu hình ngân sách sau lúc Tech gửi đối soát)
            Set<Long> pids = pLines.stream().map(ProjectCostLineItem::getProjectId).filter(Objects::nonNull).collect(Collectors.toSet());
            Map<Long, BigDecimal> liveBudgets = new HashMap<>();
            if (!pids.isEmpty()) {
                for (TechProject tp : techProjectRepository.findAllById(pids)) {
                    if (tp.getBudgetAmount() != null) {
                        liveBudgets.put(tp.getId(), tp.getBudgetAmount());
                    }
                }
            }
            pLines = pLines.stream().map(p -> {
                BigDecimal budget = (!"CONFIRMED".equals(r.getStatus()) && liveBudgets.containsKey(p.getProjectId()))
                        ? liveBudgets.get(p.getProjectId())
                        : (p.getProjectBudgetAmount() != null ? p.getProjectBudgetAmount() : liveBudgets.get(p.getProjectId()));
                Double utilPct = p.getBudgetUtilizationPercent();
                if (budget != null && budget.compareTo(BigDecimal.ZERO) > 0 && p.getEstimatedLaborCost() != null) {
                    utilPct = p.getEstimatedLaborCost().multiply(BigDecimal.valueOf(100))
                            .divide(budget, 1, RoundingMode.HALF_UP)
                            .doubleValue();
                } else {
                    utilPct = null;
                }
                return ProjectCostLineItem.builder()
                        .projectId(p.getProjectId())
                        .projectCode(p.getProjectCode())
                        .projectName(p.getProjectName())
                        .projectType(p.getProjectType())
                        .approvedHours(p.getApprovedHours())
                        .billableHours(p.getBillableHours())
                        .internalHours(p.getInternalHours())
                        .manDays(p.getManDays())
                        .fte(p.getFte())
                        .estimatedLaborCost(p.getEstimatedLaborCost())
                        .projectBudgetAmount(budget)
                        .budgetUtilizationPercent(utilPct)
                        .build();
            }).toList();
        }

        double totalApp = r.getTotalApprovedHours() != null ? r.getTotalApprovedHours().doubleValue() : 0.0;
        double totalBill = r.getTotalBillableHours() != null ? r.getTotalBillableHours().doubleValue() : 0.0;
        double billRatio = totalApp > 0 ? round2((totalBill / totalApp) * 100.0) : 0.0;

        String deptName = departmentRepository.findById(r.getDepartmentId()).map(Department::getTenPhong).orElse("Công nghệ");
        String submittedByName = userRepository.findById(r.getSubmittedBy()).map(User::getHoTen).orElse(null);
        String reviewedByName = r.getReviewedBy() != null
                ? userRepository.findById(r.getReviewedBy()).map(User::getHoTen).orElse(null) : null;

        // Cross-check với PayrollReport tháng tương ứng của Phòng Công nghệ
        String payrollStatus = null;
        BigDecimal payrollNet = null;
        try {
            YearMonth ym = YearMonth.parse(r.getReportMonth());
            Optional<PayrollReport> pr = payrollReportRepository
                    .findByDepartmentIdAndMonthAndYearAndReportLevel(
                            r.getDepartmentId(), ym.getMonthValue(), ym.getYear(), PayrollService.LEVEL_DEPARTMENT)
                    .stream().findFirst();
            if (pr.isPresent()) {
                payrollStatus = pr.get().getStatus();
                if (showMoney && pr.get().getTotalNetSalary() != null) {
                    payrollNet = BigDecimal.valueOf(pr.get().getTotalNetSalary()).setScale(0, RoundingMode.HALF_UP);
                }
            }
        } catch (Exception ignored) {}

        return ProjectCostReportResponse.builder()
                .id(r.getId())
                .reportMonth(r.getReportMonth())
                .departmentId(r.getDepartmentId())
                .departmentName(deptName)
                .status(r.getStatus())
                .totalApprovedHours(totalApp)
                .totalBillableHours(totalBill)
                .totalInternalHours(r.getTotalInternalHours() != null ? r.getTotalInternalHours().doubleValue() : 0.0)
                .billableRatioPercent(billRatio)
                .totalManDays(r.getTotalManDays() != null ? r.getTotalManDays().doubleValue() : 0.0)
                .totalLaborCost(showMoney ? r.getTotalLaborCost() : null)
                .pendingWorklogsAtSubmit(r.getPendingWorklogsAtSubmit() != null ? r.getPendingWorklogsAtSubmit() : 0)
                .costVisible(showMoney)
                .payrollBatchStatus(payrollStatus)
                .payrollTotalNetSalary(payrollNet)
                .projectBreakdowns(pLines)
                .engineerBreakdowns(eLines)
                .submittedBy(r.getSubmittedBy())
                .submittedByName(submittedByName)
                .submittedAt(r.getSubmittedAt())
                .submitNote(r.getSubmitNote())
                .reviewedBy(r.getReviewedBy())
                .reviewedByName(reviewedByName)
                .reviewedAt(r.getReviewedAt())
                .accountingVoucherNo(r.getAccountingVoucherNo())
                .financeNote(r.getFinanceNote())
                .build();
    }

    private CompensationSyncResponse mapCompSync(TechCompensationSync s) {
        User emp = userRepository.findById(s.getEmployeeId()).orElse(null);
        String deptName = departmentRepository.findById(s.getDepartmentId()).map(Department::getTenPhong).orElse("Công nghệ");
        String ceoName = userRepository.findById(s.getApprovedByCeo()).map(User::getHoTen).orElse(null);
        String appliedName = s.getAppliedBy() != null
                ? userRepository.findById(s.getAppliedBy()).map(User::getHoTen).orElse(null) : null;

        boolean lockedForSubmit = false;
        String periodStatus = null;
        try {
            YearMonth ym = YearMonth.parse(s.getEffectiveMonth());
            periodStatus = payrollPeriodLock.getDepartmentMonthStatus(s.getDepartmentId(), ym).orElse(null);
            lockedForSubmit = payrollPeriodLock.isDepartmentMonthSubmittedOrPaid(s.getDepartmentId(), ym);
        } catch (Exception ignored) {}

        return CompensationSyncResponse.builder()
                .id(s.getId())
                .reviewId(s.getReviewId())
                .employeeId(s.getEmployeeId())
                .employeeCode(emp != null ? emp.getMaNhanVien() : null)
                .employeeName(emp != null ? emp.getHoTen() : ("User #" + s.getEmployeeId()))
                .employeeEmail(emp != null ? emp.getEmail() : null)
                .departmentId(s.getDepartmentId())
                .departmentName(deptName)
                .oldTitle(s.getOldTitle())
                .newTitle(s.getNewTitle())
                .oldBaseSalary(s.getOldBaseSalary())
                .newBaseSalary(s.getNewBaseSalary())
                .oldAllowance(s.getOldAllowance())
                .newAllowance(s.getNewAllowance())
                .effectiveMonth(s.getEffectiveMonth())
                .status(s.getStatus())
                .effectivePeriodLockedForSubmit(lockedForSubmit)
                .effectivePeriodPayrollStatus(periodStatus)
                .approvedByCeo(s.getApprovedByCeo())
                .approvedByCeoName(ceoName)
                .approvedAt(s.getApprovedAt())
                .ceoNote(s.getCeoNote())
                .appliedBy(s.getAppliedBy())
                .appliedByName(appliedName)
                .appliedAt(s.getAppliedAt())
                .financeNote(s.getFinanceNote())
                .build();
    }

    private CertReimbursementResponse mapCertReimb(TechCertReimbursement c) {
        User emp = userRepository.findById(c.getEmployeeId()).orElse(null);
        UserTechCertificate cert = userTechCertificateRepository.findById(c.getCertificateId()).orElse(null);
        String deptName = departmentRepository.findById(c.getDepartmentId()).map(Department::getTenPhong).orElse("Công nghệ");
        String techRevName = c.getTechReviewerId() != null
                ? userRepository.findById(c.getTechReviewerId()).map(User::getHoTen).orElse(null) : null;
        String finAppName = c.getFinanceApproverId() != null
                ? userRepository.findById(c.getFinanceApproverId()).map(User::getHoTen).orElse(null) : null;
        String disbName = c.getDisbursedBy() != null
                ? userRepository.findById(c.getDisbursedBy()).map(User::getHoTen).orElse(null) : null;

        return CertReimbursementResponse.builder()
                .id(c.getId())
                .certificateId(c.getCertificateId())
                .employeeId(c.getEmployeeId())
                .employeeCode(emp != null ? emp.getMaNhanVien() : null)
                .employeeName(emp != null ? emp.getHoTen() : ("User #" + c.getEmployeeId()))
                .employeePosition(emp != null ? emp.getChucVu() : null)
                .departmentId(c.getDepartmentId())
                .departmentName(deptName)
                .certificateName(c.getCertificateName())
                .issuingOrganization(c.getIssuingOrganization())
                .credentialId(cert != null ? cert.getCredentialId() : null)
                .credentialUrl(cert != null ? cert.getCredentialUrl() : null)
                .examFeeVnd(c.getExamFeeVnd())
                .requestedAmountVnd(c.getRequestedAmountVnd())
                .approvedAmountVnd(c.getApprovedAmountVnd())
                .supportPercent(c.getSupportPercent())
                .invoiceNumber(c.getInvoiceNumber())
                .receiptUrl(c.getReceiptUrl())
                .commitmentMonths(c.getCommitmentMonths())
                .employeeNote(c.getEmployeeNote())
                .status(c.getStatus())
                .techReviewerId(c.getTechReviewerId())
                .techReviewerName(techRevName)
                .techReviewedAt(c.getTechReviewedAt())
                .techNote(c.getTechNote())
                .financeApproverId(c.getFinanceApproverId())
                .financeApproverName(finAppName)
                .financeApprovedAt(c.getFinanceApprovedAt())
                .financeNote(c.getFinanceNote())
                .payoutMethod(c.getPayoutMethod())
                .payoutPayrollMonth(c.getPayoutPayrollMonth())
                .paymentReference(c.getPaymentReference())
                .disbursedBy(c.getDisbursedBy())
                .disbursedByName(disbName)
                .disbursedAt(c.getDisbursedAt())
                .rejectionReason(c.getRejectionReason())
                .createdAt(c.getCreatedAt())
                .build();
    }

    private void completeRelatedHandoffTasks(
            CrossDeptTaskType type, String refType, Long refId, Long actorId, String note) {
        List<CrossDeptHandoffTask> tasks = handoffTaskRepository
                .findByReferenceTypeAndReferenceIdAndStatusIn(
                        refType, refId, List.of(CrossDeptTaskStatus.OPEN, CrossDeptTaskStatus.IN_PROGRESS));
        for (CrossDeptHandoffTask t : tasks) {
            if (t.getTaskType() == type) {
                t.setStatus(CrossDeptTaskStatus.COMPLETED);
                t.setCompletedBy(actorId);
                t.setCompletedAt(nowVn());
                t.setResolutionNote(note);
                handoffTaskRepository.save(t);
            }
        }
    }

    private void notifyFinanceMembers(String type, String title, String content, String level) {
        for (User acc : financeAccess.accountants()) {
            String path = acc.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director/finance-tech"
                    : acc.getRole() == Role.TRUONG_PHONG ? "/manager/finance-tech" : "/employee/finance-tech";
            try {
                notificationService.createNotification(acc.getId(), type, title, content, level, path);
            } catch (Exception ignored) {}
        }
    }

    private void notifyTechManagers(Long techDeptId, String type, String title, String content, String level, String tab) {
        if (techDeptId == null) return;
        userRepository.findByDepartmentId(techDeptId).stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                .forEach(mgr -> {
                    String prefix = mgr.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director" : "/manager";
                    try {
                        notificationService.createNotification(
                                mgr.getId(), type, title, content, level, prefix + "/tech-projects?tab=" + tab);
                    } catch (Exception ignored) {}
                });
    }

    private void broadcastSync(String action, Long entityId) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("domain", "TECH_FINANCE");
            payload.put("action", action);
            payload.put("entityId", entityId);
            notificationService.broadcastTopic("/topic/tech-updates", payload);
        } catch (Exception ignored) {}
    }

    private String writeJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<ProjectCostLineItem> readProjectLines(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<ProjectCostLineItem>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<EngineerCostLineItem> readEngineerLines(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<EngineerCostLineItem>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
