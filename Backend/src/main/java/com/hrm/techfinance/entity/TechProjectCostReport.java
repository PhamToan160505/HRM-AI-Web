package com.hrm.techfinance.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "tech_project_cost_reports",
        uniqueConstraints = @UniqueConstraint(name = "uk_tech_cost_month_dept", columnNames = {"report_month", "department_id"})
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProjectCostReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_month", nullable = false, length = 7)
    private String reportMonth; // YYYY-MM

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "SUBMITTED"; // SUBMITTED | CONFIRMED | DISPUTED

    @Column(name = "total_approved_hours", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalApprovedHours = BigDecimal.ZERO;

    @Column(name = "total_billable_hours", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalBillableHours = BigDecimal.ZERO;

    @Column(name = "total_internal_hours", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalInternalHours = BigDecimal.ZERO;

    @Column(name = "total_man_days", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalManDays = BigDecimal.ZERO;

    @Column(name = "total_labor_cost", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalLaborCost = BigDecimal.ZERO;

    @Column(name = "pending_worklogs_at_submit", nullable = false)
    @Builder.Default
    private Integer pendingWorklogsAtSubmit = 0;

    @Column(name = "project_breakdown_json", columnDefinition = "JSON")
    private String projectBreakdownJson;

    @Column(name = "engineer_breakdown_json", columnDefinition = "JSON")
    private String engineerBreakdownJson;

    @Column(name = "submitted_by", nullable = false)
    private Long submittedBy;

    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt;

    @Column(name = "submit_note", columnDefinition = "TEXT")
    private String submitNote;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "accounting_voucher_no", length = 100)
    private String accountingVoucherNo;

    @Column(name = "finance_note", columnDefinition = "TEXT")
    private String financeNote;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
