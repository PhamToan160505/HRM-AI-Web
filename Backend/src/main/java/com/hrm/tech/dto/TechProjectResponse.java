package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.entity.ProjectType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProjectResponse {
    private Long id;
    private String projectCode;
    private String projectName;
    private ProjectType projectType;
    private ProjectStatus status;
    private List<String> techStack;
    private LocalDate startDate;
    private LocalDate endDate;
    private String gitRepoUrl;
    private String jiraUrl;
    private String figmaUrl;
    private String description;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<TechProjectMemberResponse> members;
    private String techLeadName;
    private Integer totalMembersCount;
    private Integer totalAllocationSum;
    private Integer actualProgressPercent;
    private Integer milestonesCount;
    private Integer completedMilestonesCount;
    private Integer overdueMilestonesCount;
    private Integer dueSoonMilestonesCount;
    private Double totalApprovedHours;
    private Double totalPendingHours;
}

