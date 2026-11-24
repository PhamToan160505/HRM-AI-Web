package com.hrm.techfinance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class TechFinanceDtos {

    private TechFinanceDtos() {}

    // ─── OVERVIEW ─────────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinanceTechOverviewResponse {
        private long pendingBudgetRequisitionsCount;
        private long submittedCostReportsCount;
        private long confirmedCostReportsCount;
        private long pendingCompensationSyncsCount;
        private long pendingCertReimbursementsCount; // TECH_APPROVED waiting Finance
        private long approvedCertAwaitingDisbursementCount; // FINANCE_APPROVED waiting Disbursement
        private BigDecimal totalDisbursedCertVnd;
        private BigDecimal totalSubmittedLaborCostVnd;
    }

    // ─── MODULE F2: PROJECT COSTING & WORKLOG RECONCILIATION ─────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UpdateProjectBudgetRequest {
        private BigDecimal budgetAmount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SubmitProjectCostReportRequest {
        private String reportMonth; // YYYY-MM
        private String submitNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReviewProjectCostReportRequest {
        private String decision; // CONFIRMED | DISPUTED
        private String accountingVoucherNo;
        private String financeNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectCostLineItem {
        private Long projectId;
        private String projectCode;
        private String projectName;
        private String projectType; // INTERNAL | CLIENT | PRODUCT ...
        private double approvedHours;
        private double billableHours;
        private double internalHours;
        private double manDays;
        private double fte;
        private BigDecimal estimatedLaborCost; // null if masked by B-10
        private BigDecimal projectBudgetAmount; // null if masked by B-10
        private Double budgetUtilizationPercent; // null if no budget or masked
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EngineerCostLineItem {
        private Long userId;
        private String employeeCode;
        private String fullName;
        private String position;
        private double approvedHours;
        private double billableHours;
        private double internalHours;
        private double manDays;
        private BigDecimal estimatedLaborCost; // null if masked by B-10
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectCostReportResponse {
        private Long id;
        private String reportMonth;
        private Long departmentId;
        private String departmentName;
        private String status; // SUBMITTED | CONFIRMED | DISPUTED
        private double totalApprovedHours;
        private double totalBillableHours;
        private double totalInternalHours;
        private double billableRatioPercent;
        private double totalManDays;
        private BigDecimal totalLaborCost; // null if masked by B-10
        private int pendingWorklogsAtSubmit;
        private boolean costVisible;
        private String payrollBatchStatus; // Cross-check with Finance Payroll
        private BigDecimal payrollTotalNetSalary; // Cross-check (Finance/CEO only)
        private List<ProjectCostLineItem> projectBreakdowns;
        private List<EngineerCostLineItem> engineerBreakdowns;
        private Long submittedBy;
        private String submittedByName;
        private LocalDateTime submittedAt;
        private String submitNote;
        private Long reviewedBy;
        private String reviewedByName;
        private LocalDateTime reviewedAt;
        private String accountingVoucherNo;
        private String financeNote;
    }

    // ─── MODULE F3: COMPENSATION SYNC & PAYROLL PERIOD LOCK ──────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PayrollLockHintResponse {
        private Long departmentId;
        private String requestedMonth;
        private boolean locked;
        private String payrollStatus;
        private String suggestedEffectiveMonth;
        private String message;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ApplyCompensationSyncRequest {
        private String financeNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompensationSyncResponse {
        private Long id;
        private Long reviewId;
        private Long employeeId;
        private String employeeCode;
        private String employeeName;
        private String employeeEmail;
        private Long departmentId;
        private String departmentName;
        private String oldTitle;
        private String newTitle;
        private BigDecimal oldBaseSalary;
        private BigDecimal newBaseSalary;
        private BigDecimal oldAllowance;
        private BigDecimal newAllowance;
        private String effectiveMonth;
        private String status; // PENDING_FINANCE_APPLY | APPLIED | CANCELLED
        private boolean effectivePeriodLockedForSubmit;
        private String effectivePeriodPayrollStatus;
        private Long approvedByCeo;
        private String approvedByCeoName;
        private LocalDateTime approvedAt;
        private String ceoNote;
        private Long appliedBy;
        private String appliedByName;
        private LocalDateTime appliedAt;
        private String financeNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PayrollFinanceBannerResponse {
        private String periodMonth; // YYYY-MM
        private int pendingSalarySyncsCount;
        private List<CompensationSyncResponse> pendingSalarySyncs;
        private int payrollCertReimbursementsCount;
        private BigDecimal totalPayrollCertReimbursementsVnd;
        private List<CertReimbursementResponse> payrollCertReimbursements;
        private int submittedCostReportsCount;
    }

    // ─── MODULE F4: CERTIFICATION REIMBURSEMENT ──────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateCertReimbursementRequest {
        private Long certificateId;
        private BigDecimal examFeeVnd;
        private BigDecimal requestedAmountVnd;
        private Integer supportPercent;
        private String invoiceNumber;
        private String receiptUrl;
        private Integer commitmentMonths;
        private String employeeNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechReviewCertReimbursementRequest {
        private String decision; // APPROVED | REJECTED
        private String note;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinanceDecisionCertReimbursementRequest {
        private String decision; // APPROVED | REJECTED
        private BigDecimal approvedAmountVnd;
        private String payoutMethod; // BANK_TRANSFER | NEXT_PAYROLL
        private String payoutPayrollMonth; // YYYY-MM (required when NEXT_PAYROLL)
        private String financeNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DisburseCertReimbursementRequest {
        private String paymentReference;
        private String financeNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CertReimbursementResponse {
        private Long id;
        private Long certificateId;
        private Long employeeId;
        private String employeeCode;
        private String employeeName;
        private String employeePosition;
        private Long departmentId;
        private String departmentName;
        private String certificateName;
        private String issuingOrganization;
        private String credentialId;
        private String credentialUrl;
        private BigDecimal examFeeVnd;
        private BigDecimal requestedAmountVnd;
        private BigDecimal approvedAmountVnd;
        private Integer supportPercent;
        private String invoiceNumber;
        private String receiptUrl;
        private Integer commitmentMonths;
        private String employeeNote;
        private String status; // SUBMITTED | TECH_APPROVED | FINANCE_APPROVED | DISBURSED | REJECTED
        private Long techReviewerId;
        private String techReviewerName;
        private LocalDateTime techReviewedAt;
        private String techNote;
        private Long financeApproverId;
        private String financeApproverName;
        private LocalDateTime financeApprovedAt;
        private String financeNote;
        private String payoutMethod;
        private String payoutPayrollMonth;
        private String paymentReference;
        private Long disbursedBy;
        private String disbursedByName;
        private LocalDateTime disbursedAt;
        private String rejectionReason;
        private LocalDateTime createdAt;
    }
}
