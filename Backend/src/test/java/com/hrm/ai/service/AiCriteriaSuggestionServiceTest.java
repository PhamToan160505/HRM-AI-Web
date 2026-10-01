package com.hrm.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.controller.RecruitmentController.CriteriaSuggestionRequest;
import com.hrm.recruitment.controller.RecruitmentController.ScreeningCriterionRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiCriteriaSuggestionServiceTest {

    @Mock
    private GeminiClientService geminiClientService;

    @Mock
    private ConfigurationService configurationService;

    private AiCriteriaSuggestionService service;

    @BeforeEach
    void setUp() {
        service = new AiCriteriaSuggestionService(
                geminiClientService,
                configurationService,
                new ObjectMapper());
        when(configurationService.requireInteger("ai.timeout_seconds")).thenReturn(30);
        when(configurationService.requireInteger("ai.max_retry")).thenReturn(1);
    }

    @Test
    void normalizesWeightsAndAssignsStableIds() {
        String modelJson = """
                {"criteria":[
                  {"name":"Java","type":"MUST","weight":3,"synonyms":["JDK"],"evidenceExpected":"Dự án Java"},
                  {"name":"Spring Boot","type":"MUST","weight":2,"synonyms":["Spring"],"evidenceExpected":"Dự án Spring Boot"},
                  {"name":"SQL","type":"NICE","weight":1,"synonyms":[],"evidenceExpected":"Cơ sở dữ liệu đã sử dụng"}
                ]}
                """;
        when(geminiClientService.callGemini(anyString(), eq(30), eq(1)))
                .thenReturn(Mono.just("response"));
        when(geminiClientService.extractTextFromGeminiResponse("response")).thenReturn(modelJson);

        List<ScreeningCriterionRequest> result = service.suggest(new CriteriaSuggestionRequest(
                "Backend Developer", "Xây dựng API", "Java, Spring", "Senior", "Hybrid"));

        assertEquals(3, result.size());
        assertEquals(List.of("C1", "C2", "C3"), result.stream().map(ScreeningCriterionRequest::id).toList());
        assertEquals(100, result.stream().mapToInt(ScreeningCriterionRequest::weight).sum());
        assertTrue(result.stream().allMatch(item -> item.weight() > 0));
    }

    @Test
    void rejectsSensitiveCriteriaReturnedByModel() {
        String modelJson = """
                {"criteria":[
                  {"name":"Độ tuổi dưới 30","type":"MUST","weight":40,"synonyms":[],"evidenceExpected":"Ngày sinh"},
                  {"name":"Java","type":"MUST","weight":30,"synonyms":[],"evidenceExpected":"Dự án Java"},
                  {"name":"SQL","type":"NICE","weight":30,"synonyms":[],"evidenceExpected":"Dự án SQL"}
                ]}
                """;
        when(geminiClientService.callGemini(anyString(), eq(30), eq(1)))
                .thenReturn(Mono.just("response"));
        when(geminiClientService.extractTextFromGeminiResponse("response")).thenReturn(modelJson);

        assertThrows(AppException.class, () -> service.suggest(new CriteriaSuggestionRequest(
                "Backend Developer", "Xây dựng API", "Java", "Junior", "Onsite")));
    }

    @Test
    void doesNotTreatSensitiveTermInsideTechnicalWordAsProtectedAttribute() {
        String modelJson = """
                {"criteria":[
                  {"name":"Quản lý package Java","type":"MUST","weight":40,"synonyms":[],"evidenceExpected":"Package đã phát hành"},
                  {"name":"Message queue","type":"MUST","weight":30,"synonyms":[],"evidenceExpected":"Dự án dùng Kafka"},
                  {"name":"SQL","type":"NICE","weight":30,"synonyms":[],"evidenceExpected":"Dự án SQL"}
                ]}
                """;
        when(geminiClientService.callGemini(anyString(), eq(30), eq(1)))
                .thenReturn(Mono.just("response"));
        when(geminiClientService.extractTextFromGeminiResponse("response")).thenReturn(modelJson);

        List<ScreeningCriterionRequest> result = service.suggest(new CriteriaSuggestionRequest(
                "Backend Developer", "Xây dựng API", "Java", "Junior", "Onsite"));

        assertEquals(3, result.size());
    }
}
