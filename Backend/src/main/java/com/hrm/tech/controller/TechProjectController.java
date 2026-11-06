package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.service.TechProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/tech/projects")
@RequiredArgsConstructor
public class TechProjectController {

    private final TechProjectService techProjectService;

    @GetMapping
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechProjectResponse>>> getAllProjects(
            @RequestParam(required = false) ProjectStatus status,
            @RequestParam(required = false) String keyword) {
        List<TechProjectResponse> projects = techProjectService.getAllProjects(status, keyword);
        return ResponseEntity.ok(ApiResponse.ok(projects));
    }

    @GetMapping("/my-projects")
    public ResponseEntity<ApiResponse<List<TechProjectResponse>>> getMyProjects(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<TechProjectResponse> myProjects = techProjectService.getMyProjects(userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(myProjects));
    }

    @GetMapping("/bench")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechBenchUserResponse>>> getBenchEngineers(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long deptId = userDetails.getDepartmentId();
        List<TechBenchUserResponse> bench = techProjectService.getBenchEngineers(deptId);
        return ResponseEntity.ok(ApiResponse.ok(bench));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectResponse>> getProjectById(@PathVariable Long id) {
        TechProjectResponse project = techProjectService.getProjectById(id);
        return ResponseEntity.ok(ApiResponse.ok(project));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectResponse>> createProject(
            @Valid @RequestBody CreateProjectRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechProjectResponse created = techProjectService.createProject(request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Khởi tạo dự án thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectResponse>> updateProject(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProjectRequest request) {
        TechProjectResponse updated = techProjectService.updateProject(id, request);
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật dự án thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteProject(@PathVariable Long id) {
        techProjectService.deleteProject(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa dự án thành công"));
    }

    @PostMapping("/{id}/members")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectMemberResponse>> addMember(
            @PathVariable Long id,
            @Valid @RequestBody AddProjectMemberRequest request) {
        TechProjectMemberResponse member = techProjectService.addMember(id, request);
        return ResponseEntity.ok(ApiResponse.ok(member, "Phân bổ nhân sự vào dự án thành công"));
    }

    @PutMapping("/{id}/members/{memberId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectMemberResponse>> updateMember(
            @PathVariable Long id,
            @PathVariable Long memberId,
            @Valid @RequestBody UpdateProjectMemberRequest request) {
        TechProjectMemberResponse member = techProjectService.updateMember(id, memberId, request);
        return ResponseEntity.ok(ApiResponse.ok(member, "Cập nhật thành viên thành công"));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            @PathVariable Long id,
            @PathVariable Long memberId) {
        techProjectService.removeMember(id, memberId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã rút nhân sự khỏi dự án"));
    }
}
