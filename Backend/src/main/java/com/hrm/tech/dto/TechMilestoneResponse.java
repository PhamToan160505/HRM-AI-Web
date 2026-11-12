package com.hrm.tech.dto;

import com.hrm.tech.entity.MilestoneStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechMilestoneResponse {
    private Long id;
    private Long projectId;
    private String projectCode;
    private String projectName;
    private String title;
    private String description;
    private LocalDate dueDate;
    private LocalDateTime completedAt;
    private MilestoneStatus status;
    private Integer weightPercent;
    private Integer completionPercent;
    private String deliverableUrl;
    private Long createdBy;
    private String createdByName;
    private Boolean isOverdue;
    private Boolean isDueSoon;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

