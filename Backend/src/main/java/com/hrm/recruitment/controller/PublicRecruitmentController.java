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
        
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (now.isBefore(job.getNgayBatDau())) {
            throw new IllegalArgumentException("Chưa đến ngày nhận hồ sơ cho vị trí này");
        }
        if (now.isAfter(job.getHanNopHoSo())) {
            throw new IllegalArgumentException("Đã hết hạn nộp hồ sơ");
        }

        return ResponseEntity.ok(ApiResponse.ok(job, "Lấy thông tin thành công"));
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
                        slug, fullName, email, phone, cvFile, cccdFile, rawCvText
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
}
