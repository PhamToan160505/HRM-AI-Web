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

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

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
