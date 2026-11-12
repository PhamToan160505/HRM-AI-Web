package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.BatchApproveWorklogRequest;
import com.hrm.tech.dto.CreateWorklogRequest;
import com.hrm.tech.dto.DepartmentWorklogPageResponse;
import com.hrm.tech.dto.MyWorklogSummaryResponse;
import com.hrm.tech.dto.RejectWorklogRequest;
import com.hrm.tech.dto.TechWorklogResponse;
import com.hrm.tech.dto.UpdateWorklogRequest;
import com.hrm.tech.dto.WorklogAnalyticsResponse;
import com.hrm.tech.entity.WorklogApprovalStatus;
import com.hrm.tech.service.TechWorklogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tech/worklogs")
@RequiredArgsConstructor
public class TechWorklogController {

    private final TechWorklogService worklogService;

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<MyWorklogSummaryResponse>> getMyWorklogs(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) WorklogApprovalStatus status) {
        return ResponseEntity.ok(ApiResponse.ok(
                worklogService.getMyWorklogs(userDetails.getUserId(), month, projectId, status)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TechWorklogResponse>> createWorklog(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CreateWorklogRequest request) {
        TechWorklogResponse created = worklogService.createWorklog(request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Ghi nhận nhật ký giờ công thành công"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TechWorklogResponse>> updateWorklog(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdateWorklogRequest request) {
        TechWorklogResponse updated = worklogService.updateWorklog(id, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật nhật ký giờ công thành công"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteWorklog(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        worklogService.deleteWorklog(id, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa bản ghi giờ công"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechWorklogResponse>>> getDepartmentWorklogs(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) WorklogApprovalStatus status,
            @RequestParam(required = false) String month) {
        List<TechWorklogResponse> list = worklogService.getDepartmentWorklogs(
                userDetails.getRole(), userDetails.getDepartmentId(), projectId, userId, status, month);
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/paginated")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<DepartmentWorklogPageResponse>> getDepartmentWorklogsPaginated(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) WorklogApprovalStatus status,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) String auditFilter,
            @RequestParam(required = false) Long focusWorklogId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        DepartmentWorklogPageResponse res = worklogService.getDepartmentWorklogsPaginated(
                userDetails.getRole(),
                userDetails.getDepartmentId(),
                projectId,
                userId,
                status,
                month,
                auditFilter,
                focusWorklogId,
                page,
                size);
        return ResponseEntity.ok(ApiResponse.ok(res));
    }

    @GetMapping("/analytics")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<WorklogAnalyticsResponse>> getAnalytics(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(ApiResponse.ok(
                worklogService.getAnalytics(month, userDetails.getRole(), userDetails.getDepartmentId())));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechWorklogResponse>> approveWorklog(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        TechWorklogResponse res = worklogService.approveWorklog(id, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(res, "Đã phê duyệt giờ công"));
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechWorklogResponse>> rejectWorklog(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody RejectWorklogRequest request) {
        TechWorklogResponse res = worklogService.rejectWorklog(id, userDetails.getUserId(), request);
        return ResponseEntity.ok(ApiResponse.ok(res, "Đã từ chối bản ghi giờ công"));
    }

    @PutMapping("/batch-approve")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechWorklogResponse>>> batchApproveWorklogs(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody BatchApproveWorklogRequest request) {
        List<TechWorklogResponse> res = worklogService.batchApproveWorklogs(request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(res, "Đã phê duyệt hàng loạt " + res.size() + " nhật ký giờ công"));
    }
}

