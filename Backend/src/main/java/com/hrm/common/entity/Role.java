package com.hrm.common.entity;

/**
 * 5 role theo thống nhất mới.
 * NHAN_VIEN: chỉ dữ liệu của chính mình.
 * TRUONG_PHONG: scope team_id.
 * GIAM_DOC_PHONG_BAN: scope department_id.
 * CEO: toàn quyền, không lọc department.
 * ADMIN: Quản trị hệ thống.
 */
public enum Role {
    ADMIN,
    CEO,
    GIAM_DOC_PHONG_BAN,
    TRUONG_PHONG,
    NHAN_VIEN
}
