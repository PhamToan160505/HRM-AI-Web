package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "tech_skill_promotion_items",
    uniqueConstraints = @UniqueConstraint(name = "uk_review_skill_item", columnNames = {"review_id", "skill_id"})
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechSkillPromotionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private TechPerformanceReview review;

    @Column(name = "user_tech_skill_id")
    private Long userTechSkillId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "skill_id", nullable = false)
    private TechSkill skill;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_level", length = 20)
    private ProficiencyLevel fromLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_level", nullable = false, length = 20)
    private ProficiencyLevel targetLevel;

    @Column(name = "evidence_note", nullable = false, length = 500)
    private String evidenceNote;

    @Column(name = "evidence_url", length = 500)
    private String evidenceUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TechPromotionItemStatus status = TechPromotionItemStatus.PENDING;

    @Column(name = "reviewer_note", length = 300)
    private String reviewerNote;

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;
}
