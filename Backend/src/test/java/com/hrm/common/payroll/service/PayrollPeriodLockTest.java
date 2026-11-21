package com.hrm.common.payroll.service;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/** BUG-02: không được sửa chấm công của tháng phòng đã chốt công. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PayrollPeriodLockTest {

    @Mock private PayrollReportRepository payrollReportRepository;
    @Mock private UserRepository userRepository;
    @Mock private DepartmentRepository departmentRepository;

    private PayrollPeriodLock lock;

    @BeforeEach
    void setUp() {
        lock = new PayrollPeriodLock(payrollReportRepository, userRepository, departmentRepository);
        User u = new User();
        u.setId(9L);
        u.setDepartmentId(3L);
        when(userRepository.findById(9L)).thenReturn(Optional.of(u));
        when(departmentRepository.findById(3L)).thenReturn(Optional.of(Department.builder().id(3L).tenPhong("Kinh doanh").build()));
        when(payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(anyLong(), anyInt(), anyInt(), anyString()))
                .thenReturn(List.of());
    }

    private void batch(int month, String status) {
        when(payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(3L, month, 2026, "DEPARTMENT"))
                .thenReturn(List.of(PayrollReport.builder().departmentId(3L).month(month).year(2026).status(status).build()));
    }

    @Test
    void openMonthIsAllowed() {
        assertDoesNotThrow(() -> lock.assertOpen(9L, LocalDate.of(2026, 9, 14)));
    }

    @Test
    void closedMonthIsBlockedWithReopenHint() {
        batch(9, PayrollService.ATTENDANCE_CLOSED);
        AppException ex = assertThrows(AppException.class, () -> lock.assertOpen(9L, LocalDate.of(2026, 9, 14)));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("mở lại công"));
    }

    @Test
    void paidMonthIsBlocked() {
        batch(9, PayrollService.PAID);
        AppException ex = assertThrows(AppException.class, () -> lock.assertOpen(9L, LocalDate.of(2026, 9, 14)));
        assertTrue(ex.getMessage().contains("đã gửi duyệt hoặc đã chi trả"));
    }

    @Test
    void reopenedMonthIsAllowed() {
        batch(9, PayrollService.ATTENDANCE_REOPENED);
        assertDoesNotThrow(() -> lock.assertOpen(9L, LocalDate.of(2026, 9, 14)));
    }

    @Test
    void leaveSpanningIntoClosedMonthIsBlocked() {
        batch(10, PayrollService.DRAFT);
        assertThrows(AppException.class,
                () -> lock.assertOpen(9L, LocalDate.of(2026, 9, 29), LocalDate.of(2026, 10, 2)));
    }

    @Test
    void employeeWithoutDepartmentIsNotLocked() {
        User noDept = new User();
        noDept.setId(50L);
        when(userRepository.findById(50L)).thenReturn(Optional.of(noDept));
        assertDoesNotThrow(() -> lock.assertOpen(50L, LocalDate.of(2026, 9, 14)));
    }
}
