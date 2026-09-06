package com.hrm.recruitment.entity;

import com.hrm.common.entity.Role;
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

    @Column(nullable = false)
    private String hinhThucLamViec;

    @Column(nullable = false)
    private LocalDateTime ngayBatDau;

    @Column(nullable = false)
    private LocalDateTime hanNopHoSo;

    // Tùy chọn
    private String mucLuong;

    private Boolean coThoaThuan;

    @Column(columnDefinition = "TEXT")
    private String quyenLoi;

    private String capBac;

    @Column(name = "department_id")
    private Long departmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_role", nullable = false)
    private Role targetRole; // NHAN_VIEN, TRUONG_PHONG, GIAM_DOC_PHONG

    @Column(name = "job_requisition_id")
    private Long jobRequisitionId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
