package com.hrm.approval.controller;

import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.approval.service.ApprovalService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping("/my-pending")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<ApprovalService.ApprovalInboxItem>>> myPending(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                approvalService.getPendingInbox(currentUser.getUserId()),
                "Lấy danh sách chờ duyệt thành công"));
    }

    @GetMapping("/{entityType}/{entityId}")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ApprovalService.ApprovalRequestView>>> history(
            @PathVariable ApprovalEntityType entityType,
            @PathVariable Long entityId) {
        return ResponseEntity.ok(ApiResponse.ok(
                approvalService.getHistory(entityType, entityId),
                "Lấy lịch sử phê duyệt thành công"));
    }
}
