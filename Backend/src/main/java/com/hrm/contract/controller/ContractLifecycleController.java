package com.hrm.contract.controller;

import com.hrm.contract.service.ContractLifecycleService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/contracts/lifecycle")
@PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
public class ContractLifecycleController {

    private final ContractLifecycleService service;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<ContractLifecycleService.Dashboard>> dashboard(
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.dashboard(user.getUserId()), "Lấy dashboard hợp đồng thành công"));
    }

    @PostMapping("/assistant")
    public ResponseEntity<ApiResponse<ContractLifecycleService.AssistantResult>> assistant(
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.assistant(user.getUserId()), "Đã phân tích dữ liệu hợp đồng"));
    }

    @GetMapping("/{contractId}/amendments")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> amendments(
            @PathVariable Long contractId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.amendments(contractId, user.getUserId()), "Lấy danh sách phụ lục thành công"));
    }

    @PostMapping("/{contractId}/amendments")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createAmendment(
            @PathVariable Long contractId, @RequestBody ContractLifecycleService.AmendmentCommand command,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.createAmendment(contractId, command, user.getUserId()), "Đã tạo phụ lục"));
    }

    @PostMapping("/amendments/{id}/submit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitAmendment(
            @PathVariable Long id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.submitAmendment(id, user.getUserId()), "Đã gửi phụ lục phê duyệt"));
    }

    @PostMapping("/amendments/{id}/decision")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decideAmendment(
            @PathVariable Long id, @RequestBody ContractLifecycleService.DecisionCommand command,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.decideAmendment(id, command, user.getUserId()), "Đã ghi nhận quyết định"));
    }

    @PostMapping("/amendments/{id}/activate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> activateAmendment(
            @PathVariable Long id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.activateAmendment(id, user.getUserId()), "Phụ lục đã có hiệu lực"));
    }

    @GetMapping("/{contractId}/terminations")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> terminations(
            @PathVariable Long contractId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.terminations(contractId, user.getUserId()), "Lấy hồ sơ chấm dứt thành công"));
    }

    @PostMapping("/{contractId}/terminations")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createTermination(
            @PathVariable Long contractId, @RequestBody ContractLifecycleService.TerminationCommand command,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.createTermination(contractId, command, user.getUserId()), "Đã tạo đề xuất chấm dứt"));
    }

    @PostMapping("/terminations/{id}/submit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitTermination(
            @PathVariable Long id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.submitTermination(id, user.getUserId()), "Đã gửi đề xuất chấm dứt phê duyệt"));
    }

    @PostMapping("/terminations/{id}/decision")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decideTermination(
            @PathVariable Long id, @RequestBody ContractLifecycleService.DecisionCommand command,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.decideTermination(id, command, user.getUserId()), "Đã ghi nhận quyết định"));
    }

    @PostMapping("/terminations/{id}/activate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> activateTermination(
            @PathVariable Long id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(service.activateTermination(id, user.getUserId()), "Hợp đồng đã chấm dứt"));
    }
}
