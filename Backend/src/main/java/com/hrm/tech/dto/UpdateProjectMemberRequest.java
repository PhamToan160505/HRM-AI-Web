package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectRole;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class UpdateProjectMemberRequest {

    private ProjectRole projectRole;

    @Min(value = 5, message = "Tỷ lệ phân bổ tối thiểu là 5%")
    @Max(value = 200, message = "Tỷ lệ phân bổ tối đa là 200%")
    private Integer allocationPercent;

    private Boolean isActive;
}

