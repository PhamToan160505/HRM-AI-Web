package com.hrm.common.payroll.controller;

import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.service.PayrollService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayrollService payrollService;

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<Object>>> generatePayroll(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        List<Object> result = payrollService.generatePayroll(month, year, userDetails.getDepartmentId(), userDetails);
        return ResponseEntity.ok(ApiResponse.ok(result, "Đã tính lương xong"));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('GIAM_DOC')")
    public ResponseEntity<ApiResponse<Void>> approvePayroll(@PathVariable Long id) {
        payrollService.approvePayrollRecord(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Duyệt lương thành công"));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('GIAM_DOC')")
    public ResponseEntity<ApiResponse<Void>> rejectPayroll(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        String reason = request.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Vui lòng nhập lý do từ chối");
        }
        payrollService.rejectPayrollRecord(id, reason);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã từ chối phiếu lương"));
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Payroll>>> getMyPayroll(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getMyPayroll(userDetails.getUserId()), "Lấy phiếu lương thành công"));
    }

    @GetMapping("/department")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<Payroll>>> getDepartmentPayroll(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        // This should probably be in service, but simple logic here:
        // We will fetch from repository. Wait, PayrollService needs a method for this.
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getDepartmentPayroll(month, year, userDetails), "Lấy lương thành công"));
    }
}
