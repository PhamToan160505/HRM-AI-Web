package com.hrm.common.payroll.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentPayrollSummary {
    private Long departmentId;
    private String departmentName;
    private int totalEmployees;
    private double totalGrossSalary;
    private String status;
}
