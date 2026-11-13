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
public class TechMyPerformanceOverviewResponse {
    private List<TechPerformanceReviewResponse> reviews;
    private List<TechCareerEventResponse> careerTimeline;
    private TechTelemetryBreakdownResponse currentMonthTelemetryPreview;
    private Long pendingSelfReviewCount;
    private Long approvedReviewCount;
    private Double latestFinalScore;
    private String latestFinalGrade;
    private Integer expiringCertificatesCount;
}
