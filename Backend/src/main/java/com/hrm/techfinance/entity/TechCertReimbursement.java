package com.hrm.techfinance.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "tech_cert_reimbursements")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechCertReimbursement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "certificate_id", nullable = false)
    private Long certificateId;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "certificate_name", nullable = false, length = 200)
    private String certificateName;

    @Column(name = "issuing_organization", nullable = false, length = 150)
    private String issuingOrganization;

    @Column(name = "exam_fee_vnd", nullable = false, precision = 15, scale = 2)
    private BigDecimal examFeeVnd;

    @Column(name = "requested_amount_vnd", nullable = false, precision = 15, scale = 2)
    private BigDecimal requestedAmountVnd;

    @Column(name = "approved_amount_vnd", precision = 15, scale = 2)
    private BigDecimal approvedAmountVnd;

    @Column(name = "support_percent", nullable = false)
    @Builder.Default
    private Integer supportPercent = 100;

    @Column(name = "invoice_number", length = 100)
    private String invoiceNumber;

    @Column(name = "receipt_url", length = 500)
    private String receiptUrl;

    @Column(name = "commitment_months", nullable = false)
    @Builder.Default
    private Integer commitmentMonths = 0;

    @Column(name = "employee_note", columnDefinition = "TEXT")
    private String employeeNote;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "SUBMITTED"; // SUBMITTED | TECH_APPROVED | FINANCE_APPROVED | DISBURSED | REJECTED

    @Column(name = "tech_reviewer_id")
    private Long techReviewerId;

    @Column(name = "tech_reviewed_at")
    private LocalDateTime techReviewedAt;

    @Column(name = "tech_note", columnDefinition = "TEXT")
    private String techNote;

    @Column(name = "finance_approver_id")
    private Long financeApproverId;

    @Column(name = "finance_approved_at")
    private LocalDateTime financeApprovedAt;

    @Column(name = "finance_note", columnDefinition = "TEXT")
    private String financeNote;

    @Column(name = "payout_method", length = 30)
    private String payoutMethod; // BANK_TRANSFER | NEXT_PAYROLL

    @Column(name = "payout_payroll_month", length = 7)
    private String payoutPayrollMonth; // YYYY-MM

    @Column(name = "payment_reference", length = 100)
    private String paymentReference;

    @Column(name = "disbursed_by")
    private Long disbursedBy;

    @Column(name = "disbursed_at")
    private LocalDateTime disbursedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
