package com.hrm.recruitment.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.service.ApplicationService;
import com.hrm.recruitment.service.JobPostingService;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/public/apply")
@RequiredArgsConstructor
public class PublicRecruitmentController {

    private final JobPostingService jobPostingService;
    private final ApplicationService applicationService;
    private final com.hrm.ai.service.CvParserService cvParserService;
    private final com.hrm.ai.service.CvExtractionService cvExtractionService;
    private final com.hrm.ai.service.CvFileSafetyService cvFileSafetyService;
    private final com.hrm.ai.service.AiConsentService aiConsentService;

    // Rate Limiter: 10 requests / 1 phút mỗi IP
    private final Map<String, Bucket> cache = new ConcurrentHashMap<>();

    private Bucket resolveBucket(String ip) {
        return cache.computeIfAbsent(ip, k -> {
            Bandwidth limit = Bandwidth.classic(10, Refill.greedy(10, Duration.ofMinutes(1)));
            return Bucket.builder().addLimit(limit).build();
        });
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ApiResponse<JobPosting>> getJobPosting(@PathVariable String slug) {
        JobPosting job = jobPostingService.getJobBySlug(slug);
        if (job.getStatus() != com.hrm.recruitment.entity.JobPostingStatus.OPEN) {
            throw new IllegalArgumentException("Tin tuyển dụng này đã đóng");
        }

        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (now.isBefore(job.getNgayBatDau())) {
            throw new IllegalArgumentException("Chưa đến ngày nhận hồ sơ cho vị trí này");
        }
        if (now.isAfter(job.getHanNopHoSo())) {
            throw new IllegalArgumentException("Đã hết hạn nộp hồ sơ");
        }
        


        return ResponseEntity.ok(ApiResponse.ok(job, "Lấy thông tin thành công"));
    }

    @PostMapping("/{slug}/extract-cv")
    public ResponseEntity<ApiResponse<String>> extractCvData(
            @PathVariable String slug,
            @RequestParam("cvFile") MultipartFile cvFile,
            @RequestParam(value = "aiConsent", defaultValue = "false") boolean aiConsent
    ) {
        if (!aiConsent) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Bạn cần đồng ý phân tích CV bằng AI trước khi dùng tính năng này."));
        }
        if (slug != null) {
            return ResponseEntity.status(HttpStatus.GONE).body(ApiResponse.error(
                    "Tính năng bóc tách trước khi nộp đã tắt để tránh gửi thông tin định danh chưa che cho AI. "
                            + "Bạn hãy nhập họ tên, email và số điện thoại; phân tích bằng chứng sẽ chạy an toàn sau khi nộp."));
        }
        JobPosting job = jobPostingService.getJobBySlug(slug);
        try {
            byte[] bytes = cvFile.getBytes();
            var validated = cvFileSafetyService.validateAndExtract(bytes, cvFile.getOriginalFilename());
            String rawText = validated.visibleText();
            if (rawText == null || rawText.trim().isEmpty()) {
                rawText = cvParserService.parseCvFile(bytes, cvFile.getOriginalFilename());
            }
            if (rawText == null || rawText.trim().isEmpty()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("Không thể đọc được văn bản từ CV này."));
            }
            // Gọi AI bóc tách
            String extractedJson = cvExtractionService.extractCvData(null, job.getTitle(), rawText);
            return ResponseEntity.ok(ApiResponse.ok(extractedJson, "Trích xuất thành công"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Lỗi trích xuất CV: " + e.getMessage()));
        }
    }

    @PostMapping("/{slug}")
    public ResponseEntity<ApiResponse<Application>> applyForJob(
            @PathVariable String slug,
            @RequestParam("fullName") String fullName,
            @RequestParam("email") String email,
            @RequestParam("phone") String phone,
            @RequestParam(value = "cvFile", required = false) MultipartFile cvFile,
            @RequestParam(value = "cccdFile", required = false) MultipartFile cccdFile,
            @RequestParam(value = "rawCvText", required = false) String rawCvText,
            @RequestParam(value = "extractedData", required = false) String extractedData,
            @RequestParam(value = "aiConsent", defaultValue = "false") boolean aiConsent,
            HttpServletRequest request
    ) {
        JobPosting job = jobPostingService.getJobBySlug(slug);
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (now.isBefore(job.getNgayBatDau())) {
            throw new IllegalArgumentException("Chưa đến ngày nhận hồ sơ cho vị trí này");
        }
        if (now.isAfter(job.getHanNopHoSo())) {
            throw new IllegalArgumentException("Đã hết hạn nộp hồ sơ");
        }

        // Rate Limiting Logic
        String ip = request.getRemoteAddr();
        Bucket bucket = resolveBucket(ip);

        if (bucket.tryConsume(1)) {
            try {
                Application app = applicationService.submitApplication(
                        slug, fullName, email, phone, cvFile, cccdFile, rawCvText, extractedData, aiConsent
                );
                return ResponseEntity.status(HttpStatus.CREATED)
                        .body(ApiResponse.ok(app, "Nộp hồ sơ thành công, AI đang tiến hành phân tích"));
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(ApiResponse.error("Lỗi khi nộp hồ sơ: " + e.getMessage()));
            }
        } else {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("Bạn đã thao tác quá nhanh. Vui lòng đợi 1 phút."));
        }
    }

    @GetMapping("/{slug}/ai-consent")
    public ResponseEntity<ApiResponse<com.hrm.ai.service.AiConsentService.ConsentNotice>> aiConsentNotice(
            @PathVariable String slug) {
        jobPostingService.getJobBySlug(slug);
        return ResponseEntity.ok(ApiResponse.ok(aiConsentService.notice(), "Nội dung đồng ý phân tích CV"));
    }
}
