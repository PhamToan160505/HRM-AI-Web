package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechDodItemResponse {
    private Long id;
    private Long milestoneId;
    private String title;
    private String description;
    private Boolean isRequired;
    private Boolean isCompleted;
    private Long completedBy;
    private String completedByName;
    private LocalDateTime completedAt;
    private String notes;
    private LocalDateTime createdAt;
}

