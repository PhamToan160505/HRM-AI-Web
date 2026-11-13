package com.hrm.tech.dto;

import com.hrm.tech.entity.ProficiencyLevel;
import com.hrm.tech.entity.SkillCategory;
import com.hrm.tech.entity.TechPromotionItemStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechSkillPromotionItemDto {
    private Long id;
    private Long userTechSkillId;
    private Long skillId;
    private String skillName;
    private SkillCategory category;
    private ProficiencyLevel fromLevel;
    private ProficiencyLevel targetLevel;
    private String evidenceNote;
    private String evidenceUrl;
    private TechPromotionItemStatus status;
    private String reviewerNote;
    private LocalDateTime appliedAt;
}
