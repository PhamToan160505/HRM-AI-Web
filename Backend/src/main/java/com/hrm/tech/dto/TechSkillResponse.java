package com.hrm.tech.dto;

import com.hrm.tech.entity.SkillCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechSkillResponse {
    private Long id;
    private String skillName;
    private SkillCategory category;
    private String description;
    private String iconName;
}

