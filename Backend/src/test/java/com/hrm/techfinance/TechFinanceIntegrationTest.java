package com.hrm.techfinance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.approval.entity.ApprovalStep;
import com.hrm.approval.entity.ApprovalStepStatus;
import com.hrm.approval.service.ApprovalService;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.payroll.repository.SalaryHistoryRepository;
import com.hrm.common.payroll.service.FinanceAccess;
import com.hrm.common.payroll.service.PayrollPeriodLock;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
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
import com.hrm.techfinance.service.TechFinanceIntegrationService;
import com.hrm.techhr.repository.CrossDeptHandoffTaskRepository;
import com.hrm.techhr.service.CrossDeptHandoffService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TechFinanceIntegrationTest {

    @Mock private TechProjectCostReportRepository costReportRepository;
    @Mock private TechCompensationSyncRepository compensationSyncRepository;
    @Mock private TechCertReimbursementRepository certReimbursementRepository;
    @Mock private TechProjectRepository techProjectRepository;
    @Mock private TechWorklogRepository techWorklogRepository;
    @Mock private UserTechCertificateRepository userTechCertificateRepository;
    @Mock private UserRepository userRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private PayrollReportRepository payrollReportRepository;
    @Mock private SalaryHistoryRepository salaryHistoryRepository;
    @Mock private EmployeeHistoryService employeeHistoryService;
    @Mock private PayrollPeriodLock payrollPeriodLock;
    @Mock private FinanceAccess financeAccess;
    @Mock private CrossDeptHandoffService handoffService;
    @Mock private CrossDeptHandoffTaskRepository handoffTaskRepository;
    @Mock private JobRequisitionRepository jobRequisitionRepository;
    @Mock private ApprovalService approvalService;
    @Mock private NotificationService notificationService;

    private TechFinanceIntegrationService service;

    private User techManager;
    private User techEngineer;
    private User financeChief;
    private User financeDirector;
    private User financeStaff;
    private User ceo;

    @BeforeEach
    void setUp() {
        service = new TechFinanceIntegrationService(
                costReportRepository,
                compensationSyncRepository,
                certReimbursementRepository,
                techProjectRepository,
                techWorklogRepository,
                userTechCertificateRepository,
                userRepository,
                departmentRepository,
                payrollReportRepository,
                salaryHistoryRepository,
                employeeHistoryService,
                payrollPeriodLock,
                financeAccess,
                handoffService,
                handoffTaskRepository,
                jobRequisitionRepository,
                approvalService,
                notificationService,
                new ObjectMapper()
        );

        techManager = User.builder().id(10L).hoTen("Trưởng Phòng CN").role(Role.TRUONG_PHONG).departmentId(2L).active(true).build();
        techEngineer = User.builder().id(11L).hoTen("Nguyễn Hoàng Nam").maNhanVien("02000002").chucVu("Senior Dev")
                .role(Role.NHAN_VIEN).departmentId(2L).baseSalary(35_200_000.0).allowance(0.0).active(true).build();
        financeChief = User.builder().id(20L).hoTen("Nguyễn Thị Kế Toán Trưởng").role(Role.TRUONG_PHONG).departmentId(3L).active(true).build();
        financeDirector = User.builder().id(21L).hoTen("Lê Minh GĐ Tài Chính").role(Role.GIAM_DOC_PHONG_BAN).departmentId(3L).active(true).build();
        financeStaff = User.builder().id(22L).hoTen("Trần Minh Kế Toán").role(Role.NHAN_VIEN).departmentId(3L).active(true).build();
        ceo = User.builder().id(1L).hoTen("CEO").role(Role.CEO).departmentId(null).active(true).build();
    }

    @Test
    void testSubmitCostReportAndB10Masking_HidesMoneyFromTechManagerShowsToFinance() {
        TechProject prj = TechProject.builder()
                .id(1L).projectCode("PRJ-HRM-AI").projectName("HRM AI").projectType(ProjectType.INTERNAL)
                .budgetAmount(new BigDecimal("100000000")).build();
        TechWorklog log1 = TechWorklog.builder()
                .id(100L).project(prj).userId(11L).workDate(LocalDate.of(2026, 11, 10))
                .hoursSpent(new BigDecimal("8.00")).isBillable(true).approvalStatus(WorklogApprovalStatus.APPROVED).build();
        TechWorklog log2 = TechWorklog.builder()
                .id(101L).project(prj).userId(11L).workDate(LocalDate.of(2026, 11, 11))
                .hoursSpent(new BigDecimal("4.00")).isBillable(false).approvalStatus(WorklogApprovalStatus.APPROVED).build();

        when(userRepository.findById(10L)).thenReturn(Optional.of(techManager));
        when(userRepository.findById(20L)).thenReturn(Optional.of(financeChief));
        when(handoffService.isTechDepartment(2L)).thenReturn(true);
        when(costReportRepository.findByReportMonthAndDepartmentId("2026-11", 2L)).thenReturn(Optional.empty());
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(techManager, techEngineer));
        when(userRepository.findAll()).thenReturn(List.of(techManager, techEngineer, financeChief));
        when(techWorklogRepository.findAllForAnalyticsInRange(any(), any())).thenReturn(List.of(log1, log2));
        when(costReportRepository.save(any())).thenAnswer(inv -> {
            TechProjectCostReport r = inv.getArgument(0);
            r.setId(500L);
            return r;
        });
        when(financeAccess.financeDepartmentId()).thenReturn(Optional.of(3L));
        when(financeAccess.accountants()).thenReturn(List.of(financeChief, financeStaff));
        when(departmentRepository.findById(2L)).thenReturn(Optional.of(Department.builder().id(2L).tenPhong("Công nghệ").build()));
        when(payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(anyLong(), anyInt(), anyInt(), anyString()))
                .thenReturn(Collections.emptyList());

        ProjectCostReportResponse techView = service.submitMonthlyProjectCostReport(
                SubmitProjectCostReportRequest.builder().reportMonth("2026-11").submitNote("Chốt tháng 11").build(), 10L);

        // B-10: Trưởng phòng Công nghệ thấy giờ công & Man-days nhưng KHÔNG thấy số tiền VNĐ
        assertEquals(12.0, techView.getTotalApprovedHours());
        assertEquals(8.0, techView.getTotalBillableHours());
        assertEquals(1.5, techView.getTotalManDays());
        assertFalse(techView.isCostVisible());
        assertNull(techView.getTotalLaborCost());

        // Phòng Tài chính thấy đầy đủ chi phí nhân công VNĐ (35.2M / 176h * 12h = 2,400,000 VNĐ)
        TechProjectCostReport savedEntity = TechProjectCostReport.builder()
                .id(500L).reportMonth("2026-11").departmentId(2L).status("SUBMITTED")
                .totalApprovedHours(new BigDecimal("12.00")).totalBillableHours(new BigDecimal("8.00"))
                .totalInternalHours(new BigDecimal("4.00")).totalManDays(new BigDecimal("1.50"))
                .totalLaborCost(new BigDecimal("2400000"))
                .projectBreakdownJson("[]").engineerBreakdownJson("[]")
                .submittedBy(10L).submittedAt(LocalDateTime.now()).build();
        when(costReportRepository.findAllByOrderByReportMonthDescIdDesc()).thenReturn(List.of(savedEntity));

        List<ProjectCostReportResponse> finReports = service.listProjectCostReports(20L);
        assertEquals(1, finReports.size());
        assertTrue(finReports.get(0).isCostVisible());
        assertEquals(new BigDecimal("2400000"), finReports.get(0).getTotalLaborCost());
    }

    @Test
    void testApplyCompensationSync_RespectsPayrollPeriodLock() {
        TechCompensationSync sync = TechCompensationSync.builder()
                .id(70L).reviewId(99L).employeeId(11L).departmentId(2L)
                .oldBaseSalary(new BigDecimal("35200000")).newBaseSalary(new BigDecimal("42000000"))
                .oldAllowance(BigDecimal.ZERO).newAllowance(new BigDecimal("2000000"))
                .effectiveMonth("2026-12").status("PENDING_FINANCE_APPLY")
                .approvedByCeo(1L).approvedAt(LocalDateTime.now()).build();

        when(userRepository.findById(20L)).thenReturn(Optional.of(financeChief));
        when(financeAccess.financeDepartmentId()).thenReturn(Optional.of(3L));
        when(compensationSyncRepository.findById(70L)).thenReturn(Optional.of(sync));

        // 1. Khi kỳ 2026-12 đã gửi duyệt / PAID -> chặn 409 Conflict
        when(payrollPeriodLock.isDepartmentMonthSubmittedOrPaid(2L, YearMonth.of(2026, 12))).thenReturn(true);
        assertThrows(AppException.class, () -> service.applyCompensationSync(70L, new ApplyCompensationSyncRequest(), 20L));

        // 2. Khi kỳ 2026-12 đang mở -> áp dụng thành công vào users + SalaryHistory
        when(payrollPeriodLock.isDepartmentMonthSubmittedOrPaid(2L, YearMonth.of(2026, 12))).thenReturn(false);
        when(userRepository.findById(11L)).thenReturn(Optional.of(techEngineer));
        when(userRepository.findById(1L)).thenReturn(Optional.of(ceo));
        when(departmentRepository.findById(2L)).thenReturn(Optional.of(Department.builder().id(2L).tenPhong("Công nghệ").build()));
        when(compensationSyncRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(handoffTaskRepository.findByReferenceTypeAndReferenceIdAndStatusIn(any(), any(), any())).thenReturn(Collections.emptyList());

        CompensationSyncResponse applied = service.applyCompensationSync(
                70L, ApplyCompensationSyncRequest.builder().financeNote("Áp dụng kỳ 12/2026").build(), 20L);

        assertEquals("APPLIED", applied.getStatus());
        assertEquals(42_000_000.0, techEngineer.getBaseSalary());
        assertEquals(2_000_000.0, techEngineer.getAllowance());
        verify(salaryHistoryRepository, times(1)).save(any());
    }

    @Test
    void testCertReimbursementLifecycle_FullEndToEndAndDisburse() {
        UserTechCertificate cert = UserTechCertificate.builder()
                .id(30L).userId(11L).certificateName("AWS Solutions Architect Associate")
                .issuingOrganization("AWS").credentialId("AWS-SAA-9981").credentialUrl("https://aws.amazon.com/verify").build();

        when(userRepository.findById(11L)).thenReturn(Optional.of(techEngineer));
        when(userRepository.findById(10L)).thenReturn(Optional.of(techManager));
        when(userRepository.findById(21L)).thenReturn(Optional.of(financeDirector));
        when(userRepository.findById(22L)).thenReturn(Optional.of(financeStaff));
        when(userTechCertificateRepository.findById(30L)).thenReturn(Optional.of(cert));
        when(certReimbursementRepository.existsByCertificateIdAndStatusIn(eq(30L), any())).thenReturn(false);
        when(departmentRepository.findById(2L)).thenReturn(Optional.of(Department.builder().id(2L).tenPhong("Công nghệ").build()));
        when(handoffService.isTechDepartment(2L)).thenReturn(true);
        when(financeAccess.financeDepartmentId()).thenReturn(Optional.of(3L));
        when(financeAccess.accountants()).thenReturn(List.of(financeDirector, financeChief, financeStaff));
        when(certReimbursementRepository.save(any())).thenAnswer(inv -> {
            TechCertReimbursement e = inv.getArgument(0);
            if (e.getId() == null) e.setId(80L);
            return e;
        });

        // 1. Kỹ sư nộp đề xuất
        CertReimbursementResponse created = service.createCertReimbursement(
                CreateCertReimbursementRequest.builder()
                        .certificateId(30L)
                        .examFeeVnd(new BigDecimal("3800000"))
                        .requestedAmountVnd(new BigDecimal("3800000"))
                        .supportPercent(100)
                        .invoiceNumber("INV-AWS-2026")
                        .commitmentMonths(6)
                        .build(), 11L);
        assertEquals("SUBMITTED", created.getStatus());

        TechCertReimbursement stored = TechCertReimbursement.builder()
                .id(80L).certificateId(30L).employeeId(11L).departmentId(2L)
                .certificateName("AWS Solutions Architect Associate").issuingOrganization("AWS")
                .examFeeVnd(new BigDecimal("3800000")).requestedAmountVnd(new BigDecimal("3800000"))
                .supportPercent(100).invoiceNumber("INV-AWS-2026").status("SUBMITTED").build();
        when(certReimbursementRepository.findById(80L)).thenReturn(Optional.of(stored));

        // 2. Trưởng phòng Công nghệ xác thực chuyên môn
        CertReimbursementResponse techOk = service.techReviewCertReimbursement(
                80L, TechReviewCertReimbursementRequest.builder().decision("APPROVED").note("Chứng chỉ hợp lệ").build(), 10L);
        assertEquals("TECH_APPROVED", techOk.getStatus());

        // 3. Giám đốc Tài chính duyệt chi
        CertReimbursementResponse finOk = service.financeDecideCertReimbursement(
                80L, FinanceDecisionCertReimbursementRequest.builder()
                        .decision("APPROVED").approvedAmountVnd(new BigDecimal("3800000"))
                        .payoutMethod("BANK_TRANSFER").financeNote("Duyệt chi từ quỹ đào tạo").build(), 21L);
        assertEquals("FINANCE_APPROVED", finOk.getStatus());

        // 4. Kế toán viên xác nhận đã chi trả
        when(handoffTaskRepository.findByReferenceTypeAndReferenceIdAndStatusIn(any(), any(), any())).thenReturn(Collections.emptyList());
        CertReimbursementResponse disbursed = service.disburseCertReimbursement(
                80L, DisburseCertReimbursementRequest.builder().paymentReference("UNC-2026-1124").build(), 22L);
        assertEquals("DISBURSED", disbursed.getStatus());
        assertEquals("UNC-2026-1124", disbursed.getPaymentReference());
    }

    @Test
    void testApprovalStepFinanceScopeAllowsBothChiefAndFinanceDirector() {
        ApprovalStep financeStep = ApprovalStep.pending(
                1L, 2, Role.TRUONG_PHONG, 20L, "Resolved", "FINANCE_DEPARTMENT", "Phòng Tài chính thẩm định ngân sách");
        assertEquals(ApprovalStepStatus.PENDING, financeStep.getStatus());
        assertEquals("FINANCE_DEPARTMENT", financeStep.getStepScope());
        assertEquals("Phòng Tài chính thẩm định ngân sách", financeStep.getStepLabel());
    }
}
