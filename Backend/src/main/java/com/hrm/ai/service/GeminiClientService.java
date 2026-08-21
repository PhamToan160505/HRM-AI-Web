package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;

@Service
@Slf4j
public class GeminiClientService {

    private final WebClient webClient;
    private final String apiKey;
    private final ObjectMapper objectMapper = new ObjectMapper();

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
     * Gọi Gemini API với text prompt thông thường.
     * Cơ chế Retry (2 lần) và Timeout (120s).
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
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    String errMsg = cause.getMessage() != null ? cause.getMessage() : e.getMessage();
                    log.error("[Gemini] Lỗi cuối cùng: {} - {}", cause.getClass().getSimpleName(), errMsg);
                    return Mono.error(new RuntimeException("Lỗi khi gọi Gemini API: " + errMsg));
                });
    }

    /**
     * Gọi Gemini Vision API — gửi danh sách ảnh Base64 + text prompt.
     * Dùng để OCR file PDF dạng hình ảnh (scan).
     * Gemini Vision hiểu bố cục 2D (2 cột, header/footer) tốt hơn OCR truyền thống đọc trái→phải.
     */
    public Mono<String> callGeminiVision(List<String> base64Images, String textPrompt) {
        String url = "/models/" + model + ":generateContent?key=" + apiKey;

        // Xây dựng mảng "parts": mỗi trang ảnh là một inline_data part, cuối là text prompt
        StringBuilder partsBuilder = new StringBuilder();
        for (String b64 : base64Images) {
            if (partsBuilder.length() > 0) partsBuilder.append(",");
            partsBuilder.append("{\"inline_data\": {\"mime_type\": \"image/png\", \"data\": \"")
                        .append(b64)
                        .append("\"}}");
        }
        // Thêm text prompt hướng dẫn cách đọc
        if (!base64Images.isEmpty()) partsBuilder.append(",");
        partsBuilder.append("{\"text\": \"").append(escapeJson(textPrompt)).append("\"}");

        String requestBody = "{\"contents\": [{\"parts\": [" + partsBuilder + "]}]}";

        log.info("[Gemini Vision] OCR {} trang PDF bằng Gemini Vision", base64Images.size());

        return webClient.post()
                .uri(url)
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        response -> response.bodyToMono(String.class).flatMap(body -> {
                            log.error("[Gemini Vision] HTTP {} error: {}", response.statusCode(), body);
                            return Mono.error(new RuntimeException(
                                    "Gemini Vision API lỗi: " + response.statusCode() + " - " + body));
                        }))
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(180))
                .retryWhen(Retry.backoff(1, Duration.ofSeconds(10))
                        .doBeforeRetry(sig -> log.warn("[Gemini Vision] Retry #{} vì: {}",
                                sig.totalRetriesInARow() + 1, sig.failure().getMessage())))
                .onErrorResume(e -> {
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    String errMsg = cause.getMessage() != null ? cause.getMessage() : e.getMessage();
                    log.error("[Gemini Vision] Lỗi OCR: {}", errMsg);
                    return Mono.error(new RuntimeException("Lỗi Gemini Vision OCR: " + errMsg));
                });
    }

    /**
     * Trích xuất text từ response JSON của Gemini (cả text và vision đều cùng format).
     */
    public String extractTextFromGeminiResponse(String rawResponse) {
        if (rawResponse == null) return "";
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            if (root.has("candidates") && root.get("candidates").isArray() && root.get("candidates").size() > 0) {
                JsonNode content = root.get("candidates").get(0).get("content");
                if (content != null && content.has("parts") && content.get("parts").isArray()
                        && content.get("parts").size() > 0) {
                    return content.get("parts").get(0).get("text").asText("").trim();
                }
            }
        } catch (Exception e) {
            log.warn("[Gemini] Không parse được response JSON, trả nguyên chuỗi: {}", e.getMessage());
        }
        return rawResponse.trim();
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
