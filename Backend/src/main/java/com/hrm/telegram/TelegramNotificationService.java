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
            sb.append("Good morning! Day la bao cao tu dong cua he thong HRM AI.\n\n");
            sb.append("BAO CAO SANG - ").append(today.format(DATE_FMT)).append("\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n\n");

            sb.append("NHAN SU\n");
            sb.append("Tong nhan vien: ").append(totalEmp).append(" nguoi\n");
            sb.append("Dang lam viec: ").append(activeEmp).append(" nguoi\n\n");

            sb.append("CHAM CONG HOM QUA (").append(yesterday.format(DATE_FMT)).append(")\n");
            sb.append("Dung gio: ").append(presentYesterday).append(" nguoi\n");
            sb.append("Di muon: ").append(lateYesterday).append(" nguoi\n");
            sb.append("Vang mat: ").append(absentYesterday).append(" nguoi\n\n");

            sb.append("TUYEN DUNG\n");
            sb.append("Vi tri dang tuyen: ").append(openJobs).append(" vi tri\n");
            sb.append("Ho so dang xet: ").append(pendingCv).append(" ho so\n\n");

            if (pendingRequests > 0) {
                sb.append("CO ").append(pendingRequests).append(" DON CHO DUYET!\n");
                sb.append("Go /request de xem danh sach.\n\n");
            } else {
                sb.append("Khong co don nao cho duyet.\n\n");
            }

            sb.append("Go /dashboard de xem toan bo thong tin.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Da gui bao cao sang vao nhom chatId={}", chatId);

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
            sb.append("CANH BAO: BANG LUONG THANG ").append(now.getMonthValue())
              .append("/").append(now.getYear()).append(" CHUA HOAN TAT!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("Tong nhan vien trong bang luong: ").append(payrolls.size()).append(" nguoi\n");
            sb.append("Chua duoc duyet: ").append(notApproved).append(" phieu\n");
            sb.append("Tong chi phi du kien: ").append(String.format("%,.0f", totalNet)).append(" VND\n\n");
            sb.append("Vui long vao he thong HRM de duyet bang luong truoc cuoi thang!\n");
            sb.append("Go /luong de xem chi tiet.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Da gui canh bao bang luong chua duyet thang {}/{}", now.getMonthValue(), now.getYear());

        } catch (Exception e) {
            log.error("[TelegramNotify] Loi canh bao bang luong: {}", e.getMessage(), e);
        }
    }

    // ── 4. THONG BAO UNG VIEN MOI NOP CV (check 15 phut/lan) ─────────────────

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
            sb.append("CO ").append(newApps).append(" UNG VIEN MOI NOP HO SO!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("Tong ho so trong he thong: ").append(currentCount).append("\n");
            sb.append("Vi tri dang tuyen: ").append(openJobs).append(" vi tri\n");
            long pendingCv = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                           + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            sb.append("Ho so cho xet duyet: ").append(pendingCv).append("\n\n");
            sb.append("Vao he thong HRM de xem va xu ly ho so ung vien.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Da gui thong bao {} ung vien moi", newApps);

        } catch (Exception e) {
            log.error("[TelegramNotify] Loi thong bao ung vien moi: {}", e.getMessage(), e);
        }
    }

    // ── 5. THONG BAO NHAN VIEN MOI ONBOARD (check 1 tieng/lan) ──────────────

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
            sb.append("CHAO MUNG ").append(newEmployees).append(" THANH VIEN MOI!\n");
            sb.append("━━━━━━━━━━━━━━━━━━━━━━\n");
            sb.append("He thong hien co ").append(currentActive).append("/").append(totalEmp)
              .append(" nhan vien dang lam viec.\n\n");
            sb.append("Vao he thong HRM de xem thong tin nhan vien moi.");

            sendToGroup(chatId, sb.toString());
            log.info("[TelegramNotify] Da gui thong bao {} nhan vien moi onboard", newEmployees);

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