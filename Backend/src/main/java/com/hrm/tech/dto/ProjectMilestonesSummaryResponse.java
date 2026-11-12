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
public class ProjectMilestonesSummaryResponse {
    private Long projectId;
    private String projectCode;
    private String projectName;
    private Integer actualProgressPercent;
    private Integer totalWeightPercent;
    private Integer remainingWeightPercent;
    private Integer totalCount;
    private Integer completedCount;
    private Integer overdueCount;
    private Integer dueSoonCount;
    private List<TechMilestoneResponse> milestones;
}

