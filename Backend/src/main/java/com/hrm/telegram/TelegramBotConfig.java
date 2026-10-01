package com.hrm.telegram;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

import jakarta.annotation.PostConstruct;

/**
 * Đăng ký HrmTelegramBot vào TelegramBotsApi để bắt đầu Long Polling.
 * Spring Boot Starter tự động tạo TelegramBotsApi nhưng không tự đăng ký bean —
 * cần @PostConstruct để gọi registerBot() sau khi Spring context sẵn sàng.
 */
@Slf4j
@Configuration
public class TelegramBotConfig {

    private final HrmTelegramBot hrmTelegramBot;

    public TelegramBotConfig(HrmTelegramBot hrmTelegramBot) {
        this.hrmTelegramBot = hrmTelegramBot;
    }

    @PostConstruct
    public void registerBot() {
        try {
            TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
            botsApi.registerBot(hrmTelegramBot);
            log.info("✅ @Hrmaii_bot registered and Long Polling started!");
        } catch (TelegramApiException e) {
            log.error("❌ Failed to register Telegram bot: {}", e.getMessage(), e);
        }
    }
}
