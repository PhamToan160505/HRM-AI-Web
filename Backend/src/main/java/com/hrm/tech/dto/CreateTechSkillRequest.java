package com.hrm.tech.dto;

import com.hrm.tech.entity.SkillCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechSkillRequest {
    @NotBlank(message = "Tên kỹ năng không được để trống")
    private String skillName;

    @NotNull(message = "Vui lòng chọn danh mục kỹ năng")
    private SkillCategory category;

    private String description;
    private String iconName;
}

