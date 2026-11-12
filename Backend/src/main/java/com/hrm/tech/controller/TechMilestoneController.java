package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.CreateMilestoneRequest;
import com.hrm.tech.dto.ProjectHealthBriefResponse;
import com.hrm.tech.dto.ProjectMilestonesSummaryResponse;
import com.hrm.tech.dto.TechMilestoneResponse;
import com.hrm.tech.dto.UpdateMilestoneRequest;
import com.hrm.tech.service.TechMilestoneService;
import com.hrm.tech.service.TechProjectHealthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tech/projects/{projectId}")
@RequiredArgsConstructor
public class TechMilestoneController {

    private final TechMilestoneService milestoneService;
    private final TechProjectHealthService healthService;

    @GetMapping("/milestones")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<ProjectMilestonesSummaryResponse>> getProjectMilestones(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.ok(milestoneService.getProjectMilestones(projectId)));
    }

    @PostMapping("/milestones")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechMilestoneResponse>> createMilestone(
            @PathVariable Long projectId,
            @Valid @RequestBody CreateMilestoneRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechMilestoneResponse created = milestoneService.createMilestone(projectId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Thêm mốc tiến độ dự án thành công"));
    }

    @PutMapping("/milestones/{milestoneId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechMilestoneResponse>> updateMilestone(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId,
            @Valid @RequestBody UpdateMilestoneRequest request) {
        TechMilestoneResponse updated = milestoneService.updateMilestone(projectId, milestoneId, request);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật mốc tiến độ thành công"));
    }

    @DeleteMapping("/milestones/{milestoneId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteMilestone(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId) {
        milestoneService.deleteMilestone(projectId, milestoneId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa mốc tiến độ dự án"));
    }

    @PostMapping("/health-brief")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<ProjectHealthBriefResponse>> generateHealthBrief(
            @PathVariable Long projectId) {
        ProjectHealthBriefResponse brief = healthService.generateHealthBrief(projectId);
        return ResponseEntity.ok(ApiResponse.ok(brief, "Phân tích sức khỏe dự án thành công"));
    }
}

