package com.hrm.ai.service;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiRecruiterDigestService {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final GeminiClientService geminiClientService;
    private final NotificationService notificationService;

    // Chạy vào 8:00 sáng và 15:00 chiều mỗi ngày
    @Scheduled(cron = "0 0 8,15 * * *")
    public void runDailyDigest() {
        log.info("Bắt đầu chạy AI Recruiter Digest hằng ngày...");
        
        // 1. Lấy dữ liệu 24h qua
        LocalDateTime yesterday = LocalDateTime.now().minusHours(24);
        List<Application> recentApps = applicationRepository.findByCreatedAtAfter(yesterday);
        
        if (recentApps.isEmpty()) {
            log.info("Không có hồ sơ nào mới trong 24h qua. Kết thúc digest.");
            return;
        }

        // 2. Thống kê
        int totalNew = recentApps.size();
        List<Application> topCandidates = recentApps.stream()
                .filter(app -> app.getFitScore() != null && app.getFitScore() >= 80)
                .collect(Collectors.toList());
        List<Application> needsReview = recentApps.stream()
                .filter(app -> Boolean.TRUE.equals(app.getFraudFlagged()) || Boolean.TRUE.equals(app.getNeedsVerification()))
                .collect(Collectors.toList());

        // 3. Xây dựng prompt cho Gemini
        StringBuilder prompt = new StringBuilder();
        prompt.append("Bạn là một Trợ lý Nhân sự AI chuyên nghiệp. Hãy viết một đoạn tóm tắt (digest) ngắn gọn bằng tiếng Việt để báo cáo cho Trưởng phòng Tuyển dụng về tình hình nộp hồ sơ trong 24h qua.\n");
        prompt.append("Bắt đầu bằng câu chào: 'Chào bạn, tôi là Trợ lý AI của bạn. Đây là báo cáo tự động của hệ thống.'\n");
        prompt.append("Dữ liệu như sau:\n");
        prompt.append("- Tổng số hồ sơ mới nhận: ").append(totalNew).append("\n");
        prompt.append("- Số hồ sơ đạt điểm phù hợp cao (>=80): ").append(topCandidates.size()).append("\n");
        if (!topCandidates.isEmpty()) {
            prompt.append("  Các ứng viên nổi bật:\n");
            for (Application app : topCandidates) {
                prompt.append("   + ").append(app.getFullName()).append(" (Ứng tuyển: ").append(app.getJobPosting().getTitle()).append(", Điểm: ").append(app.getFitScore()).append(")\n");
            }
        }
        prompt.append("- Số hồ sơ cần Trưởng phòng chú ý (có thể là gian lận hoặc hệ thống không tự quyết định được): ").append(needsReview.size()).append("\n");
        prompt.append("\nYêu cầu: Viết giọng điệu chuyên nghiệp, tích cực, không dùng markdown như in đậm quá nhiều, chỉ khoảng 3-4 câu gọn gàng.");

        String digestMessage;
        try {
            String rawResponse = geminiClientService.callGemini(prompt.toString()).block();
            digestMessage = geminiClientService.extractTextFromGeminiResponse(rawResponse);
        } catch (Exception e) {
            log.error("Lỗi khi gọi Gemini cho Digest. Fallback về số liệu thô.", e);
            // 4. Fallback thô
            digestMessage = String.format("Báo cáo nhanh 24h: Có %d hồ sơ mới, %d hồ sơ xuất sắc, %d hồ sơ cần bạn chú ý.", totalNew, topCandidates.size(), needsReview.size());
        }

        // 5. Lấy danh sách TRUONG_PHONG và gửi thông báo
        List<User> truongPhongs = userRepository.findByRole(Role.TRUONG_PHONG);
        if (truongPhongs.isEmpty()) {
            log.warn("Không tìm thấy người dùng nào có role TRUONG_PHONG để gửi digest.");
            return;
        }

        for (User user : truongPhongs) {
            // Sử dụng muc_do = "binh_thuong" (theo user yêu cầu) thay vì thong_thuong
            notificationService.createNotification(
                    user.getId(),
                    "tuyen_dung",
                    "Báo Cáo Tự Động Từ Trợ Lý AI",
                    digestMessage,
                    "binh_thuong",
                    "/manager/recruitment/applications"
            );
        }

        log.info("Hoàn tất AI Recruiter Digest. Đã gửi thông báo cho {} trưởng phòng.", truongPhongs.size());
    }

    public void triggerDigestManually() {
        runDailyDigest();
    }
}
