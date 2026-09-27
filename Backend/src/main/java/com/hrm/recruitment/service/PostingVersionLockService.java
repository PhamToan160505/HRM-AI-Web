package com.hrm.recruitment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.configuration.entity.ScoringProfile;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.ScreeningCriteriaSet;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.recruitment.repository.ScreeningCriteriaSetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashMap;
import java.util.HexFormat;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PostingVersionLockService {

    private final ScreeningCriteriaSetRepository criteriaSetRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ConfigurationService configurationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public JobPosting lockInitialPair(JobPosting posting, Long actorId) {
        if (posting.getCriteriaVersionId() != null || posting.getScoringProfileVersionId() != null) {
            requireLockedPair(posting);
            return posting;
        }
        ScoringProfile activeProfile = configurationService.requireActiveScoringProfile();
        configurationService.requireScoringParameters(activeProfile.getId());
        ScreeningCriteriaSet criteria = createConfirmedCriteriaVersion(
                posting,
                actorId,
                "Xác nhận tiêu chí khi mở posting");
        posting.setCriteriaVersionId(criteria.getId());
        posting.setScoringProfileVersionId(activeProfile.getId());
        return jobPostingRepository.save(posting);
    }

    @Transactional
    public JobPosting createNewCriteriaVersion(JobPosting posting, Long actorId, String reason) {
        requireLockedPair(posting);
        ScreeningCriteriaSet current = criteriaSetRepository.findById(posting.getCriteriaVersionId())
                .orElseThrow(() -> AppException.conflict("criteria_version_id của posting không tồn tại"));
        String snapshot = buildSnapshot(posting);
        String hash = sha256(snapshot);
        if (hash.equals(current.getContentHash())) {
            return posting;
        }
        ScreeningCriteriaSet next = createConfirmedCriteriaVersion(posting, actorId, reason);
        posting.setCriteriaVersionId(next.getId());
        return jobPostingRepository.save(posting);
    }

    public void requireLockedPair(JobPosting posting) {
        if (posting.getCriteriaVersionId() == null || posting.getScoringProfileVersionId() == null) {
            throw AppException.conflict(
                    "Posting phải khóa criteria_version_id và scoring_profile_version_id trước khi OPEN");
        }
        ScreeningCriteriaSet criteria = criteriaSetRepository.findById(posting.getCriteriaVersionId())
                .orElseThrow(() -> AppException.conflict("criteria_version_id của posting không tồn tại"));
        if (!criteria.getPostingId().equals(posting.getId())) {
            throw AppException.conflict("criteria_version_id không thuộc posting hiện tại");
        }
        configurationService.requireScoringParameters(posting.getScoringProfileVersionId());
    }

    private ScreeningCriteriaSet createConfirmedCriteriaVersion(JobPosting posting, Long actorId, String reason) {
        int nextVersion = criteriaSetRepository.findFirstByPostingIdOrderByVersionNumberDesc(posting.getId())
                .map(value -> value.getVersionNumber() + 1)
                .orElse(1);
        String snapshot = buildSnapshot(posting);
        return criteriaSetRepository.save(ScreeningCriteriaSet.confirmed(
                posting.getId(),
                nextVersion,
                snapshot,
                sha256(snapshot),
                actorId,
                reason));
    }

    private String buildSnapshot(JobPosting posting) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("title", posting.getTitle());
        snapshot.put("description", posting.getDescription());
        snapshot.put("requirements", posting.getRequirements());
        snapshot.put("level", posting.getCapBac());
        snapshot.put("targetRole", posting.getTargetRole() == null ? null : posting.getTargetRole().name());
        try {
            snapshot.put("criteria", objectMapper.readTree(posting.getCriteriaDefinition()));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Bộ tiêu chí của posting không phải JSON hợp lệ", exception);
        }
        snapshot.put("source", "POSTING_JD_SNAPSHOT");
        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể tạo snapshot tiêu chí", exception);
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
}
