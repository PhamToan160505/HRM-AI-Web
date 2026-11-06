package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectRole;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AddProjectMemberRequest {

    @NotNull(message = "Vui lòng chọn nhân viên")
    private Long userId;

    @NotNull(message = "Vui lòng chọn vai trò trong dự án")
    private ProjectRole projectRole;

    @NotNull(message = "Vui lòng nhập tỷ lệ phân bổ (%)")
    @Min(value = 5, message = "Tỷ lệ phân bổ tối thiểu là 5%")
    @Max(value = 200, message = "Tỷ lệ phân bổ tối đa là 200%")
    private Integer allocationPercent = 100;

    private LocalDate joinedAt;
}

