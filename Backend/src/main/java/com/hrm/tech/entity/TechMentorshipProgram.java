package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tech_mentorship_programs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechMentorshipProgram {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "mentor_id", nullable = false)
    private Long mentorId;

    @Column(name = "mentee_id", nullable = false)
    private Long menteeId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_skill_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private TechSkill focusSkill;

    @Column(name = "program_title", nullable = false)
    private String programTitle;

    @Column(name = "target_goal", nullable = false, length = 500)
    private String targetGoal;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private TechMentorshipStatus status = TechMentorshipStatus.ACTIVE;

    @Column(name = "final_assessment", columnDefinition = "TEXT")
    private String finalAssessment;

    @Column(name = "graduation_proposed", nullable = false)
    @Builder.Default
    private Boolean graduationProposed = false;

    @Column(name = "mentor_summary", columnDefinition = "TEXT")
    private String mentorSummary;

    @Column(name = "graduation_proposed_at")
    private LocalDateTime graduationProposedAt;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}

