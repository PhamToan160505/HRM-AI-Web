package com.hrm.ai.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_analyses")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_id", nullable = false)
    private Long applicationId;

    @Column(name = "criteria_version_id", nullable = false)
    private Long criteriaVersionId;

    @Column(name = "scoring_profile_version_id", nullable = false)
    private Long scoringProfileVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AiAnalysisStatus status;

    @Column(name = "claim_coverage", precision = 5, scale = 2)
    private BigDecimal claimCoverage;

    @Column(name = "evidence_score", precision = 5, scale = 2)
    private BigDecimal evidenceScore;

    @Column(name = "result_payload", columnDefinition = "LONGTEXT")
    private String resultPayload;

    @Column(name = "model_output", columnDefinition = "LONGTEXT")
    private String modelOutput;

    @Column(name = "computed_result", columnDefinition = "LONGTEXT")
    private String computedResult;

    @Column(name = "model_name", nullable = false, length = 120)
    private String modelName;

    @Column(name = "prompt_version", nullable = false, length = 80)
    private String promptVersion;

    @Column(name = "input_hash", nullable = false, length = 64, columnDefinition = "char(64)")
    private String inputHash;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    public static AiAnalysis queued(
            Long applicationId,
            Long criteriaVersionId,
            Long scoringProfileVersionId,
            String modelName,
            String promptVersion,
            String inputHash) {
        AiAnalysis analysis = new AiAnalysis();
        analysis.applicationId = applicationId;
        analysis.criteriaVersionId = criteriaVersionId;
        analysis.scoringProfileVersionId = scoringProfileVersionId;
        analysis.status = AiAnalysisStatus.QUEUED;
        analysis.modelName = modelName;
        analysis.promptVersion = promptVersion;
        analysis.inputHash = inputHash;
        return analysis;
    }

    public static AiAnalysis skippedNoConsent(
            Long applicationId,
            Long criteriaVersionId,
            Long scoringProfileVersionId,
            String modelName,
            String promptVersion,
            String inputHash) {
        AiAnalysis analysis = queued(applicationId, criteriaVersionId, scoringProfileVersionId,
                modelName, promptVersion, inputHash);
        analysis.status = AiAnalysisStatus.SKIPPED_NO_CONSENT;
        analysis.completedAt = LocalDateTime.now();
        return analysis;
    }

    public void start(String inputHash) {
        if (status != AiAnalysisStatus.QUEUED) {
            throw new IllegalStateException("Only a QUEUED AI analysis can start");
        }
        if (inputHash == null || inputHash.length() != 64) {
            throw new IllegalArgumentException("inputHash must be SHA-256");
        }
        this.inputHash = inputHash;
        status = AiAnalysisStatus.RUNNING;
        startedAt = LocalDateTime.now();
    }

    public void complete(String modelOutput, String computedResult,
                         BigDecimal claimCoverage, BigDecimal evidenceScore) {
        requireRunning();
        this.status = AiAnalysisStatus.DONE;
        this.modelOutput = modelOutput;
        this.computedResult = computedResult;
        this.resultPayload = computedResult;
        this.claimCoverage = claimCoverage;
        this.evidenceScore = evidenceScore;
        finish();
    }

    public void needsManualReview(String computedResult, String reason) {
        requireNotFinal();
        this.status = AiAnalysisStatus.NEEDS_MANUAL_REVIEW;
        this.computedResult = computedResult;
        this.resultPayload = computedResult;
        this.errorMessage = truncate(reason);
        finish();
    }

    public void fail(String errorMessage) {
        requireNotFinal();
        this.status = AiAnalysisStatus.FAILED;
        this.errorMessage = truncate(errorMessage == null ? "AI analysis failed" : errorMessage);
        finish();
    }

    private void requireRunning() {
        if (status != AiAnalysisStatus.RUNNING) {
            throw new IllegalStateException("AI analysis run is already finalized");
        }
    }

    private void requireNotFinal() {
        if (status != AiAnalysisStatus.QUEUED && status != AiAnalysisStatus.RUNNING) {
            throw new IllegalStateException("AI analysis run is already finalized");
        }
    }

    private void finish() {
        completedAt = LocalDateTime.now();
        if (startedAt != null) {
            durationMs = java.time.Duration.between(startedAt, completedAt).toMillis();
        }
    }

    private String truncate(String value) {
        return value.substring(0, Math.min(1000, value.length()));
    }
}
