package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "tech_performance_reviews",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_tech_review_emp_period",
        columnNames = {"employee_id", "review_type", "period_start", "period_end"}
    )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechPerformanceReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cycle_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private TechEvaluationCycle cycle;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_type", nullable = false, length = 20)
    @Builder.Default
    private TechReviewType reviewType = TechReviewType.QUARTERLY;

    @Column(name = "period_label", nullable = false, length = 50)
    private String periodLabel;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    // Telemetry tự động (tổng max 100)
    @Column(name = "delivery_score", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal deliveryScore = BigDecimal.ZERO;

    @Column(name = "impact_score", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal impactScore = BigDecimal.ZERO;

    @Column(name = "capability_score", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal capabilityScore = BigDecimal.ZERO;

    @Column(name = "discipline_score", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal disciplineScore = BigDecimal.ZERO;

    @Column(name = "telemetry_total_score", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal telemetryTotalScore = BigDecimal.ZERO;

    @Column(name = "telemetry_snapshot_json", columnDefinition = "json")
    private String telemetrySnapshotJson;

    // Tự đánh giá của Kỹ sư (Self-Review)
    @Column(name = "self_summary", columnDefinition = "TEXT")
    private String selfSummary;

    @Column(name = "self_achievements", columnDefinition = "TEXT")
    private String selfAchievements;

    @Column(name = "self_challenges", columnDefinition = "TEXT")
    private String selfChallenges;

    @Column(name = "self_goals_next", columnDefinition = "TEXT")
    private String selfGoalsNext;

    @Column(name = "self_rating_score", precision = 5, scale = 2)
    private BigDecimal selfRatingScore;

    @Column(name = "self_submitted_at")
    private LocalDateTime selfSubmittedAt;

    // Đánh giá định tính của Quản lý (4 tiêu chí x 25 = 100)
    @Column(name = "evaluator_id")
    private Long evaluatorId;

    @Column(name = "qual_craft_score", precision = 5, scale = 2)
    private BigDecimal qualCraftScore;

    @Column(name = "qual_ownership_score", precision = 5, scale = 2)
    private BigDecimal qualOwnershipScore;

    @Column(name = "qual_collab_score", precision = 5, scale = 2)
    private BigDecimal qualCollabScore;

    @Column(name = "qual_growth_score", precision = 5, scale = 2)
    private BigDecimal qualGrowthScore;

    @Column(name = "manager_qual_score", precision = 5, scale = 2)
    private BigDecimal managerQualScore;

    @Column(name = "manager_comment", columnDefinition = "TEXT")
    private String managerComment;

    @Column(name = "manager_feedback_goals", columnDefinition = "TEXT")
    private String managerFeedbackGoals;

    @Column(name = "ai_copilot_summary", columnDefinition = "TEXT")
    private String aiCopilotSummary;

    // Hiệu chỉnh & Kết quả cuối
    @Column(name = "calibration_delta", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal calibrationDelta = BigDecimal.ZERO;

    @Column(name = "calibration_reason", length = 500)
    private String calibrationReason;

    @Column(name = "final_score", precision = 5, scale = 2)
    private BigDecimal finalScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "final_grade", length = 5)
    private TechRatingGrade finalGrade;

    // Đề xuất Thăng chức & Điều chỉnh đãi ngộ (B-10)
    @Column(name = "recommend_promotion", nullable = false)
    @Builder.Default
    private Boolean recommendPromotion = false;

    @Column(name = "recommended_title", length = 100)
    private String recommendedTitle;

    @Column(name = "recommended_salary_increase_pct", precision = 5, scale = 2)
    private BigDecimal recommendedSalaryIncreasePct;

    @Column(name = "recommended_new_base_salary")
    private Double recommendedNewBaseSalary;

    @Column(name = "recommended_new_allowance")
    private Double recommendedNewAllowance;

    @Column(name = "compensation_reason", length = 500)
    private String compensationReason;

    @Enumerated(EnumType.STRING)
    @Column(name = "compensation_status", nullable = false, length = 25)
    @Builder.Default
    private CompensationProposalStatus compensationStatus = CompensationProposalStatus.NONE;

    // Trạng thái phê duyệt & Audit
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private TechReviewStatus status = TechReviewStatus.SELF_REVIEW_PENDING;

    @Column(name = "final_approver_id")
    private Long finalApproverId;

    @Column(name = "final_approved_at")
    private LocalDateTime finalApprovedAt;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "review", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private List<TechSkillPromotionItem> skillPromotionItems = new ArrayList<>();
}
