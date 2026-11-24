package com.hrm.common.payroll.controller;

import com.hrm.common.payroll.dto.PayrollBatchView;
import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.service.PayrollService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.techfinance.entity.TechCertReimbursement;
import com.hrm.techfinance.repository.TechCertReimbursementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * API lương theo luồng do phòng Tài chính - Kế toán điều phối.
 * Quyền chi tiết (đúng phòng, đúng bước) được kiểm tra trong {@link PayrollService};
 * mỗi kỳ lương trả về danh sách "actions" người dùng hiện tại được làm.
 */
@RestController
@RequestMapping("/api/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayrollService payrollService;
    private final TechCertReimbursementRepository techCertReimbursementRepository;

    @GetMapping("/access")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAccess(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getAccess(user)));
    }

    @GetMapping("/batches")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<PayrollBatchView>>> getBatches(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getBatches(month, year, user), "Lấy danh sách kỳ lương thành công"));
    }

    @GetMapping("/batches/{id}/items")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getBatchItems(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails user) {
        List<Map<String, Object>> items = payrollService.getBatchItems(id, user);
        enrichBatchItemsWithCertReimbursements(items);
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    // ── 1. Trưởng phòng / GĐ phòng chốt công ──

    @PostMapping("/attendance/close")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> closeAttendance(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.closeAttendance(month, year, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã chốt công tháng " + month + "/" + year + " và chuyển phòng Tài chính - Kế toán"));
    }

    @PostMapping("/attendance/reopen")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> reopenAttendance(
            @RequestParam int month,
            @RequestParam int year,
            @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.reopenAttendance(month, year, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã mở lại công tháng " + month + "/" + year));
    }

    // ── 2. Kế toán tính lương và gửi duyệt ──

    @PostMapping("/finance/generate")
    @PreAuthorize("@financeAccess.isAccountant(principal)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> generate(
            @RequestParam int month,
            @RequestParam int year,
            @RequestParam(required = false) Long departmentId,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(payrollService.generatePayroll(month, year, departmentId, user), "Đã tính lương"));
    }

    @PostMapping("/finance/batches/{id}/submit")
    @PreAuthorize("@financeAccess.isAccountant(principal)")
    public ResponseEntity<ApiResponse<Void>> submit(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.submitForApproval(id, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã gửi bảng lương đi duyệt"));
    }

    // ── 3. Giám đốc phòng ban xác nhận ──

    @PostMapping("/director/batches/{id}/confirm")
    @PreAuthorize("hasRole('GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> directorConfirm(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.directorConfirm(id, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xác nhận bảng lương phòng ban"));
    }

    @PostMapping("/director/batches/{id}/reject")
    @PreAuthorize("hasRole('GIAM_DOC_PHONG_BAN')")
    public ResponseEntity<ApiResponse<Void>> directorReject(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.directorReject(id, body.get("reason"), user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã trả bảng lương về phòng Tài chính - Kế toán"));
    }

    // ── 4. Kế toán trưởng kiểm tra ──

    @PostMapping("/chief/batches/{id}/approve")
    @PreAuthorize("@financeAccess.isChiefAccountant(principal)")
    public ResponseEntity<ApiResponse<Void>> chiefApprove(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.chiefApprove(id, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã kiểm tra và gửi Tổng Giám đốc"));
    }

    @PostMapping("/chief/batches/{id}/reject")
    @PreAuthorize("@financeAccess.isChiefAccountant(principal)")
    public ResponseEntity<ApiResponse<Void>> chiefReject(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.chiefReject(id, body.get("reason"), user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã trả bảng lương cho kế toán tính lại"));
    }

    // ── 5. CEO chốt ──

    @PostMapping("/ceo/batches/{id}/approve")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<Void>> ceoApprove(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.ceoApprove(id, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã chốt bảng lương"));
    }

    @PostMapping("/ceo/batches/{id}/reject")
    @PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<Void>> ceoReject(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.ceoReject(id, body.get("reason"), user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã từ chối bảng lương"));
    }

    // ── 6. Kế toán chi trả ──

    @PostMapping("/finance/batches/{id}/pay")
    @PreAuthorize("@financeAccess.isAccountant(principal)")
    public ResponseEntity<ApiResponse<Void>> markPaid(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal CustomUserDetails user) {
        payrollService.markPaid(id, body != null ? body.get("paymentReference") : null, user);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã ghi nhận chi trả lương và gửi phiếu lương cho nhân viên"));
    }

    @GetMapping("/finance/batches/{id}/bank-file")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> bankFile(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails user) {
        String csv = payrollService.buildBankTransferCsv(id, user);
        byte[] bom = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}; // để Excel đọc đúng tiếng Việt
        byte[] body = csv.getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"chi-luong-" + id + ".csv\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(out);
    }

    // ── Phiếu lương cá nhân ──

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Payroll>>> getMyPayroll(@AuthenticationPrincipal CustomUserDetails user) {
        List<Payroll> payrolls = payrollService.getMyPayroll(user.getUserId());
        enrichMyPayrollsWithCertReimbursements(payrolls, user.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(payrolls, "Lấy phiếu lương thành công"));
    }

    /**
     * Bổ sung cột hiển thị "Hoàn ứng chứng chỉ (miễn thuế)" cho các khoản hoàn ứng chọn gộp kỳ lương
     * (không tác động vào công thức Gross/BHXH/Thuế TNCN của PayrollService).
     */
    private void enrichBatchItemsWithCertReimbursements(List<Map<String, Object>> items) {
        if (items == null || items.isEmpty()) return;
        Object mObj = items.get(0).get("month");
        Object yObj = items.get(0).get("year");
        if (!(mObj instanceof Number mNum) || !(yObj instanceof Number yNum)) return;

        String yyyyMm = String.format("%04d-%02d", yNum.intValue(), mNum.intValue());
        List<TechCertReimbursement> certs = techCertReimbursementRepository
                .findByPayoutMethodAndPayoutPayrollMonthAndStatusIn(
                        "NEXT_PAYROLL", yyyyMm, List.of("FINANCE_APPROVED", "DISBURSED"));
        Map<Long, List<TechCertReimbursement>> byEmp = certs.stream()
                .collect(Collectors.groupingBy(TechCertReimbursement::getEmployeeId));

        for (Map<String, Object> row : items) {
            Long empId = row.get("employeeId") instanceof Number n ? n.longValue() : null;
            double net = row.get("netSalary") instanceof Number n ? n.doubleValue() : 0.0;
            List<TechCertReimbursement> empCerts = empId != null ? byEmp.getOrDefault(empId, List.of()) : List.of();
            double certTotal = sumCertReimbursement(empCerts);
            row.put("certReimbursementAmount", certTotal);
            row.put("certReimbursementSummary", buildCertSummary(empCerts));
            row.put("totalPayoutAmount", net + certTotal);
        }
    }

    private void enrichMyPayrollsWithCertReimbursements(List<Payroll> payrolls, Long userId) {
        if (payrolls == null || payrolls.isEmpty() || userId == null) return;
        List<TechCertReimbursement> allMyCerts = techCertReimbursementRepository
                .findByEmployeeIdOrderByCreatedAtDesc(userId).stream()
                .filter(c -> "NEXT_PAYROLL".equals(c.getPayoutMethod())
                        && ("FINANCE_APPROVED".equals(c.getStatus()) || "DISBURSED".equals(c.getStatus()))
                        && c.getPayoutPayrollMonth() != null)
                .toList();
        Map<String, List<TechCertReimbursement>> byMonth = allMyCerts.stream()
                .collect(Collectors.groupingBy(TechCertReimbursement::getPayoutPayrollMonth));

        for (Payroll p : payrolls) {
            if (p.getYear() == null || p.getMonth() == null) continue;
            String yyyyMm = String.format("%04d-%02d", p.getYear(), p.getMonth());
            List<TechCertReimbursement> monthCerts = byMonth.getOrDefault(yyyyMm, List.of());
            double certTotal = sumCertReimbursement(monthCerts);
            double net = p.getNetSalary() != null ? p.getNetSalary() : 0.0;
            p.setCertReimbursementAmount(certTotal);
            p.setCertReimbursementSummary(buildCertSummary(monthCerts));
            p.setTotalPayoutAmount(net + certTotal);
        }
    }

    private static double sumCertReimbursement(List<TechCertReimbursement> certs) {
        if (certs == null || certs.isEmpty()) return 0.0;
        return certs.stream()
                .map(c -> c.getApprovedAmountVnd() != null ? c.getApprovedAmountVnd() : c.getRequestedAmountVnd())
                .filter(v -> v != null && v.compareTo(BigDecimal.ZERO) > 0)
                .mapToDouble(BigDecimal::doubleValue)
                .sum();
    }

    private static String buildCertSummary(List<TechCertReimbursement> certs) {
        if (certs == null || certs.isEmpty()) return null;
        return certs.stream()
                .map(c -> c.getCertificateName()
                        + (c.getPaymentReference() != null && !c.getPaymentReference().isBlank()
                                ? " (" + c.getPaymentReference() + ")"
                                : ""))
                .collect(Collectors.joining("; "));
    }
}
