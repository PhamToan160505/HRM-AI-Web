package com.hrm.recruitment.service;

import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncUploadService {

    private final CloudinaryService cloudinaryService;
    private final ApplicationRepository applicationRepository;

    @Async
    public void uploadFilesAndUpdateApplicationAsync(Long applicationId, byte[] cvBytes, String cvFilename, byte[] cccdBytes, String cccdFilename) {
        log.info("Bắt đầu tiến trình upload file ngầm cho hồ sơ ID: {}", applicationId);
        try {
            Application app = applicationRepository.findById(applicationId)
                    .orElseThrow(() -> new RuntimeException("Không tìm thấy hồ sơ"));

            String cvUrl = cloudinaryService.uploadFileBytes(cvBytes, cvFilename, "cvs");
            String cccdUrl = cloudinaryService.uploadFileBytes(cccdBytes, cccdFilename, "cccds");

            app.setCvUrl(cvUrl);
            app.setCccdUrl(cccdUrl);
            applicationRepository.save(app);

            log.info("Đã hoàn tất upload file ngầm cho hồ sơ ID: {}", applicationId);
        } catch (Exception e) {
            log.error("Lỗi khi upload file ngầm cho hồ sơ ID {}: {}", applicationId, e.getMessage(), e);
        }
    }
}
