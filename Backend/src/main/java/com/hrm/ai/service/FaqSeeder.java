package com.hrm.ai.service;

import com.hrm.ai.entity.FaqCache;
import com.hrm.ai.repository.FaqCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class FaqSeeder implements CommandLineRunner {

    private final FaqCacheRepository faqCacheRepository;
    private final GeminiClientService geminiClientService;

    @Override
    public void run(String... args) throws Exception {
        if (faqCacheRepository.count() == 0) {
            log.info("Bắt đầu tự động tạo dữ liệu mẫu cho FaqCache (Semantic Caching)...");

        String[][] faqs = {
                { "Hệ thống chấm công hoạt động như thế nào?",
                        "Hệ thống hỗ trợ chấm công bằng nhận diện khuôn mặt AI (Face Recognition). Bạn chỉ cần mở chức năng Điểm danh trên trình duyệt, camera sẽ tự động xác thực và ghi nhận giờ làm việc của bạn." },
                { "Cách xem lại lịch sử đơn từ của bản thân?",
                        "Bạn chỉ cần truy cập vào Chức năng Đơn từ của tôi, hệ thống sẽ tự động hiển thị tổng quan số lượng đơn từ và chi tiết lịch sử các đơn từ trong tháng." },
                { "Làm sao để thay đổi thông tin cá nhân trên hệ thống?",
                        "Bạn có thể truy cập vào mục 'Hồ sơ cá nhân' (Profile) ở menu, bấm vào biểu tượng chỉnh sửa để cập nhật số điện thoại, địa chỉ hoặc thay đổi ảnh đại diện (Avatar)." },
                { "Cách xem lại lịch sử chấm công của bản thân?",
                        "Bạn chỉ cần truy cập vào màn hình Tổng quan hoặc chức năng Chấm công, hệ thống sẽ tự động hiển thị lịch sử check-in/check-out và chi tiết số ngày công đi làm hợp lệ của bạn trong tháng." },
                { "Nếu tôi đi làm muộn thì quy định xử lý như thế nào?",
                        "Hệ thống sẽ tự động đối chiếu giờ bạn điểm danh với giờ làm việc tiêu chuẩn. Việc đi muộn sẽ được tự động ghi nhận và áp dụng mức phạt trừ vào bảng lương tùy thuộc vào Cấu hình hệ thống (System Settings)." }
        };

        for (String[] faq : faqs) {
            String question = faq[0];
            String answer = faq[1];

            // Tránh rate limit của API (chờ 3 giây giữa mỗi lần request embedding)
            Thread.sleep(3000);

            String embedding = geminiClientService.getEmbedding(question);

            if (embedding != null) {
                FaqCache cache = FaqCache.builder()
                        .question(question)
                        .questionEmbedding(embedding)
                        .answer(answer)
                        .build();
                faqCacheRepository.save(cache);
                log.info("Đã seed thành công FAQ: {}", question);
            } else {
                log.warn("Không thể lấy embedding cho FAQ: {}", question);
            }
        }
        log.info("Hoàn thành nạp 5 câu hỏi mẫu sát với hệ thống vào FaqCache!");
        } else {
            log.info("FaqCache đã có dữ liệu, bỏ qua bước seeder.");
        }
    }
}
