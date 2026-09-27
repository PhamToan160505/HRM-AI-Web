package com.hrm.ai.service;

import com.hrm.ai.entity.AiAnalysis;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AiAnalysisServiceTest {

    private final AiAnalysisService service = new AiAnalysisService(null, null, null, null, null, null);

    @Test
    void allowsComparisonOnlyForSameVersionPair() {
        AiAnalysis first = AiAnalysis.queued(1L, 10L, 20L, "model", "prompt-v1", "a".repeat(64));
        AiAnalysis samePair = AiAnalysis.queued(2L, 10L, 20L, "model", "prompt-v1", "b".repeat(64));

        assertDoesNotThrow(() -> service.assertSameVersionPair(List.of(first, samePair)));
    }

    @Test
    void rejectsComparisonAcrossVersionPairs() {
        AiAnalysis first = AiAnalysis.queued(1L, 10L, 20L, "model", "prompt-v1", "a".repeat(64));
        AiAnalysis differentProfile = AiAnalysis.queued(2L, 10L, 21L, "model", "prompt-v1", "b".repeat(64));

        assertThrows(AppException.class,
                () -> service.assertSameVersionPair(List.of(first, differentProfile)));
    }
}
