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
import java.util.Map;

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
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<JobPosting>>> getAllJobs(@org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getAllJobs(userDetails), "Lấy danh sách thành công"));
    }

    @GetMapping("/jobs/stats")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getJobStats(@org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getJobStats(userDetails), "Lấy thống kê thành công"));
    }

    @GetMapping("/jobs/stats/paginated")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<Map<String, Object>>>> getJobStatsPaginated(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String capBac,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            @RequestParam(defaultValue = "false") boolean restrictToRequester,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getJobStatsPaginated(departmentId, capBac, page, size, restrictToRequester, userDetails), "Lấy thống kê thành công"));
    }

    @GetMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<JobPosting>> getJobById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(jobPostingService.getJobById(id), "Thành công"));
    }

    @PostMapping("/jobs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<JobPosting>> createJob(@RequestBody JobPostingRequest request, @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        if (!jobPostingService.isSpecialRole(userDetails)) {
            return ResponseEntity.status(403).body(ApiResponse.error("Bạn không có quyền tạo chiến dịch tuyển dụng"));
        }
        JobPosting job = jobPostingService.createJob(request);
        return ResponseEntity.ok(ApiResponse.ok(job, "Tạo tin tuyển dụng thành công"));
    }

    @PutMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<JobPosting>> updateJob(@PathVariable Long id, @RequestBody JobPostingRequest request, @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        if (!jobPostingService.isSpecialRole(userDetails)) {
            return ResponseEntity.status(403).body(ApiResponse.error("Bạn không có quyền sửa chiến dịch tuyển dụng"));
        }
        JobPosting job = jobPostingService.updateJob(id, request);
        return ResponseEntity.ok(ApiResponse.ok(job, "Cập nhật tin tuyển dụng thành công"));
    }

    @PatchMapping("/jobs/{id}/status")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<JobPosting>> updateJobStatus(@PathVariable Long id, @RequestBody StatusRequest request, @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        if (!jobPostingService.isSpecialRole(userDetails)) {
            return ResponseEntity.status(403).body(ApiResponse.error("Bạn không có quyền thay đổi trạng thái chiến dịch"));
        }
        JobPosting job = jobPostingService.updateJobStatus(id, request.status());
        return ResponseEntity.ok(ApiResponse.ok(job, "Cập nhật trạng thái thành công"));
    }

    @DeleteMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteJob(@PathVariable Long id, @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        if (!jobPostingService.isSpecialRole(userDetails)) {
            return ResponseEntity.status(403).body(ApiResponse.error("Bạn không có quyền xóa chiến dịch tuyển dụng"));
        }
        jobPostingService.deleteJob(id);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa tin tuyển dụng", "Thành công"));
    }

    // --- APPLICATIONS ---

    @GetMapping("/jobs/{jobId}/applications")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<Application>>> getApplicationsByJob(@PathVariable Long jobId, @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getApplicationsByJobPosting(jobId, userDetails), "Thành công"));
    }

    @GetMapping("/applications")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<Application>>> getAllApplications(
            @RequestParam(required = false) Long jobPostingId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getApplicationsPaginated(jobPostingId, status, search, page, size, userDetails), "Thành công"));
    }

    @GetMapping("/applications/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<Application>> getApplicationById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getApplicationById(id), "Thành công"));
    }

    @PostMapping("/applications/{id}/approve")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<Application>> approveApplication(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails) {
        String feedback = (body != null) ? body.getOrDefault("feedback", "") : "";
        Application app = applicationService.approveApplication(id, userDetails, feedback);
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã duyệt hồ sơ sang vòng tiếp theo"));
    }

    @PostMapping("/applications/{id}/reject")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<Application>> rejectApplication(
            @PathVariable Long id, 
            @RequestBody(required = false) Map<String, String> body,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails userDetails
    ) {
        String reason = (body != null) ? body.getOrDefault("reason", "") : "";
        if (reason.trim().isEmpty()) {
            throw new RuntimeException("Phải nhập lý do từ chối");
        }
        Application app = applicationService.rejectApplication(id, userDetails, reason);
        return ResponseEntity.ok(ApiResponse.ok(app, "Đã từ chối hồ sơ"));
    }

    @DeleteMapping("/applications/{id}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<String>> deleteApplication(@PathVariable Long id) {
        applicationService.deleteApplication(id);
        return ResponseEntity.ok(ApiResponse.ok("Đã xóa hồ sơ ứng viên", "Thành công"));
    }

    @PostMapping("/applications/{id}/run-ai")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<Application>> runAiReview(@PathVariable Long id) {
        Application app = applicationService.triggerAiReview(id);
        return ResponseEntity.ok(ApiResponse.ok(app, "AI đánh giá hoàn tất"));
    }

    @GetMapping("/applications/{id}/ai-logs")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<List<AiDecisionLog>>> getAiLogs(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getAiLogsForApplication(id), "Thành công"));
    }

    @PostMapping("/test-digest")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
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
            String capBac,
            com.hrm.common.entity.Role targetRole,
            Long departmentId,
            Long jobRequisitionId
    ) {}
    public record StatusRequest(String status) {}
    public record PriorityRequest(boolean isPriority) {}
    public record ReasonRequest(String reason) {}
}
