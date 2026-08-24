package com.hrm.common.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Người dùng nội bộ (NHAN_VIEN / TRUONG_PHONG / GIAM_DOC).
 * Ứng viên KHÔNG có tài khoản — xem README mục 3.
 *
 * departmentId nullable cho GIAM_DOC (không thuộc phòng cụ thể).
 * Không bao giờ tin role/departmentId từ client — luôn đọc từ JWT đã verify.
 */
@Entity
@Table(
    name = "users",
    uniqueConstraints = @UniqueConstraint(columnNames = "email")
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ho_ten", nullable = false, length = 150)
    private String hoTen;

    @Column(name = "ma_nhan_vien", unique = true, length = 10)
    private String maNhanVien;

    @Column(name = "email", nullable = false, unique = true, length = 150)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role;

    /**
     * Nullable: GIAM_DOC không cần thuộc phòng cụ thể.
     * Dùng lazy FK — không @ManyToOne để tránh N+1 không cần thiết;
     * departmentId đủ cho JWT claim và scope check.
     */
    @Column(name = "department_id")
    private Long departmentId;

    @Column(name = "chuc_vu", length = 100)
    private String chucVu;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "cccd", length = 20)
    private String cccd;

    @Column(name = "ngay_sinh")
    private java.time.LocalDate ngaySinh;

    @Column(name = "que_quan")
    private String queQuan;

    @Column(name = "dia_chi")
    private String diaChi;

    @Column(name = "ngay_cap_cccd")
    private java.time.LocalDate ngayCapCccd;

    @Column(name = "noi_cap_cccd")
    private String noiCapCccd;

    @Column(name = "cccd_front_public_id")
    private String cccdFrontPublicId;

    @Column(name = "cccd_back_public_id")
    private String cccdBackPublicId;

    // TODO: migrate sang lấy từ Contract.mucLuong khi module Hợp đồng lao động hoàn thành.
    @Column(name = "base_salary")
    private Double baseSalary;

    @Column(name = "allowance")
    private Double allowance;

    @Column(name = "so_nguoi_phu_thuoc", nullable = false)
    @Builder.Default
    private Integer soNguoiPhuThuoc = 0;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
