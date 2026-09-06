package com.hrm.common.payroll.controller;

import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.entity.PayrollReport;
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

    @PostMapping("/manager/approve-all")
    @PreAuthorize("hasRole('TRUONG_PHONG')")
    public ResponseEntity<ApiResponse<Void>> approveAllPayrollManager(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        payrollService.approveAllPayroll(month, year, userDetails.getDepartmentId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Duyệt tất cả lương thành công"));
    }

    @PostMapping("/manager/submit-report")
    @PreAuthorize("hasRole('TRUONG_PHONG')")
    public ResponseEntity<ApiResponse<Void>> submitManagerReport(
            @RequestParam int month,
            @RequestParam int year,
            @RequestParam(required = false, defaultValue = "false") boolean force,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        try {
            payrollService.submitManagerReport(month, year, userDetails.getDepartmentId(), userDetails.getUserId(), force);
            return ResponseEntity.ok(ApiResponse.ok(null, "Đã gửi báo cáo lương lên Giám đốc phòng ban"));
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("WARNING_OVERWRITE:")) {
                return ResponseEntity.status(409).body(ApiResponse.error(e.getMessage().replace("WARNING_OVERWRITE:", "").trim()));
            }
            throw e;
        }
    }

    @GetMapping("/director/reports")
    @PreAuthorize("hasRole('GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<List<PayrollReport>>> getManagerReports(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        List<PayrollReport> reports = payrollService.getManagerReportsForDirector(month, year, userDetails.getDepartmentId());
        return ResponseEntity.ok(ApiResponse.ok(reports, "Lấy danh sách báo cáo thành công"));
    }

    @PostMapping("/director/approve-report/{id}")
    @PreAuthorize("hasRole('GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> approveManagerReport(
            @PathVariable Long id) {
        payrollService.approveManagerReport(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã duyệt báo cáo của Trưởng phòng"));
    }

    @PostMapping("/director/submit-report")
    @PreAuthorize("hasRole('GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> submitDirectorReport(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        payrollService.submitDirectorReport(month, year, userDetails.getDepartmentId(), userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã gửi báo cáo tổng hợp lên Tổng Giám đốc"));
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

    @GetMapping("/ceo/reports")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<List<PayrollReport>>> getDirectorReportsForCeo(
            @RequestParam int month,
            @RequestParam int year) {
        List<PayrollReport> reports = payrollService.getDirectorReportsForCeo(month, year);
        return ResponseEntity.ok(ApiResponse.ok(reports, "Lấy danh sách báo cáo tổng hợp thành công"));
    }

    @PostMapping("/ceo/approve-report/{id}")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<Void>> approveDirectorReportByCeo(
            @PathVariable Long id) {
        payrollService.approveDirectorReportByCeo(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã duyệt báo cáo bảng lương thành công"));
    }

    @PostMapping("/ceo/reject-report/{id}")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<Void>> rejectDirectorReportByCeo(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        String reason = request.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Vui lòng nhập lý do từ chối");
        }
        payrollService.rejectDirectorReportByCeo(id, reason);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã từ chối báo cáo bảng lương"));
    }
}
