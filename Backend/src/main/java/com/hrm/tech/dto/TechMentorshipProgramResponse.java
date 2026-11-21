package com.hrm.tech.dto;

import com.hrm.tech.entity.TechMentorshipStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechMentorshipProgramResponse {
    private Long id;
    private Long departmentId;
    private Long mentorId;
    private String mentorName;
    private String mentorEmail;
    private Long menteeId;
    private String menteeName;
    private String menteeEmail;
    private Long focusSkillId;
    private String focusSkillName;
    private String programTitle;
    private String targetGoal;
    private LocalDate startDate;
    private LocalDate endDate;
    private TechMentorshipStatus status;
    private String finalAssessment;
    private Boolean graduationProposed;
    private String mentorSummary;
    private LocalDateTime graduationProposedAt;
    private Long createdBy;
    private LocalDateTime createdAt;
    private Long checkinCount;
    private Double averageRating;
}

