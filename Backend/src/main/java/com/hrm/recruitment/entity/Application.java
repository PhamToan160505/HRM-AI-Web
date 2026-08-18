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

    @Column(nullable = false)
    private String decisionStatus; // PENDING, APPROVED, REJECTED, NEEDS_VERIFICATION, PENDING_AI_REVIEW

    @Column(columnDefinition = "JSON")
    private String extractedData; // Chứa kết quả OCR và confidence per field

    @Column(columnDefinition = "TEXT")
    private String rawCvText; // Lưu raw text CV để Trưởng phòng trigger AI sau

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
