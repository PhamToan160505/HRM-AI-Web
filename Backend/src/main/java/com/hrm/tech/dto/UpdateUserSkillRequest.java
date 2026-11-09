package com.hrm.tech.dto;

import com.hrm.tech.entity.ProficiencyLevel;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserSkillRequest {
    @NotNull(message = "Vui lòng chọn cấp độ thành thạo")
    private ProficiencyLevel proficiencyLevel;

    @DecimalMin(value = "0.0", message = "Số năm kinh nghiệm không được âm")
    @DecimalMax(value = "40.0", message = "Số năm kinh nghiệm không hợp lệ (tối đa không quá 40 năm)")
    private Double yearsOfExperience;

    private String highlightProject;
}

