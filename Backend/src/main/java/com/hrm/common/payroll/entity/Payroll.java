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

    // DRAFT, PENDING_DIRECTOR, PENDING_CHIEF_ACCOUNTANT, PENDING_CEO, APPROVED_BY_CEO, PAID, REJECTED
    // (APPROVED và các trạng thái MANAGER_* là dữ liệu của luồng cũ)
    @Column(name = "status", nullable = false)
    private String status;

    /** Kỳ lương phòng ban chứa phiếu này (payroll_reports.id, report_level = DEPARTMENT). */
    @Column(name = "payroll_report_id")
    private Long payrollReportId;

    /** Phòng ban của nhân viên tại thời điểm tính lương. */
    @Column(name = "department_id")
    private Long departmentId;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    /** Khoản hoàn ứng chứng chỉ quốc tế gộp kỳ lương (miễn thuế TNCN, không tính vào BHXH) — enrich khi trả API. */
    @Transient
    private Double certReimbursementAmount;

    /** Mô tả chứng chỉ hoàn ứng gộp kỳ lương (tên chứng chỉ / mã chứng từ) — enrich khi trả API. */
    @Transient
    private String certReimbursementSummary;

    /** Tổng số tiền nhân viên thực nhận gồm lương Net + hoàn ứng chứng chỉ miễn thuế (nếu có). */
    @Transient
    private Double totalPayoutAmount;

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
