package com.hrm.recruitment.entity;

import com.hrm.common.entity.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "job_requisitions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobRequisition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title; // Chức danh cần tuyển

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role targetRole; // NHAN_VIEN, TRUONG_PHONG, GIAM_DOC_PHONG

    @Column(name = "department_id")
    private Long departmentId; // Nullable đối với GIAM_DOC_PHONG (có thể tuyển GĐ cho phòng chưa có)

    @Column(nullable = false)
    private Integer soLuong;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String reason; // Lý do tuyển dụng

    @Column(columnDefinition = "TEXT")
    private String requirements; // Yêu cầu cơ bản

    @Column(columnDefinition = "TEXT")
    private String description; // Mô tả công việc (JD)

    @Column(length = 100)
    private String budget; // Mức lương dự kiến

    @Column(length = 100)
    private String capBac; // Cấp bậc

    @Column(length = 100)
    private String hinhThucLamViec; // Hình thức làm việc

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private JobRequisitionStatus status;

    @Column(name = "requester_id", nullable = false)
    private Long requesterId; // ID người yêu cầu

    @Column(name = "approver_id")
    private Long approverId; // ID Giám đốc nhân sự duyệt (nếu có)

    @Column(columnDefinition = "TEXT")
    private String rejectionReason; // Lý do từ chối (nếu có)

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Transient
    private String requesterName;

    @Transient
    private String requesterPosition;
}
