package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechSmartMentorSuggestionResponse {
    private Long menteeId;
    private String menteeName;
    private Long skillId;
    private String skillName;
    private String menteeLevel;
    private List<MentorCandidateDto> suggestedMentors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MentorCandidateDto {
        private Long mentorId;
        private String mentorName;
        private String mentorEmail;
        private String mentorLevel;
        private Double yearsExperience;
        private Integer activeMentorshipsCount;
        private String recommendationReason;
    }
}

