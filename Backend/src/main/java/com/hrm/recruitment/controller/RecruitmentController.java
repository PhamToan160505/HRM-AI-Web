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

import com.hrm.ai.service.AiRecruiterDigestService;

@RestController
@RequestMapping("/api/recruitment")
@RequiredArgsConstructor
public class RecruitmentController {

    private final JobPostingService jobPostingService;
    private final ApplicationService applicationService;
    private final AiRecruiterDigestService aiRecruiterDigestService;

    // --- JOB POSTINGS ---

    @GetMapping("/jobs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<JobPosting>>> getAllJobs() {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getAllJobs(), "Lấy danh sách thành công"));
    }

    @GetMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<JobPosting>> getJobById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getJobById(id), "Thành công"));
    }

    @PostMapping("/jobs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<JobPosting>> createJob(@RequestBody JobPostingRequest request) {
        JobPosting job = jobPostingService.createJob(request);
        return ResponseEntity.ok(ApiResponse.ok(job, "Tạo tin tuyển dụng thành công"));
    }

    @PutMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<JobPosting>> updateJob(@PathVariable Long id, @RequestBody JobPostingRequest request) {
        JobPosting job = jobPostingService.updateJob(id, request);
        return ResponseEntity.ok(ApiResponse.ok(job, "Cập nhật tin tuyển dụng thành công"));
    }

    @PatchMapping("/jobs/{id}/status")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<JobPosting>> updateJobStatus(@PathVariable Long id, @RequestBody StatusRequest request) {
        JobPosting job = jobPostingService.updateJobStatus(id, request.status());
        return ResponseEntity.ok(ApiResponse.ok(job, "Cập nhật trạng thái thành công"));
    }

    @DeleteMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<String>> deleteJob(@PathVariable Long id) {
        jobPostingService.deleteJob(id);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa tin tuyển dụng", "Thành công"));
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

    @PostMapping("/applications/{id}/submit-to-director")
    @PreAuthorize("hasRole('TRUONG_PHONG')")
    public ResponseEntity<ApiResponse<Application>> submitToDirector(@PathVariable Long id, @RequestBody PriorityRequest request) {
        Application app = applicationService.submitToDirector(id, request.isPriority());
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã trình Giám đốc"));
    }

    @PostMapping("/applications/{id}/reject-hr")
    @PreAuthorize("hasRole('TRUONG_PHONG')")
    public ResponseEntity<ApiResponse<Application>> rejectByHr(@PathVariable Long id) {
        Application app = applicationService.rejectByHr(id);
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã loại hồ sơ"));
    }

    @PostMapping("/applications/{id}/approve-director")
    @PreAuthorize("hasRole('GIAM_DOC')")
    public ResponseEntity<ApiResponse<Application>> approveByDirector(@PathVariable Long id) {
        Application app = applicationService.approveByDirector(id);
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã phê duyệt hồ sơ"));
    }

    @PostMapping("/applications/{id}/reject-director")
    @PreAuthorize("hasRole('GIAM_DOC')")
    public ResponseEntity<ApiResponse<Application>> rejectByDirector(
            @PathVariable Long id, 
            @RequestBody ReasonRequest request,
            java.security.Principal principal
    ) {
        if (request.reason() == null || request.reason().trim().isEmpty()) {
            throw new RuntimeException("Phải nhập lý do từ chối");
        }
        String directorName = principal != null ? principal.getName() : "Giám đốc";
        Application app = applicationService.rejectByDirector(id, request.reason(), directorName);
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã từ chối hồ sơ"));
    }

    @DeleteMapping("/applications/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<String>> deleteApplication(@PathVariable Long id) {
        applicationService.deleteApplication(id);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa hồ sơ ứng viên", "Thành công"));
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

    @PostMapping("/test-digest")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<String>> triggerDigest() {
        aiRecruiterDigestService.triggerDigestManually();
        return ResponseEntity.ok(ApiResponse.ok("Đã chạy AI Recruiter Digest thành công", "Thành công"));
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
    public record PriorityRequest(boolean isPriority) {}
    public record ReasonRequest(String reason) {}
}
