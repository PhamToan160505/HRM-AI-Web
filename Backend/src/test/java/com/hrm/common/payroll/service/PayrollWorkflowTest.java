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
    @Mock private com.hrm.request.repository.EmployeeRequestRepository employeeRequestRepository;

    private PayrollService service;

    private final User salesManager = user(10L, Role.TRUONG_PHONG, SALES);
    private final User salesDirector = user(11L, Role.GIAM_DOC_PHONG_BAN, SALES);
    private final User salesStaff = user(12L, Role.NHAN_VIEN, SALES);
    private final User accountant = user(20L, Role.NHAN_VIEN, FINANCE);
    private final User chiefAccountant = user(21L, Role.TRUONG_PHONG, FINANCE);
    private final User ceo = user(1L, Role.CEO, null);
    private final User financeDirector = user(22L, Role.GIAM_DOC_PHONG_BAN, FINANCE);

    @BeforeEach
    void setUp() {
        FinanceAccess financeAccess = new FinanceAccess(departmentRepository, userRepository);
        ReflectionTestUtils.setField(financeAccess, "financeDepartmentName", "Tài chính - Kế toán");
        service = new PayrollService(payrollRepository, holidayRepository, attendanceRepository, userRepository,
                departmentRepository, notificationService, payrollReportRepository, financeAccess, employeeRequestRepository);
        ReflectionTestUtils.setField(service, "overtimeWeekdayRate", 1.5);
        ReflectionTestUtils.setField(service, "overtimeWeekendRate", 2.0);
        ReflectionTestUtils.setField(service, "overtimeHolidayRate", 3.0);
        ReflectionTestUtils.setField(service, "personalDeduction", 15_500_000);
        ReflectionTestUtils.setField(service, "dependentDeduction", 6_200_000);

        Department sales = Department.builder().id(SALES).tenPhong("Kinh doanh").isLock(false).build();
        Department finance = Department.builder().id(FINANCE).tenPhong("Tài chính - Kế toán").isLock(false).build();
        when(departmentRepository.findAll()).thenReturn(List.of(sales, finance));
        when(departmentRepository.findById(SALES)).thenReturn(Optional.of(sales));
        when(departmentRepository.findById(FINANCE)).thenReturn(Optional.of(finance));
        when(userRepository.findByDepartmentId(SALES)).thenReturn(List.of(salesManager, salesDirector, salesStaff));
        when(userRepository.findByDepartmentId(FINANCE)).thenReturn(List.of(accountant, chiefAccountant, financeDirector));
        when(userRepository.findByDepartmentIdAndRole(FINANCE, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of(financeDirector));
        when(userRepository.findByDepartmentIdAndRole(SALES, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of(salesDirector));
        when(userRepository.findByRole(Role.CEO)).thenReturn(List.of(ceo));
        when(userRepository.findById(anyLong())).thenReturn(Optional.of(salesStaff));
        when(payrollReportRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(payrollReportRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
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
                () -> service.closeAttendance(10, 2026, principal(salesManager)));
        assertTrue(ex.getMessage().contains(salesStaff.getHoTen()));
        verify(payrollReportRepository, never()).saveAndFlush(any());
    }

    @Test
    void concurrentCloseAttendanceReturnsConflictInsteadOfDuplicate() {
        // BUG-01: request thứ 2 chạm ràng buộc UNIQUE(period_key)
        when(payrollReportRepository.saveAndFlush(any()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("uk_payroll_reports_period_key"));

        AppException ex = assertThrows(AppException.class,
                () -> service.closeAttendance(10, 2026, principal(salesManager)));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        verifyNoInteractions(notificationService);
    }

    @Test
    void closeAttendanceSetsUniquePeriodKey() {
        PayrollReport report = service.closeAttendance(10, 2026, principal(salesManager));
        assertEquals("DEPARTMENT:1:2026:10", report.getPeriodKey());
    }

    @Test
    void resignedEmployeeWithWorkdaysIsStillPaid() {
        User resigned = user(13L, Role.NHAN_VIEN, SALES);
        resigned.setActive(false);
        User resignedLongAgo = user(14L, Role.NHAN_VIEN, SALES);
        resignedLongAgo.setActive(false);
        when(userRepository.findByDepartmentId(SALES))
                .thenReturn(List.of(salesManager, salesDirector, salesStaff, resigned, resignedLongAgo));
        when(attendanceRepository.findByEmployeeIdAndDateBetween(eq(13L), any(), any()))
                .thenReturn(List.of(com.hrm.attendance.entity.Attendance.builder().employeeId(13L).status("PRESENT").build()));

        PayrollReport report = service.closeAttendance(10, 2026, principal(salesManager));

        // 3 người đang làm + 1 người nghỉ giữa tháng có ngày công; người nghỉ từ trước (không có công) bị loại
        assertEquals(4, report.getTotalEmployees());
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

    @Test
    void cannotCloseAttendanceBeforeMonthEnds() {
        java.time.YearMonth now = java.time.YearMonth.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        AppException current = assertThrows(AppException.class,
                () -> service.closeAttendance(now.getMonthValue(), now.getYear(), principal(salesManager)));
        assertEquals(HttpStatus.BAD_REQUEST, current.getStatus());
        java.time.YearMonth next = now.plusMonths(1);
        assertThrows(AppException.class,
                () -> service.closeAttendance(next.getMonthValue(), next.getYear(), principal(salesManager)));
    }

    @Test
    void pendingLeaveRequestBlocksClosingAttendance() {
        com.hrm.request.entity.EmployeeRequest pending = com.hrm.request.entity.EmployeeRequest.builder()
                .user(salesStaff).status(com.hrm.request.entity.RequestStatus.PENDING).build();
        when(employeeRequestRepository.findOverlappingByUsersAndStatuses(anyList(), anyList(), any(), any()))
                .thenReturn(List.of(pending));

        AppException ex = assertThrows(AppException.class,
                () -> service.closeAttendance(10, 2026, principal(salesManager)));
        assertTrue(ex.getMessage().contains("đơn từ chưa duyệt"));
        assertTrue(ex.getMessage().contains(salesStaff.getHoTen()));
    }

    @Test
    void overtimeUsesLegalRatesAndPremiumIsTaxExempt() {
        // Tháng 10/2026: 22 ngày làm việc, đặt 15/10 là ngày lễ -> công chuẩn 21; lương 210tr -> 10tr/ngày
        salesStaff.setBaseSalary(210_000_000.0);
        when(holidayRepository.findByNgayLeBetween(any(), any())).thenReturn(List.of(
                com.hrm.common.payroll.entity.Holiday.builder().ngayLe(java.time.LocalDate.of(2026, 10, 15)).build()));
        PayrollReport batch = draftBatch();
        batch.setMonth(10);
        batch.setStatus(PayrollService.ATTENDANCE_CLOSED);
        when(payrollReportRepository.findByMonthAndYearAndReportLevel(10, 2026, "DEPARTMENT")).thenReturn(List.of(batch));
        com.hrm.request.entity.EmployeeRequest ot = com.hrm.request.entity.EmployeeRequest.builder()
                .user(salesStaff).requestType(com.hrm.request.entity.RequestType.OVERTIME)
                .status(com.hrm.request.entity.RequestStatus.APPROVED)
                .startDate(java.time.LocalDate.of(2026, 10, 14))   // Thứ 4: 150%
                .endDate(java.time.LocalDate.of(2026, 10, 15))     // Thứ 5, ngày lễ: 300%
                .build();
        com.hrm.request.entity.EmployeeRequest otWeekend = com.hrm.request.entity.EmployeeRequest.builder()
                .user(salesStaff).requestType(com.hrm.request.entity.RequestType.OVERTIME)
                .status(com.hrm.request.entity.RequestStatus.APPROVED)
                .startDate(java.time.LocalDate.of(2026, 10, 17))   // Thứ 7: 200%
                .endDate(java.time.LocalDate.of(2026, 10, 17))
                .build();
        when(employeeRequestRepository.findApprovedRequestsForMonth(eq(salesStaff.getId()), any(), any()))
                .thenReturn(List.of(ot, otWeekend));
        org.mockito.ArgumentCaptor<Payroll> saved = org.mockito.ArgumentCaptor.forClass(Payroll.class);

        service.generatePayroll(10, 2026, null, principal(accountant));

        verify(payrollRepository, atLeastOnce()).save(saved.capture());
        Payroll staff = saved.getAllValues().stream().filter(p -> p.getEmployeeId().equals(salesStaff.getId())).findFirst().orElseThrow();
        assertEquals(21.0, staff.getStandardDays());
        assertEquals(65_000_000, staff.getOvertimePay(), 1);          // 10tr × (1.5 + 3.0 + 2.0)
        assertTrue(staff.getOvertimeReason().contains("3 ngày OT"));
        // Chịu thuế = 65tr - 35tr (phần trả thêm được miễn thuế) = 30tr; tính thuế = 30tr - 15.5tr
        assertEquals(14_500_000, staff.getThuNhapTinhThue(), 1);
    }

    @Test
    void staleOvertimeFromOldPayrollIsNotKept() {
        PayrollReport batch = draftBatch();
        batch.setMonth(10);
        batch.setStatus(PayrollService.ATTENDANCE_CLOSED);
        when(payrollReportRepository.findByMonthAndYearAndReportLevel(10, 2026, "DEPARTMENT")).thenReturn(List.of(batch));
        Payroll old = Payroll.builder().employeeId(salesManager.getId()).month(10).year(2026)
                .status("DRAFT").overtimePay(1_500_000.0).overtimeReason("dữ liệu cũ").build();
        when(payrollRepository.findByEmployeeIdAndMonthAndYear(salesManager.getId(), 10, 2026)).thenReturn(Optional.of(old));

        service.generatePayroll(10, 2026, null, principal(accountant));

        assertEquals(0.0, old.getOvertimePay());
        assertNull(old.getOvertimeReason());
    }

    @Test
    void directorWhoSubmittedAsAccountantCannotConfirm() {
        PayrollReport batch = draftBatch();
        batch.setDepartmentId(FINANCE);
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of());

        service.submitForApproval(batch.getId(), principal(financeDirector));

        AppException ex = assertThrows(AppException.class, () -> service.directorConfirm(batch.getId(), principal(financeDirector)));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void financeDirectorCannotDoBothDirectorAndChiefSteps() {
        PayrollReport batch = draftBatch();
        batch.setDepartmentId(FINANCE);
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of());

        service.submitForApproval(batch.getId(), principal(accountant));
        service.directorConfirm(batch.getId(), principal(financeDirector));

        AppException ex = assertThrows(AppException.class, () -> service.chiefApprove(batch.getId(), principal(financeDirector)));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        service.chiefApprove(batch.getId(), principal(chiefAccountant));
        assertEquals(PayrollService.PENDING_CEO, batch.getStatus());
    }

    @Test
    void paymentReferenceTooLongIsRejectedClearly() {
        PayrollReport batch = draftBatch();
        batch.setStatus(PayrollService.APPROVED_BY_CEO);
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));

        AppException ex = assertThrows(AppException.class,
                () -> service.markPaid(batch.getId(), "R".repeat(101), principal(accountant)));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals(PayrollService.APPROVED_BY_CEO, batch.getStatus());
    }

    @Test
    void bankFileNeutralisesSpreadsheetFormulas() {
        PayrollReport batch = draftBatch();
        batch.setStatus(PayrollService.APPROVED_BY_CEO);
        when(payrollReportRepository.findById(batch.getId())).thenReturn(Optional.of(batch));
        User evil = user(30L, Role.NHAN_VIEN, SALES);
        evil.setHoTen("=HYPERLINK(\"http://x\")");
        when(payrollRepository.findByPayrollReportId(batch.getId())).thenReturn(List.of(
                Payroll.builder().employeeId(30L).netSalary(1_000_000.0).build()));
        when(userRepository.findAllById(any())).thenReturn(List.of(evil));

        String csv = service.buildBankTransferCsv(batch.getId(), principal(accountant));

        assertTrue(csv.contains("'=HYPERLINK"), csv);
        assertFalse(csv.contains(",=HYPERLINK"), csv);
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
