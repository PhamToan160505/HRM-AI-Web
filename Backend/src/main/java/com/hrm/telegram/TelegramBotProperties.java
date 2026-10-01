package com.hrm.telegram;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

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
     * Bỏ trống nếu dùng Long Polling mode.
     */
    private String webhookUrl = "";

    /**
     * Map Telegram username (lowercase, không @) → User ID trong DB.
     * Dùng để xác định người duyệt khi bot thực hiện hành động.
     * Ví dụ:
     *   user-id-map:
     *     zcap05: 1
     *     ceo_nguyen: 2
     */
    private Map<String, Long> userIdMap = new HashMap<>();

    /**
     * Chat ID của nhóm Telegram nhận thông báo tự động.
     * Lấy bằng cách thêm @userinfobot vào nhóm và gõ /start,
     * hoặc xem chatId trong log khi bot nhận tin nhắn từ nhóm.
     * Ví dụ: -1001234567890
     */
    private String groupChatId = "";
}
