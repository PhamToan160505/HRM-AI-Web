package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "screening_criteria_sets", uniqueConstraints =
        @UniqueConstraint(name = "uk_criteria_set_version", columnNames = {"posting_id", "version_number"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ScreeningCriteriaSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "posting_id", nullable = false)
    private Long postingId;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScreeningCriteriaSetStatus status;

    @Column(name = "criteria_snapshot", nullable = false, columnDefinition = "json")
    private String criteriaSnapshot;

    @Column(name = "content_hash", nullable = false, length = 64, columnDefinition = "char(64)")
    private String contentHash;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "confirmed_by")
    private Long confirmedBy;

    @Column(name = "change_reason", nullable = false, length = 500)
    private String changeReason;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    public static ScreeningCriteriaSet confirmed(
            Long postingId,
            int versionNumber,
            String criteriaSnapshot,
            String contentHash,
            Long actorId,
            String reason) {
        ScreeningCriteriaSet criteriaSet = new ScreeningCriteriaSet();
        criteriaSet.postingId = postingId;
        criteriaSet.versionNumber = versionNumber;
        criteriaSet.status = ScreeningCriteriaSetStatus.CONFIRMED;
        criteriaSet.criteriaSnapshot = criteriaSnapshot;
        criteriaSet.contentHash = contentHash;
        criteriaSet.createdBy = actorId;
        criteriaSet.confirmedBy = actorId;
        criteriaSet.changeReason = reason;
        criteriaSet.confirmedAt = LocalDateTime.now();
        return criteriaSet;
    }
}
