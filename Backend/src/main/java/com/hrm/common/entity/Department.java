package com.hrm.common.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Bảng phòng ban. truong_phong thuộc 1 phòng (FK department_id trong User).
 * LƯUÝ: module Tuyển dụng KHÔNG lọc theo department_id theo README mục 3.
 */
@Entity
@Table(name = "departments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Department {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ten_phong", nullable = false, length = 100)
    private String tenPhong;

    @Column(name = "mo_ta", length = 255)
    private String moTa;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "is_lock", nullable = false)
    @Builder.Default
    private Boolean isLock = false;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
