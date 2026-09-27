package com.hrm.configuration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.configuration.entity.ConfigurationValueType;
import com.hrm.configuration.entity.ScoringParameter;
import com.hrm.configuration.entity.ScoringProfile;
import com.hrm.configuration.entity.ScoringProfileStatus;
import com.hrm.configuration.repository.ScoringParameterRepository;
import com.hrm.configuration.repository.ScoringProfileRepository;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * The only read gateway for versioned business configuration.
 * Missing or malformed required values fail explicitly; no business fallback is hidden in code.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConfigurationService {

    private static final Set<String> REQUIRED_SYSTEM_KEYS = Set.of(
            "seat.max_overbook_per_requisition",
            "application.reopen_window_days",
            "upload.max_file_size_mb",
            "upload.max_pages",
            "ai.timeout_seconds",
            "ai.max_retry",
            "ai.mode",
            "ai.consent_terms_version",
            "ai.consent_purpose",
            "ai.external_provider_disclosure",
            "ai.prompt_version",
            "ai.extraction.min_chars",
            "ai.hidden_text.min_font_size",
            "ai.model.max_quotes_per_criterion",
            "ai.model.max_quote_chars",
            "ai.max_verify_points",
            "ai.negation_patterns");

    private static final Set<String> REQUIRED_SCORING_KEYS = Set.of(
            "scoring.evidence_multiplier.listed_only",
            "scoring.evidence_multiplier.mentioned",
            "scoring.evidence_multiplier.demonstrated",
            "scoring.evidence_grade.low_ratio",
            "scoring.evidence_grade.high_ratio",
            "scoring.evidence_grade.low_score_max",
            "scoring.evidence_grade.high_score_min",
            "scoring.ngram_n",
            "scoring.copy_span_threshold",
            "scoring.mirroring_warn_threshold",
            "scoring.confidence.unverified_citation_ratio_max",
            "scoring.max_input_chars");

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ScoringProfileRepository scoringProfileRepository;
    private final ScoringParameterRepository scoringParameterRepository;
    private final Map<String, CacheEntry<?>> cache = new ConcurrentHashMap<>();

    @Value("${app.configuration.cache-ttl-seconds:60}")
    private long cacheTtlSeconds;

    public String requireString(String key) {
        return typedSystemValue(key, ConfigurationValueType.STRING, String.class);
    }

    public int requireInteger(String key) {
        return typedSystemValue(key, ConfigurationValueType.INTEGER, Integer.class);
    }

    public BigDecimal requireDecimal(String key) {
        return typedSystemValue(key, ConfigurationValueType.DECIMAL, BigDecimal.class);
    }

    public boolean requireBoolean(String key) {
        return typedSystemValue(key, ConfigurationValueType.BOOLEAN, Boolean.class);
    }

    public JsonNode requireJson(String key) {
        return typedSystemValue(key, ConfigurationValueType.JSON, JsonNode.class);
    }

    public ScoringProfile requireActiveScoringProfile() {
        return cached("scoring-profile:active", () -> scoringProfileRepository
                .findFirstByStatusAndEffectiveFromLessThanEqualOrderByEffectiveFromDescIdDesc(
                        ScoringProfileStatus.ACTIVE, LocalDateTime.now())
                .orElseThrow(() -> AppException.conflict("Thiếu scoring profile ACTIVE có hiệu lực")));
    }

    public Map<String, ScoringParameter> requireScoringParameters(Long profileId) {
        return cached("scoring-parameters:" + profileId, () -> {
            Map<String, ScoringParameter> parameters = scoringParameterRepository
                    .findByScoringProfileIdOrderByParameterKey(profileId)
                    .stream()
                    .collect(Collectors.toUnmodifiableMap(ScoringParameter::getParameterKey, value -> value));
            List<String> missing = REQUIRED_SCORING_KEYS.stream()
                    .filter(key -> !parameters.containsKey(key))
                    .sorted()
                    .toList();
            if (!missing.isEmpty()) {
                throw AppException.conflict("Thiếu cấu hình scoring profile " + profileId + ": " + String.join(", ", missing));
            }
            parameters.values().forEach(this::validateScoringParameter);
            return parameters;
        });
    }

    public BigDecimal requireScoringDecimal(Long profileId, String key) {
        ScoringParameter parameter = requireScoringParameter(profileId, key, ConfigurationValueType.DECIMAL);
        return parseDecimal(key, parameter.getParameterValue());
    }

    public int requireScoringInteger(Long profileId, String key) {
        ScoringParameter parameter = requireScoringParameter(profileId, key, ConfigurationValueType.INTEGER);
        return parseInteger(key, parameter.getParameterValue());
    }

    public EffectiveValue requireLegalValue(String key, LocalDateTime effectiveAt) {
        String cacheKey = "legal:" + key + ":" + effectiveAt.toLocalDate();
        return cached(cacheKey, () -> jdbcTemplate.query(
                        """
                        SELECT parameter_value, value_type, effective_from, source_reference, verified_by
                        FROM legal_parameters
                        WHERE parameter_key = ? AND effective_from <= ?
                        ORDER BY effective_from DESC, id DESC
                        LIMIT 1
                        """,
                        (rs, rowNum) -> new EffectiveValue(
                                rs.getString("parameter_value"),
                                ConfigurationValueType.valueOf(rs.getString("value_type")),
                                rs.getTimestamp("effective_from").toLocalDateTime(),
                                rs.getString("source_reference"),
                                rs.getString("verified_by")),
                        key,
                        effectiveAt)
                .stream()
                .findFirst()
                .orElseThrow(() -> AppException.conflict("Thiếu cấu hình pháp lý: " + key)));
    }

    public List<PatternRule> activeRedactionRules() {
        return cached("rules:redaction", () -> jdbcTemplate.query(
                """
                SELECT rule_key, pattern_text, replacement_text, priority
                FROM redaction_rules
                WHERE active = b'1' AND effective_from <= CURRENT_TIMESTAMP(6)
                ORDER BY priority, id
                """,
                (rs, rowNum) -> new PatternRule(
                        rs.getString("rule_key"),
                        rs.getString("pattern_text"),
                        rs.getString("replacement_text"),
                        rs.getInt("priority"))));
    }

    public List<InjectionRule> activeInjectionPatterns() {
        return cached("rules:injection", () -> jdbcTemplate.query(
                """
                SELECT pattern_key, pattern_text, severity
                FROM injection_patterns
                WHERE active = b'1' AND effective_from <= CURRENT_TIMESTAMP(6)
                ORDER BY id
                """,
                (rs, rowNum) -> new InjectionRule(
                        rs.getString("pattern_key"),
                        rs.getString("pattern_text"),
                        rs.getString("severity"))));
    }

    public List<String> activeCommonPhrases(String locale) {
        return cached("phrases:" + locale, () -> jdbcTemplate.queryForList(
                """
                SELECT normalized_phrase
                FROM common_phrases
                WHERE active = b'1' AND locale = ? AND effective_from <= CURRENT_TIMESTAMP(6)
                ORDER BY id
                """,
                String.class,
                locale));
    }

    public List<ApprovalPolicyConfiguration> activeApprovalPolicies(String entityType) {
        return cached("approval-policies:" + entityType, () -> jdbcTemplate.query(
                """
                SELECT id, policy_code, version_number, entity_type, condition_json, steps_template, effective_from
                FROM approval_policies
                WHERE entity_type = ?
                  AND status = 'ACTIVE'
                  AND effective_from <= CURRENT_TIMESTAMP(6)
                ORDER BY version_number DESC, effective_from DESC, id DESC
                """,
                (rs, rowNum) -> new ApprovalPolicyConfiguration(
                        rs.getLong("id"),
                        rs.getString("policy_code"),
                        rs.getInt("version_number"),
                        rs.getString("entity_type"),
                        parseJson("approval policy conditions", rs.getString("condition_json")),
                        parseJson("approval policy steps", rs.getString("steps_template")),
                        rs.getTimestamp("effective_from").toLocalDateTime()),
                entityType));
    }

    public void refreshCache() {
        cache.clear();
        log.info("Business configuration cache refreshed");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void failFastOnMissingConfiguration() {
        REQUIRED_SYSTEM_KEYS.stream().sorted().forEach(this::requireSystemValue);
        ScoringProfile activeProfile = requireActiveScoringProfile();
        requireScoringParameters(activeProfile.getId());
        if (activeRedactionRules().isEmpty()) {
            throw AppException.conflict("Thiếu cấu hình: redaction_rules đang hoạt động");
        }
        if (activeInjectionPatterns().isEmpty()) {
            throw AppException.conflict("Thiếu cấu hình: injection_patterns đang hoạt động");
        }
        if (activeApprovalPolicies("JOB_REQUISITION").isEmpty()) {
            throw AppException.conflict("Thiếu cấu hình: approval policy cho JOB_REQUISITION");
        }
        if (activeApprovalPolicies("APPLICATION_TECH_REVIEW").isEmpty()) {
            throw AppException.conflict("Thiếu cấu hình: approval policy cho APPLICATION_TECH_REVIEW");
        }
        if (activeApprovalPolicies("OFFER").isEmpty()) {
            throw AppException.conflict("Thiếu cấu hình: approval policy cho OFFER");
        }
        log.info("Configuration validation passed with scoring profile {} v{}",
                activeProfile.getProfileCode(), activeProfile.getVersionNumber());
    }

    private ScoringParameter requireScoringParameter(Long profileId, String key, ConfigurationValueType expectedType) {
        ScoringParameter parameter = requireScoringParameters(profileId).get(key);
        if (parameter == null) {
            throw AppException.conflict("Thiếu cấu hình: " + key + " trong scoring profile " + profileId);
        }
        if (parameter.getValueType() != expectedType) {
            throw AppException.conflict("Sai kiểu cấu hình " + key + ": cần " + expectedType);
        }
        return parameter;
    }

    private SystemValue requireSystemValue(String key) {
        return cached("system:" + key, () -> jdbcTemplate.query(
                        """
                        SELECT config_value, value_type, effective_from
                        FROM system_configurations
                        WHERE config_key = ? AND effective_from <= CURRENT_TIMESTAMP(6)
                        ORDER BY effective_from DESC, id DESC
                        LIMIT 1
                        """,
                        (rs, rowNum) -> new SystemValue(
                                rs.getString("config_value"),
                                ConfigurationValueType.valueOf(rs.getString("value_type")),
                                rs.getTimestamp("effective_from").toLocalDateTime()),
                        key)
                .stream()
                .findFirst()
                .orElseThrow(() -> AppException.conflict("Thiếu cấu hình: " + key)));
    }

    private <T> T typedSystemValue(String key, ConfigurationValueType expectedType, Class<T> targetType) {
        SystemValue value = requireSystemValue(key);
        if (value.type() != expectedType) {
            throw AppException.conflict("Sai kiểu cấu hình " + key + ": cần " + expectedType);
        }
        Object parsed = switch (expectedType) {
            case STRING -> value.value();
            case INTEGER -> parseInteger(key, value.value());
            case DECIMAL -> parseDecimal(key, value.value());
            case BOOLEAN -> parseBoolean(key, value.value());
            case JSON -> parseJson(key, value.value());
        };
        return targetType.cast(parsed);
    }

    private void validateScoringParameter(ScoringParameter parameter) {
        switch (parameter.getValueType()) {
            case INTEGER -> parseInteger(parameter.getParameterKey(), parameter.getParameterValue());
            case DECIMAL -> parseDecimal(parameter.getParameterKey(), parameter.getParameterValue());
            case BOOLEAN -> parseBoolean(parameter.getParameterKey(), parameter.getParameterValue());
            case JSON -> parseJson(parameter.getParameterKey(), parameter.getParameterValue());
            case STRING -> {
                if (parameter.getParameterValue().isBlank()) {
                    throw AppException.conflict("Cấu hình rỗng: " + parameter.getParameterKey());
                }
            }
        }
    }

    private int parseInteger(String key, String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException exception) {
            throw AppException.conflict("Giá trị cấu hình không phải số nguyên: " + key);
        }
    }

    private BigDecimal parseDecimal(String key, String raw) {
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException exception) {
            throw AppException.conflict("Giá trị cấu hình không phải số thập phân: " + key);
        }
    }

    private boolean parseBoolean(String key, String raw) {
        if (!"true".equalsIgnoreCase(raw) && !"false".equalsIgnoreCase(raw)) {
            throw AppException.conflict("Giá trị cấu hình không phải boolean: " + key);
        }
        return Boolean.parseBoolean(raw);
    }

    private JsonNode parseJson(String key, String raw) {
        try {
            return objectMapper.readTree(raw);
        } catch (Exception exception) {
            throw AppException.conflict("Giá trị cấu hình không phải JSON hợp lệ: " + key);
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, Supplier<T> loader) {
        long now = System.currentTimeMillis();
        CacheEntry<?> existing = cache.get(key);
        if (existing != null && existing.expiresAtMillis() > now) {
            return (T) existing.value();
        }
        T loaded = loader.get();
        cache.put(key, new CacheEntry<>(loaded, now + cacheTtlSeconds * 1000));
        return loaded;
    }

    private record CacheEntry<T>(T value, long expiresAtMillis) {}
    private record SystemValue(String value, ConfigurationValueType type, LocalDateTime effectiveFrom) {}

    public record EffectiveValue(
            String value,
            ConfigurationValueType type,
            LocalDateTime effectiveFrom,
            String sourceReference,
            String verifiedBy) {}

    public record PatternRule(String key, String pattern, String replacement, int priority) {}
    public record InjectionRule(String key, String pattern, String severity) {}

    public record ApprovalPolicyConfiguration(
            Long id,
            String policyCode,
            int versionNumber,
            String entityType,
            JsonNode conditions,
            JsonNode stepsTemplate,
            LocalDateTime effectiveFrom) {}
}
