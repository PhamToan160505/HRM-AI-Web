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

    @Column(name = "status", nullable = false)
    private String status; // PENDING_DIRECTOR, PENDING_CEO, APPROVED_BY_DIRECTOR, APPROVED_BY_CEO, REJECTED

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
