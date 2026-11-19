package com.hrm.tech.dto;

import com.hrm.tech.entity.TechEnvironmentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTechEnvironmentRequest {
    private String displayName;
    private String accessUrl;
    private String gitBranch;
    private String serverHost;
    private TechEnvironmentStatus status;
    private Long ownerId;
    private String notes;
}

