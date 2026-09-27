package com.hrm.configuration.service;

import com.hrm.configuration.entity.ConfigurationValueType;
import com.hrm.configuration.entity.ScoringParameter;
import com.hrm.configuration.entity.ScoringProfile;
import com.hrm.configuration.entity.ScoringProfileStatus;
import com.hrm.configuration.repository.ScoringParameterRepository;
import com.hrm.configuration.repository.ScoringProfileRepository;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ScoringProfileService {

    private final ScoringProfileRepository profileRepository;
    private final ScoringParameterRepository parameterRepository;
    private final ConfigurationService configurationService;

    @Transactional(readOnly = true)
    public List<ScoringProfileView> listProfiles() {
        return profileRepository.findAllByOrderByProfileCodeAscVersionNumberDesc().stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public ScoringProfileView getProfile(Long id) {
        return toView(requireProfile(id));
    }

    /**
     * Internal versioning operation. Editing a parameter means cloning the complete
     * profile into a new DRAFT and applying overrides to that clone.
     */
    @Transactional
    public ScoringProfileView createDraftVersion(
            Long sourceProfileId,
            String displayName,
            String reason,
            Long actorId,
            Map<String, String> parameterOverrides) {
        ScoringProfile source = requireProfile(sourceProfileId);
        List<ScoringParameter> sourceParameters = parameterRepository
                .findByScoringProfileIdOrderByParameterKey(sourceProfileId);

        List<String> unknownKeys = parameterOverrides.keySet().stream()
                .filter(key -> sourceParameters.stream().noneMatch(parameter -> parameter.getParameterKey().equals(key)))
                .sorted()
                .toList();
        if (!unknownKeys.isEmpty()) {
            throw AppException.badRequest("Tham số không tồn tại trong profile nguồn: " + String.join(", ", unknownKeys));
        }

        int nextVersion = profileRepository.findFirstByProfileCodeOrderByVersionNumberDesc(source.getProfileCode())
                .map(profile -> profile.getVersionNumber() + 1)
                .orElse(1);
        ScoringProfile draft = profileRepository.save(ScoringProfile.draft(
                source.getProfileCode(),
                nextVersion,
                displayName == null || displayName.isBlank() ? source.getDisplayName() + " v" + nextVersion : displayName,
                LocalDateTime.now(),
                actorId,
                reason));

        List<ScoringParameter> copiedParameters = sourceParameters.stream()
                .map(parameter -> ScoringParameter.copyFor(
                        draft.getId(), parameter, parameterOverrides.get(parameter.getParameterKey())))
                .toList();
        validateParameterValues(copiedParameters);
        parameterRepository.saveAll(copiedParameters);
        configurationService.refreshCache();
        return toView(draft);
    }

    @Transactional
    public ScoringProfileView activate(Long profileId) {
        ScoringProfile target = requireProfile(profileId);
        if (target.getStatus() == ScoringProfileStatus.ACTIVE) {
            return toView(target);
        }
        if (target.getStatus() != ScoringProfileStatus.DRAFT) {
            throw AppException.conflict("Scoring profile đã RETIRED không thể kích hoạt lại");
        }
        if (target.getEffectiveFrom().isAfter(LocalDateTime.now())) {
            throw AppException.conflict("Scoring profile chưa đến thời điểm có hiệu lực");
        }

        configurationService.requireScoringParameters(target.getId());
        profileRepository.findByStatus(ScoringProfileStatus.ACTIVE).stream()
                .filter(profile -> !profile.getId().equals(target.getId()))
                .forEach(ScoringProfile::retire);
        target.activate(LocalDateTime.now());
        profileRepository.save(target);
        configurationService.refreshCache();
        return toView(target);
    }

    private ScoringProfile requireProfile(Long id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy scoring profile: " + id));
    }

    private ScoringProfileView toView(ScoringProfile profile) {
        List<ScoringParameterView> parameters = parameterRepository
                .findByScoringProfileIdOrderByParameterKey(profile.getId())
                .stream()
                .map(parameter -> new ScoringParameterView(
                        parameter.getParameterKey(),
                        parameter.getParameterValue(),
                        parameter.getValueType(),
                        parameter.getDescription()))
                .toList();
        return new ScoringProfileView(
                profile.getId(),
                profile.getProfileCode(),
                profile.getVersionNumber(),
                profile.getDisplayName(),
                profile.getStatus(),
                profile.getEffectiveFrom(),
                profile.getChangeReason(),
                profile.getCreatedAt(),
                profile.getActivatedAt(),
                parameters);
    }

    private void validateParameterValues(List<ScoringParameter> parameters) {
        for (ScoringParameter parameter : parameters) {
            try {
                if (parameter.getValueType() == ConfigurationValueType.INTEGER) {
                    Integer.parseInt(parameter.getParameterValue());
                } else if (parameter.getValueType() == ConfigurationValueType.DECIMAL) {
                    new java.math.BigDecimal(parameter.getParameterValue());
                } else if (parameter.getValueType() == ConfigurationValueType.BOOLEAN
                        && !"true".equalsIgnoreCase(parameter.getParameterValue())
                        && !"false".equalsIgnoreCase(parameter.getParameterValue())) {
                    throw new IllegalArgumentException();
                }
            } catch (RuntimeException exception) {
                throw AppException.badRequest("Giá trị không hợp lệ cho tham số: " + parameter.getParameterKey());
            }
        }
    }

    public record ScoringProfileView(
            Long id,
            String profileCode,
            Integer versionNumber,
            String displayName,
            ScoringProfileStatus status,
            LocalDateTime effectiveFrom,
            String changeReason,
            LocalDateTime createdAt,
            LocalDateTime activatedAt,
            List<ScoringParameterView> parameters) {}

    public record ScoringParameterView(
            String key,
            String value,
            ConfigurationValueType type,
            String description) {}
}
