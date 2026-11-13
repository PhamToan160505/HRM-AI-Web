package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tech_evaluation_cycles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechEvaluationCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cycle_code", nullable = false, unique = true, length = 40)
    private String cycleCode;

    @Column(name = "title", nullable = false, length = 180)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_type", nullable = false, length = 20)
    @Builder.Default
    private TechReviewType reviewType = TechReviewType.QUARTERLY;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "self_review_deadline")
    private LocalDate selfReviewDeadline;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TechEvaluationCycleStatus status = TechEvaluationCycleStatus.OPEN;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
