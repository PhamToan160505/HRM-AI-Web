package com.hrm.common.payroll.controller;

import com.hrm.common.payroll.dto.PayrollBatchView;
import com.hrm.common.payroll.entity.Payroll;
import com.hrm.common.payroll.service.PayrollService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

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
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getBatchItems(id, user)));
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
        return ResponseEntity.ok(ApiResponse.ok(payrollService.getMyPayroll(user.getUserId()), "Lấy phiếu lương thành công"));
    }
}
