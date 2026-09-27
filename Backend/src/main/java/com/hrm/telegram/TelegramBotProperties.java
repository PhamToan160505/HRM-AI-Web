package com.hrm.telegram;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Bind cấu hình Telegram Bot từ application.yml (prefix: app.telegram).
 * Ví dụ:
 *   app:
 *     telegram:
 *       bot-token: "123456:ABC..."
 *       bot-username: "HrmAiBot"
 *       allowed-usernames:
 *         - "giamdocA"
 *         - "ceo_nguyen"
 */
@Data
@ConfigurationProperties(prefix = "app.telegram")
public class TelegramBotProperties {

    /** Bot token từ BotFather */
    private String botToken;

    /** Username của bot (không có @) */
    private String botUsername;

    /**
     * Danh sách Telegram username (không có @) được phép dùng bot.
     * Nếu rỗng → mọi người đều dùng được (không khuyến khích production).
     */
    private List<String> allowedUsernames = List.of();

    /**
     * Webhook URL đầy đủ (nếu dùng webhook mode).
     * VD: https://your-domain.com/api/telegram/webhook
     * Bỏ trống nếu dùng Long Polling mode.
     */
    private String webhookUrl = "";
}
