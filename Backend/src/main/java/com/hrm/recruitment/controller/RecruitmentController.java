package com.hrm.recruitment.controller;

import com.hrm.ai.entity.AiDecisionLog;
import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.service.ApplicationService;
import com.hrm.recruitment.service.JobPostingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recruitment")
@RequiredArgsConstructor
public class RecruitmentController {

    private final JobPostingService jobPostingService;
    private final ApplicationService applicationService;

    // --- JOB POSTINGS ---

    @GetMapping("/jobs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<JobPosting>>> getAllJobs() {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getAllJobs(), "Lấy danh sách thành công"));
    }

    @PostMapping("/jobs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<JobPosting>> createJob(@RequestBody JobPostingRequest request) {
        JobPosting job = jobPostingService.createJob(request);
        return ResponseEntity.ok(ApiResponse.ok(job, "Tạo tin tuyển dụng thành công"));
    }

    @PatchMapping("/jobs/{id}/status")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<JobPosting>> updateJobStatus(@PathVariable Long id, @RequestBody StatusRequest request) {
        JobPosting job = jobPostingService.updateJobStatus(id, request.status());
        return ResponseEntity.ok(ApiResponse.ok(job, "Cập nhật trạng thái thành công"));
    }

    // --- APPLICATIONS ---

    @GetMapping("/jobs/{jobId}/applications")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<Application>>> getApplicationsByJob(@PathVariable Long jobId) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getApplicationsByJobPosting(jobId), "Thành công"));
    }

    @GetMapping("/applications")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<Application>>> getAllApplications() {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getAllApplications(), "Thành công"));
    }

    @GetMapping("/applications/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<Application>> getApplicationById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getApplicationById(id), "Thành công"));
    }

    @PatchMapping("/applications/{id}/decision")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<Application>> updateApplicationDecision(@PathVariable Long id, @RequestBody StatusRequest request) {
        Application app = applicationService.updateDecisionStatus(id, request.status());
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã cập nhật quyết định"));
    }

    @PostMapping("/applications/{id}/run-ai")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<Application>> runAiReview(@PathVariable Long id) {
        Application app = applicationService.triggerAiReview(id);
        return ResponseEntity.ok(ApiResponse.ok(app, "AI đánh giá hoàn tất"));
    }

    @GetMapping("/applications/{id}/ai-logs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<AiDecisionLog>>> getAiLogs(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getAiLogsForApplication(id), "Thành công"));
    }

    // DTOs
    public record JobPostingRequest(
            String title, 
            String description, 
            String requirements,
            Integer soLuongTuyen,
            String diaDiem,
            String hinhThucLamViec,
            java.time.LocalDateTime ngayBatDau,
            java.time.LocalDateTime hanNopHoSo,
            String mucLuong,
            Boolean coThoaThuan,
            String quyenLoi,
            String capBac
    ) {}
    public record StatusRequest(String status) {}
}
