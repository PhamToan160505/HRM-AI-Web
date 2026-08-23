package com.hrm.common.entity;

/**
 * Hệ thống phân quyền 5 cấp:
 * ADMIN: Quản trị hệ thống, quản lý tài khoản.
 * NHAN_VIEN: Chỉ xem dữ liệu của chính mình.
 * TRUONG_PHONG: Quản lý cấp phòng ban (ngoại trừ tuyển dụng).
 * GIAM_DOC_PHONG: Quản lý toàn bộ phòng ban.
 * GIAM_DOC: Tổng giám đốc, toàn quyền công ty.
 */
public enum Role {
    ADMIN,
    NHAN_VIEN,
    TRUONG_PHONG,
    GIAM_DOC_PHONG,
    GIAM_DOC
}
