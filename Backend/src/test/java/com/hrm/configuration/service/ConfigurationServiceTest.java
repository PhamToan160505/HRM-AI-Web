package com.hrm.configuration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.configuration.entity.ConfigurationValueType;
import com.hrm.configuration.entity.ScoringParameter;
import com.hrm.configuration.repository.ScoringParameterRepository;
import com.hrm.configuration.repository.ScoringProfileRepository;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConfigurationServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private ScoringProfileRepository scoringProfileRepository;
    @Mock
    private ScoringParameterRepository scoringParameterRepository;

    private ConfigurationService configurationService;

    @BeforeEach
    void setUp() {
        configurationService = new ConfigurationService(
                jdbcTemplate,
                new ObjectMapper(),
                scoringProfileRepository,
                scoringParameterRepository);
    }

    @Test
    void rejectsScoreThresholdSeededAsInteger() {
        List<ScoringParameter> parameters = requiredParameters(ConfigurationValueType.INTEGER);
        when(scoringParameterRepository.findByScoringProfileIdOrderByParameterKey(1L))
                .thenReturn(parameters);

        AppException exception = assertThrows(AppException.class,
                () -> configurationService.requireScoringParameters(1L));

        assertEquals(
                "Sai kiểu cấu hình scoring.evidence_grade.low_score_max: cần DECIMAL",
                exception.getMessage());
    }

    @Test
    void acceptsScoreThresholdsStoredAsDecimal() {
        List<ScoringParameter> parameters = requiredParameters(ConfigurationValueType.DECIMAL);
        when(scoringParameterRepository.findByScoringProfileIdOrderByParameterKey(1L))
                .thenReturn(parameters);

        assertEquals(12, configurationService.requireScoringParameters(1L).size());
    }

    private List<ScoringParameter> requiredParameters(ConfigurationValueType lowScoreType) {
        return List.of(
                parameter("scoring.evidence_multiplier.listed_only", "0.25", ConfigurationValueType.DECIMAL),
                parameter("scoring.evidence_multiplier.mentioned", "0.6", ConfigurationValueType.DECIMAL),
                parameter("scoring.evidence_multiplier.demonstrated", "1.0", ConfigurationValueType.DECIMAL),
                parameter("scoring.evidence_grade.low_ratio", "0.4", ConfigurationValueType.DECIMAL),
                parameter("scoring.evidence_grade.high_ratio", "0.7", ConfigurationValueType.DECIMAL),
                parameter("scoring.evidence_grade.low_score_max", "30", lowScoreType),
                parameter("scoring.evidence_grade.high_score_min", "50", ConfigurationValueType.DECIMAL),
                parameter("scoring.ngram_n", "6", ConfigurationValueType.INTEGER),
                parameter("scoring.copy_span_threshold", "0.5", ConfigurationValueType.DECIMAL),
                parameter("scoring.mirroring_warn_threshold", "0.72", ConfigurationValueType.DECIMAL),
                parameter("scoring.confidence.unverified_citation_ratio_max", "0.2", ConfigurationValueType.DECIMAL),
                parameter("scoring.max_input_chars", "30000", ConfigurationValueType.INTEGER));
    }

    private ScoringParameter parameter(String key, String value, ConfigurationValueType type) {
        ScoringParameter parameter = mock(ScoringParameter.class);
        lenient().when(parameter.getParameterKey()).thenReturn(key);
        lenient().when(parameter.getParameterValue()).thenReturn(value);
        lenient().when(parameter.getValueType()).thenReturn(type);
        return parameter;
    }
}
