package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyWorklogSummaryResponse {
    private String month;
    private Double totalApprovedHours;
    private Double totalPendingHours;
    private Double totalRejectedHours;
    private Double currentMonthApprovedHours;
    private Double currentMonthPendingHours;
    private Double currentWeekHours;
    private Double billableApprovedHours;
    private Integer billablePercent;
    private Double currentMonthManDays;
    private List<TechWorklogResponse> worklogs;
}

