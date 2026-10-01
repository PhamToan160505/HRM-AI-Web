package com.hrm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Gemini API WebClient bean dùng chung — theo SKILL_backend-patterns.md mục 6.
 *
 * Model mặc định: gemini-3.5-flash-lite — model ổn định có Free Tier,
 * phù hợp cho phân tích văn bản, hình ảnh và tài liệu PDF.
 * GEMINI_API_KEY bắt buộc từ biến môi trường — throw khi start nếu thiếu.
 *
 * Mọi AI service (CvExtractionService, SemanticFitScoreService, v.v.) inject bean này,
 * không tự tạo WebClient riêng.
 */
@Configuration
public class GeminiConfig {

    @Value("${app.gemini.api-key}")
    private String apiKey;

    @Value("${app.gemini.base-url}")
    private String baseUrl;

    @Bean(name = "geminiWebClient")
    public WebClient geminiWebClient() {
        return WebClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("x-goog-api-key", apiKey)
                .defaultHeader("Content-Type", "application/json")
                .codecs(configurer -> configurer.defaultCodecs()
                        .maxInMemorySize(10 * 1024 * 1024)) // 10MB cho multimodal (CV + ảnh CCCD)
                .build();
    }
}
