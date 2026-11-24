package com.hrm.techhr.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.security.CustomUserDetails;
import com.hrm.techhr.dto.CreateTechGapRequisitionRequest;
import com.hrm.techhr.dto.ProjectHiringStatusResponse;
import com.hrm.techhr.dto.TechHrIntegrationDtos.*;
import com.hrm.techhr.service.CrossDeptHandoffService;
import com.hrm.techhr.service.TechHrIntegrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tech-hr")
@RequiredArgsConstructor
public class TechHrIntegrationController {

    private final TechHrIntegrationService integrationService;
    private final CrossDeptHandoffService handoffService;

    // ─── MODULE 1: TECH GAP -> HR REQUISITION & PROJECT HIRING STATUS ─────────

    @PostMapping("/requisitions/from-gap")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<JobRequisition>> createRequisitionFromTechGap(
            @Valid @RequestBody CreateTechGapRequisitionRequest request,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        JobRequisition created = integrationService.createRequisitionFromTechGap(
                request, userDetails.getUserId(), idempotencyKey);
        return ResponseEntity.ok(ApiResponse.ok(created, "Đã gửi yêu cầu tuyển dụng từ Phòng Công nghệ sang Phòng Nhân sự"));
    }

    @GetMapping("/projects/{projectId}/hiring-status")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<ProjectHiringStatusResponse>> getProjectHiringStatus(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.ok(integrationService.getProjectHiringStatus(projectId)));
    }

    @GetMapping("/requisitions/{requisitionId}/hiring-detail")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechHiringRequisitionDetailResponse>> getRequisitionHiringDetail(
            @PathVariable Long requisitionId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.getRequisitionHiringDetail(requisitionId, userDetails.getUserId())));
    }

    // ─── MODULE 2: SMART TECHNICAL INTERVIEWER SUGGESTION & MY INTERVIEWS ─────

    @GetMapping("/interviewer-suggestions")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechInterviewerSuggestion>>> suggestInterviewers(
            @RequestParam(required = false) Long applicationId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate interviewDate) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.suggestTechnicalInterviewers(applicationId, departmentId, interviewDate)));
    }

    @GetMapping("/my-interviews")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<MyTechInterviewItem>>> getMyUpcomingInterviews(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.getMyUpcomingTechInterviews(userDetails.getUserId())));
    }

    // ─── MODULE 3: TECH PRE-BOARDING & PROBATION HANDOVER ─────────────────────

    @GetMapping("/preboarding")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechPreboardingEngineer>>> getPreboardingEngineers(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.getPreboardingAndProbationEngineers(userDetails.getUserId())));
    }

    @PostMapping("/preboarding/{lifecycleEmployeeId}/items/{itemId}/complete")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> completeTechPreboardingItem(
            @PathVariable Long lifecycleEmployeeId,
            @PathVariable Long itemId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        integrationService.completeTechPreboardingItem(lifecycleEmployeeId, itemId, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xác nhận hoàn tất mục Onboarding kỹ thuật"));
    }

    // ─── MODULE 4 & 5: CROSS-DEPARTMENT HANDOFF TASKS & SLA OVERSIGHT ─────────

    @GetMapping("/handoff-tasks")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<CrossDeptHandoffTaskResponse>>> getHandoffTasks(
            @RequestParam(defaultValue = "ALL") String direction,
            @RequestParam(defaultValue = "ALL") String status,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                handoffService.getTasksForActor(userDetails.getUserId(), direction, status)));
    }

    @PutMapping("/handoff-tasks/{taskId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<CrossDeptHandoffTaskResponse>> updateHandoffTask(
            @PathVariable Long taskId,
            @RequestBody CompleteHandoffTaskRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        CrossDeptHandoffTaskResponse updated = handoffService.updateTaskStatus(
                taskId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(updated, "Đã cập nhật trạng thái tác vụ liên phòng ban"));
    }

    @GetMapping("/handoff-tasks/sla-summary")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<CrossDeptSlaSummaryResponse>> getSlaSummary() {
        return ResponseEntity.ok(ApiResponse.ok(handoffService.getSlaSummary()));
    }

    // ─── MODULE 5: LEAVE PROJECT IMPACT & OFFBOARDING HANDOVER GUARD ──────────

    @GetMapping("/leave-impact/{userId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechLeaveImpactResponse>> checkLeaveImpact(
            @PathVariable Long userId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.checkLeaveProjectImpact(userId, startDate, endDate)));
    }

    @GetMapping("/offboarding-impact/{userId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechOffboardingImpactResponse>> getOffboardingImpact(
            @PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.ok(
                integrationService.getOffboardingTechImpact(userId)));
    }

    @GetMapping("/offboarding-impact/by-lifecycle/{lifecycleEmployeeId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechOffboardingImpactResponse>> getOffboardingImpactByLifecycle(
            @PathVariable Long lifecycleEmployeeId) {
        return ResponseEntity.ok(ApiResponse.ok(integrationService.getOffboardingImpactByLifecycleId(lifecycleEmployeeId)));
    }

    @PostMapping("/offboarding-handover/{userId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<CrossDeptHandoffTaskResponse>> triggerOffboardingHandover(
            @PathVariable Long userId,
            @RequestBody(required = false) TriggerOffboardingRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        CrossDeptHandoffTaskResponse task = integrationService.triggerTechOffboardingHandover(
                userId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(task, "Đã tạo yêu cầu Bàn giao Kỹ thuật gửi Phòng Công nghệ"));
    }
}
