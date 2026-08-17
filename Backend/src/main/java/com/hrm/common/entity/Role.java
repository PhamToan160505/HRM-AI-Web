package com.hrm.common.entity;

/**
 * 3 role cố định — không thêm role mới theo README mục 3.
 * NHAN_VIEN: chỉ dữ liệu của chính mình.
 * TRUONG_PHONG: scope department_id (trừ module Tuyển dụng — xem mục 3 README).
 * GIAM_DOC: toàn quyền, không lọc department.
 */
public enum Role {
    NHAN_VIEN,
    TRUONG_PHONG,
    GIAM_DOC
}
