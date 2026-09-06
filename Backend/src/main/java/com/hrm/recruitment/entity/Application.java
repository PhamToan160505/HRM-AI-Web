package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "applications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_posting_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private JobPosting jobPosting;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String phone;

    @Column
    private String cvUrl;

    @Column
    private String cccdUrl;

    @Column
    private Integer fitScore;

    @Column(nullable = false)
    private Boolean fraudFlagged;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ApplicationStatus approvalStatus; // Dùng Enum State Machine

    @Column(nullable = false)
    private Boolean needsVerification = false;

    @Column(nullable = false)
    private Boolean isPriority = false;

    @Column(columnDefinition = "JSON")
    private String extractedData; // Chứa kết quả OCR và confidence per field

    @Column(columnDefinition = "TEXT")
    private String rawCvText; // Lưu raw text CV để Trưởng phòng trigger AI sau

    @Column(columnDefinition = "TEXT")
    private String hrReviewFeedback;
    @Column(length = 150)
    private String hrReviewer;

    @Column(columnDefinition = "TEXT")
    private String techReviewFeedback;
    @Column(length = 150)
    private String techReviewer;

    @Column(columnDefinition = "TEXT")
    private String interview1Feedback;
    @Column(length = 150)
    private String interview1Reviewer;

    @Column(columnDefinition = "TEXT")
    private String interview2Feedback;
    @Column(length = 150)
    private String interview2Reviewer;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(length = 150)
    private String rejectorName;

    @Column(columnDefinition = "TEXT")
    private String offerDetails;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
