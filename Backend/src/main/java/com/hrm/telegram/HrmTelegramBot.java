package com.hrm.telegram;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Message;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.util.List;

/**
 * Telegram Bot chính — sử dụng Long Polling mode.
 *
 * Luồng xử lý:
 *   1. Nhận message từ Telegram
 *   2. Kiểm tra quyền (allowedUsernames)
 *   3. Gọi Gemini AI để detect intent
 *   4. Query DB qua TelegramHrmDataService
 *   5. Trả lời lại chat/group
 */
@Slf4j
@Component
public class HrmTelegramBot extends TelegramLongPollingBot {

    private final TelegramBotProperties properties;
    private final TelegramHrmDataService dataService;
    private final TelegramAiIntentService intentService;

    // Telegrambots 6.x: phải truyền botToken vào super() constructor
    public HrmTelegramBot(TelegramBotProperties properties,
                          TelegramHrmDataService dataService,
                          TelegramAiIntentService intentService) {
        super(properties.getBotToken());
        this.properties = properties;
        this.dataService = dataService;
        this.intentService = intentService;
    }

    // ─── Lệnh nhanh (slash commands) ─────────────────────────────────────
    private static final String CMD_HELP        = "/help";
    private static final String CMD_NHANVIEN    = "/nhanvien";
    private static final String CMD_CHAMCONG    = "/chamcong";
    private static final String CMD_LUONG       = "/luong";
    private static final String CMD_TUYENDUNG   = "/tuyendung";
    private static final String CMD_REQUEST     = "/request";
    private static final String CMD_DASHBOARD   = "/dashboard";
    private static final String CMD_START       = "/start";

    @Override
    public String getBotToken() {
        return properties.getBotToken();
    }

    @Override
    public String getBotUsername() {
        return properties.getBotUsername();
    }

    @Override
    public void onUpdateReceived(Update update) {
        if (!update.hasMessage() || !update.getMessage().hasText()) {
            return;
        }

        Message message = update.getMessage();
        String chatId   = message.getChatId().toString();
        String text     = message.getText().trim();
        String username = message.getFrom().getUserName();
        String firstName = message.getFrom().getFirstName();
        String senderName = (username != null && !username.isEmpty()) ? "@" + username : firstName;

        log.info("Telegram message from {} (chatId={}): {}", senderName, chatId, text);

        // ─── Kiểm tra phân quyền ─────────────────────────────────────────
        if (!isAuthorized(username)) {
            sendReply(chatId, "⛔ Xin lỗi, bạn không có quyền sử dụng bot này.\n" +
                    "_Bot chỉ dành cho CEO và Giám đốc._", message.getMessageId());
            return;
        }

        // ─── Xử lý lệnh slash (ưu tiên trước AI) ──────────────────────────
        if (text.startsWith("/")) {
            handleSlashCommand(chatId, text.toLowerCase(), message.getMessageId(), senderName);
        } else {
            // ─── Xử lý ngôn ngữ tự nhiên qua AI ─────────────────────────
            handleNaturalLanguage(chatId, text, message.getMessageId(), senderName);
        }
    }

    // ─────────────────────────── Slash Commands ────────────────────────────

    private void handleSlashCommand(String chatId, String cmd, Integer replyToMsgId, String sender) {
        // Chỉ lấy phần trước space (để ignore @botname suffix)
        String baseCmd = cmd.split("\\s+")[0];
        // Bỏ @username suffix nếu có
        if (baseCmd.contains("@")) {
            baseCmd = baseCmd.substring(0, baseCmd.indexOf("@"));
        }

        String response = switch (baseCmd) {
            case CMD_START  -> buildWelcomeMessage(sender);
            case CMD_HELP   -> buildHelpMessage();
            case CMD_NHANVIEN   -> dataService.getEmployeeSummary();
            case CMD_CHAMCONG   -> dataService.getTodayAttendance();
            case CMD_LUONG      -> dataService.getPayrollSummary();
            case CMD_TUYENDUNG  -> dataService.getRecruitmentSummary();
            case CMD_REQUEST    -> dataService.getPendingRequestsSummary();
            case CMD_DASHBOARD  -> dataService.getFullDashboard();
            default -> "❓ Lệnh không nhận ra. Gõ /help để xem danh sách lệnh.";
        };

        sendReply(chatId, response, replyToMsgId);
    }

    // ─────────────────────────── Natural Language ──────────────────────────

    private void handleNaturalLanguage(String chatId, String text, Integer replyToMsgId, String sender) {
        // Gửi "typing..." indicator
        sendTypingAction(chatId);

        TelegramAiIntentService.Intent intent = intentService.detectIntent(text);
        log.info("Detected intent: {} for message: {}", intent, text);

        String response = switch (intent) {
            case EMPLOYEE_SUMMARY  -> dataService.getEmployeeSummary();
            case ATTENDANCE_TODAY  -> dataService.getTodayAttendance();
            case PAYROLL_SUMMARY   -> dataService.getPayrollSummary();
            case RECRUITMENT_SUMMARY -> dataService.getRecruitmentSummary();
            case PENDING_REQUESTS  -> dataService.getPendingRequestsSummary();
            case FULL_DASHBOARD    -> dataService.getFullDashboard();
            case HELP              -> buildHelpMessage();
            case UNKNOWN           -> buildUnknownResponse(text);
        };

        sendReply(chatId, response, replyToMsgId);
    }

    // ─────────────────────────── Helpers ───────────────────────────────────

    private boolean isAuthorized(String username) {
        List<String> allowed = properties.getAllowedUsernames();
        if (allowed == null || allowed.isEmpty()) {
            // Nếu không cấu hình whitelist → block tất cả (an toàn)
            log.warn("No allowed usernames configured! Blocking all users.");
            return false;
        }
        return username != null && allowed.contains(username.toLowerCase());
    }

    private void sendReply(String chatId, String text, Integer replyToMessageId) {
        SendMessage msg = SendMessage.builder()
                .chatId(chatId)
                .text(text)
                .parseMode("Markdown")
                .replyToMessageId(replyToMessageId)
                .build();
        try {
            execute(msg);
        } catch (TelegramApiException e) {
            log.error("Failed to send Telegram message to {}: {}", chatId, e.getMessage());
            // Thử gửi lại không có Markdown nếu parse error
            try {
                SendMessage fallback = SendMessage.builder()
                        .chatId(chatId)
                        .text(text.replaceAll("[*_`]", ""))
                        .build();
                execute(fallback);
            } catch (TelegramApiException ex) {
                log.error("Fallback send also failed: {}", ex.getMessage());
            }
        }
    }

    private void sendTypingAction(String chatId) {
        try {
            org.telegram.telegrambots.meta.api.methods.send.SendChatAction action =
                    org.telegram.telegrambots.meta.api.methods.send.SendChatAction.builder()
                            .chatId(chatId)
                            .action(org.telegram.telegrambots.meta.api.methods.ActionType.TYPING.toString())
                            .build();
            execute(action);
        } catch (Exception ignored) {}
    }

    private String buildWelcomeMessage(String sender) {
        return String.format("""
                🤖 *Chào mừng %s đến với HRM AI Bot!*
                
                Tôi có thể giúp bạn tra cứu thông tin nhân sự của công ty bằng tiếng Việt tự nhiên.
                
                ━━━━━━━━━━━━━━━━━━━━━━
                💡 *Ví dụ bạn có thể hỏi:*
                • "Hiện tại công ty có bao nhiêu nhân viên?"
                • "Hôm nay ai đi muộn?"
                • "Bảng lương tháng này thế nào?"
                • "Đang tuyển bao nhiêu vị trí?"
                • "Có yêu cầu nào chờ duyệt không?"
                
                Gõ /help để xem danh sách lệnh nhanh.
                """, sender);
    }

    private String buildHelpMessage() {
        return """
                📋 *DANH SÁCH LỆNH HRM AI BOT*
                ━━━━━━━━━━━━━━━━━━━━━━
                
                *Lệnh nhanh:*
                /dashboard — Tổng quan toàn bộ
                /nhanvien — Thống kê nhân viên
                /chamcong — Chấm công hôm nay
                /luong — Bảng lương tháng này
                /tuyendung — Tình hình tuyển dụng
                /request — Yêu cầu chờ phê duyệt
                /help — Hiển thị hướng dẫn này
                
                *Hỏi tự nhiên:*
                Bạn cũng có thể gõ câu hỏi bằng tiếng Việt tự nhiên, ví dụ:
                _"Hôm nay có bao nhiêu nhân viên đi muộn?"_
                _"Tổng chi phí lương tháng này là bao nhiêu?"_
                
                🔐 _Bot chỉ dành cho CEO và Giám đốc._
                """;
    }

    private String buildUnknownResponse(String originalText) {
        return String.format("""
                🤔 Tôi chưa hiểu rõ yêu cầu: _"%s"_
                
                Hãy thử:
                • Đặt câu hỏi rõ hơn về nhân sự, chấm công, lương, tuyển dụng
                • Dùng lệnh /help để xem danh sách lệnh có sẵn
                • Hoặc gõ /dashboard để xem tổng quan
                """, originalText.length() > 50 ? originalText.substring(0, 50) + "..." : originalText);
    }
}
