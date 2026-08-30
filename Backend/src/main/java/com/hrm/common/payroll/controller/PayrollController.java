package com.hrm.common.payroll.controller;

import com.hrm.common.payroll.dto.DepartmentPayrollSummary;
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
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<List<Object>>> generatePayroll(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        List<Object> result = payrollService.generatePayroll(month, year, userDetails.getDepartmentId(), userDetails);
        return ResponseEntity.ok(ApiResponse.ok(result, "Đã tính lương xong"));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<Void>> approvePayroll(@PathVariable Long id) {
        payrollService.approvePayrollRecord(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Duyệt lương thành công"));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
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
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<List<Payroll>>> getDepartmentPayroll(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getDepartmentPayroll(month, year, userDetails), "Lấy lương thành công"));
    }

    @GetMapping("/summary-by-department")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<List<DepartmentPayrollSummary>>> getDepartmentPayrollSummaries(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<DepartmentPayrollSummary> summaries = payrollService.getDepartmentPayrollSummaries(month, year);
        if (userDetails.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            summaries = summaries.stream()
                    .filter(s -> s.getDepartmentId().equals(userDetails.getDepartmentId()))
                    .filter(s -> "Chờ Giám đốc duyệt".equals(s.getStatus()) || "Đã duyệt".equals(s.getStatus()) || "Bị từ chối".equals(s.getStatus()))
                    .collect(java.util.stream.Collectors.toList());
        }
        return ResponseEntity.ok(ApiResponse.ok(summaries, "Lấy thống kê thành công"));
    }

    @PostMapping("/department/approve")
    @PreAuthorize("hasRole('GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> approveDepartmentPayroll(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        payrollService.approveDepartmentPayroll(userDetails.getDepartmentId(), month, year, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Duyệt báo cáo bảng lương phòng ban thành công"));
    }

    @PostMapping("/department/reject")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<Void>> rejectDepartmentPayroll(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        Long departmentId = request.get("departmentId") != null ? Long.valueOf(request.get("departmentId").toString()) : null;
        Integer month = request.get("month") != null ? Integer.valueOf(request.get("month").toString()) : null;
        Integer year = request.get("year") != null ? Integer.valueOf(request.get("year").toString()) : null;
        String reason = (String) request.get("reason");

        if (departmentId == null || month == null || year == null) {
            throw new IllegalArgumentException("Thiếu thông tin phòng ban, tháng hoặc năm");
        }
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Vui lòng nhập lý do từ chối");
        }

        payrollService.rejectDepartmentPayroll(departmentId, month, year, reason, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã từ chối báo cáo bảng lương phòng ban"));
    }
}
