package com.hrm.tech.dto;

import com.hrm.tech.entity.TechEvaluationCycleStatus;
import com.hrm.tech.entity.TechReviewType;
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
public class TechEvaluationCycleResponse {
    private Long id;
    private String cycleCode;
    private String title;
    private TechReviewType reviewType;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private LocalDate selfReviewDeadline;
    private TechEvaluationCycleStatus status;
    private Long departmentId;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private Long totalReviews;
    private Long selfReviewSubmittedCount;
    private Integer selfReviewRatePercent;
    private Long approvedCount;
    private Integer approvedRatePercent;
    private Long pendingActionCount;
}
