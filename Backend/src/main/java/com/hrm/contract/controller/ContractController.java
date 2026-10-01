package com.hrm.contract.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.contract.service.ContractService;
import com.hrm.contract.service.ElectronicContractSigningService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/contracts")
@PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
public class ContractController {

    private final ContractService contractService;
    private final ElectronicContractSigningService signingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContractService.ContractView>>> list(
            @RequestParam(required = false) String status,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(contractService.listContracts(status, user.getUserId()),
                "Lấy danh sách hợp đồng thành công"));
    }

    @GetMapping("/clauses")
    public ResponseEntity<ApiResponse<List<ContractService.ClauseView>>> clauses(
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(contractService.listClauses(user.getUserId(), includeInactive),
                "Lấy thư viện điều khoản thành công"));
    }

    @PostMapping("/clauses")
    public ResponseEntity<ApiResponse<ContractService.ClauseView>> createClause(
            @RequestBody ContractService.ClauseCommand command,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(contractService.createClause(command, user.getUserId()),
                "Đã tạo phiên bản điều khoản"));
    }

    @GetMapping("/application/{applicationId}")
    public ResponseEntity<ApiResponse<List<ContractService.ContractView>>> byApplication(
            @PathVariable Long applicationId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(contractService.getByApplication(applicationId, user.getUserId()),
                "Lấy hợp đồng thành công"));
    }

    @PostMapping("/application/{applicationId}")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> create(
            @PathVariable Long applicationId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                contractService.createFromAcceptedOffer(applicationId, user.getUserId(), idempotencyKey),
                "Đã khởi tạo hợp đồng từ offer"));
    }

    @PostMapping("/{contractId}/generate")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> generate(
            @PathVariable Long contractId,
            @RequestBody ContractService.GenerateCommand command,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                contractService.generate(contractId, command, user.getUserId(), idempotencyKey),
                "Đã sinh nội dung hợp đồng"));
    }

    @PostMapping("/{contractId}/submit-legal")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> submitLegal(
            @PathVariable Long contractId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                contractService.submitLegal(contractId, user.getUserId(), idempotencyKey),
                "Đã gửi pháp chế rà soát"));
    }

    @PostMapping("/{contractId}/legal-decision")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> legalDecision(
            @PathVariable Long contractId,
            @RequestBody ContractService.LegalDecisionCommand command,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                contractService.legalDecision(contractId, command, user.getUserId(), idempotencyKey),
                "Đã ghi nhận quyết định pháp chế"));
    }

    @PostMapping("/{contractId}/issue")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> issue(
            @PathVariable Long contractId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(contractService.issue(contractId, user.getUserId(), idempotencyKey),
                "Đã phát hành hợp đồng"));
    }

    @PostMapping(value = "/{contractId}/signed-copy", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> uploadSigned(
            @PathVariable Long contractId,
            @RequestPart("file") MultipartFile file,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                contractService.uploadSigned(contractId, file, user.getUserId(), idempotencyKey),
                "Đã lưu bản hợp đồng ký tay"));
    }

    @PostMapping("/{contractId}/send-for-signature")
    public ResponseEntity<ApiResponse<ElectronicContractSigningService.SendResult>> sendForSignature(
            @PathVariable Long contractId,
            @RequestBody(required = false) ElectronicContractSigningService.SendCommand command,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(signingService.sendToCandidate(contractId,
                command == null ? null : command.expiresAt(), user.getUserId(), idempotencyKey),
                "Đã gửi link ký bảo mật cho ứng viên"));
    }

    @PostMapping("/{contractId}/activate")
    public ResponseEntity<ApiResponse<ContractService.ContractView>> activate(
            @PathVariable Long contractId,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        signingService.activate(contractId, user.getUserId(), idempotencyKey);
        return ResponseEntity.ok(ApiResponse.ok(contractService.get(contractId, user.getUserId()),
                "Đã kích hoạt hợp đồng và chuyển sang chuẩn bị nhận việc"));
    }
}
