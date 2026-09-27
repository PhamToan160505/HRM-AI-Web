package com.hrm.lifecycle.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.lifecycle.service.EmployeeLifecycleService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/lifecycle/employees")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
public class EmployeeLifecycleController {

    private final EmployeeLifecycleService lifecycleService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EmployeeLifecycleService.EmployeeView>>> list(
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(lifecycleService.list(status, actor.getUserId()),
                "Lấy danh sách vòng đời nhân viên thành công"));
    }

    @GetMapping("/{employeeId}")
    public ResponseEntity<ApiResponse<EmployeeLifecycleService.EmployeeDetail>> detail(
            @PathVariable Long employeeId,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(lifecycleService.detail(employeeId, actor.getUserId()),
                "Lấy hồ sơ pre-boarding thành công"));
    }

    @PostMapping("/{employeeId}/checklist/{itemId}/complete")
    public ResponseEntity<ApiResponse<EmployeeLifecycleService.EmployeeView>> completeItem(
            @PathVariable Long employeeId, @PathVariable Long itemId,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                lifecycleService.completeChecklistItem(employeeId, itemId, actor.getUserId()),
                "Đã hoàn tất mục checklist"));
    }

    @PostMapping("/{employeeId}/join")
    public ResponseEntity<ApiResponse<EmployeeLifecycleService.EmployeeView>> join(
            @PathVariable Long employeeId, @RequestBody JoinRequest request,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(lifecycleService.confirmJoined(employeeId,
                request.joinDate(), request.checklistOverrideReason(), request.earlyJoinReason(),
                actor.getUserId(), idempotencyKey), "Đã xác nhận nhân viên nhận việc"));
    }

    @PostMapping("/{employeeId}/cancel-onboarding")
    public ResponseEntity<ApiResponse<EmployeeLifecycleService.EmployeeView>> cancel(
            @PathVariable Long employeeId, @RequestBody CancelRequest request,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(lifecycleService.cancelOnboarding(employeeId,
                request.reasonCode(), actor.getUserId(), idempotencyKey), "Đã ghi nhận hủy nhận việc"));
    }

    public record JoinRequest(LocalDate joinDate, String checklistOverrideReason, String earlyJoinReason) {}
    public record CancelRequest(String reasonCode) {}
}
