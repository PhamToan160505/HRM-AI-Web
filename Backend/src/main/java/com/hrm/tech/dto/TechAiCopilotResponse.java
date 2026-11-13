package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechAiCopilotResponse {
    private Long reviewId;
    private String strengths;
    private String growthAreas;
    private String roadmap90Days;
    private String formattedSummary;
    private Boolean generatedByAi;
    private LocalDateTime generatedAt;
}
