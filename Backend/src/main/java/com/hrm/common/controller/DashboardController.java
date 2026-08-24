package com.hrm.common.controller;

import com.hrm.common.service.DashboardService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/ceo")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCeoDashboard() {
        return ResponseEntity.ok(ApiResponse.ok(dashboardService.getDirectorStats(), "Thành công"));
    }

    @GetMapping("/manager")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getManagerDashboard(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(dashboardService.getManagerStats(userDetails), "Thành công"));
    }

    @GetMapping("/employee")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getEmployeeDashboard(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(dashboardService.getEmployeeStats(userDetails.getUserId()), "Thành công"));
    }
}
