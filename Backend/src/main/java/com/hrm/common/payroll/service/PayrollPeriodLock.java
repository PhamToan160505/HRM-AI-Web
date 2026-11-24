package com.hrm.common.payroll.service;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/**
 * Khóa bảng công (BUG-02): khi phòng ban đã chốt công một tháng thì không module nào được
 * sửa dữ liệu chấm công của tháng đó nữa (duyệt đơn từ, duyệt ngoại lệ chấm công, tạo đơn lùi ngày).
 * Muốn sửa phải để Trưởng phòng "Mở lại công" (chỉ được khi bảng lương chưa gửi duyệt).
 */
@Component
@RequiredArgsConstructor
public class PayrollPeriodLock {

    private final PayrollReportRepository payrollReportRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    /** Ném lỗi 409 nếu ngày {@code date} của nhân viên thuộc tháng mà phòng của họ đã chốt công. */
    public void assertOpen(Long employeeId, LocalDate date) {
        if (employeeId == null || date == null) return;
        findLock(employeeId, YearMonth.from(date)).ifPresent(r -> {
            throw AppException.conflict(message(r));
        });
    }

    /** Kiểm tra cả khoảng ngày (đơn nghỉ nhiều ngày có thể vắt qua 2 tháng). */
    public void assertOpen(Long employeeId, LocalDate from, LocalDate to) {
        if (from == null) return;
        LocalDate end = to != null && !to.isBefore(from) ? to : from;
        Set<YearMonth> months = new HashSet<>();
        for (YearMonth ym = YearMonth.from(from); !ym.isAfter(YearMonth.from(end)); ym = ym.plusMonths(1)) {
            months.add(ym);
        }
        for (YearMonth ym : months) {
            assertOpen(employeeId, ym.atDay(1));
        }
    }

    /** Kiểm tra nhanh xem phòng ban đã chốt công / khóa kỳ lương tháng {@code ym} hay chưa. */
    public boolean isDepartmentMonthLocked(Long departmentId, YearMonth ym) {
        if (departmentId == null || ym == null) return false;
        return findLockByDepartment(departmentId, ym).isPresent();
    }

    /** Kiểm tra xem kỳ lương tháng {@code ym} của phòng ban đã gửi duyệt hoặc đã chi trả (không còn sửa lương được) hay chưa. */
    public boolean isDepartmentMonthSubmittedOrPaid(Long departmentId, YearMonth ym) {
        if (departmentId == null || ym == null) return false;
        return findLockByDepartment(departmentId, ym)
                .map(r -> {
                    String st = r.getStatus();
                    return !(PayrollService.ATTENDANCE_CLOSED.equals(st)
                            || PayrollService.DRAFT.equals(st)
                            || PayrollService.REJECTED.equals(st));
                })
                .orElse(false);
    }

    /** Trả về trạng thái kỳ lương hiện tại của phòng ban (null nếu chưa chốt công). */
    public Optional<String> getDepartmentMonthStatus(Long departmentId, YearMonth ym) {
        if (departmentId == null || ym == null) return Optional.empty();
        return findLockByDepartment(departmentId, ym).map(PayrollReport::getStatus);
    }

    private Optional<PayrollReport> findLock(Long employeeId, YearMonth ym) {
        Long deptId = userRepository.findById(employeeId).map(User::getDepartmentId).orElse(null);
        return findLockByDepartment(deptId, ym);
    }

    private Optional<PayrollReport> findLockByDepartment(Long deptId, YearMonth ym) {
        if (deptId == null || ym == null) return Optional.empty();
        return payrollReportRepository
                .findByDepartmentIdAndMonthAndYearAndReportLevel(deptId, ym.getMonthValue(), ym.getYear(), PayrollService.LEVEL_DEPARTMENT)
                .stream()
                .filter(r -> !PayrollService.ATTENDANCE_REOPENED.equals(r.getStatus()))
                .findFirst();
    }

    private String message(PayrollReport r) {
        String dept = departmentRepository.findById(r.getDepartmentId()).map(Department::getTenPhong).orElse("");
        String period = r.getMonth() + "/" + r.getYear();
        boolean reopenable = PayrollService.ATTENDANCE_CLOSED.equals(r.getStatus())
                || PayrollService.DRAFT.equals(r.getStatus())
                || PayrollService.REJECTED.equals(r.getStatus());
        return reopenable
                ? "Công tháng " + period + " của phòng " + dept + " đã được chốt, không thể thay đổi dữ liệu chấm công. "
                  + "Vui lòng đề nghị Trưởng phòng mở lại công trước."
                : "Bảng lương tháng " + period + " của phòng " + dept + " đã gửi duyệt hoặc đã chi trả, "
                  + "không thể thay đổi dữ liệu chấm công của tháng này.";
    }
}
