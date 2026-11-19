package com.hrm.tech.dto;

import com.hrm.tech.entity.TechDeploymentStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechDeploymentLogRequest {
    @NotBlank(message = "Phiên bản release không được để trống")
    private String versionTag;

    private String commitHash;

    @Builder.Default
    private TechDeploymentStatus status = TechDeploymentStatus.SUCCESS;

    private String changelog;
}

