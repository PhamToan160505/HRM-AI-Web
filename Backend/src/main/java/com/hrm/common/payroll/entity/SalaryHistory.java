package com.hrm.common.payroll.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "salary_history")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SalaryHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "changed_by")
    private Long changedBy;

    @Column(name = "old_base_salary")
    private Double oldBaseSalary;

    @Column(name = "new_base_salary")
    private Double newBaseSalary;

    @Column(name = "old_allowance")
    private Double oldAllowance;

    @Column(name = "new_allowance")
    private Double newAllowance;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "change_date")
    private LocalDateTime changeDate;
}
