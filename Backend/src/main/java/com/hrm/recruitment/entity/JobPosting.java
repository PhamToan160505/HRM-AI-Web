package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "job_postings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobPosting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String requirements;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String status; // OPEN, CLOSED

    // Bắt buộc (không dùng cho checkDepartmentScope)
    @Column(nullable = false)
    private Integer soLuongTuyen;

    @Column(nullable = false)
    private String diaDiem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HinhThucLamViec hinhThucLamViec;

    @Column(nullable = false)
    private LocalDateTime ngayBatDau;

    @Column(nullable = false)
    private LocalDateTime hanNopHoSo;

    // Tùy chọn
    private String mucLuong;

    private Boolean coThoaThuan;

    @Column(columnDefinition = "TEXT")
    private String quyenLoi;

    @Enumerated(EnumType.STRING)
    private CapBac capBac;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
