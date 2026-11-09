package com.hrm.tech.dto;

import com.hrm.tech.entity.ProficiencyLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillMatchRequest {
    private List<Long> skillIds;
    private ProficiencyLevel minProficiencyLevel;
    private Boolean benchOnly;
    private Boolean strictLevel;
}

