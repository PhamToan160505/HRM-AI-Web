package com.hrm.admin.controller;

import com.hrm.admin.entity.AccountCreationRequest;
import com.hrm.admin.service.AccountCreationService;
import com.hrm.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/account-requests")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AccountCreationController {

    private final AccountCreationService accountCreationService;

    @GetMapping
    public ApiResponse<List<AccountCreationRequest>> getPendingRequests() {
        return ApiResponse.success(accountCreationService.getPendingRequests());
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<String> approveRequest(@PathVariable Long id) {
        accountCreationService.approveRequest(id);
        return ApiResponse.success("Đã duyệt yêu cầu và tạo tài khoản thành công!");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<String> rejectRequest(@PathVariable Long id) {
        accountCreationService.rejectRequest(id);
        return ApiResponse.success("Đã từ chối yêu cầu.");
    }
}
