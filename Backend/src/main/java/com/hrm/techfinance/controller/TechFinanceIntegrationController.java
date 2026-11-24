package com.hrm.techfinance.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.techfinance.dto.TechFinanceDtos.*;
import com.hrm.techfinance.service.TechFinanceIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tech-finance")
@RequiredArgsConstructor
public class TechFinanceIntegrationController {

    private final TechFinanceIntegrationService techFinanceService;

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<FinanceTechOverviewResponse>> getOverview(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(techFinanceService.getOverview(currentUser.getUserId())));
    }

    // ─── MODULE F2: PROJECT BUDGET & MONTHLY COSTING ─────────────────────────

    @PutMapping("/projects/{projectId}/budget")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateProjectBudget(
            @PathVariable Long projectId,
            @RequestBody UpdateProjectBudgetRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.updateProjectBudget(projectId, req, currentUser.getUserId()),
                "Đã cập nhật ngân sách dự án"));
    }

    @PostMapping("/cost-reports/submit")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<ProjectCostReportResponse>> submitCostReport(
            @RequestBody SubmitProjectCostReportRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.submitMonthlyProjectCostReport(req, currentUser.getUserId()),
                "Đã chốt và gửi bảng đối soát giờ công & chi phí dự án sang Phòng Tài chính - Kế toán"));
    }

    @GetMapping("/cost-reports")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ProjectCostReportResponse>>> listCostReports(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(techFinanceService.listProjectCostReports(currentUser.getUserId())));
    }

    @PutMapping("/cost-reports/{reportId}/review")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<ProjectCostReportResponse>> reviewCostReport(
            @PathVariable Long reportId,
            @RequestBody ReviewProjectCostReportRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.reviewProjectCostReport(reportId, req, currentUser.getUserId()),
                "Đã cập nhật kết quả thẩm định bảng đối soát chi phí dự án"));
    }

    @GetMapping("/cost-reports/{reportId}/export-excel")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<byte[]> exportCostReportExcel(
            @PathVariable Long reportId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        byte[] bytes = techFinanceService.exportProjectCostReportExcel(reportId, currentUser.getUserId());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=hach_toan_du_an_" + reportId + ".xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    // ─── MODULE F3: COMPENSATION SYNC & PAYROLL PERIOD LOCK ──────────────────

    @GetMapping("/payroll-lock-hint")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<PayrollLockHintResponse>> getPayrollLockHint(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(ApiResponse.ok(techFinanceService.getPayrollLockHint(departmentId, month)));
    }

    @GetMapping("/compensation-syncs")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<CompensationSyncResponse>>> listCompensationSyncs(
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.listCompensationSyncs(currentUser.getUserId(), status)));
    }

    @PostMapping("/compensation-syncs/{syncId}/apply")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<CompensationSyncResponse>> applyCompensationSync(
            @PathVariable Long syncId,
            @RequestBody(required = false) ApplyCompensationSyncRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.applyCompensationSync(syncId, req, currentUser.getUserId()),
                "Đã đồng bộ mức lương/phụ cấp mới vào hồ sơ lương"));
    }

    @GetMapping("/payroll-banner")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<PayrollFinanceBannerResponse>> getPayrollBanner(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.getPayrollBanner(month, year, currentUser.getUserId())));
    }

    // ─── MODULE F4: CERTIFICATION REIMBURSEMENT ──────────────────────────────

    @PostMapping("/cert-reimbursements")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<CertReimbursementResponse>> createCertReimbursement(
            @RequestBody CreateCertReimbursementRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.createCertReimbursement(req, currentUser.getUserId()),
                "Đã gửi đề xuất hoàn ứng lệ phí chứng chỉ quốc tế"));
    }

    @GetMapping("/cert-reimbursements")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<CertReimbursementResponse>>> listCertReimbursements(
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.listCertReimbursements(currentUser.getUserId(), status)));
    }

    @PutMapping("/cert-reimbursements/{id}/tech-review")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<CertReimbursementResponse>> techReviewCertReimbursement(
            @PathVariable Long id,
            @RequestBody TechReviewCertReimbursementRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.techReviewCertReimbursement(id, req, currentUser.getUserId()),
                "Đã cập nhật kết quả xác thực chuyên môn chứng chỉ"));
    }

    @PutMapping("/cert-reimbursements/{id}/finance-decision")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<CertReimbursementResponse>> financeDecideCertReimbursement(
            @PathVariable Long id,
            @RequestBody FinanceDecisionCertReimbursementRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.financeDecideCertReimbursement(id, req, currentUser.getUserId()),
                "Đã cập nhật quyết định duyệt chi hoàn ứng chứng chỉ"));
    }

    @PutMapping("/cert-reimbursements/{id}/disburse")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<CertReimbursementResponse>> disburseCertReimbursement(
            @PathVariable Long id,
            @RequestBody DisburseCertReimbursementRequest req,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.ok(
                techFinanceService.disburseCertReimbursement(id, req, currentUser.getUserId()),
                "Đã xác nhận chi trả hoàn ứng lệ phí chứng chỉ"));
    }
}
