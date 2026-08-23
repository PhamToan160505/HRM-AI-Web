package com.hrm.admin.controller;

import com.hrm.admin.dto.CreateUserRequest;
import com.hrm.admin.dto.UpdateUserRequest;
import com.hrm.admin.service.AdminUserService;
import com.hrm.common.entity.User;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<User>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(adminUserService.getAllUsers(), "Lấy danh sách người dùng thành công"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<User>> createUser(@RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(adminUserService.createUser(request), "Tạo người dùng thành công"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<User>> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(adminUserService.updateUser(id, request), "Cập nhật người dùng thành công"));
    }

    @PostMapping("/{id}/reset-password")
    public ResponseEntity<ApiResponse<User>> resetPassword(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String newPassword = request.get("newPassword");
        if (newPassword == null || newPassword.trim().isEmpty()) {
            throw new RuntimeException("Mật khẩu mới không được để trống");
        }
        return ResponseEntity.ok(ApiResponse.ok(adminUserService.resetPassword(id, newPassword), "Đặt lại mật khẩu thành công"));
    }
}
