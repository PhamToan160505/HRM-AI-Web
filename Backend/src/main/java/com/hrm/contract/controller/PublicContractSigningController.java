package com.hrm.contract.controller;

import com.hrm.contract.service.ElectronicContractSigningService;
import com.hrm.exception.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/public/contracts/sign")
public class PublicContractSigningController {

    private final ElectronicContractSigningService signingService;

    @GetMapping("/{token}")
    public ResponseEntity<ApiResponse<ElectronicContractSigningService.PublicSigningView>> view(
            @PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.ok(signingService.publicView(token),
                "Lấy hợp đồng cần ký thành công"));
    }

    @PostMapping("/{token}/otp")
    public ResponseEntity<ApiResponse<ElectronicContractSigningService.OtpResult>> sendOtp(
            @PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.ok(signingService.sendOtp(token),
                "Đã gửi OTP tới email ứng viên"));
    }

    @PostMapping("/{token}/verify-otp")
    public ResponseEntity<ApiResponse<ElectronicContractSigningService.VerificationResult>> verifyOtp(
            @PathVariable String token,
            @RequestBody ElectronicContractSigningService.VerifyOtpCommand command) {
        return ResponseEntity.ok(ApiResponse.ok(signingService.verifyOtp(token, command.otp()),
                "Xác thực OTP thành công"));
    }

    @PostMapping("/{token}/complete")
    public ResponseEntity<ApiResponse<ElectronicContractSigningService.PublicSigningView>> sign(
            @PathVariable String token,
            @RequestBody ElectronicContractSigningService.SignCommand command,
            HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(signingService.sign(token, command,
                clientIp(request), request.getHeader("User-Agent")), "Đã ký hợp đồng thành công"));
    }

    @PostMapping("/{token}/decline")
    public ResponseEntity<ApiResponse<ElectronicContractSigningService.PublicSigningView>> decline(
            @PathVariable String token,
            @RequestBody ElectronicContractSigningService.DeclineCommand command,
            HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(signingService.decline(token, command,
                clientIp(request), request.getHeader("User-Agent")), "Đã ghi nhận từ chối ký"));
    }

    @GetMapping("/{token}/document")
    public ResponseEntity<byte[]> document(@PathVariable String token) {
        ElectronicContractSigningService.DocumentDownload document = signingService.finalDocument(token);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + document.fileName().replace("\"", "") + "\"")
                .body(document.bytes());
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank()
                ? request.getRemoteAddr()
                : forwarded.split(",")[0].trim();
    }
}
