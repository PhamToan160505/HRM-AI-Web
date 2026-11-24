package com.hrm.common.payroll.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.dto.PayrollBatchView;
import com.hrm.common.payroll.entity.Holiday;
import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Nghiệp vụ lương.
 *
 * Luồng (mỗi phòng ban / mỗi tháng là một "kỳ lương" = PayrollReport với report_level = DEPARTMENT):
 * <pre>
 *  Trưởng phòng / GĐ phòng  : chốt công tháng              -> ATTENDANCE_CLOSED
 *  Kế toán (phòng TC-KT)    : tính lương                    -> DRAFT
 *  Kế toán                  : gửi xác nhận                  -> PENDING_DIRECTOR
 *                             (phòng không có GĐ thì bỏ qua -> PENDING_CHIEF_ACCOUNTANT)
 *  Giám đốc phòng ban       : xác nhận lương phòng mình     -> PENDING_CHIEF_ACCOUNTANT
 *  Kế toán trưởng           : kiểm tra lần cuối             -> PENDING_CEO
 *  CEO                      : chốt                          -> APPROVED_BY_CEO
 *  Kế toán                  : chi trả                       -> PAID
 *  Bất kỳ bước duyệt nào từ chối                            -> REJECTED (kế toán tính lại)
 *  Trưởng phòng mở lại công (trước khi gửi duyệt)           -> ATTENDANCE_REOPENED
 * </pre>
 */
@Service
@RequiredArgsConstructor
public class PayrollService {

    public static final String LEVEL_DEPARTMENT = "DEPARTMENT";
    static final int MAX_PAYMENT_REFERENCE = 100;
    private static final java.time.ZoneId PAYROLL_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    public static final String OPEN = "OPEN";
    public static final String ATTENDANCE_CLOSED = "ATTENDANCE_CLOSED";
    public static final String ATTENDANCE_REOPENED = "ATTENDANCE_REOPENED";
    public static final String DRAFT = "DRAFT";
    public static final String PENDING_DIRECTOR = "PENDING_DIRECTOR";
    public static final String PENDING_CHIEF_ACCOUNTANT = "PENDING_CHIEF_ACCOUNTANT";
    public static final String PENDING_CEO = "PENDING_CEO";
    public static final String APPROVED_BY_CEO = "APPROVED_BY_CEO";
    public static final String PAID = "PAID";
    public static final String REJECTED = "REJECTED";

    /** Trạng thái phiếu lương đã khóa — không được tính đè. */
    private static final Set<String> LOCKED_PAYROLL_STATUSES = Set.of(
            PENDING_DIRECTOR, PENDING_CHIEF_ACCOUNTANT, PENDING_CEO, APPROVED_BY_CEO, PAID, "APPROVED");

    private static final Set<String> FINALIZED_PAYROLL_STATUSES = Set.of(APPROVED_BY_CEO, PAID, "APPROVED");
    private static final Set<String> GENERATABLE = Set.of(ATTENDANCE_CLOSED, DRAFT, REJECTED);
    private static final Set<String> REOPENABLE = Set.of(ATTENDANCE_CLOSED, DRAFT, REJECTED);
    private static final Set<Role> PAYROLL_ROLES = Set.of(Role.NHAN_VIEN, Role.TRUONG_PHONG, Role.GIAM_DOC_PHONG_BAN);

    private final PayrollRepository payrollRepository;
    private final HolidayRepository holidayRepository;
    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final NotificationService notificationService;
    private final PayrollReportRepository payrollReportRepository;
    private final FinanceAccess financeAccess;
    private final EmployeeRequestRepository employeeRequestRepository;

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

    // Hệ số làm thêm giờ theo Điều 98 Bộ luật Lao động 2019
    @Value("${payroll.overtime-multiplier:1.5}")
    private double overtimeWeekdayRate;

    @Value("${payroll.overtime-weekend-multiplier:2.0}")
    private double overtimeWeekendRate;

    @Value("${payroll.overtime-holiday-multiplier:3.0}")
    private double overtimeHolidayRate;

    // ───────────────────────────── Quyền truy cập ─────────────────────────────

    public Map<String, Object> getAccess(CustomUserDetails user) {
        Map<String, Object> access = new LinkedHashMap<>();
        access.put("accountant", financeAccess.isAccountant(user));
        access.put("chiefAccountant", financeAccess.isChiefAccountant(user));
        access.put("financeDepartmentName", financeAccess.getFinanceDepartmentName());
        access.put("financeDepartmentConfigured", financeAccess.findFinanceDepartment().isPresent());
        return access;
    }

    // ───────────────────────────── Danh sách kỳ lương ─────────────────────────────

    public List<PayrollBatchView> getBatches(int month, int year, CustomUserDetails user) {
        validatePeriod(month, year);
        boolean companyWide = user.getRole() == Role.CEO || financeAccess.isAccountant(user);

        List<Department> departments;
        if (companyWide) {
            departments = departmentRepository.findAll().stream()
                    .sorted(Comparator.comparing(Department::getId))
                    .toList();
        } else if ((user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && user.getDepartmentId() != null) {
            departments = departmentRepository.findById(user.getDepartmentId()).map(List::of).orElse(List.of());
        } else {
            throw AppException.forbidden("Bạn không có quyền xem bảng lương phòng ban");
        }

        Map<Long, PayrollReport> reportsByDept = payrollReportRepository
                .findByMonthAndYearAndReportLevel(month, year, LEVEL_DEPARTMENT).stream()
                .collect(Collectors.toMap(PayrollReport::getDepartmentId, Function.identity(), (a, b) -> a));

        Set<Long> userIds = new HashSet<>();
        reportsByDept.values().forEach(r -> userIds.addAll(actorIds(r)));
        Map<Long, String> names = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getHoTen));

        List<PayrollBatchView> result = new ArrayList<>();
        for (Department d : departments) {
            PayrollReport r = reportsByDept.get(d.getId());
            // Phòng đã khóa và không có kỳ lương thì không cần hiển thị.
            if (r == null && Boolean.TRUE.equals(d.getIsLock())) continue;
            result.add(toView(d, r, month, year, user, names));
        }
        return result;
    }

    public List<Map<String, Object>> getBatchItems(Long batchId, CustomUserDetails user) {
        PayrollReport report = loadBatch(batchId);
        boolean companyWide = user.getRole() == Role.CEO || financeAccess.isAccountant(user);
        boolean sameDept = report.getDepartmentId().equals(user.getDepartmentId());
        if (!companyWide && !(sameDept && (user.getRole() == Role.GIAM_DOC_PHONG_BAN || user.getRole() == Role.TRUONG_PHONG))) {
            throw AppException.forbidden("Bạn không có quyền xem bảng lương phòng ban này");
        }

        List<Payroll> payrolls = payrollRepository.findByPayrollReportId(batchId);
        Map<Long, User> users = userRepository.findAllById(payrolls.stream().map(Payroll::getEmployeeId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        return payrolls.stream()
                .filter(p -> {
                    // Trưởng phòng chỉ xem lương nhân viên và của chính mình (không xem lương Giám đốc).
                    if (companyWide || user.getRole() != Role.TRUONG_PHONG) return true;
                    User u = users.get(p.getEmployeeId());
                    return p.getEmployeeId().equals(user.getUserId()) || (u != null && u.getRole() == Role.NHAN_VIEN);
                })
                .sorted(Comparator.comparing(p -> Optional.ofNullable(users.get(p.getEmployeeId())).map(User::getHoTen).orElse("")))
                .map(p -> {
                    User u = users.get(p.getEmployeeId());
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", p.getId());
                    row.put("employeeId", p.getEmployeeId());
                    row.put("month", p.getMonth());
                    row.put("year", p.getYear());
                    row.put("employeeName", u != null ? u.getHoTen() : "NV " + p.getEmployeeId());
                    row.put("maNhanVien", u != null ? u.getMaNhanVien() : null);
                    row.put("chucVu", u != null ? u.getChucVu() : null);
                    row.put("baseSalary", p.getBaseSalary());
                    row.put("allowance", p.getAllowance());
                    row.put("standardDays", p.getStandardDays());
                    row.put("actualDays", p.getActualDays());
                    row.put("latePenalty", p.getLatePenalty());
                    row.put("overtimePay", p.getOvertimePay());
                    row.put("grossSalary", p.getGrossSalary());
                    row.put("bhxhAmount", p.getBhxhAmount());
                    row.put("bhytAmount", p.getBhytAmount());
                    row.put("bhtnAmount", p.getBhtnAmount());
                    row.put("thuNhapTinhThue", p.getThuNhapTinhThue());
                    row.put("thuTncn", p.getThuTncn());
                    row.put("netSalary", p.getNetSalary());
                    row.put("status", p.getStatus());
                    row.put("rejectionReason", p.getRejectionReason());
                    return row;
                })
                .toList();
    }

    // ───────────────────────────── 1. Trưởng phòng chốt công ─────────────────────────────

    @Transactional
    public PayrollReport closeAttendance(int month, int year, CustomUserDetails user) {
        validatePeriod(month, year);
        Long deptId = requireDepartmentLead(user);

        // BUG-05: chỉ chốt công khi tháng đã kết thúc (tránh khóa bảng công khi nhân viên còn đang đi làm).
        if (!YearMonth.of(year, month).isBefore(YearMonth.now(PAYROLL_ZONE))) {
            throw AppException.badRequest("Chỉ được chốt công khi tháng " + month + "/" + year
                    + " đã kết thúc. Tháng hiện tại vẫn còn ngày làm việc.");
        }

        List<User> employees = payrollEmployees(deptId, month, year);
        if (employees.isEmpty()) {
            throw AppException.badRequest("Phòng ban chưa có nhân sự để chốt công");
        }
        List<String> pending = employeesWithPendingExceptions(employees, month, year);
        if (!pending.isEmpty()) {
            throw AppException.badRequest("Còn đơn ngoại lệ chấm công chưa duyệt của: " + String.join(", ", pending)
                    + ". Vui lòng xử lý hết trước khi chốt công.");
        }
        // BUG-04: đơn từ (nghỉ phép, OT...) còn chờ duyệt cũng phải xử lý xong trước khi chốt.
        List<String> pendingRequests = employeesWithPendingRequests(employees, month, year);
        if (!pendingRequests.isEmpty()) {
            throw AppException.badRequest("Còn đơn từ chưa duyệt trong tháng của: " + String.join(", ", pendingRequests)
                    + ". Vui lòng duyệt hoặc từ chối trước khi chốt công.");
        }

        PayrollReport report = findBatch(deptId, month, year).orElse(null);
        if (report != null && !ATTENDANCE_REOPENED.equals(report.getStatus())) {
            throw AppException.conflict("Công tháng " + month + "/" + year + " của phòng đã được chốt (trạng thái: "
                    + report.getStatus() + ")");
        }
        if (report == null) {
            report = PayrollReport.builder()
                    .departmentId(deptId)
                    .month(month)
                    .year(year)
                    .reportLevel(LEVEL_DEPARTMENT)
                    .periodKey(periodKey(deptId, month, year))
                    .build();
        }
        report.setCreatedBy(user.getUserId());
        report.setStatus(ATTENDANCE_CLOSED);
        report.setAttendanceClosedBy(user.getUserId());
        report.setAttendanceClosedAt(LocalDateTime.now());
        report.setTotalEmployees(employees.size());
        try {
            // Ghi ngay để ràng buộc UNIQUE(period_key) bắt được trường hợp 2 request chốt công cùng lúc (BUG-01).
            report = payrollReportRepository.saveAndFlush(report);
        } catch (DataIntegrityViolationException e) {
            throw AppException.conflict("Công tháng " + month + "/" + year + " của phòng vừa được chốt bởi một thao tác khác. Vui lòng tải lại trang.");
        }

        String deptName = departmentName(deptId);
        notifyUsers(financeAccess.accountants(), "Phòng " + deptName + " đã chốt công",
                user.getHoTen() + " đã chốt công tháng " + month + "/" + year + " của phòng " + deptName
                        + ". Kế toán có thể tiến hành tính lương.", "binh_thuong");
        return report;
    }

    @Transactional
    public PayrollReport reopenAttendance(int month, int year, CustomUserDetails user) {
        validatePeriod(month, year);
        Long deptId = requireDepartmentLead(user);
        PayrollReport report = findBatch(deptId, month, year)
                .orElseThrow(() -> AppException.badRequest("Phòng chưa chốt công tháng " + month + "/" + year));
        if (!REOPENABLE.contains(report.getStatus())) {
            throw AppException.conflict("Bảng lương đã được gửi duyệt, không thể mở lại công. Hãy đề nghị người duyệt từ chối để kế toán xử lý.");
        }
        // Phiếu lương nháp tính từ dữ liệu công cũ không còn giá trị.
        List<Payroll> drafts = payrollRepository.findByPayrollReportId(report.getId()).stream()
                .filter(p -> DRAFT.equals(p.getStatus()) || REJECTED.equals(p.getStatus()))
                .toList();
        payrollRepository.deleteAll(drafts);

        report.setStatus(ATTENDANCE_REOPENED);
        report.setTotalGrossSalary(null);
        report.setTotalNetSalary(null);
        report.setGeneratedBy(null);
        report.setGeneratedAt(null);
        report = payrollReportRepository.save(report);

        String deptName = departmentName(deptId);
        notifyUsers(financeAccess.accountants(), "Phòng " + deptName + " mở lại công",
                user.getHoTen() + " đã mở lại công tháng " + month + "/" + year + " của phòng " + deptName
                        + ". Bảng lương nháp của phòng đã bị hủy, chờ phòng chốt công lại.", "binh_thuong");
        return report;
    }

    // ───────────────────────────── 2. Kế toán tính lương ─────────────────────────────

    /**
     * Tính lương cho mọi phòng đã chốt công (hoặc chỉ 1 phòng nếu truyền departmentId).
     */
    @Transactional
    public Map<String, Object> generatePayroll(int month, int year, Long onlyDepartmentId, CustomUserDetails user) {
        validatePeriod(month, year);
        requireAccountant(user);

        List<PayrollReport> batches = payrollReportRepository.findByMonthAndYearAndReportLevel(month, year, LEVEL_DEPARTMENT);
        Map<Long, PayrollReport> byDept = batches.stream()
                .collect(Collectors.toMap(PayrollReport::getDepartmentId, Function.identity(), (a, b) -> a));

        List<Map<String, Object>> generated = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        List<Map<String, Object>> blockedEmployees = new ArrayList<>();
        List<Map<String, Object>> warnings = new ArrayList<>();

        List<Department> departments = departmentRepository.findAll().stream()
                .filter(d -> onlyDepartmentId == null || d.getId().equals(onlyDepartmentId))
                .sorted(Comparator.comparing(Department::getId))
                .toList();
        int standardDays = calculateStandardDays(month, year);

        for (Department d : departments) {
            PayrollReport report = byDept.get(d.getId());
            if (report == null || ATTENDANCE_REOPENED.equals(report.getStatus())) {
                if (!Boolean.TRUE.equals(d.getIsLock())) skipped.add(skip(d, "Chưa chốt công"));
                continue;
            }
            if (!GENERATABLE.contains(report.getStatus())) {
                skipped.add(skip(d, "Đang trong quy trình duyệt hoặc đã chi trả"));
                continue;
            }

            List<User> employees = payrollEmployees(d.getId(), month, year);
            List<String> pending = employeesWithPendingExceptions(employees, month, year);
            if (!pending.isEmpty()) {
                skipped.add(skip(d, "Còn đơn ngoại lệ chưa duyệt: " + String.join(", ", pending)));
                continue;
            }
            List<String> pendingReqs = employeesWithPendingRequests(employees, month, year);
            if (!pendingReqs.isEmpty()) {
                skipped.add(skip(d, "Còn đơn từ chưa duyệt: " + String.join(", ", pendingReqs)));
                continue;
            }

            Set<Long> includedIds = new HashSet<>();
            double totalGross = 0;
            double totalNet = 0;
            for (User emp : employees) {
                Optional<Payroll> existingOpt = payrollRepository.findByEmployeeIdAndMonthAndYear(emp.getId(), month, year);
                if (existingOpt.isPresent()) {
                    Payroll existing = existingOpt.get();
                    boolean locked = existing.getPayrollReportId() == null
                            // Phiếu của luồng cũ: chỉ khóa nếu đã được chốt cuối cùng.
                            ? FINALIZED_PAYROLL_STATUSES.contains(existing.getStatus())
                            : !existing.getPayrollReportId().equals(report.getId())
                                && LOCKED_PAYROLL_STATUSES.contains(existing.getStatus());
                    if (locked) {
                        blockedEmployees.add(Map.of("employeeId", emp.getId(), "hoTen", emp.getHoTen(),
                                "reason", "Đã có phiếu lương tháng này ở trạng thái " + existing.getStatus()));
                        continue;
                    }
                }
                Payroll payroll = existingOpt.orElse(Payroll.builder()
                        .employeeId(emp.getId())
                        .month(month)
                        .year(year)
                        .build());
                computePayroll(emp, payroll, month, year, standardDays);
                payroll.setPayrollReportId(report.getId());
                payroll.setDepartmentId(d.getId());
                payroll.setStatus(DRAFT);
                payroll.setRejectionReason(null);
                payrollRepository.save(payroll);
                if (!Boolean.TRUE.equals(emp.getActive())) {
                    warnings.add(Map.of("employeeId", emp.getId(), "hoTen", emp.getHoTen(),
                            "departmentName", d.getTenPhong(), "reason", "Đã nghỉ việc — chỉ tính lương " + payroll.getActualDays() + " ngày công đã làm"));
                } else if (nz(payroll.getActualDays()) <= 0) {
                    warnings.add(Map.of("employeeId", emp.getId(), "hoTen", emp.getHoTen(),
                            "departmentName", d.getTenPhong(), "reason", "0 ngày công trong tháng — kiểm tra lại dữ liệu chấm công"));
                } else if (nz(payroll.getNetSalary()) <= 0) {
                    warnings.add(Map.of("employeeId", emp.getId(), "hoTen", emp.getHoTen(),
                            "departmentName", d.getTenPhong(), "reason", "Lương thực nhận bằng 0"));
                }
                includedIds.add(emp.getId());
                totalGross += nz(payroll.getGrossSalary());
                totalNet += nz(payroll.getNetSalary());
            }

            // Nhân viên đã chuyển phòng / nghỉ việc kể từ lần tính trước thì bỏ khỏi kỳ lương này.
            List<Payroll> stale = payrollRepository.findByPayrollReportId(report.getId()).stream()
                    .filter(p -> !includedIds.contains(p.getEmployeeId()))
                    .toList();
            payrollRepository.deleteAll(stale);

            report.setStatus(DRAFT);
            report.setTotalEmployees(includedIds.size());
            report.setTotalGrossSalary(totalGross);
            report.setTotalNetSalary(totalNet);
            report.setGeneratedBy(user.getUserId());
            report.setGeneratedAt(LocalDateTime.now());
            payrollReportRepository.save(report);

            Map<String, Object> g = new LinkedHashMap<>();
            g.put("departmentId", d.getId());
            g.put("departmentName", d.getTenPhong());
            g.put("employees", includedIds.size());
            g.put("totalNetSalary", totalNet);
            generated.add(g);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("generated", generated);
        result.put("skipped", skipped);
        result.put("blocked", blockedEmployees);
        result.put("warnings", warnings);
        return result;
    }

    @Transactional
    public PayrollReport submitForApproval(Long batchId, CustomUserDetails user) {
        requireAccountant(user);
        PayrollReport report = loadBatch(batchId);
        requireStatus(report, DRAFT);
        if (nz(report.getTotalEmployees()) == 0) {
            throw AppException.badRequest("Bảng lương chưa có nhân viên nào, vui lòng tính lương lại");
        }

        List<User> directors = directorsOf(report.getDepartmentId());
        String next = directors.isEmpty() ? PENDING_CHIEF_ACCOUNTANT : PENDING_DIRECTOR;
        report.setStatus(next);
        report.setSubmittedBy(user.getUserId());
        report.setSubmittedAt(LocalDateTime.now());
        clearRejection(report);
        syncPayrollStatus(report, next);
        payrollReportRepository.save(report);

        String deptName = departmentName(report.getDepartmentId());
        if (directors.isEmpty()) {
            notifyUsers(financeAccess.chiefAccountants(), "Bảng lương chờ kế toán trưởng kiểm tra",
                    "Bảng lương tháng " + period(report) + " của phòng " + deptName + " đang chờ bạn kiểm tra.", "quan_trong");
        } else {
            notifyUsers(directors, "Bảng lương phòng chờ xác nhận",
                    "Phòng Tài chính - Kế toán đã gửi bảng lương tháng " + period(report) + " của phòng " + deptName
                            + ". Vui lòng xác nhận.", "quan_trong");
        }
        return report;
    }

    // ───────────────────────────── 3. Giám đốc phòng xác nhận ─────────────────────────────

    @Transactional
    public PayrollReport directorConfirm(Long batchId, CustomUserDetails user) {
        PayrollReport report = loadBatch(batchId);
        requireDirectorOf(report, user);
        requireStatus(report, PENDING_DIRECTOR);
        report.setStatus(PENDING_CHIEF_ACCOUNTANT);
        report.setDirectorConfirmedBy(user.getUserId());
        report.setDirectorConfirmedAt(LocalDateTime.now());
        syncPayrollStatus(report, PENDING_CHIEF_ACCOUNTANT);
        payrollReportRepository.save(report);

        notifyUsers(financeAccess.chiefAccountants(), "Bảng lương chờ kế toán trưởng kiểm tra",
                user.getHoTen() + " đã xác nhận bảng lương tháng " + period(report) + " của phòng "
                        + departmentName(report.getDepartmentId()) + ".", "quan_trong");
        return report;
    }

    @Transactional
    public PayrollReport directorReject(Long batchId, String reason, CustomUserDetails user) {
        PayrollReport report = loadBatch(batchId);
        requireDirectorOf(report, user);
        requireStatus(report, PENDING_DIRECTOR);
        return reject(report, "DIRECTOR", reason, user);
    }

    // ───────────────────────────── 4. Kế toán trưởng kiểm tra ─────────────────────────────

    @Transactional
    public PayrollReport chiefApprove(Long batchId, CustomUserDetails user) {
        PayrollReport report = loadBatch(batchId);
        requireChief(report, user);
        requireStatus(report, PENDING_CHIEF_ACCOUNTANT);
        report.setStatus(PENDING_CEO);
        report.setChiefReviewedBy(user.getUserId());
        report.setChiefReviewedAt(LocalDateTime.now());
        syncPayrollStatus(report, PENDING_CEO);
        payrollReportRepository.save(report);

        notifyUsers(userRepository.findByRole(Role.CEO), "Bảng lương chờ Tổng Giám đốc chốt",
                "Kế toán trưởng đã kiểm tra bảng lương tháng " + period(report) + " của phòng "
                        + departmentName(report.getDepartmentId()) + ".", "quan_trong");
        return report;
    }

    @Transactional
    public PayrollReport chiefReject(Long batchId, String reason, CustomUserDetails user) {
        PayrollReport report = loadBatch(batchId);
        requireChief(report, user);
        requireStatus(report, PENDING_CHIEF_ACCOUNTANT);
        return reject(report, "CHIEF_ACCOUNTANT", reason, user);
    }

    // ───────────────────────────── 5. CEO chốt ─────────────────────────────

    @Transactional
    public PayrollReport ceoApprove(Long batchId, CustomUserDetails user) {
        requireCeo(user);
        PayrollReport report = loadBatch(batchId);
        requireStatus(report, PENDING_CEO);
        report.setStatus(APPROVED_BY_CEO);
        report.setCeoApprovedBy(user.getUserId());
        report.setCeoApprovedAt(LocalDateTime.now());
        syncPayrollStatus(report, APPROVED_BY_CEO);
        payrollReportRepository.save(report);

        notifyUsers(financeAccess.accountants(), "Bảng lương đã được chốt — chờ chi trả",
                "Tổng Giám đốc đã chốt bảng lương tháng " + period(report) + " của phòng "
                        + departmentName(report.getDepartmentId()) + ". Kế toán tiến hành chi trả.", "quan_trong");
        return report;
    }

    @Transactional
    public PayrollReport ceoReject(Long batchId, String reason, CustomUserDetails user) {
        requireCeo(user);
        PayrollReport report = loadBatch(batchId);
        requireStatus(report, PENDING_CEO);
        return reject(report, "CEO", reason, user);
    }

    // ───────────────────────────── 6. Kế toán chi trả ─────────────────────────────

    @Transactional
    public PayrollReport markPaid(Long batchId, String paymentReference, CustomUserDetails user) {
        requireAccountant(user);
        if (paymentReference != null && paymentReference.trim().length() > MAX_PAYMENT_REFERENCE) {
            throw AppException.badRequest("Mã chứng từ tối đa " + MAX_PAYMENT_REFERENCE + " ký tự");
        }
        PayrollReport report = loadBatch(batchId);
        requireStatus(report, APPROVED_BY_CEO);
        report.setStatus(PAID);
        report.setPaidBy(user.getUserId());
        report.setPaidAt(LocalDateTime.now());
        report.setPaymentReference(paymentReference != null && !paymentReference.isBlank() ? paymentReference.trim() : null);
        List<Payroll> payrolls = syncPayrollStatus(report, PAID);
        payrollReportRepository.save(report);

        for (Payroll p : payrolls) {
            notificationService.createNotification(p.getEmployeeId(), "PAYROLL",
                    "Đã chi trả lương tháng " + period(report),
                    "Lương thực nhận tháng " + period(report) + ": " + formatVnd(p.getNetSalary())
                            + ". Xem chi tiết trong mục Phiếu lương.",
                    "binh_thuong", payslipLink(p.getEmployeeId()));
        }
        return report;
    }

    /** File CSV (UTF-8) để kế toán nhập vào Internet Banking. */
    public String buildBankTransferCsv(Long batchId, CustomUserDetails user) {
        if (!financeAccess.isAccountant(user) && user.getRole() != Role.CEO) {
            throw AppException.forbidden("Chỉ phòng Tài chính - Kế toán được xuất file chi lương");
        }
        PayrollReport report = loadBatch(batchId);
        if (!APPROVED_BY_CEO.equals(report.getStatus()) && !PAID.equals(report.getStatus())) {
            throw AppException.badRequest("Chỉ xuất file chi lương sau khi Tổng Giám đốc đã chốt");
        }
        List<Payroll> payrolls = payrollRepository.findByPayrollReportId(batchId);
        Map<Long, User> users = userRepository.findAllById(payrolls.stream().map(Payroll::getEmployeeId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        String content = "Luong T" + report.getMonth() + "/" + report.getYear();
        StringBuilder sb = new StringBuilder("STT,Ma NV,Ho ten,So tai khoan,Ngan hang,So tien,Noi dung\n");
        int i = 1;
        double total = 0;
        for (Payroll p : payrolls) {
            User u = users.get(p.getEmployeeId());
            long amount = Math.round(nz(p.getNetSalary()));
            total += amount;
            sb.append(i++).append(',')
                    .append(csv(u != null ? u.getMaNhanVien() : String.valueOf(p.getEmployeeId()))).append(',')
                    .append(csv(u != null ? u.getHoTen() : "")).append(',')
                    .append(",") // Số tài khoản: hệ thống chưa lưu, kế toán bổ sung trước khi tải lên ngân hàng
                    .append(",")
                    .append(amount).append(',')
                    .append(csv(content + " - " + (u != null ? u.getHoTen() : ""))).append('\n');
        }
        sb.append(",,TONG CONG,,,").append(Math.round(total)).append(",\n");
        return sb.toString();
    }

    // ───────────────────────────── Phiếu lương cá nhân ─────────────────────────────

    public List<Payroll> getMyPayroll(Long employeeId) {
        return payrollRepository.findByEmployeeIdOrderByYearDescMonthDesc(employeeId)
                .stream().filter(p -> PAID.equals(p.getStatus()) || "APPROVED".equals(p.getStatus())).toList();
    }

    // ───────────────────────────── Tính toán ─────────────────────────────

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

    private void computePayroll(User emp, Payroll payroll, int month, int year, int standardDays) {
        YearMonth yearMonth = YearMonth.of(year, month);
        LocalDate startDate = yearMonth.atDay(1);
        LocalDate endDate = yearMonth.atEndOfMonth();

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

        // ── Làm thêm giờ (BUG-03): tính lại từ đơn OT đã duyệt, không giữ giá trị cũ ──
        // Mỗi ngày OT = lương 1 ngày × 150% (ngày thường) / 200% (cuối tuần) / 300% (ngày lễ).
        // Phần trả thêm so với lương bình thường được miễn thuế TNCN.
        Set<LocalDate> holidayDates = new HashSet<>(holidayRepository.findByNgayLeBetween(startDate, endDate)
                .stream().map(Holiday::getNgayLe).toList());
        Set<LocalDate> otDates = new TreeSet<>();
        for (EmployeeRequest req : employeeRequestRepository.findApprovedRequestsForMonth(emp.getId(), startDate, endDate)) {
            if (req.getRequestType() != RequestType.OVERTIME || req.getStartDate() == null) continue;
            LocalDate from = req.getStartDate().isBefore(startDate) ? startDate : req.getStartDate();
            LocalDate to = req.getEndDate() == null || req.getEndDate().isAfter(endDate) ? endDate : req.getEndDate();
            for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) otDates.add(d);
        }
        double overtimePay = 0.0;
        double overtimePremium = 0.0;
        int otWeekday = 0, otWeekend = 0, otHoliday = 0;
        for (LocalDate d : otDates) {
            double rate;
            if (holidayDates.contains(d)) { rate = overtimeHolidayRate; otHoliday++; }
            else if (d.getDayOfWeek() == DayOfWeek.SATURDAY || d.getDayOfWeek() == DayOfWeek.SUNDAY) { rate = overtimeWeekendRate; otWeekend++; }
            else { rate = overtimeWeekdayRate; otWeekday++; }
            overtimePay += dailySalary * rate;
            overtimePremium += dailySalary * Math.max(rate - 1.0, 0.0);
        }
        payroll.setOvertimePay(overtimePay);
        payroll.setOvertimeReason(otDates.isEmpty() ? null : String.format(
                "%d ngày OT (ngày thường %d × %.0f%%, cuối tuần %d × %.0f%%, ngày lễ %d × %.0f%%)",
                otDates.size(), otWeekday, overtimeWeekdayRate * 100, otWeekend, overtimeWeekendRate * 100,
                otHoliday, overtimeHolidayRate * 100));

        payroll.setBaseSalary(baseSalary);
        payroll.setAllowance(allowance);
        payroll.setStandardDays((double) standardDays);
        payroll.setActualDays(actualDays);
        payroll.setLatePenalty(latePenalty);

        // 1. Tính lương gộp (gross)
        double ratio = standardDays > 0 ? actualDays / standardDays : 0.0;
        double grossSalary = (baseSalary + allowance) * ratio - latePenalty + overtimePay;
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

        // 3. Tính thu nhập chịu thuế (trừ phần tiền OT trả cao hơn lương bình thường — được miễn thuế)
        double thuNhapChiuThue = Math.max(grossSalary - totalInsurance - overtimePremium, 0.0);

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
    }

    // ───────────────────────────── Helpers ─────────────────────────────

    private PayrollReport reject(PayrollReport report, String stage, String reason, CustomUserDetails user) {
        if (reason == null || reason.trim().isEmpty()) {
            throw AppException.badRequest("Vui lòng nhập lý do từ chối");
        }
        report.setStatus(REJECTED);
        report.setRejectedStage(stage);
        report.setRejectedBy(user.getUserId());
        report.setRejectionReason(reason.trim());
        List<Payroll> payrolls = syncPayrollStatus(report, REJECTED);
        payrolls.forEach(p -> p.setRejectionReason(reason.trim()));
        payrollRepository.saveAll(payrolls);
        payrollReportRepository.save(report);

        String stageLabel = switch (stage) {
            case "DIRECTOR" -> "Giám đốc phòng ban";
            case "CHIEF_ACCOUNTANT" -> "Kế toán trưởng";
            default -> "Tổng Giám đốc";
        };
        notifyUsers(financeAccess.accountants(), "Bảng lương bị từ chối",
                stageLabel + " (" + user.getHoTen() + ") đã từ chối bảng lương tháng " + period(report) + " của phòng "
                        + departmentName(report.getDepartmentId()) + ". Lý do: " + reason.trim(), "quan_trong");
        return report;
    }

    private List<Payroll> syncPayrollStatus(PayrollReport report, String status) {
        List<Payroll> payrolls = payrollRepository.findByPayrollReportId(report.getId());
        payrolls.forEach(p -> p.setStatus(status));
        return payrollRepository.saveAll(payrolls);
    }

    private PayrollBatchView toView(Department d, PayrollReport r, int month, int year,
                                    CustomUserDetails user, Map<Long, String> names) {
        String status = r == null ? OPEN : r.getStatus();
        boolean hasDirector = !directorsOf(d.getId()).isEmpty();
        List<String> actions = new ArrayList<>();

        boolean lead = isDepartmentLead(user, d.getId());
        boolean accountant = financeAccess.isAccountant(user);
        boolean chief = financeAccess.isChiefAccountant(user);
        boolean ceo = user.getRole() == Role.CEO;
        boolean director = user.getRole() == Role.GIAM_DOC_PHONG_BAN && d.getId().equals(user.getDepartmentId());

        boolean monthEnded = YearMonth.of(year, month).isBefore(YearMonth.now(PAYROLL_ZONE));
        if (lead && monthEnded && (OPEN.equals(status) || ATTENDANCE_REOPENED.equals(status))) actions.add("CLOSE_ATTENDANCE");
        if (lead && REOPENABLE.contains(status)) actions.add("REOPEN_ATTENDANCE");
        if (accountant && GENERATABLE.contains(status)) actions.add("GENERATE");
        if (accountant && DRAFT.equals(status)) actions.add("SUBMIT");
        if (director && PENDING_DIRECTOR.equals(status) && !user.getUserId().equals(r.getSubmittedBy())) {
            actions.add("DIRECTOR_CONFIRM");
            actions.add("DIRECTOR_REJECT");
        }
        if (chief && PENDING_CHIEF_ACCOUNTANT.equals(status) && !alreadyActed(r, user.getUserId())) {
            actions.add("CHIEF_APPROVE");
            actions.add("CHIEF_REJECT");
        }
        if (ceo && PENDING_CEO.equals(status)) {
            actions.add("CEO_APPROVE");
            actions.add("CEO_REJECT");
        }
        if ((accountant || ceo) && (APPROVED_BY_CEO.equals(status) || PAID.equals(status))) actions.add("DOWNLOAD_BANK_FILE");
        if (accountant && APPROVED_BY_CEO.equals(status)) actions.add("MARK_PAID");
        if (r != null && r.getGeneratedAt() != null) actions.add("VIEW_ITEMS");

        return new PayrollBatchView(
                r == null ? null : r.getId(),
                d.getId(),
                d.getTenPhong(),
                month,
                year,
                status,
                r == null ? payrollEmployees(d.getId(), month, year).size() : r.getTotalEmployees(),
                r == null ? null : r.getTotalGrossSalary(),
                r == null ? null : r.getTotalNetSalary(),
                hasDirector,
                r == null ? null : names.get(r.getAttendanceClosedBy()),
                r == null ? null : r.getAttendanceClosedAt(),
                r == null ? null : names.get(r.getGeneratedBy()),
                r == null ? null : r.getGeneratedAt(),
                r == null ? null : names.get(r.getSubmittedBy()),
                r == null ? null : r.getSubmittedAt(),
                r == null ? null : names.get(r.getDirectorConfirmedBy()),
                r == null ? null : r.getDirectorConfirmedAt(),
                r == null ? null : names.get(r.getChiefReviewedBy()),
                r == null ? null : r.getChiefReviewedAt(),
                r == null ? null : names.get(r.getCeoApprovedBy()),
                r == null ? null : r.getCeoApprovedAt(),
                r == null ? null : names.get(r.getPaidBy()),
                r == null ? null : r.getPaidAt(),
                r == null ? null : r.getPaymentReference(),
                r == null ? null : r.getRejectedStage(),
                r == null ? null : names.get(r.getRejectedBy()),
                r == null ? null : r.getRejectionReason(),
                actions
        );
    }

    private static List<Long> actorIds(PayrollReport r) {
        return Arrays.asList(r.getAttendanceClosedBy(), r.getGeneratedBy(), r.getSubmittedBy(),
                        r.getDirectorConfirmedBy(), r.getChiefReviewedBy(), r.getCeoApprovedBy(),
                        r.getPaidBy(), r.getRejectedBy())
                .stream().filter(Objects::nonNull).toList();
    }

    /**
     * Nhân sự được tính lương của phòng trong tháng:
     *  - nhân viên đang làm việc (active), và
     *  - nhân viên đã nghỉ việc (active = false) nhưng có ngày công trong tháng —
     *    vẫn được trả lương cho những ngày đã làm.
     */
    private List<User> payrollEmployees(Long departmentId, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        return userRepository.findByDepartmentId(departmentId).stream()
                .filter(u -> PAYROLL_ROLES.contains(u.getRole()))
                .filter(u -> Boolean.TRUE.equals(u.getActive())
                        || !attendanceRepository.findByEmployeeIdAndDateBetween(u.getId(), ym.atDay(1), ym.atEndOfMonth()).isEmpty())
                .toList();
    }

    static String periodKey(Long departmentId, int month, int year) {
        return LEVEL_DEPARTMENT + ":" + departmentId + ":" + year + ":" + month;
    }

    private List<String> employeesWithPendingExceptions(List<User> employees, int month, int year) {
        YearMonth ym = YearMonth.of(year, month);
        return employees.stream()
                .filter(e -> attendanceRepository.existsByEmployeeIdAndDateBetweenAndExceptionStatus(
                        e.getId(), ym.atDay(1), ym.atEndOfMonth(), "PENDING"))
                .map(User::getHoTen)
                .toList();
    }

    private List<String> employeesWithPendingRequests(List<User> employees, int month, int year) {
        if (employees.isEmpty()) return List.of();
        YearMonth ym = YearMonth.of(year, month);
        return employeeRequestRepository.findOverlappingByUsersAndStatuses(
                        employees.stream().map(User::getId).toList(),
                        List.of(RequestStatus.PENDING, RequestStatus.FORWARDED),
                        ym.atDay(1), ym.atEndOfMonth())
                .stream()
                .map(r -> r.getUser().getHoTen())
                .distinct()
                .toList();
    }

    private List<User> directorsOf(Long departmentId) {
        return userRepository.findByDepartmentIdAndRole(departmentId, Role.GIAM_DOC_PHONG_BAN).stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .toList();
    }

    private Optional<PayrollReport> findBatch(Long deptId, int month, int year) {
        return payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(deptId, month, year, LEVEL_DEPARTMENT)
                .stream().findFirst();
    }

    private PayrollReport loadBatch(Long batchId) {
        PayrollReport report = payrollReportRepository.findById(batchId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ lương"));
        if (!LEVEL_DEPARTMENT.equals(report.getReportLevel())) {
            throw AppException.badRequest("Báo cáo này thuộc luồng lương cũ, không thao tác được");
        }
        return report;
    }

    private boolean isDepartmentLead(CustomUserDetails user, Long departmentId) {
        return (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && departmentId.equals(user.getDepartmentId());
    }

    private Long requireDepartmentLead(CustomUserDetails user) {
        if (user.getDepartmentId() == null || !isDepartmentLead(user, user.getDepartmentId())) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc phòng ban được chốt công của phòng");
        }
        return user.getDepartmentId();
    }

    private void requireAccountant(CustomUserDetails user) {
        if (!financeAccess.isAccountant(user)) {
            throw AppException.forbidden("Chỉ nhân sự phòng " + financeAccess.getFinanceDepartmentName() + " được thực hiện thao tác này");
        }
    }

    private void requireChief(PayrollReport report, CustomUserDetails user) {
        if (!financeAccess.isChiefAccountant(user)) {
            throw AppException.forbidden("Chỉ Kế toán trưởng (Trưởng phòng / Giám đốc phòng Tài chính - Kế toán) được duyệt bước này");
        }
        // BUG-06: mỗi người chỉ làm 1 bước duyệt trên 1 kỳ lương.
        if (user.getUserId().equals(report.getSubmittedBy())) {
            throw AppException.forbidden("Người gửi bảng lương không được tự kiểm duyệt. Cần một kế toán trưởng khác duyệt.");
        }
        if (user.getUserId().equals(report.getDirectorConfirmedBy())) {
            throw AppException.forbidden("Bạn đã xác nhận bảng lương này ở bước Giám đốc phòng, không được duyệt tiếp bước Kế toán trưởng. Cần một kế toán trưởng khác duyệt.");
        }
    }

    private void requireDirectorOf(PayrollReport report, CustomUserDetails user) {
        if (user.getRole() != Role.GIAM_DOC_PHONG_BAN || !report.getDepartmentId().equals(user.getDepartmentId())) {
            throw AppException.forbidden("Chỉ Giám đốc của phòng này được xác nhận bảng lương");
        }
        if (user.getUserId().equals(report.getSubmittedBy())) {
            throw AppException.forbidden("Bạn đã gửi bảng lương này với vai trò kế toán, không được tự xác nhận ở bước Giám đốc phòng.");
        }
    }

    /** Người dùng đã tham gia duyệt/gửi kỳ lương này ở một bước khác chưa (BUG-06). */
    private static boolean alreadyActed(PayrollReport r, Long userId) {
        return r != null && (userId.equals(r.getSubmittedBy()) || userId.equals(r.getDirectorConfirmedBy()));
    }

    private void requireCeo(CustomUserDetails user) {
        if (user.getRole() != Role.CEO) {
            throw AppException.forbidden("Chỉ Tổng Giám đốc được chốt bảng lương");
        }
    }

    private void requireStatus(PayrollReport report, String expected) {
        if (!expected.equals(report.getStatus())) {
            throw AppException.conflict("Thao tác không hợp lệ: bảng lương đang ở trạng thái " + report.getStatus());
        }
    }

    private void clearRejection(PayrollReport report) {
        report.setRejectedStage(null);
        report.setRejectedBy(null);
        report.setRejectionReason(null);
    }

    private void validatePeriod(int month, int year) {
        if (month < 1 || month > 12 || year < 2000 || year > 2100) {
            throw AppException.badRequest("Tháng/năm không hợp lệ");
        }
    }

    private String departmentName(Long deptId) {
        return departmentRepository.findById(deptId).map(Department::getTenPhong).orElse("#" + deptId);
    }

    private void notifyUsers(List<User> users, String title, String body, String level) {
        users.forEach(u -> notificationService.createNotification(u.getId(), "PAYROLL", title, body, level, payrollLink(u)));
    }

    private String payrollLink(User u) {
        return switch (u.getRole()) {
            case CEO -> "/ceo/payroll";
            case GIAM_DOC_PHONG_BAN -> "/director/payroll";
            case TRUONG_PHONG -> "/manager/payroll";
            default -> "/employee/finance-payroll";
        };
    }

    private String payslipLink(Long employeeId) {
        return userRepository.findById(employeeId).map(u -> switch (u.getRole()) {
            case TRUONG_PHONG -> "/manager/my-payroll";
            case GIAM_DOC_PHONG_BAN -> "/director/my-payroll";
            default -> "/employee/payroll";
        }).orElse("/employee/payroll");
    }

    private static Map<String, Object> skip(Department d, String reason) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("departmentId", d.getId());
        m.put("departmentName", d.getTenPhong());
        m.put("reason", reason);
        return m;
    }

    private static String period(PayrollReport r) {
        return r.getMonth() + "/" + r.getYear();
    }

    private static double nz(Double v) {
        return v == null ? 0.0 : v;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static String formatVnd(Double v) {
        return String.format(Locale.forLanguageTag("vi-VN"), "%,.0f đ", nz(v));
    }

    private static String csv(String v) {
        if (v == null) return "";
        // OBS-02: chống CSV/formula injection — ô bắt đầu bằng = + - @ tab CR sẽ được Excel hiểu là công thức.
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        String s = v.replace("\"", "\"\"");
        return (s.contains(",") || s.contains("\"") || s.contains("\n")) ? "\"" + s + "\"" : s;
    }
}
