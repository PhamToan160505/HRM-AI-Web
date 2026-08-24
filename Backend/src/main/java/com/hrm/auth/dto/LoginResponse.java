package com.hrm.auth.dto;

import com.hrm.common.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Response sau đăng nhập thành công.
 * Chứa JWT token + thông tin cần thiết để AuthContext frontend lưu.
 * Theo SKILL_backend-patterns.md mục 3: JWT payload chứa role + departmentId.
 */
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private Long userId;
    private String hoTen;
    private Role role;
    private Long departmentId; // null cho CEO
    private Long teamId;
}
