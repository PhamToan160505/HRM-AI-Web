package com.hrm.telegram;

import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.repository.EmployeeRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Dich vu gui thong bao tu dong vao nhom Telegram cho CEO/Giam doc.
 *
 * Cac loai thong bao:
 *  1. Bao cao sang (08:00): Tong quan nhan su + cham cong hom qua
 *  2. Canh bao don cho duyet (30 phut/lan): Neu co don PENDING
 *  3. Canh bao bang luong chua duyet (cuoi thang, 17:00)
 *  4. Thong bao ung vien moi nop CV (check 15 phut/lan)
 *  5. Thong bao nhan vien moi onboard (check 1 tieng/lan)
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TelegramNotificationService {

    private final HrmTelegramBot telegramBot;
    private final TelegramBotProperties properties;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final PayrollRepository payrollRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ApplicationRepository applicationRepository;
    private final EmployeeRequestRepository employeeRequestRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    private static final List<Role> EMPLOYEE_ROLES = List.of(
            Role.NHAN_VIEN, Role.TRUONG_PHONG, Role.GIAM_DOC_PHONG_BAN, Role.CEO
    );

    // Tracking de tranh gui trung lap
    private final AtomicLong lastKnownApplicationCount = new AtomicLong(-1);
    private final AtomicLong lastKnownOnboardCount     = new AtomicLong(-1);
    private long lastPendingRequestAlert = 0; // epoch millis

    // ── 1. BAO CAO SANG (08:00 moi ngay lam viec) ────────────────────────────

    @Scheduled(cron = "0 0 8 * * MON-FRI")
    public void sendMorningReport() {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) {
            log.warn("[TelegramNotify] group-chat-id chua duoc cau hinh, bo qua bao cao sang.");
            return;
        }
        try {
            LocalDate today    = LocalDate.now();
            LocalDate yesterday = today.minusDays(1);

            long totalEmp  = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long activeEmp = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);

            long presentYesterday = attendanceRepository.countByDateAndStatus(yesterday, "PRESENT");
            long lateYesterday    = attendanceRepository.countByDateAndStatus(yesterday, "LATE");
            long absentYesterday  = attendanceRepository.countByDateAndStatus(yesterday, "ABSENT");

            long openJobs   = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long pendingCv  = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                            + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);

            long pendingRequests = employeeRequestRepository.findAll().stream()
                    .filter(r -> r.getStatus() == RequestStatus.PENDING).count();

            StringBuilder sb = new StringBuilder();
            sb.append("☀️ BÁO CÁO SÁNG - ").append(today.format(DATE_FMT)).append("\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n\n");

            sb.append("👥 NHÂN SỰ\n");
            sb.append("Tổng nhân viên: ").append(totalEmp).append(" người\n");
            sb.append("Đang làm việc: ").append(activeEmp).append(" người\n\n");

            sb.append("📅 CHẤM CÔNG HÔM QUA (").append(yesterday.format(DATE_FMT)).append(")\n");
            sb.append("✅ Đúng giờ: ").append(presentYesterday).append(" người\n");
            sb.append("⏰ Đi muộn: ").append(lateYesterday).append(" người\n");
            sb.append("❌ Vắng mặt: ").append(absentYesterday).append(" người\n\n");

            sb.append("📋 TUYỂN DỤNG\n");
            sb.append("Vị trí đang tuyển: ").append(openJobs).append(" vị trí\n");
            sb.append("Hồ sơ đang xét: ").append(pendingCv).append(" hồ sơ\n\n");

            if (pendingRequests > 0) {
                sb.append("⏳ CÓ ").append(pendingRequests).append(" ĐƠN CHỜ PHÊ DUYỆT!\n");
                sb.append("Gõ /request để xem danh sách.\n\n");
            } else {
                sb.append("✨ Không có đơn nào chờ duyệt.\n\n");
            }

            sb.append("💡 Gõ /dashboard để xem toàn bộ thông tin.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Đã gửi báo cáo sáng vào nhóm chatId={}", chatId);

        } catch (Exception e) {
            log.error("[TelegramNotify] Loi gui bao cao sang: {}", e.getMessage(), e);
        }
    }

    // ── 2. CANH BAO DON CHO DUYET (8:00 va 15:00 hang ngay) ───────────────────

    @Scheduled(cron = "0 0 8,15 * * *") // Run at 08:00 and 15:00 every day
    public void alertPendingRequests() {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) return;
        try {
            List<com.hrm.request.entity.EmployeeRequest> pendingList =
                    employeeRequestRepository.findByStatusWithUser(RequestStatus.PENDING);

            if (pendingList.isEmpty()) return;

            StringBuilder sb = new StringBuilder();
            sb.append("📋 CẢNH BÁO DỊNH KỲ: CÓ ").append(pendingList.size()).append(" ĐƠN CHỜ PHÊ DUYỆT!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");

            int shown = Math.min(pendingList.size(), 5);
            for (int i = 0; i < shown; i++) {
                var req = pendingList.get(i);
                String loai = switch (req.getRequestType()) {
                    case NORMAL_LEAVE      -> "Nghỉ thường";
                    case SPECIAL_WFH_LEAVE -> "Làm từ xa (WFH)";
                    case HALF_DAY_LEAVE    -> "Nghỉ nửa ngày";
                    case UNPAID_LEAVE      -> "Nghỉ không lương";
                    case OVERTIME          -> "Tăng ca";
                    default -> req.getRequestType().name();
                };
                sb.append("#").append(req.getId()).append(" - ").append(req.getUser() != null ? req.getUser().getHoTen() : "N/A")
                  .append(" | ").append(loai).append("\n");
                sb.append("  ").append(req.getStartDate().format(DATE_FMT))
                  .append(" đến ").append(req.getEndDate().format(DATE_FMT)).append("\n");
            }
            if (pendingList.size() > 5) {
                sb.append("... và ").append(pendingList.size() - 5).append(" đơn khác.\n");
            }
            sb.append("\nGõ /duyet [ID] để duyệt, /tuchoi [ID] [lý do] để từ chối.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Đã gửi cảnh báo {} đơn chờ duyệt (lịch 8h/15h)", pendingList.size());

        } catch (Exception e) {
            log.error("[TelegramNotify] Lỗi cảnh báo đơn chờ duyệt: {}", e.getMessage(), e);
        }
    }

    /**
     * Thông báo TỨC THÌ vào nhóm Telegram khi nhân viên tạo đơn mới.
     */
    public void notifyNewRequestCreated(com.hrm.request.entity.EmployeeRequest req) {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) return;
        try {
            String loai = switch (req.getRequestType()) {
                case NORMAL_LEAVE      -> "Nghỉ thường";
                case SPECIAL_WFH_LEAVE -> "Làm từ xa (WFH)";
                case HALF_DAY_LEAVE    -> "Nghỉ nửa ngày";
                case UNPAID_LEAVE      -> "Nghỉ không lương";
                case OVERTIME          -> "Tăng ca";
                default -> req.getRequestType().name();
            };

            String nguoiGui = (req.getUser() != null && req.getUser().getHoTen() != null)
                    ? req.getUser().getHoTen() : "Nhân viên";

            StringBuilder sb = new StringBuilder();
            sb.append("📩 ĐƠN YÊU CẦU MỚI!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("Mã đơn: #").append(req.getId()).append("\n");
            sb.append("Người gửi: ").append(nguoiGui).append("\n");
            sb.append("Loại đơn: ").append(loai).append("\n");
            sb.append("Thời gian: ").append(req.getStartDate().format(DATE_FMT))
              .append(" đến ").append(req.getEndDate().format(DATE_FMT)).append("\n");
            if (req.getReason() != null && !req.getReason().isBlank()) {
                sb.append("Lý do: ").append(req.getReason()).append("\n");
            }
            sb.append("\n👉 Gõ /duyet ").append(req.getId())
              .append(" để duyệt, /tuchoi ").append(req.getId()).append(" [lý do] để từ chối.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Đã gửi thông báo đơn mới #{}", req.getId());
        } catch (Exception e) {
            log.error("[TelegramNotify] Lỗi gửi thông báo đơn mới: {}", e.getMessage(), e);
        }
    }

    /**
     * Lắng nghe event khi có đơn mới tạo và tự động gửi thông báo Telegram.
     */
    @org.springframework.context.event.EventListener
    public void handleRequestCreated(com.hrm.request.event.RequestCreatedEvent event) {
        if (event != null && event.getRequest() != null) {
            notifyNewRequestCreated(event.getRequest());
        }
    }

    // ── 3. CANH BAO BANG LUONG CHUA DUYET (17:00 ngay 25-28 hang thang) ──────

    @Scheduled(cron = "0 0 17 25-28 * MON-FRI")
    public void alertPayrollNotApproved() {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) return;
        try {
            LocalDate now = LocalDate.now();
            var payrolls = payrollRepository.findByMonthAndYear(now.getMonthValue(), now.getYear());
            if (payrolls.isEmpty()) return;

            long notApproved = payrolls.stream()
                    .filter(p -> !"APPROVED".equals(p.getStatus())).count();
            if (notApproved == 0) return;

            double totalNet = payrolls.stream()
                    .mapToDouble(p -> p.getNetSalary() != null ? p.getNetSalary() : 0).sum();

            StringBuilder sb = new StringBuilder();
            sb.append("⚠️ CẢNH BÁO: BẢNG LƯƠNG THÁNG ").append(now.getMonthValue())
              .append("/").append(now.getYear()).append(" CHƯA HOÀN TẤT!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("Tổng nhân viên trong bảng lương: ").append(payrolls.size()).append(" người\n");
            sb.append("Chưa được duyệt: ").append(notApproved).append(" phiếu\n");
            sb.append("Tổng chi phí dự kiến: ").append(String.format("%,.0f", totalNet)).append(" VNĐ\n\n");
            sb.append("Vui lòng vào hệ thống HRM để duyệt bảng lương trước cuối tháng!\n");
            sb.append("Gõ /luong để xem chi tiết.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Đã gửi cảnh báo bảng lương chưa duyệt tháng {}/{}", now.getMonthValue(), now.getYear());

        } catch (Exception e) {
            log.error("[TelegramNotify] Lỗi cảnh báo bảng lương: {}", e.getMessage(), e);
        }
    }

    // ── 4. THÔNG BÁO ỨNG VIÊN MỚI NỘP CV (check 15 phút/lần) ─────────────────

    @Scheduled(fixedDelay = 900000, initialDelay = 120000) // 15 phut
    public void notifyNewApplications() {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) return;
        try {
            long currentCount = applicationRepository.count();
            long lastCount    = lastKnownApplicationCount.get();

            if (lastCount < 0) {
                // Lan dau: chi cap nhat baseline, khong gui
                lastKnownApplicationCount.set(currentCount);
                return;
            }

            long newApps = currentCount - lastCount;
            if (newApps <= 0) return;

            lastKnownApplicationCount.set(currentCount);

            long openJobs = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);

            StringBuilder sb = new StringBuilder();
            sb.append("📄 CÓ ").append(newApps).append(" ỨNG VIÊN MỚI NỘP HỒ SƠ!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("Tổng hồ sơ trong hệ thống: ").append(currentCount).append("\n");
            sb.append("Vị trí đang tuyển: ").append(openJobs).append(" vị trí\n");
            long pendingCv = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                           + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            sb.append("Hồ sơ chờ xét duyệt: ").append(pendingCv).append("\n\n");
            sb.append("👉 Vào hệ thống HRM để xem và xử lý hồ sơ ứng viên.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Đã gửi thông báo {} ứng viên mới", newApps);

        } catch (Exception e) {
            log.error("[TelegramNotify] Lỗi thông báo ứng viên mới: {}", e.getMessage(), e);
        }
    }

    // ── 5. THÔNG BÁO NHÂN VIÊN MỚI ONBOARD (check 1 tiếng/lần) ──────────────

    @Scheduled(fixedDelay = 3600000, initialDelay = 180000) // 1 tieng
    public void notifyNewOnboard() {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) return;
        try {
            long currentActive = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
            long lastActive    = lastKnownOnboardCount.get();

            if (lastActive < 0) {
                lastKnownOnboardCount.set(currentActive);
                return;
            }

            long newEmployees = currentActive - lastActive;
            if (newEmployees <= 0) return;

            lastKnownOnboardCount.set(currentActive);
            long totalEmp = userRepository.countByRoleIn(EMPLOYEE_ROLES);

            StringBuilder sb = new StringBuilder();
            sb.append("🎉 CHÀO MỪNG ").append(newEmployees).append(" THÀNH VIÊN MỚI!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("Hệ thống hiện có ").append(currentActive).append("/").append(totalEmp)
              .append(" nhân viên đang làm việc.\n\n");
            sb.append("👉 Vào hệ thống HRM để xem thông tin nhân viên mới.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Đã gửi thông báo {} nhân viên mới onboard", newEmployees);

        } catch (Exception e) {
            log.error("[TelegramNotify] Loi thong bao nhan vien moi: {}", e.getMessage(), e);
        }
    }

    // ── API cong khai: gui thu cong (dung cho test hoac trigger tu ngoai) ──────

    /**
     * Gui thong bao bat ky vao nhom. Dung cho cac service khac hook vao.
     * Vi du: khi CEO duyet xong 1 don, send thong bao vao nhom.
     */
    public void sendGroupNotification(String message) {
        String chatId = properties.getGroupChatId();
        if (chatId == null || chatId.isBlank()) {
            log.warn("[TelegramNotify] group-chat-id chua cau hinh, khong gui duoc.");
            return;
        }
        sendToGroup(chatId, message);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private void sendToGroup(String chatId, String text) {
        try {
            SendMessage msg = SendMessage.builder()
                    .chatId(chatId)
                    .text(text)
                    .build();
            telegramBot.execute(msg);
            log.debug("[TelegramNotify] Gui thanh cong den chatId={}", chatId);
        } catch (TelegramApiException e) {
            log.error("[TelegramNotify] Loi gui Telegram den chatId={}: {}", chatId, e.getMessage(), e);
        }
    }
}