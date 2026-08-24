package com.hrm.admin.dto;

import com.hrm.common.entity.Role;
import lombok.Data;

@Data
public class UpdateUserRequest {
    private String hoTen;
    private Role role;
    private Long departmentId;
    private String chucVu;
    private Boolean active;
}
