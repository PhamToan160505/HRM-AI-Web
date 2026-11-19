package com.hrm.tech.dto;

import com.hrm.tech.entity.TechMentorshipStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTechMentorshipRequest {
    private String programTitle;
    private String targetGoal;
    private Long focusSkillId;
    private LocalDate endDate;
    private TechMentorshipStatus status;
    private String finalAssessment;
}

