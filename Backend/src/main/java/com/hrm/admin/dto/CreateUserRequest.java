package com.hrm.admin.dto;

import com.hrm.common.entity.Role;
import lombok.Data;

@Data
public class CreateUserRequest {
    private String hoTen;
    private String email;
    private String password;
    private Role role;
    private Long departmentId;
    private String chucVu;
}
