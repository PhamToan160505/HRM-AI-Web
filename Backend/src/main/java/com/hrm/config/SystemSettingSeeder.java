package com.hrm.config;

import com.hrm.common.entity.SystemSetting;
import com.hrm.common.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class SystemSettingSeeder implements CommandLineRunner {

    private final SystemSettingRepository systemSettingRepository;

    @Override
    public void run(String... args) throws Exception {
        String key = "chatbot_sensitive_keywords";
        Optional<SystemSetting> existingSetting = systemSettingRepository.findByKey(key);

        if (existingSetting.isEmpty()) {
            SystemSetting setting = SystemSetting.builder()
                    .key(key)
                    .value("tạo yêu cầu, duyệt yêu cầu, tạo tin tuyển dụng, duyệt lương, chốt lương, bảng lương, báo cáo lương, mức lương, nhân viên, phòng ban, tài khoản, nghỉ phép, ngày phép, mã nhân viên, luồng, quy trình")
                    .description("Các từ khóa cấm Chatbot tự động lưu bộ nhớ đệm (cách nhau bằng dấu phẩy)")
                    .build();
            
            systemSettingRepository.save(setting);
            log.info("✅ [Seeder] Đã tạo SystemSetting: {}", key);
        } else {
            log.info("✅ [Seeder] Bỏ qua tạo SystemSetting: {} (đã tồn tại)", key);
        }
    }
}
