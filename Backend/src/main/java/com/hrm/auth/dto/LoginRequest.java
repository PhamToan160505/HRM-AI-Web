package com.hrm.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * DTO nhận từ client khi đăng nhập.
 * Bean Validation chạy trước khi vào Service — lọc input sớm theo mục 3 SKILL.
 */
@Getter
@NoArgsConstructor
public class LoginRequest {

    @NotBlank(message = "Tài khoản đăng nhập không được để trống")
    private String maNhanVien;

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;
}
