package com.hrm.common.payroll.service;

import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Luồng lương: chốt công -> kế toán -> GĐ phòng -> kế toán trưởng -> CEO -> chi trả. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PayrollWorkflowTest {

    private static final long SALES = 1L;
    private static final long FINANCE = 9L;

    @Mock private PayrollRepository payrollRepository;
    @Mock private HolidayRepository holidayRepository;
    @Mock private AttendanceRepository attendanceRepository;
    @Mock private UserRepository userRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private NotificationService notificationService;
    @Mock private PayrollReportRepository payrollReportRepository;

    private PayrollService service;

    private final User salesManager = user(10L, Role.TRUONG_PHONG, SALES);
    private final User salesDirector = user(11L, Role.GIAM_DOC_PHONG_BAN, SALES);
    private final User salesStaff = user(12L, Role.NHAN_VIEN, SALES);
    private final User accountant = user(20L, Role.NHAN_VIEN, FINANCE);
    private final User chiefAccountant = user(21L, Role.TRUONG_PHONG, FINANCE);
    private final User ceo = user(1L, Role.CEO, null);

    @BeforeEach
    void setUp() {
        FinanceAccess financeAccess = new FinanceAccess(departmentRepository, userRepository);
        ReflectionTestUtils.setField(financeAccess, "financeDepartmentName", "Tài chính - Kế toán");
        service = new PayrollService(payrollRepository, holidayRepository, attendanceRepository, userRepository,
                departmentRepository, notificationService, payrollReportRepository, financeAccess);

        Department sales = Department.builder().id(SALES).tenPhong("Kinh doanh").isLock(false).build();
        Department finance = Department.builder().id(FINANCE).tenPhong("Tài chính - Kế toán").isLock(false).build();
        when(departmentRepository.findAll()).thenReturn(List.of(sales, finance));
        when(departmentRepository.findById(SALES)).thenReturn(Optional.of(sales));
        when(departmentRepository.findById(FINANCE)).thenReturn(Optional.of(finance));
        when(userRepository.findByDepartmentId(SALES)).thenReturn(List.of(salesManager, salesDirector, salesStaff));
        when(userRepository.findByDepartmentId(FINANCE)).thenReturn(List.of(accountant, chiefAccountant));
        when(userRepository.findByDepartmentIdAndRole(SALES, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of(salesDirector));
        when(userRepository.findByRole(Role.CEO)).thenReturn(List.of(ceo));
        when(userRepository.findById(anyLong())).thenReturn(Optional.of(salesStaff));
        when(payrollReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(payrollRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void fullApprovalChainEndsInPaidAndNotifiesEmployee() {
        PayrollReport batch = draftBatch();
        Payroll row = Payroll.builder().id(100L).employeeId(salesStaff.getId()).month(11).year(2026)
                .payrollReportId(batch.getId()).status(PayrollService.DRAFT).netSalary(12_000_000.0).build();
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of(row));

        service.submitForApproval(batch.getId(), principal(accountant));
        assertEquals(PayrollService.PENDING_DIRECTOR, batch.getStatus());

        service.directorConfirm(batch.getId(), principal(salesDirector));
        assertEquals(PayrollService.PENDING_CHIEF_ACCOUNTANT, batch.getStatus());

        service.chiefApprove(batch.getId(), principal(chiefAccountant));
        assertEquals(PayrollService.PENDING_CEO, batch.getStatus());

        service.ceoApprove(batch.getId(), principal(ceo));
        assertEquals(PayrollService.APPROVED_BY_CEO, batch.getStatus());

        service.markPaid(batch.getId(), "UNC-001", principal(accountant));
        assertEquals(PayrollService.PAID, batch.getStatus());
        assertEquals("UNC-001", batch.getPaymentReference());
        assertEquals(PayrollService.PAID, row.getStatus());
        verify(notificationService).createNotification(eq(salesStaff.getId()), eq("PAYROLL"),
                contains("Đã chi trả lương"), anyString(), anyString(), anyString());
    }

    @Test
    void submitterCannotReviewOwnPayrollAsChiefAccountant() {
        PayrollReport batch = draftBatch();
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of());

        service.submitForApproval(batch.getId(), principal(chiefAccountant));
        service.directorConfirm(batch.getId(), principal(salesDirector));

        AppException ex = assertThrows(AppException.class,
                () -> service.chiefApprove(batch.getId(), principal(chiefAccountant)));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals(PayrollService.PENDING_CHIEF_ACCOUNTANT, batch.getStatus());
    }

    @Test
    void departmentWithoutDirectorGoesStraightToChiefAccountant() {
        PayrollReport batch = draftBatch();
        when(userRepository.findByDepartmentIdAndRole(SALES, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of());
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of());

        service.submitForApproval(batch.getId(), principal(accountant));

        assertEquals(PayrollService.PENDING_CHIEF_ACCOUNTANT, batch.getStatus());
    }

    @Test
    void managerOutsideFinanceCannotGeneratePayroll() {
        AppException ex = assertThrows(AppException.class,
                () -> service.generatePayroll(11, 2026, null, principal(salesManager)));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void closingAttendanceIsBlockedByPendingExceptions() {
        when(attendanceRepository.existsByEmployeeIdAndDateBetweenAndExceptionStatus(
                eq(salesStaff.getId()), any(), any(), eq("PENDING"))).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> service.closeAttendance(11, 2026, principal(salesManager)));
        assertTrue(ex.getMessage().contains(salesStaff.getHoTen()));
        verify(payrollReportRepository, never()).save(any());
    }

    @Test
    void ceoRejectionReturnsBatchToFinanceWithReason() {
        PayrollReport batch = draftBatch();
        batch.setStatus(PayrollService.PENDING_CEO);
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of());

        service.ceoReject(batch.getId(), "Thiếu thưởng dự án", principal(ceo));

        assertEquals(PayrollService.REJECTED, batch.getStatus());
        assertEquals("CEO", batch.getRejectedStage());
        assertEquals("Thiếu thưởng dự án", batch.getRejectionReason());
    }

    private PayrollReport draftBatch() {
        return PayrollReport.builder()
                .id(500L).departmentId(SALES).createdBy(salesManager.getId())
                .month(11).year(2026).reportLevel(PayrollService.LEVEL_DEPARTMENT)
                .status(PayrollService.DRAFT).totalEmployees(3)
                .build();
    }

    private static User user(Long id, Role role, Long departmentId) {
        User u = new User();
        u.setId(id);
        u.setHoTen("User " + id);
        u.setEmail("u" + id + "@hrm.local");
        u.setRole(role);
        u.setDepartmentId(departmentId);
        u.setActive(true);
        return u;
    }

    private static CustomUserDetails principal(User u) {
        return new CustomUserDetails(u.getId(), u.getEmail(), u.getRole(), u.getDepartmentId(), null, u.getHoTen());
    }
}
