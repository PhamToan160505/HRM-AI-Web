package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectHealthBriefResponse {
    private Long projectId;
    private String projectCode;
    private String projectName;
    private String healthTone; // HEALTHY, WARNING, CRITICAL
    private String healthLabel;
    private String headline;
    private String scheduleAssessment;
    private String capacityAssessment;
    private List<String> recommendations;
    private Boolean generatedByAi;
    private LocalDateTime generatedAt;
}

