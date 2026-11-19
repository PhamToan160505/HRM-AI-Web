package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "tech_mentorship_checkins")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechMentorshipCheckin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "program_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private TechMentorshipProgram program;

    @Column(name = "checkin_date", nullable = false)
    private LocalDate checkinDate;

    @Column(name = "topics_covered", nullable = false, columnDefinition = "TEXT")
    private String topicsCovered;

    @Column(name = "progress_rating", nullable = false)
    @Builder.Default
    private Integer progressRating = 3;

    @Column(name = "mentor_feedback", columnDefinition = "TEXT")
    private String mentorFeedback;

    @Column(name = "mentee_notes", columnDefinition = "TEXT")
    private String menteeNotes;

    @Column(name = "logged_by", nullable = false)
    private Long loggedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}

