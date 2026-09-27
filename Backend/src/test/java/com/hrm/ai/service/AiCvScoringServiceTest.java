package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AiCvScoringServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ConfigurationService configuration = mock(ConfigurationService.class);
    private final AiTextSafetyService textSafety = mock(AiTextSafetyService.class);
    private AiCvScoringService service;

    @BeforeEach
    void setUp() {
        service = new AiCvScoringService(mapper, configuration, textSafety);
        when(configuration.requireInteger("ai.model.max_quotes_per_criterion")).thenReturn(5);
        when(configuration.requireInteger("ai.model.max_quote_chars")).thenReturn(700);
        when(configuration.requireInteger("ai.max_verify_points")).thenReturn(5);
        when(configuration.requireScoringInteger(9L, "scoring.ngram_n")).thenReturn(3);
        when(configuration.requireScoringDecimal(9L, "scoring.copy_span_threshold")).thenReturn(new BigDecimal("0.50"));
        when(configuration.requireScoringDecimal(9L, "scoring.mirroring_warn_threshold")).thenReturn(new BigDecimal("0.95"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_multiplier.listed_only")).thenReturn(new BigDecimal("0.25"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_multiplier.mentioned")).thenReturn(new BigDecimal("0.60"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_multiplier.demonstrated")).thenReturn(BigDecimal.ONE);
        when(configuration.requireScoringDecimal(9L, "scoring.confidence.unverified_citation_ratio_max")).thenReturn(new BigDecimal("0.50"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_grade.low_ratio")).thenReturn(new BigDecimal("0.40"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_grade.high_ratio")).thenReturn(new BigDecimal("0.80"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_grade.low_score_max")).thenReturn(new BigDecimal("39"));
        when(configuration.requireScoringDecimal(9L, "scoring.evidence_grade.high_score_min")).thenReturn(new BigDecimal("80"));
        when(configuration.activeCommonPhrases(anyString())).thenReturn(List.of());
        when(textSafety.negationPatterns()).thenReturn(List.of("chua tung", "khong co kinh nghiem"));
    }

    @Test
    void t11NegatedClaimCannotBecomeEvidence() throws Exception {
        String cv = "Kinh nghiệm: Tôi chưa từng làm Spring Boot trong dự án thực tế.";
        JsonNode result = mapper.readTree(service.score(model("Tôi chưa từng làm Spring Boot", "EXPERIENCE"),
                criteria(), cv, "Yêu cầu Spring Boot", 9L, List.of(), extraction(), meta()).computedResult());

        assertEquals("NONE", result.path("criteria").get(0).path("evidence_level").asText());
        assertEquals(0, result.path("scores").path("evidence_score").decimalValue().compareTo(BigDecimal.ZERO));
    }

    @Test
    void t3CopiedJdSpanIsCappedAtListedOnly() throws Exception {
        String quote = "Spring Boot xây dựng hệ thống xử lý thanh toán hiệu năng cao";
        JsonNode result = mapper.readTree(service.score(model(quote, "EXPERIENCE"), criteria(),
                "Kinh nghiệm " + quote, quote, 9L, List.of(), extraction(), meta()).computedResult());

        assertEquals("LISTED_ONLY", result.path("criteria").get(0).path("evidence_level").asText());
        assertTrue(result.path("flags").toString().contains("EVIDENCE_COPIED_FROM_JD"));
    }

    @Test
    void t15ModelOutputContainingScoreIsRejected() {
        String poisoned = "{\"schema_version\":\"1.0\",\"score\":99,\"criteria_evidence\":[]}";
        assertThrows(AppException.class, () -> service.parseStrictModelOutput(poisoned));
    }

    private JsonNode criteria() throws Exception {
        return mapper.readTree("""
                {"criteria":[{"id":"C1","name":"Spring Boot","type":"MUST","weight":100,
                "synonyms":["spring boot"],"evidence_expected":"Kinh nghiệm dự án"}]}
                """);
    }

    private String model(String quote, String section) throws Exception {
        var root = mapper.createObjectNode().put("schema_version", "1.0");
        var item = root.putArray("criteria_evidence").addObject().put("criteria_id", "C1");
        item.put("missing", "");
        var candidate = item.putArray("candidates").addObject();
        candidate.put("quote", quote).put("section", section).put("polarity", "AFFIRMED");
        candidate.putArray("detail_types").add("role");
        root.putArray("consistency_notes");
        return root.toString();
    }

    private AiCvScoringService.ExtractionInfo extraction() {
        return new AiCvScoringService.ExtractionInfo("OK", "TEXT_LAYER", 100, 0);
    }

    private AiCvScoringService.MetaInfo meta() {
        return new AiCvScoringService.MetaInfo("model", "prompt", 8, 9,
                "a".repeat(64), "1", 10);
    }
}
