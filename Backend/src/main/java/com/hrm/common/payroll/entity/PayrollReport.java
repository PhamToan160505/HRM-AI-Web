package com.hrm.common.payroll.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "payroll_reports"
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayrollReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy; // Manager ID or Director ID

    @Column(name = "month", nullable = false)
    private Integer month;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "report_level", nullable = false)
    private String reportLevel; // MANAGER_LEVEL or DIRECTOR_LEVEL

    @Column(name = "total_employees")
    private Integer totalEmployees;

    @Column(name = "total_gross_salary")
    private Double totalGrossSalary;

    /**
     * report_level = DEPARTMENT (luồng mới): ATTENDANCE_CLOSED, DRAFT, PENDING_DIRECTOR,
     * PENDING_CHIEF_ACCOUNTANT, PENDING_CEO, APPROVED_BY_CEO, PAID, REJECTED, ATTENDANCE_REOPENED.
     * report_level = MANAGER_LEVEL / DIRECTOR_LEVEL: dữ liệu luồng cũ.
     */
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "total_net_salary")
    private Double totalNetSalary;

    /** "DEPARTMENT:{deptId}:{year}:{month}" — UNIQUE, chống tạo trùng kỳ lương. NULL với dữ liệu luồng cũ. */
    @Column(name = "period_key", length = 64)
    private String periodKey;

    @Column(name = "attendance_closed_by")
    private Long attendanceClosedBy;

    @Column(name = "attendance_closed_at")
    private LocalDateTime attendanceClosedAt;

    @Column(name = "generated_by")
    private Long generatedBy;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "submitted_by")
    private Long submittedBy;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "director_confirmed_by")
    private Long directorConfirmedBy;

    @Column(name = "director_confirmed_at")
    private LocalDateTime directorConfirmedAt;

    @Column(name = "chief_reviewed_by")
    private Long chiefReviewedBy;

    @Column(name = "chief_reviewed_at")
    private LocalDateTime chiefReviewedAt;

    @Column(name = "ceo_approved_by")
    private Long ceoApprovedBy;

    @Column(name = "ceo_approved_at")
    private LocalDateTime ceoApprovedAt;

    @Column(name = "paid_by")
    private Long paidBy;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "payment_reference")
    private String paymentReference;

    /** Bước đã từ chối: DIRECTOR, CHIEF_ACCOUNTANT, CEO. */
    @Column(name = "rejected_stage", length = 50)
    private String rejectedStage;

    @Column(name = "rejected_by")
    private Long rejectedBy;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
