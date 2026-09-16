package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
                    for (JsonNode part : content.get("parts")) {
                        if (part.has("text")) {
                            return part.get("text").asText("").trim();
                        }
                    }
                    return ""; // Không có text part (ví dụ: chỉ có functionCall)
                }
            }
        } catch (Exception e) {
            log.warn("[Gemini] Không parse được response JSON, trả nguyên chuỗi: {}", e.getMessage());
        }
        return rawResponse.trim();
    }

    /**
     * Tương tác nhiều lượt (multi-turn) với Gemini, hỗ trợ System Prompt và Function Calling.
     */
    public Mono<String> callGeminiChat(String systemPrompt, List<com.hrm.ai.entity.ChatMessage> history, JsonNode tools) {
        String url = "/models/" + model + ":generateContent?key=" + apiKey;
        
        ObjectNode requestBodyNode = objectMapper.createObjectNode();

        // System Instruction
        if (systemPrompt != null && !systemPrompt.isEmpty()) {
            ObjectNode sysInstNode = requestBodyNode.putObject("system_instruction");
            sysInstNode.putArray("parts").addObject().put("text", systemPrompt);
        }

        // Contents (History) - Đảm bảo tính luân phiên của role (user -> model -> user)
        var contentsArray = requestBodyNode.putArray("contents");
        String lastRole = null;
        ObjectNode lastMsgNode = null;
        
        for (var msg : history) {
            String role = msg.getRole().equals("assistant") || msg.getRole().equals("model") ? "model" : "user";
            
            if (role.equals(lastRole) && lastMsgNode != null) {
                // Nếu cùng role với tin nhắn trước đó, gộp nội dung lại
                lastMsgNode.withArray("parts").addObject().put("text", "\n\n" + msg.getContent());
            } else {
                // Nếu khác role, tạo node mới
                ObjectNode msgNode = contentsArray.addObject();
                msgNode.put("role", role);
                msgNode.putArray("parts").addObject().put("text", msg.getContent());
                
                lastRole = role;
                lastMsgNode = msgNode;
            }
        }

        // Tools (Function Calling)
        if (tools != null && tools.isArray() && tools.size() > 0) {
            requestBodyNode.set("tools", tools);
        }

        String requestBody;
        try {
            requestBody = objectMapper.writeValueAsString(requestBodyNode);
        } catch (Exception e) {
            return Mono.error(new RuntimeException("Lỗi serialize JSON cho Gemini chat: " + e.getMessage()));
        }

        log.info("[Gemini Chat] Gọi model={}, historySize={}, có tools={}", model, history.size(), tools != null);

        return webClient.post()
                .uri(url)
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        response -> response.bodyToMono(String.class).flatMap(body -> {
                            log.error("[Gemini Chat] HTTP {} error: {}", response.statusCode(), body);
                            return Mono.error(new RuntimeException(
                                    "Gemini Chat lỗi HTTP " + response.statusCode() + ": " + body));
                        }))
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(60))
                .retryWhen(reactor.util.retry.Retry.backoff(2, Duration.ofSeconds(5))
                        .doBeforeRetry(sig -> log.warn("[Gemini Chat] API bận/lỗi, đang thử lại lần {}/3...", sig.totalRetriesInARow() + 1)))
                .onErrorResume(e -> {
                    log.error("[Gemini Chat] Lỗi: {}", e.getMessage());
                    return Mono.error(new RuntimeException("Lỗi khi gọi Gemini API Chat: " + e.getMessage()));
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

    /**
     * Gọi Gemini API với raw JSON body (dùng cho group chat AI).
     */
    public String generateContent(String jsonBody) {
        String url = "/models/" + model + ":generateContent?key=" + apiKey;

        return webClient.post()
                .uri(url)
                .bodyValue(jsonBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                        response -> response.bodyToMono(String.class).flatMap(body -> {
                            log.error("[Gemini generateContent] HTTP {} error: {}", response.statusCode(), body);
                            return Mono.error(new RuntimeException(
                                    "Gemini API lỗi HTTP " + response.statusCode() + ": " + body));
                        }))
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(120))
                .retryWhen(Retry.backoff(2, Duration.ofSeconds(5)))
                .block();
    }

    /**
     * Gọi Gemini Embedding API để lấy vector ngữ nghĩa (Semantic Embedding)
     * Model sử dụng mặc định: gemini-embedding-2
     */
    public String getEmbedding(String text) {
        String url = "/models/gemini-embedding-2:embedContent?key=" + apiKey;

        String requestBody = """
            {
              "model": "models/gemini-embedding-2",
              "content": {
                "parts": [{"text": "%s"}]
              }
            }
            """.formatted(escapeJson(text));

        log.debug("[Gemini] Gọi Embedding model, textLen={}", text.length());

        try {
            String rawResponse = webClient.post()
                    .uri(url)
                    .bodyValue(requestBody)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                            response -> response.bodyToMono(String.class).flatMap(body -> {
                                log.error("[Gemini Embedding] HTTP {} error: {}", response.statusCode(), body);
                                return Mono.error(new RuntimeException(
                                        "Gemini Embedding lỗi HTTP " + response.statusCode() + ": " + body));
                            }))
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .retryWhen(Retry.backoff(3, Duration.ofSeconds(2)))
                    .block();

            JsonNode root = objectMapper.readTree(rawResponse);
            if (root.has("embedding") && root.get("embedding").has("values")) {
                return root.get("embedding").get("values").toString(); // Trả về chuỗi JSON "[0.12, -0.34, ...]"
            }
        } catch (Exception e) {
            log.error("[Gemini Embedding] Lỗi lấy hoặc parse vector embedding: ", e);
        }
        return null;
    }
}
