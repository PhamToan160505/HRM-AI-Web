package com.hrm.tech.dto;

import com.hrm.tech.entity.TechEnvironmentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProjectEnvironmentResponse {
    private Long id;
    private Long projectId;
    private String envName;
    private String displayName;
    private String accessUrl;
    private String gitBranch;
    private String serverHost;
    private TechEnvironmentStatus status;
    private Long ownerId;
    private String ownerName;
    private String notes;
    private LocalDateTime updatedAt;
    private Long deploymentCount;
    private String latestVersionTag;
    private LocalDateTime latestDeployedAt;
}

