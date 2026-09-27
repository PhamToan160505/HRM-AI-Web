package com.hrm.configuration.entity;

import com.hrm.exception.AppException;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "scoring_profiles", uniqueConstraints =
        @UniqueConstraint(name = "uk_scoring_profile_version", columnNames = {"profile_code", "version_number"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ScoringProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "profile_code", nullable = false, length = 80)
    private String profileCode;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "display_name", nullable = false, length = 180)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScoringProfileStatus status;

    @Column(name = "effective_from", nullable = false)
    private LocalDateTime effectiveFrom;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "change_reason", nullable = false, length = 500)
    private String changeReason;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "activated_at")
    private LocalDateTime activatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    private ScoringProfile(
            String profileCode,
            Integer versionNumber,
            String displayName,
            LocalDateTime effectiveFrom,
            Long createdBy,
            String changeReason) {
        this.profileCode = profileCode;
        this.versionNumber = versionNumber;
        this.displayName = displayName;
        this.status = ScoringProfileStatus.DRAFT;
        this.effectiveFrom = effectiveFrom;
        this.createdBy = createdBy;
        this.changeReason = changeReason;
    }

    public static ScoringProfile draft(
            String profileCode,
            Integer versionNumber,
            String displayName,
            LocalDateTime effectiveFrom,
            Long createdBy,
            String changeReason) {
        if (changeReason == null || changeReason.isBlank()) {
            throw AppException.badRequest("Lý do tạo phiên bản scoring profile là bắt buộc");
        }
        return new ScoringProfile(profileCode, versionNumber, displayName, effectiveFrom, createdBy, changeReason);
    }

    public void activate(LocalDateTime activatedAt) {
        if (status != ScoringProfileStatus.DRAFT) {
            throw AppException.conflict("Chỉ scoring profile DRAFT mới có thể kích hoạt");
        }
        this.status = ScoringProfileStatus.ACTIVE;
        this.activatedAt = activatedAt;
    }

    public void retire() {
        if (status == ScoringProfileStatus.ACTIVE) {
            this.status = ScoringProfileStatus.RETIRED;
        }
    }
}
