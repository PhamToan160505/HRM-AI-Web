package com.hrm.request.controller;

import com.hrm.request.dto.ApproveRequestDto;
import com.hrm.request.dto.CreateRequestDto;
import com.hrm.request.dto.EmployeeRequestDto;
import com.hrm.request.service.EmployeeRequestService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/requests")
@RequiredArgsConstructor
public class EmployeeRequestController {

    private final EmployeeRequestService requestService;

    @PostMapping
    public ResponseEntity<EmployeeRequestDto> createRequest(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody CreateRequestDto dto) {
        return ResponseEntity.ok(requestService.createRequest(userDetails.getUserId(), dto));
    }

    @GetMapping("/me")
    public ResponseEntity<List<EmployeeRequestDto>> getMyRequests(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(requestService.getMyRequests(userDetails.getUserId()));
    }

    @GetMapping("/management")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<List<EmployeeRequestDto>> getRequestsForManager(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(requestService.getRequestsForManager(userDetails));
    }

    @GetMapping("/leave-quota")
    public ResponseEntity<Integer> getLeaveQuota(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(requestService.getRemainingLeaveQuota(userDetails.getUserId()));
    }

    @GetMapping("/monthly-summary")
    public ResponseEntity<java.util.Map<String, Object>> getMonthlySummary(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(requestService.getMonthlySummary(userDetails.getUserId()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<EmployeeRequestDto> approveRequest(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @RequestBody(required = false) ApproveRequestDto dto) {
        return ResponseEntity.ok(requestService.approveRequest(userDetails.getUserId(), id, dto));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<EmployeeRequestDto> rejectRequest(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @RequestBody(required = false) ApproveRequestDto dto) {
        return ResponseEntity.ok(requestService.rejectRequest(userDetails.getUserId(), id, dto));
    }

    @PostMapping("/{id}/forward")
    @PreAuthorize("hasRole('TRUONG_PHONG')")
    public ResponseEntity<EmployeeRequestDto> forwardRequest(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @RequestBody(required = false) ApproveRequestDto dto) {
        return ResponseEntity.ok(requestService.forwardRequest(userDetails.getUserId(), id, dto));
    }
}
