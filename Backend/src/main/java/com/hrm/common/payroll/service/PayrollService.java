package com.hrm.common.payroll.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.Holiday;
import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.notification.service.NotificationService;
import com.hrm.common.payroll.dto.DepartmentPayrollSummary;
import com.hrm.common.entity.Department;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PayrollService {

    private final PayrollRepository payrollRepository;
    private final HolidayRepository holidayRepository;
    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final NotificationService notificationService;
    private final PayrollReportRepository payrollReportRepository;

    @Value("${payroll.late-free-times:1}")
    private int lateFreeTimes;

    @Value("${payroll.late-penalty-percent:0.3}")
    private double latePenaltyPercent;

    @Value("${payroll.late-percent-tier-max-times:3}")
    private int latePercentTierMaxTimes;

    @Value("${payroll.late-4th-time-days-deducted:0.5}")
    private double late4thTimeDaysDeducted;

    @Value("${payroll.late-5th-plus-days-deducted:1.0}")
    private double late5thPlusDaysDeducted;

    @Value("${payroll.half-day-leave-deducted:0.5}")
    private double halfDayLeaveDeducted;

    @Value("${payroll.normal-leave-days-per-month:1}")
    private int normalLeaveDaysPerMonth;

    @Value("${payroll.special-wfh-leave-days-per-month:1}")
    private int specialWfhLeaveDaysPerMonth;

    @Value("${payroll.insurance.bhxh-percent:0.08}")
    private double bhxhPercent;

    @Value("${payroll.insurance.bhyt-percent:0.015}")
    private double bhytPercent;

    @Value("${payroll.insurance.bhtn-percent:0.01}")
    private double bhtnPercent;

    @Value("${payroll.tax.personal-deduction:15500000}")
    private double personalDeduction;

    @Value("${payroll.tax.dependent-deduction:6200000}")
    private double dependentDeduction;

    private int calculateStandardDays(int month, int year) {
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        List<Holiday> holidays = holidayRepository.findByNgayLeBetween(startDate, endDate);
        List<LocalDate> holidayDates = holidays.stream().map(Holiday::getNgayLe).toList();

        int standardDays = 0;
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            if (date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY) {
                if (!holidayDates.contains(date)) {
                    standardDays++;
                }
            }
        }
        return standardDays;
    }

    @Transactional
    public List<Object> generatePayroll(int month, int year, Long departmentId, CustomUserDetails currentUser) {
        List<User> employees = new ArrayList<>();
        if (currentUser.getRole() == com.hrm.common.entity.Role.CEO) {
            employees = userRepository.findAll();
        } else if (currentUser.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            List<User> deptUsers = userRepository.findByDepartmentId(currentUser.getDepartmentId());
            employees = deptUsers.stream()
                    .filter(u -> u.getRole() == com.hrm.common.entity.Role.NHAN_VIEN || u.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG)
                    .toList();
        } else if (currentUser.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            List<User> deptUsers = userRepository.findByDepartmentId(currentUser.getDepartmentId());
            employees = deptUsers.stream()
                    .filter(u -> u.getRole() == com.hrm.common.entity.Role.NHAN_VIEN)
                    .toList();
        }

        int standardDays = calculateStandardDays(month, year);
        
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

        List<Object> blockedEmployees = new ArrayList<>();
        List<Payroll> generatedPayrolls = new ArrayList<>();

        for (User emp : employees) {
            boolean hasPending = attendanceRepository.existsByEmployeeIdAndDateBetweenAndExceptionStatus(
                    emp.getId(), startDate, endDate, "PENDING"
            );
            if (hasPending) {
                blockedEmployees.add(java.util.Map.of("employeeId", emp.getId(), "hoTen", emp.getHoTen(), "reason", "Còn đơn ngoại lệ chờ duyệt"));
                continue;
            }

            Optional<Payroll> existingOpt = payrollRepository.findByEmployeeIdAndMonthAndYear(emp.getId(), month, year);
            if (existingOpt.isPresent() && "APPROVED".equals(existingOpt.get().getStatus())) {
                blockedEmployees.add(java.util.Map.of("employeeId", emp.getId(), "hoTen", emp.getHoTen(), "reason", "Lương đã duyệt"));
                continue;
            }

            Payroll payroll = existingOpt.orElse(Payroll.builder()
                    .employeeId(emp.getId())
                    .month(month)
                    .year(year)
                    .build());

            Double baseSalary = emp.getBaseSalary() != null ? emp.getBaseSalary() : 0.0;
            Double allowance = emp.getAllowance() != null ? emp.getAllowance() : 0.0;
            Double dailySalary = standardDays > 0 ? baseSalary / standardDays : 0.0;

            List<Attendance> attendances = attendanceRepository.findByEmployeeIdAndDateBetween(emp.getId(), startDate, endDate);
            
            double actualDays = 0.0;
            double latePenalty = 0.0;
            int lateCount = 0;
            int normalLeaveCount = 0;
            int specialWfhCount = 0;

            for (Attendance a : attendances) {
                if ("PRESENT".equals(a.getStatus())) {
                    actualDays += 1.0;
                } else if ("LATE".equals(a.getStatus())) {
                    lateCount++;
                    if (lateCount <= lateFreeTimes) {
                        actualDays += 1.0;
                    } else if (lateCount <= latePercentTierMaxTimes) {
                        actualDays += 1.0;
                        latePenalty += dailySalary * latePenaltyPercent;
                    } else if (lateCount == 4) {
                        actualDays += (1.0 - late4thTimeDaysDeducted);
                    } else {
                        actualDays += (1.0 - late5thPlusDaysDeducted);
                    }
                } else if ("ABSENT".equals(a.getStatus()) && "APPROVED".equals(a.getExceptionStatus())) {
                    String leaveType = a.getLoaiNghiPhep();
                    if ("HALF_DAY_LEAVE".equals(leaveType)) {
                        actualDays += (1.0 - halfDayLeaveDeducted);
                    } else if ("NORMAL_LEAVE".equals(leaveType)) {
                        normalLeaveCount++;
                        if (normalLeaveCount <= normalLeaveDaysPerMonth) {
                            actualDays += 1.0;
                        }
                    } else if ("SPECIAL_WFH_LEAVE".equals(leaveType)) {
                        specialWfhCount++;
                        if (specialWfhCount <= specialWfhLeaveDaysPerMonth) {
                            actualDays += 0.7;
                        }
                    }
                    // UNPAID or exceeded limits -> 0.0 added
                }
            }

            payroll.setBaseSalary(baseSalary);
            payroll.setAllowance(allowance);
            payroll.setStandardDays((double) standardDays);
            payroll.setActualDays(actualDays);
            payroll.setLatePenalty(latePenalty);
            payroll.setStatus("DRAFT");
            
            // 1. Tính lương gộp (gross)
            double grossSalary = (baseSalary + allowance) * (actualDays / standardDays) - latePenalty + (payroll.getOvertimePay() != null ? payroll.getOvertimePay() : 0.0);
            payroll.setGrossSalary(grossSalary);

            // 2. Tính Bảo hiểm trên lương cơ bản (baseSalary)
            double bhxhAmount = 0.0;
            double bhytAmount = 0.0;
            double bhtnAmount = 0.0;
            
            // Theo luật lao động VN, người lao động không làm việc và không hưởng tiền lương từ 14 ngày làm việc trở lên trong tháng thì không đóng BHXH tháng đó.
            if (actualDays >= 14) {
                bhxhAmount = baseSalary * bhxhPercent;
                bhytAmount = baseSalary * bhytPercent;
                bhtnAmount = baseSalary * bhtnPercent;
            }
            
            payroll.setBhxhAmount(bhxhAmount);
            payroll.setBhytAmount(bhytAmount);
            payroll.setBhtnAmount(bhtnAmount);
            double totalInsurance = bhxhAmount + bhytAmount + bhtnAmount;

            // 3. Tính thu nhập chịu thuế
            double thuNhapChiuThue = grossSalary - totalInsurance;

            // 4. Tính thu nhập tính thuế
            int soNguoiPhuThuoc = emp.getSoNguoiPhuThuoc() != null ? emp.getSoNguoiPhuThuoc() : 0;
            double totalDeduction = personalDeduction + (dependentDeduction * soNguoiPhuThuoc);
            double thuNhapTinhThue = thuNhapChiuThue - totalDeduction;
            if (thuNhapTinhThue <= 0) {
                thuNhapTinhThue = 0.0;
            }
            payroll.setThuNhapTinhThue(thuNhapTinhThue);

            // 5. Tính Thuế TNCN
            double thuTncn = PersonalIncomeTaxCalculator.calculate(thuNhapTinhThue);
            payroll.setThuTncn(thuTncn);

            // 6. Tính thực nhận (netSalary)
            double netSalary = grossSalary - totalInsurance - thuTncn;
            payroll.setNetSalary(netSalary);

            generatedPayrolls.add(payrollRepository.save(payroll));
        }

        return List.of(java.util.Map.of("generated", generatedPayrolls, "blocked", blockedEmployees));
    }

    @Transactional
    public void approvePayrollRecord(Long payrollId) {
        Payroll payroll = payrollRepository.findById(payrollId).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu lương"));
        if (!"DRAFT".equals(payroll.getStatus())) {
            throw new RuntimeException("Chỉ được duyệt khi trạng thái là DRAFT");
        }
        payroll.setStatus("MANAGER_APPROVED");
        payrollRepository.save(payroll);
    }

    @Transactional
    public void rejectPayrollRecord(Long payrollId, String reason) {
        Payroll payroll = payrollRepository.findById(payrollId).orElseThrow(() -> new RuntimeException("Không tìm thấy phiếu lương"));
        if (!"DRAFT".equals(payroll.getStatus())) {
            throw new RuntimeException("Chỉ được từ chối khi trạng thái là DRAFT");
        }
        payroll.setStatus("REJECTED");
        payroll.setRejectionReason(reason);
        payrollRepository.save(payroll);
    }

    @Transactional
    public void approveAllPayroll(int month, int year, Long departmentId) {
        List<User> employees = userRepository.findByDepartmentId(departmentId);
        if (employees.isEmpty()) return;
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        List<Payroll> payrolls = payrollRepository.findByMonthAndYearAndEmployeeIdIn(month, year, employeeIds);
        
        boolean hasChanges = false;
        for (Payroll p : payrolls) {
            if ("DRAFT".equals(p.getStatus())) {
                p.setStatus("MANAGER_APPROVED");
                hasChanges = true;
            }
        }
        if (hasChanges) {
            payrollRepository.saveAll(payrolls);
        }
    }

    @Transactional
    public void submitManagerReport(int month, int year, Long departmentId, Long managerId, boolean force) {
        List<User> employees = userRepository.findByDepartmentId(departmentId);
        if (employees.isEmpty()) return;
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        List<Payroll> payrolls = payrollRepository.findByMonthAndYearAndEmployeeIdIn(month, year, employeeIds);
        
        int totalEmployees = payrolls.size();
        double totalGross = payrolls.stream().mapToDouble(p -> p.getGrossSalary() != null ? p.getGrossSalary() : 0.0).sum();
        
        Optional<PayrollReport> existingOpt = payrollReportRepository.findByDepartmentIdAndCreatedByAndMonthAndYearAndReportLevel(
                departmentId, managerId, month, year, "MANAGER_LEVEL");
                
        if (existingOpt.isPresent()) {
            PayrollReport report = existingOpt.get();
            if ("APPROVED_BY_DIRECTOR".equals(report.getStatus()) || "APPROVED_BY_CEO".equals(report.getStatus()) || "PENDING_CEO".equals(report.getStatus())) {
                throw new RuntimeException("Giám đốc phòng ban đã duyệt báo cáo này, không thể gửi lại (ghi đè)!");
            }
            if (!force && "PENDING_DIRECTOR".equals(report.getStatus())) {
                throw new RuntimeException("WARNING_OVERWRITE: Báo cáo lương tháng này đã được bạn gửi trước đó và đang chờ duyệt. Việc gửi lại sẽ ghi đè lên dữ liệu báo cáo cũ. Bạn có chắc chắn muốn tiếp tục?");
            }
            report.setTotalEmployees(totalEmployees);
            report.setTotalGrossSalary(totalGross);
            report.setStatus("PENDING_DIRECTOR");
            payrollReportRepository.save(report);
        } else {
            PayrollReport report = PayrollReport.builder()
                .departmentId(departmentId)
                .createdBy(managerId)
                .month(month)
                .year(year)
                .reportLevel("MANAGER_LEVEL")
                .totalEmployees(totalEmployees)
                .totalGrossSalary(totalGross)
                .status("PENDING_DIRECTOR")
                .build();
            payrollReportRepository.save(report);
        }
        
        for (Payroll p : payrolls) {
            if ("MANAGER_APPROVED".equals(p.getStatus()) || "DRAFT".equals(p.getStatus())) {
                p.setStatus("PENDING_DIRECTOR");
            }
        }
        payrollRepository.saveAll(payrolls);
    }

    public List<PayrollReport> getManagerReportsForDirector(int month, int year, Long departmentId) {
        return payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(
                departmentId, month, year, "MANAGER_LEVEL");
    }

    @Transactional
    public void approveManagerReport(Long reportId) {
        PayrollReport report = payrollReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy báo cáo lương"));
        if (!"PENDING_DIRECTOR".equals(report.getStatus())) {
            throw new RuntimeException("Chỉ có thể duyệt báo cáo ở trạng thái chờ Giám đốc duyệt");
        }
        report.setStatus("APPROVED_BY_DIRECTOR");
        payrollReportRepository.save(report);
    }

    @Transactional
    public void submitDirectorReport(int month, int year, Long departmentId, Long directorId) {
        List<PayrollReport> managerReports = payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(
                departmentId, month, year, "MANAGER_LEVEL");
        
        if (managerReports.isEmpty()) {
            throw new RuntimeException("Chưa có báo cáo nào từ Trưởng phòng");
        }
        
        boolean allApproved = managerReports.stream().allMatch(r -> "APPROVED_BY_DIRECTOR".equals(r.getStatus()));
        if (!allApproved) {
            throw new RuntimeException("Vui lòng duyệt tất cả các báo cáo của Trưởng phòng trước khi gửi lên Tổng Giám đốc");
        }
        
        int totalEmployees = managerReports.stream().mapToInt(r -> r.getTotalEmployees() != null ? r.getTotalEmployees() : 0).sum();
        double totalGross = managerReports.stream().mapToDouble(r -> r.getTotalGrossSalary() != null ? r.getTotalGrossSalary() : 0.0).sum();
        
        Optional<PayrollReport> existingOpt = payrollReportRepository.findByDepartmentIdAndCreatedByAndMonthAndYearAndReportLevel(
                departmentId, directorId, month, year, "DIRECTOR_LEVEL");
                
        if (existingOpt.isPresent()) {
            PayrollReport report = existingOpt.get();
            if ("APPROVED_BY_CEO".equals(report.getStatus())) {
                 throw new RuntimeException("Tổng Giám đốc đã duyệt báo cáo này, không thể gửi lại!");
            }
            report.setTotalEmployees(totalEmployees);
            report.setTotalGrossSalary(totalGross);
            report.setStatus("PENDING_CEO");
            payrollReportRepository.save(report);
        } else {
            PayrollReport report = PayrollReport.builder()
                .departmentId(departmentId)
                .createdBy(directorId)
                .month(month)
                .year(year)
                .reportLevel("DIRECTOR_LEVEL")
                .totalEmployees(totalEmployees)
                .totalGrossSalary(totalGross)
                .status("PENDING_CEO")
                .build();
            payrollReportRepository.save(report);
        }
        
        List<User> employees = userRepository.findByDepartmentId(departmentId);
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        List<Payroll> payrolls = payrollRepository.findByMonthAndYearAndEmployeeIdIn(month, year, employeeIds);
        
        for (Payroll p : payrolls) {
            if ("PENDING_DIRECTOR".equals(p.getStatus())) {
                p.setStatus("PENDING_CEO");
            }
        }
        payrollRepository.saveAll(payrolls);
    }

    public List<PayrollReport> getDirectorReportsForCeo(int month, int year) {
        return payrollReportRepository.findByMonthAndYearAndReportLevel(month, year, "DIRECTOR_LEVEL");
    }

    @Transactional
    public void approveDirectorReportByCeo(Long reportId) {
        PayrollReport report = payrollReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy báo cáo lương"));
        if (!"PENDING_CEO".equals(report.getStatus())) {
            throw new RuntimeException("Chỉ có thể duyệt báo cáo ở trạng thái chờ Tổng Giám đốc duyệt");
        }
        report.setStatus("APPROVED_BY_CEO");
        payrollReportRepository.save(report);
        
        List<User> employees = userRepository.findByDepartmentId(report.getDepartmentId());
        if (employees.isEmpty()) return;
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        List<Payroll> payrolls = payrollRepository.findByMonthAndYearAndEmployeeIdIn(report.getMonth(), report.getYear(), employeeIds);
        
        for (Payroll p : payrolls) {
            if ("PENDING_CEO".equals(p.getStatus())) {
                p.setStatus("APPROVED_BY_CEO");
            }
        }
        payrollRepository.saveAll(payrolls);
    }
    
    @Transactional
    public void rejectDirectorReportByCeo(Long reportId, String reason) {
        PayrollReport report = payrollReportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy báo cáo lương"));
        if (!"PENDING_CEO".equals(report.getStatus())) {
            throw new RuntimeException("Chỉ có thể từ chối báo cáo ở trạng thái chờ Tổng Giám đốc duyệt");
        }
        report.setStatus("REJECTED");
        payrollReportRepository.save(report);
        
        List<User> employees = userRepository.findByDepartmentId(report.getDepartmentId());
        if (employees.isEmpty()) return;
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        List<Payroll> payrolls = payrollRepository.findByMonthAndYearAndEmployeeIdIn(report.getMonth(), report.getYear(), employeeIds);
        
        for (Payroll p : payrolls) {
            if ("PENDING_CEO".equals(p.getStatus())) {
                p.setStatus("REJECTED_BY_CEO");
                p.setRejectionReason(reason);
            }
        }
        payrollRepository.saveAll(payrolls);

        Department dept = departmentRepository.findById(report.getDepartmentId()).orElse(null);
        String deptName = dept != null ? dept.getTenPhong() : "Unknown";

        userRepository.findByRole(com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN).stream()
                .filter(u -> report.getDepartmentId().equals(u.getDepartmentId()))
                .forEach(director -> {
            notificationService.createNotification(
                    director.getId(),
                    "PAYROLL",
                    "Báo cáo bảng lương bị từ chối",
                    "Tổng giám đốc đã từ chối báo cáo bảng lương tháng " + report.getMonth() + "/" + report.getYear() + " của phòng " + deptName + ". Lý do: " + reason,
                    "quan_trong",
                    "/director/payroll"
            );
        });
    }

    public List<Payroll> getMyPayroll(Long employeeId) {
        return payrollRepository.findByEmployeeIdOrderByYearDescMonthDesc(employeeId)
                .stream().filter(p -> "APPROVED".equals(p.getStatus())).toList();
    }

    public List<Payroll> getDepartmentPayroll(int month, int year, CustomUserDetails currentUser) {
        if ("CEO".equals(currentUser.getRole().name())) {
            return payrollRepository.findByMonthAndYear(month, year);
        } else if ("GIAM_DOC_PHONG_BAN".equals(currentUser.getRole().name())) {
            List<User> deptUsers = userRepository.findByDepartmentId(currentUser.getDepartmentId());
            List<Long> employeeIds = deptUsers.stream()
                    .filter(u -> u.getRole() == com.hrm.common.entity.Role.NHAN_VIEN || u.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG)
                    .map(User::getId)
                    .toList();
            return payrollRepository.findByMonthAndYearAndEmployeeIdIn(month, year, employeeIds);
        } else {
            List<User> deptUsers = userRepository.findByDepartmentId(currentUser.getDepartmentId());
            List<Long> employeeIds = deptUsers.stream()
                    .filter(u -> u.getRole() == com.hrm.common.entity.Role.NHAN_VIEN)
                    .map(User::getId)
                    .toList();
            return payrollRepository.findByMonthAndYearAndEmployeeIdIn(month, year, employeeIds);
        }
    }
}
