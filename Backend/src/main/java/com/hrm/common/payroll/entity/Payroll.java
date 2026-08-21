package com.hrm.common.payroll.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "payrolls",
    uniqueConstraints = @UniqueConstraint(columnNames = {"employee_id", "month", "year"})
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Payroll {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "month", nullable = false)
    private Integer month;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "base_salary")
    private Double baseSalary;

    @Column(name = "standard_days")
    private Double standardDays;

    @Column(name = "actual_days")
    private Double actualDays;

    @Column(name = "allowance")
    private Double allowance;

    @Column(name = "late_penalty")
    @Builder.Default
    private Double latePenalty = 0.0;

    @Column(name = "overtime_pay")
    @Builder.Default
    private Double overtimePay = 0.0;

    @Column(name = "overtime_reason", columnDefinition = "TEXT")
    private String overtimeReason;

    @Column(name = "gross_salary")
    private Double grossSalary;

    @Column(name = "bhxh_amount")
    @Builder.Default
    private Double bhxhAmount = 0.0;

    @Column(name = "bhyt_amount")
    @Builder.Default
    private Double bhytAmount = 0.0;

    @Column(name = "bhtn_amount")
    @Builder.Default
    private Double bhtnAmount = 0.0;

    @Column(name = "thu_nhap_tinh_thue")
    private Double thuNhapTinhThue;

    @Column(name = "thu_tncn")
    @Builder.Default
    private Double thuTncn = 0.0;

    @Column(name = "net_salary")
    private Double netSalary;

    // DRAFT, APPROVED, REJECTED
    @Column(name = "status", nullable = false)
    private String status;

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
