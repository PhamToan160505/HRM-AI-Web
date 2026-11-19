package com.hrm.tech.dto;

import com.hrm.tech.entity.TechEnvironmentStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechEnvironmentRequest {
    @NotBlank(message = "Mã môi trường không được để trống (ví dụ: DEV, STAGING, PROD)")
    private String envName;

    @NotBlank(message = "Tên hiển thị môi trường không được để trống")
    private String displayName;

    private String accessUrl;
    private String gitBranch;
    private String serverHost;

    @Builder.Default
    private TechEnvironmentStatus status = TechEnvironmentStatus.ONLINE;

    private Long ownerId;
    private String notes;
}

