package com.hrm.tech.dto;

import com.hrm.tech.entity.TechDeploymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechDeploymentLogResponse {
    private Long id;
    private Long environmentId;
    private String envName;
    private String envDisplayName;
    private String versionTag;
    private String commitHash;
    private TechDeploymentStatus status;
    private String changelog;
    private Long deployedBy;
    private String deployedByName;
    private LocalDateTime deployedAt;
}

