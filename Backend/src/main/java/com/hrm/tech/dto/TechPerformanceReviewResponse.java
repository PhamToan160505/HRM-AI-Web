package com.hrm.tech.dto;

import com.hrm.common.entity.Role;
import com.hrm.tech.entity.CompensationProposalStatus;
import com.hrm.tech.entity.TechRatingGrade;
import com.hrm.tech.entity.TechReviewStatus;
import com.hrm.tech.entity.TechReviewType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechPerformanceReviewResponse {
    private Long id;
    private Long cycleId;
    private String cycleCode;
    private String cycleTitle;
    private Long departmentId;
    private TechReviewType reviewType;
    private String periodLabel;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private LocalDate selfReviewDeadline;

    // Thông tin kỹ sư được đánh giá
    private Long employeeId;
    private String hoTen;
    private String maNhanVien;
    private String email;
    private String chucVu;
    private Role employeeRole;
    private String avatarUrl;

    // Telemetry tự động
    private Double deliveryScore;
    private Double impactScore;
    private Double capabilityScore;
    private Double disciplineScore;
    private Double telemetryTotalScore;
    private TechTelemetryBreakdownResponse telemetryBreakdown;

    // Tự đánh giá
    private String selfSummary;
    private String selfAchievements;
    private String selfChallenges;
    private String selfGoalsNext;
    private Double selfRatingScore;
    private LocalDateTime selfSubmittedAt;

    // Quản lý chấm định tính
    private Long evaluatorId;
    private String evaluatorName;
    private Double qualCraftScore;
    private Double qualOwnershipScore;
    private Double qualCollabScore;
    private Double qualGrowthScore;
    private Double managerQualScore;
    private String managerComment;
    private String managerFeedbackGoals;
    private String aiCopilotSummary;
    private String aiCopilotRoadmap;

    // Hiệu chỉnh & Kết quả cuối
    private Double calibrationDelta;
    private String calibrationReason;
    private Double finalScore;
    private TechRatingGrade finalGrade;

    // Đề xuất Thăng chức & Đãi ngộ (Tuân thủ B-10 nghiêm ngặt!)
    private Boolean recommendPromotion;
    private String recommendedTitle;
    private Double recommendedSalaryIncreasePct;
    private String compensationReason;
    private CompensationProposalStatus compensationStatus;

    // B-10 STRICT MASKED FIELDS: Luôn null nếu caller không phải CEO / GIAM_DOC_PHONG_BAN
    private Double currentBaseSalary;
    private Double currentAllowance;
    private Double recommendedNewBaseSalary;
    private Double recommendedNewAllowance;

    // Quy trình & Thẩm định
    private TechReviewStatus status;
    private Boolean escalationRequired;
    private List<String> escalationReasons;
    private Long finalApproverId;
    private String finalApproverName;
    private LocalDateTime finalApprovedAt;
    private String rejectionReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private List<TechSkillPromotionItemDto> skillPromotionItems;
}
