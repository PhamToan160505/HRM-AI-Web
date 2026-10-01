package com.hrm.telegram;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

import jakarta.annotation.PostConstruct;

/**
 * Đăng ký HrmTelegramBot vào TelegramBotsApi để bắt đầu Long Polling.
 * Bọc try-catch và kiểm tra Token an toàn để không làm sập Spring Boot nếu Bot Token chưa được cấu hình.
 */
@Slf4j
@Configuration
public class TelegramBotConfig {

    private final HrmTelegramBot hrmTelegramBot;
    private final TelegramBotProperties properties;

    public TelegramBotConfig(@Autowired(required = false) HrmTelegramBot hrmTelegramBot,
                              TelegramBotProperties properties) {
        this.hrmTelegramBot = hrmTelegramBot;
        this.properties = properties;
    }

    @PostConstruct
    public void registerBot() {
        if (hrmTelegramBot == null) {
            log.warn("⚠️ HrmTelegramBot bean is not present. Skipping Telegram bot registration.");
            return;
        }

        String token = properties.getBotToken();
        if (token == null || token.isBlank() || "YOUR_BOT_TOKEN_HERE".equalsIgnoreCase(token.trim())) {
            log.warn("⚠️ Telegram Bot Token is missing or default placeholder. Skipping Telegram bot registration.");
            return;
        }

        try {
            TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
            botsApi.registerBot(hrmTelegramBot);
            log.info("✅ Telegram Bot @{} registered successfully and Long Polling started!", properties.getBotUsername());
        } catch (Throwable e) {
            log.error("⚠️ Unable to start Telegram bot (Backend will continue running normally): {}", e.getMessage());
        }
    }
}
