package com.hrm.tech.dto;

import com.hrm.tech.entity.ProficiencyLevel;
import com.hrm.tech.entity.SkillCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserSkillResponse {
    private Long id;
    private Long userId;
    private Long skillId;
    private String skillName;
    private SkillCategory category;
    private ProficiencyLevel proficiencyLevel;
    private Double yearsOfExperience;
    private Boolean isVerified;
    private Long verifiedBy;
    private String verifierName;
    private LocalDateTime verifiedAt;
    private String highlightProject;
    private String iconName;
}

