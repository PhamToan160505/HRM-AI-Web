package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.*;
import com.hrm.tech.service.TechProjectEnvironmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tech/projects/{projectId}")
@RequiredArgsConstructor
public class TechProjectEnvironmentController {

    private final TechProjectEnvironmentService environmentService;

    @GetMapping("/environments")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechProjectEnvironmentResponse>>> getEnvironments(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.ok(environmentService.getEnvironments(projectId)));
    }

    @PostMapping("/environments")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectEnvironmentResponse>> createEnvironment(
            @PathVariable Long projectId,
            @Valid @RequestBody CreateTechEnvironmentRequest request) {
        TechProjectEnvironmentResponse created = environmentService.createEnvironment(projectId, request);
        return ResponseEntity.ok(ApiResponse.ok(created, "Thêm môi trường triển khai thành công"));
    }

    @PutMapping("/environments/{envId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectEnvironmentResponse>> updateEnvironment(
            @PathVariable Long projectId,
            @PathVariable Long envId,
            @RequestBody UpdateTechEnvironmentRequest request) {
        TechProjectEnvironmentResponse updated = environmentService.updateEnvironment(envId, request);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật thông tin môi trường thành công"));
    }

    @DeleteMapping("/environments/{envId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteEnvironment(
            @PathVariable Long projectId,
            @PathVariable Long envId) {
        environmentService.deleteEnvironment(envId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa môi trường"));
    }

    @GetMapping("/environments/{envId}/deployments")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechDeploymentLogResponse>>> getDeploymentLogs(
            @PathVariable Long projectId,
            @PathVariable Long envId) {
        return ResponseEntity.ok(ApiResponse.ok(environmentService.getDeploymentLogs(envId)));
    }

    @PostMapping("/environments/{envId}/deployments")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechDeploymentLogResponse>> createDeploymentLog(
            @PathVariable Long projectId,
            @PathVariable Long envId,
            @Valid @RequestBody CreateTechDeploymentLogRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechDeploymentLogResponse created = environmentService.createDeploymentLog(envId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Ghi nhận đợt triển khai thành công"));
    }

    @GetMapping("/deployments")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechDeploymentLogResponse>>> getProjectDeploymentLogs(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.ok(environmentService.getProjectDeploymentLogs(projectId)));
    }
}

