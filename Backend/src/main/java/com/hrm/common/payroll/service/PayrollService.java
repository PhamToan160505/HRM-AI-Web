package com.hrm.common.payroll.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.Holiday;
import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.UserRepository;
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
        List<User> employees = userRepository.findByDepartmentId(departmentId);
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
                            actualDays += 0.5;
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
        payroll.setStatus("APPROVED");
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

    public List<Payroll> getMyPayroll(Long employeeId) {
        return payrollRepository.findByEmployeeIdOrderByYearDescMonthDesc(employeeId)
                .stream().filter(p -> "APPROVED".equals(p.getStatus())).toList();
    }

    public List<Payroll> getDepartmentPayroll(int month, int year, CustomUserDetails currentUser) {
        if ("GIAM_DOC".equals(currentUser.getRole().name())) {
            return payrollRepository.findByMonthAndYear(month, year);
        } else {
            List<User> employees = userRepository.findByDepartmentId(currentUser.getDepartmentId());
            List<Long> employeeIds = employees.stream().map(User::getId).toList();
            return payrollRepository.findByMonthAndYearAndEmployeeIdIn(month, year, employeeIds);
        }
    }
}
