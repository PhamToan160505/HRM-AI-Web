package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechPerformanceAnalyticsResponse {
    private Long cycleId;
    private String cycleCode;
    private String cycleTitle;
    private Long totalReviews;
    private Long selfReviewSubmittedCount;
    private Long managerReviewPendingCount;
    private Long directorApprovalPendingCount;
    private Long approvedCount;
    private Integer completionRatePercent;

    private Double avgTelemetryScore;
    private Double avgManagerQualScore;
    private Double avgFinalScore;

    // Trung bình 4 trụ cột toàn phòng
    private Double avgDeliveryScore;
    private Double avgImpactScore;
    private Double avgCapabilityScore;
    private Double avgDisciplineScore;

    // Phân bố xếp loại S/A/B/C/D
    private Map<String, Long> gradeDistribution;
    private List<GradeBucket> gradeBuckets;

    // Đề xuất nâng bậc & đãi ngộ
    private Long pendingSkillPromotionsCount;
    private Long approvedSkillPromotionsCount;
    private Long pendingCompensationProposalsCount;

    // Chứng chỉ sắp hết hạn / hết hạn
    private Long expiringCertificatesCount;
    private Long expiredCertificatesCount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GradeBucket {
        private String grade;
        private String label;
        private Long count;
    }
}
