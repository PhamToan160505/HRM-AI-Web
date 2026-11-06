package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.entity.ProjectType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class UpdateProjectRequest {

    @NotBlank(message = "Tên dự án không được để trống")
    private String projectName;

    private String projectCode;

    private ProjectType projectType;

    private ProjectStatus status;

    private List<String> techStack;

    private LocalDate startDate;

    private LocalDate endDate;

    private String gitRepoUrl;

    private String jiraUrl;

    private String figmaUrl;

    private String description;
}

