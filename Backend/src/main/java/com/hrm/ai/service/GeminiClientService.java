package com.hrm.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;

@Service
@Slf4j
public class GeminiClientService {

    private final WebClient webClient;
    private final String apiKey;

    @Value("${app.gemini.model:gemini-1.5-flash}")
    private String model;

    public GeminiClientService(WebClient.Builder webClientBuilder,
                               @Value("${app.gemini.base-url}") String baseUrl,
                               @Value("${app.gemini.api-key}") String apiKey) {
        this.apiKey = apiKey;
        this.webClient = webClientBuilder
                .baseUrl(baseUrl)
                .defaultHeader("Content-Type", "application/json")
                .build();
        log.info("[Gemini] Configured baseUrl={}, keyPrefix={}", baseUrl,
                apiKey != null && apiKey.length() > 8 ? apiKey.substring(0, 8) + "..." : "EMPTY");
    }

    /**
     * Gọi Gemini API với cơ chế Retry (2 lần) và Timeout (30s).
     * Key gửi qua query param ?key=... thay vì header để tương thích mọi loại key.
     */
    public Mono<String> callGemini(String prompt) {
        String url = "/models/" + model + ":generateContent?key=" + apiKey;

        String requestBody = """
            {
              "contents": [{
                "parts": [{"text": "%s"}]
              }]
            }
            """.formatted(escapeJson(prompt));

        log.debug("[Gemini] Calling model={}, promptLen={}", model, prompt.length());

        return webClient.post()
                .uri(url)
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        response -> response.bodyToMono(String.class).flatMap(body -> {
                            log.error("[Gemini] HTTP {} error: {}", response.statusCode(), body);
                            return Mono.error(new RuntimeException(
                                    "Gemini API lỗi HTTP " + response.statusCode() + ": " + body));
                        }))
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(120))
                .retryWhen(Retry.backoff(2, Duration.ofSeconds(5))
                        .doBeforeRetry(sig -> log.warn("[Gemini] Retry #{} vì: {}",
                                sig.totalRetriesInARow() + 1, sig.failure().getMessage())))
                .onErrorResume(e -> {
                    // Lấy root cause thật
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    String errMsg = cause.getMessage() != null ? cause.getMessage() : e.getMessage();
                    log.error("[Gemini] Lỗi cuối cùng: {} - {}", cause.getClass().getSimpleName(), errMsg);
                    return Mono.error(new RuntimeException("Lỗi khi gọi Gemini API: " + errMsg));
                });
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\b", "\\b")
                    .replace("\f", "\\f")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
    }
}
