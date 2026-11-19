package com.hrm.tech.dto;

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
public class TechMentorshipCheckinResponse {
    private Long id;
    private Long programId;
    private LocalDate checkinDate;
    private String topicsCovered;
    private Integer progressRating;
    private String mentorFeedback;
    private String menteeNotes;
    private Long loggedBy;
    private String loggedByName;
    private LocalDateTime createdAt;
}

