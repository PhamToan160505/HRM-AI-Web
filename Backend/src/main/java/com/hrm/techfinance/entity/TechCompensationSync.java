package com.hrm.techfinance.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "tech_compensation_syncs",
        uniqueConstraints = @UniqueConstraint(name = "uk_tech_comp_sync_review", columnNames = {"review_id"})
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechCompensationSync {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "review_id", nullable = false, unique = true)
    private Long reviewId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "old_title", length = 150)
    private String oldTitle;

    @Column(name = "new_title", length = 150)
    private String newTitle;

    @Column(name = "old_base_salary", precision = 15, scale = 2)
    private BigDecimal oldBaseSalary;

    @Column(name = "new_base_salary", precision = 15, scale = 2)
    private BigDecimal newBaseSalary;

    @Column(name = "old_allowance", precision = 15, scale = 2)
    private BigDecimal oldAllowance;

    @Column(name = "new_allowance", precision = 15, scale = 2)
    private BigDecimal newAllowance;

    @Column(name = "effective_month", nullable = false, length = 7)
    private String effectiveMonth; // YYYY-MM

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING_FINANCE_APPLY"; // PENDING_FINANCE_APPLY | APPLIED | CANCELLED

    @Column(name = "approved_by_ceo", nullable = false)
    private Long approvedByCeo;

    @Column(name = "approved_at", nullable = false)
    private LocalDateTime approvedAt;

    @Column(name = "ceo_note", columnDefinition = "TEXT")
    private String ceoNote;

    @Column(name = "applied_by")
    private Long appliedBy;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "finance_note", columnDefinition = "TEXT")
    private String financeNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
