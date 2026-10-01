package com.hrm.telegram;

import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.request.dto.ApproveRequestDto;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.request.service.EmployeeRequestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TelegramHrmDataService {

    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final PayrollRepository payrollRepository;
    private final ApplicationRepository applicationRepository;
    private final JobPostingRepository jobPostingRepository;
    private final EmployeeRequestRepository employeeRequestRepository;
    private final DepartmentRepository departmentRepository;
    private final EmployeeRequestService employeeRequestService;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final List<Role> EMPLOYEE_ROLES = List.of(
            Role.NHAN_VIEN, Role.TRUONG_PHONG, Role.GIAM_DOC_PHONG_BAN, Role.CEO
    );

    public String getEmployeeSummary() {
        try {
            long total    = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long active   = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
            long inactive = total - active;
            List<Object[]> deptDist = userRepository.getDepartmentDistributionRaw();

            StringBuilder sb = new StringBuilder();
            sb.append("\uD83D\uDC65 TỔNG QUAN NHÂN SỰ\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append(String.format("Tổng nhân viên: %d người\n", total));
            sb.append(String.format("Đang làm việc: %d người\n", active));
            sb.append(String.format("Đã nghỉ việc: %d người\n", inactive));

            if (!deptDist.isEmpty()) {
                sb.append("\n\uD83C\uDFE2 Phân bổ theo phòng ban:\n");
                for (Object[] row : deptDist) {
                    String dept = row[0] != null ? row[0].toString() : "Chưa phân công";
                    long count = ((Number) row[1]).longValue();
                    sb.append(String.format("  · %s: %d người\n", dept, count));
                }
            }
            sb.append("\n🕐 Cập nhật: ").append(LocalDate.now().format(DATE_FMT));
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting employee summary", e);
            return "⚠️ Không thể lấy dữ liệu nhân sự. Vui lòng thử lại.";
        }
    }

    public String getTodayAttendance() {
        try {
            LocalDate today = LocalDate.now();
            long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
            long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
            long absent  = attendanceRepository.countByDateAndStatus(today, "ABSENT");
            long onLeave = attendanceRepository.countByDateAndStatus(today, "ON_LEAVE");
            long totalActive = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);

            StringBuilder sb = new StringBuilder();
            sb.append("\uD83D\uDCC5 CHẤM CÔNG HÔM NAY\n");
            sb.append("Ngày: ").append(today.format(DATE_FMT)).append("\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append(String.format("✅ Có mặt đúng giờ: %d người\n", present));
            sb.append(String.format("⏰ Đi muộn: %d người\n", late));
            sb.append(String.format("❌ Vắng mặt: %d người\n", absent));
            sb.append(String.format("🏖️ Nghỉ phép: %d người\n", onLeave));
            sb.append(String.format("👥 Tổng nhân viên: %d người\n", totalActive));

            long checked = present + late + absent + onLeave;
            long notChecked = Math.max(0, totalActive - checked);
            if (notChecked > 0) {
                sb.append(String.format("❓ Chưa chấm công: %d người\n", notChecked));
            }
            sb.append("\n🕐 Cập nhật: ").append(LocalDate.now().format(DATE_FMT));
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting attendance", e);
            return "⚠️ Không thể lấy dữ liệu chấm công. Vui lòng thử lại.";
        }
    }

    public String getPayrollSummary() {
        try {
            LocalDate now = LocalDate.now();
            int month = now.getMonthValue();
            int year  = now.getYear();
            var payrolls = payrollRepository.findByMonthAndYear(month, year);

            if (payrolls.isEmpty()) {
                LocalDate prev = now.minusMonths(1);
                payrolls = payrollRepository.findByMonthAndYear(prev.getMonthValue(), prev.getYear());
                if (!payrolls.isEmpty()) { month = prev.getMonthValue(); year = prev.getYear(); }
            }
            if (payrolls.isEmpty()) return "📭 Chưa có dữ liệu bảng lương tháng này.";

            double totalNet   = payrolls.stream().mapToDouble(p -> p.getNetSalary()   != null ? p.getNetSalary()   : 0).sum();
            double totalGross = payrolls.stream().mapToDouble(p -> p.getGrossSalary() != null ? p.getGrossSalary() : 0).sum();
            double maxSalary  = payrolls.stream().mapToDouble(p -> p.getNetSalary()   != null ? p.getNetSalary()   : 0).max().orElse(0);
            double avgSalary  = payrolls.stream().mapToDouble(p -> p.getNetSalary()   != null ? p.getNetSalary()   : 0).average().orElse(0);
            long approved = payrolls.stream().filter(p -> "APPROVED".equals(p.getStatus())).count();

            StringBuilder sb = new StringBuilder();
            sb.append(String.format("\uD83D\uDCB0 BẢNG LƯƠNG THÁNG %d/%d\n", month, year));
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append(String.format("Số nhân viên: %d người\n", payrolls.size()));
            sb.append(String.format("Đã phê duyệt: %d người\n", approved));
            sb.append(String.format("Tổng Gross: %,.0f VNĐ\n", totalGross));
            sb.append(String.format("Tổng Net: %,.0f VNĐ\n", totalNet));
            sb.append(String.format("Lương trung bình: %,.0f VNĐ\n", avgSalary));
            sb.append(String.format("Lương cao nhất: %,.0f VNĐ\n", maxSalary));
            sb.append("\n📊 Nguồn: Hệ thống HRM AI");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting payroll summary", e);
            return "⚠️ Không thể lấy dữ liệu lương. Vui lòng thử lại.";
        }
    }

    public String getRecruitmentSummary() {
        try {
            long openPostings    = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long totalApps       = applicationRepository.count();
            long pendingCvReview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long pendingInterview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_1)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
            long pendingOffer = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_OFFER)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_OFFER_APPROVAL)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.OFFER_INTERNALLY_APPROVED);

            StringBuilder sb = new StringBuilder();
            sb.append("\uD83D\uDCCB TÌNH HÌNH TUYỂN DỤNG\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append(String.format("Vị trí đang tuyển: %d vị trí\n", openPostings));
            sb.append(String.format("Tổng ứng viên: %d người\n", totalApps));
            sb.append(String.format("Đang sàng lọc CV: %d người\n", pendingCvReview));
            sb.append(String.format("Đang phỏng vấn: %d người\n", pendingInterview));
            sb.append(String.format("Giai đoạn Offer: %d người\n", pendingOffer));
            sb.append("\n📊 Nguồn: Hệ thống HRM AI");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting recruitment summary", e);
            return "⚠️ Không thể lấy dữ liệu tuyển dụng. Vui lòng thử lại.";
        }
    }

    public String getPendingRequestsSummary() {
        try {
            var allRequests = employeeRequestRepository.findAll();
            long pendingCount  = allRequests.stream().filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            long approvedToday = allRequests.stream()
                    .filter(r -> r.getStatus() == RequestStatus.APPROVED
                            && r.getCreatedAt() != null
                            && r.getCreatedAt().toLocalDate().equals(LocalDate.now())).count();
            long rejectedToday = allRequests.stream()
                    .filter(r -> r.getStatus() == RequestStatus.REJECTED
                            && r.getCreatedAt() != null
                            && r.getCreatedAt().toLocalDate().equals(LocalDate.now())).count();

            StringBuilder sb = new StringBuilder();
            sb.append("\uD83D\uDCCE YÊU CẦU NHÂN VIÊN\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append(String.format("⏳ Chờ phê duyệt: %d yêu cầu\n", pendingCount));
            sb.append(String.format("✅ Đã duyệt hôm nay: %d yêu cầu\n", approvedToday));
            sb.append(String.format("❌ Từ chối hôm nay: %d yêu cầu\n", rejectedToday));
            if (pendingCount > 0) {
                sb.append(String.format("\n⚠️ Còn %d yêu cầu cần xử lý!", pendingCount));
            }
            sb.append("\n🕐 Cập nhật: ").append(LocalDate.now().format(DATE_FMT));
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting pending requests", e);
            return "⚠️ Không thể lấy dữ liệu yêu cầu. Vui lòng thử lại.";
        }
    }

    public String getFullDashboard() {
        StringBuilder sb = new StringBuilder();
        sb.append("\uD83D\uDCCA DASHBOARD HRM AI\n");
        sb.append("━━━━━━━━━━━━━━━━━━━━━━\n\n");

        try {
            long total  = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long active = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
            sb.append(String.format("\uD83D\uDC65 Nhân viên: %d người (đang làm: %d)\n", total, active));
        } catch (Exception ignored) {}

        try {
            LocalDate today = LocalDate.now();
            long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
            long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
            sb.append(String.format("\uD83D\uDCC5 Hôm nay: %d đúng giờ, %d đi muộn\n", present, late));
        } catch (Exception ignored) {}

        try {
            long open = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long pendingApp = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            sb.append(String.format("\uD83D\uDCCB Tuyển dụng: %d vị trí mở, %d ứng viên đang xét\n", open, pendingApp));
        } catch (Exception ignored) {}

        try {
            var allReqs = employeeRequestRepository.findAll();
            long pending = allReqs.stream().filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            if (pending > 0) {
                sb.append(String.format("⏳ Yêu cầu chờ duyệt: %d\n", pending));
            }
        } catch (Exception ignored) {}

        sb.append("\n💡 Gõ /help để xem danh sách lệnh chi tiết.");
        return sb.toString();
    }

    // ─── ACTION: Liệt kê đơn chờ duyệt kèm ID ───────────────────────────────

    @Transactional(readOnly = true)
    public String getPendingRequestsList() {
        try {
            var pending = employeeRequestRepository.findAllWithUser().stream()
                    .filter(r -> r.getStatus() == RequestStatus.PENDING
                            || r.getStatus() == RequestStatus.FORWARDED)
                    .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                    .toList();

            if (pending.isEmpty()) {
                return "✅ Không có đơn nào cần duyệt!";
            }

            StringBuilder sb = new StringBuilder();
            sb.append("📋 ĐƠN CHỜ PHÊ DUYỆT\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            for (EmployeeRequest req : pending) {
                String loai = switch (req.getRequestType()) {
                    case NORMAL_LEAVE -> "Nghỉ thường";
                    case SPECIAL_WFH_LEAVE -> "Làm từ xa (WFH)";
                    case HALF_DAY_LEAVE -> "Nghỉ nửa ngày";
                    case UNPAID_LEAVE -> "Nghỉ không lương";
                    case OVERTIME -> "Tăng ca";
                    default -> req.getRequestType().name();
                };
                sb.append(String.format("🔶 #%d — %s | %s\n",
                        req.getId(), req.getUser().getHoTen(), loai));
                sb.append(String.format("   %s đến %s\n",
                        req.getStartDate().format(DATE_FMT),
                        req.getEndDate().format(DATE_FMT)));
                sb.append(String.format("   Lý do: %s\n\n",
                        req.getReason().length() > 60
                        ? req.getReason().substring(0, 60) + "..." : req.getReason()));
            }
            sb.append("💡 Gõ /duyet [ID] để duyệt, /tuchoi [ID] [lý do] để từ chối.");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error listing pending requests", e);
            return "⚠️ Không thể lấy danh sách đơn. Vui lòng thử lại.";
        }
    }

    // ─── ACTION: Duyệt đơn ───────────────────────────────────────────────────

    @Transactional
    public String approveRequestById(Long managerId, Long requestId, String note) {
        try {
            ApproveRequestDto dto = new ApproveRequestDto();
            dto.setNote(note != null && !note.isBlank() ? note : "Duyệt qua Telegram Bot");
            employeeRequestService.approveRequest(managerId, requestId, dto);

            var req = employeeRequestRepository.findById(requestId).orElseThrow();
            return String.format("✅ Đã duyệt đơn #%d của %s thành công!\nThời gian: %s đến %s",
                    requestId,
                    req.getUser().getHoTen(),
                    req.getStartDate().format(DATE_FMT),
                    req.getEndDate().format(DATE_FMT));
        } catch (Exception e) {
            log.error("Error approving request #{}", requestId, e);
            return String.format("❌ Không thể duyệt đơn #%d: %s", requestId, e.getMessage());
        }
    }

    // ─── ACTION: Từ chối đơn ─────────────────────────────────────────────────

    @Transactional
    public String rejectRequestById(Long managerId, Long requestId, String reason) {
        try {
            ApproveRequestDto dto = new ApproveRequestDto();
            dto.setNote(reason != null && !reason.isBlank() ? reason : "Từ chối qua Telegram Bot");
            employeeRequestService.rejectRequest(managerId, requestId, dto);

            var req = employeeRequestRepository.findById(requestId).orElseThrow();
            return String.format("❌ Đã từ chối đơn #%d của %s.\nLý do: %s",
                    requestId,
                    req.getUser().getHoTen(),
                    dto.getNote());
        } catch (Exception e) {
            log.error("Error rejecting request #{}", requestId, e);
            return String.format("❌ Không thể từ chối đơn #%d: %s", requestId, e.getMessage());
        }
    }
}