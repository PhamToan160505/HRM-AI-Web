package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.ai.entity.AiAnalysis;
import com.hrm.ai.repository.AiAnalysisRepository;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.recruitment.repository.OutboxEventRepository;
import com.hrm.recruitment.entity.OutboxEvent;
import com.hrm.recruitment.service.PostingVersionLockService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AiAnalysisService {

    private final AiAnalysisRepository analysisRepository;
    private final JobPostingRepository jobPostingRepository;
    private final PostingVersionLockService postingVersionLockService;
    private final ConfigurationService configurationService;
    private final ObjectMapper objectMapper;
    private final OutboxEventRepository outboxEventRepository;

    @Value("${app.gemini.model:gemini-3.5-flash-lite}")
    private String modelName;

    @Transactional
    public AiAnalysis createRun(Application application, boolean consentGranted) {
        JobPosting posting = application.getJobPosting();
        postingVersionLockService.requireLockedPair(posting);
        String promptVersion = configurationService.requireString("ai.prompt_version");
        String initialHash = sha256((consentGranted ? "QUEUED|" : "NO_CONSENT|")
                + application.getId() + "|" + posting.getCriteriaVersionId() + "|"
                + posting.getScoringProfileVersionId() + "|" + promptVersion);
        AiAnalysis run = consentGranted
                ? AiAnalysis.queued(application.getId(), posting.getCriteriaVersionId(),
                    posting.getScoringProfileVersionId(), modelName, promptVersion, initialHash)
                : AiAnalysis.skippedNoConsent(application.getId(), posting.getCriteriaVersionId(),
                    posting.getScoringProfileVersionId(), modelName, promptVersion, initialHash);
        return analysisRepository.save(run);
    }

    /** Compatibility bridge for legacy callers; new code must use createRun + pipeline. */
    @Deprecated
    public AiAnalysis start(Application application) {
        AiAnalysis run = createRun(application, true);
        return markRunning(run.getId(), run.getInputHash());
    }

    /** Compatibility bridge retained until the legacy scorer is removed. */
    @Deprecated
    public void complete(AiAnalysis run, Application ignored) {
        // The evidence pipeline owns completion; legacy completion intentionally does nothing.
    }

    @Deprecated
    public void fail(AiAnalysis run, Exception exception) {
        fail(run.getId(), exception);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AiAnalysis markRunning(Long runId, String inputHash) {
        AiAnalysis run = requireRun(runId);
        run.start(inputHash);
        return analysisRepository.save(run);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AiAnalysis complete(Long runId, AiCvScoringService.ScoringOutcome outcome) {
        AiAnalysis run = requireRun(runId);
        run.complete(outcome.modelOutput(), outcome.computedResult(),
                outcome.claimCoverage(), outcome.evidenceScore());
        AiAnalysis saved = analysisRepository.save(run);
        publishResult(saved, "AI_ANALYSIS_COMPLETED");
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AiAnalysis manualReview(Long runId, String computedResult, String reason) {
        AiAnalysis run = requireRun(runId);
        run.needsManualReview(computedResult, reason);
        AiAnalysis saved = analysisRepository.save(run);
        publishResult(saved, "AI_ANALYSIS_MANUAL_REVIEW_REQUIRED");
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long runId, Exception exception) {
        AiAnalysis run = requireRun(runId);
        run.fail(exception == null ? "AI analysis failed" : exception.getMessage());
        analysisRepository.save(run);
        publishResult(run, "AI_ANALYSIS_FAILED");
    }

    @Transactional(readOnly = true)
    public AiAnalysis requireRun(Long runId) {
        return analysisRepository.findById(runId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy lần chạy AI: " + runId));
    }

    @Transactional(readOnly = true)
    public List<AnalysisView> history(Long applicationId) {
        return analysisRepository.findByApplicationIdOrderByCreatedAtDescIdDesc(applicationId).stream()
                .map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public List<AiAnalysis> getCurrentComparableResults(Long postingId) {
        JobPosting posting = jobPostingRepository.findById(postingId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy posting: " + postingId));
        postingVersionLockService.requireLockedPair(posting);
        return analysisRepository.findComparableForPosting(
                postingId, posting.getCriteriaVersionId(), posting.getScoringProfileVersionId());
    }

    @Transactional(readOnly = true)
    public List<AnalysisView> getCurrentComparableViews(Long postingId) {
        List<AiAnalysis> results = getCurrentComparableResults(postingId);
        assertSameVersionPair(results);
        return results.stream().map(this::toView).toList();
    }

    public void assertSameVersionPair(List<AiAnalysis> analyses) {
        if (analyses.isEmpty()) return;
        AiAnalysis first = analyses.get(0);
        boolean mixed = analyses.stream().anyMatch(item ->
                !item.getCriteriaVersionId().equals(first.getCriteriaVersionId())
                        || !item.getScoringProfileVersionId().equals(first.getScoringProfileVersionId()));
        if (mixed) {
            throw AppException.conflict("Không thể so sánh kết quả AI thuộc hai cặp criteria/scoring version khác nhau");
        }
    }

    public String inputHash(String normalizedCv, String jd, Long criteriaVersionId,
                            Long scoringProfileVersionId, String promptVersion) {
        return sha256(String.join("|", normalizedCv, jd, criteriaVersionId.toString(),
                scoringProfileVersionId.toString(), promptVersion));
    }

    private AnalysisView toView(AiAnalysis run) {
        return new AnalysisView(run.getId(), run.getApplicationId(), run.getStatus().name(),
                run.getCriteriaVersionId(), run.getScoringProfileVersionId(), run.getModelName(),
                run.getPromptVersion(), run.getInputHash(), run.getClaimCoverage(), run.getEvidenceScore(),
                parseJson(run.getComputedResult()), run.getErrorMessage(), run.getCreatedAt(),
                run.getStartedAt(), run.getCompletedAt(), run.getDurationMs());
    }

    private JsonNode parseJson(String value) {
        if (value == null || value.isBlank()) return null;
        try { return objectMapper.readTree(value); }
        catch (Exception exception) { return objectMapper.createObjectNode().put("invalid_legacy_payload", true); }
    }

    private void publishResult(AiAnalysis run, String eventType) {
        try {
            var payload = objectMapper.createObjectNode();
            payload.put("analysis_id", run.getId());
            payload.put("application_id", run.getApplicationId());
            payload.put("status", run.getStatus().name());
            payload.put("criteria_version_id", run.getCriteriaVersionId());
            payload.put("scoring_profile_version_id", run.getScoringProfileVersionId());
            outboxEventRepository.save(OutboxEvent.pending(eventType, "ai-run-" + run.getId(),
                    "AI_ANALYSIS", run.getId(), objectMapper.writeValueAsString(payload)));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể ghi sự kiện kết quả AI vào outbox", exception);
        }
    }

    private String sha256(String content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("JVM không hỗ trợ SHA-256", exception);
        }
    }

    public record AnalysisView(Long id, Long applicationId, String status,
                               Long criteriaVersionId, Long scoringProfileVersionId,
                               String model, String promptVersion, String inputHash,
                               BigDecimal claimCoverage, BigDecimal evidenceScore,
                               JsonNode computedResult, String errorMessage,
                               java.time.LocalDateTime createdAt, java.time.LocalDateTime startedAt,
                               java.time.LocalDateTime completedAt, Long durationMs) {}
}
