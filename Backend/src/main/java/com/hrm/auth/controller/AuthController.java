package com.hrm.auth.controller;

import com.hrm.auth.dto.LoginRequest;
import com.hrm.auth.dto.LoginResponse;
import com.hrm.auth.service.AuthService;
import com.hrm.exception.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Auth Controller — CHỈ nhận request, validate (@Valid), gọi Service, trả response.
 * Không viết logic nghiệp vụ ở đây theo SKILL_backend-patterns.md mục 1.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/auth/login
     * Public endpoint — không cần JWT (cấu hình ở SecurityConfig).
     *
     * @param request email + password
     * @return JWT token + thông tin user (role, departmentId, userId, hoTen)
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {

        LoginResponse loginResponse = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok(loginResponse, "Đăng nhập thành công"));
    }
}
