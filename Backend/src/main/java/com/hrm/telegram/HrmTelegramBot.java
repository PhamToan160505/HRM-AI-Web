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
        log.info("✅ HRM Telegram Bot initialized! Username: @{}", properties.getBotUsername());
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
    private static final String CMD_DUYET       = "/duyet";
    private static final String CMD_TUCHOI      = "/tuchoi";

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
            log.warn("Unauthorized user: username='{}', firstName='{}'", username, firstName);
            sendReply(chatId, "Xin loi, ban khong co quyen su dung bot nay.", message.getMessageId());
            return;
        }
        log.info("Authorized user: {}", senderName);

        // ─── Xử lý lệnh slash (ưu tiên trước AI) ──────────────────────────
        if (text.startsWith("/")) {
            handleSlashCommand(chatId, text.toLowerCase(), message.getMessageId(), senderName, username);
        } else {
            // ─── Xử lý ngôn ngữ tự nhiên qua AI ─────────────────────────
            handleNaturalLanguage(chatId, text, message.getMessageId(), senderName);
        }
    }

    // ─────────────────────────── Slash Commands ────────────────────────────

    private void handleSlashCommand(String chatId, String cmd, Integer replyToMsgId, String sender, String username) {
        // Tách base command và arguments — xử lý cả "/duyet 5" lẫn "/help@Hrmaii_bot"
        // cmd đã lowercase, ví dụ: "/nhanvien@hrmaii_bot" hoặc "/duyet 5 lý do"
        String[] parts = cmd.trim().split("\\s+", 3);
        String baseCmd = parts[0];
        // Bỏ @botname suffix trong base command
        if (baseCmd.contains("@")) {
            baseCmd = baseCmd.substring(0, baseCmd.indexOf("@"));
            parts[0] = baseCmd;
        }

        // Lấy managerId từ config map
        Long managerId = properties.getUserIdMap() != null
                ? properties.getUserIdMap().get(username != null ? username.toLowerCase() : "")
                : null;

        String response = switch (baseCmd) {
            case CMD_START      -> buildWelcomeMessage(sender);
            case CMD_HELP       -> buildHelpMessage();
            case CMD_NHANVIEN   -> dataService.getEmployeeSummary();
            case CMD_CHAMCONG   -> dataService.getTodayAttendance();
            case CMD_LUONG      -> dataService.getPayrollSummary();
            case CMD_TUYENDUNG  -> dataService.getRecruitmentSummary();
            case CMD_REQUEST    -> dataService.getPendingRequestsList();
            case CMD_DASHBOARD  -> dataService.getFullDashboard();
            case CMD_DUYET      -> handleDuyet(parts, managerId, sender);
            case CMD_TUCHOI     -> handleTuchoi(parts, managerId, sender);
            default -> "❓ Lệnh không nhận ra. Gõ /help để xem danh sách lệnh.";
        };

        sendReply(chatId, response, replyToMsgId);
    }

    private String handleDuyet(String[] parts, Long managerId, String sender) {
        if (managerId == null) {
            return "⛔ Bạn chưa được cấu hình userId. Liên hệ admin để thiết lập user-id-map trong config.";
        }
        if (parts.length < 2) {
            return "⚠️ Cú pháp: /duyet [ID đơn]\nVí dụ: /duyet 5";
        }
        try {
            long requestId = Long.parseLong(parts[1].trim());
            String note = parts.length > 2 ? parts[2].trim() : null;
            return dataService.approveRequestById(managerId, requestId, note);
        } catch (NumberFormatException e) {
            return "⚠️ ID đơn phải là số. Ví dụ: /duyet 5";
        }
    }

    private String handleTuchoi(String[] parts, Long managerId, String sender) {
        if (managerId == null) {
            return "⛔ Bạn chưa được cấu hình userId. Liên hệ admin để thiết lập user-id-map trong config.";
        }
        if (parts.length < 2) {
            return "⚠️ Cú pháp: /tuchoi [ID đơn] [lý do]\nVí dụ: /tuchoi 5 chưa đủ số ngày phép";
        }
        try {
            long requestId = Long.parseLong(parts[1].trim());
            String reason = parts.length > 2 ? parts[2].trim() : null;
            return dataService.rejectRequestById(managerId, requestId, reason);
        } catch (NumberFormatException e) {
            return "⚠️ ID đơn phải là số. Ví dụ: /tuchoi 5 lý do";
        }
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
            log.warn("No allowed usernames configured! Blocking all users.");
            return false;
        }
        if (username == null) return false;
        String userLower = username.toLowerCase();
        boolean authorized = allowed.stream()
                .anyMatch(a -> a.toLowerCase().equals(userLower));
        log.info("Auth check: username='{}' -> {}", username, authorized ? "ALLOWED" : "DENIED");
        return authorized;
    }

    private void sendReply(String chatId, String text, Integer replyToMessageId) {
        log.info("Sending reply to chatId={}: {}", chatId, text.substring(0, Math.min(50, text.length())));
        SendMessage msg = SendMessage.builder()
                .chatId(chatId)
                .text(text)
                .replyToMessageId(replyToMessageId)
                .build();
        try {
            execute(msg);
            log.info("Reply sent successfully to chatId={}", chatId);
        } catch (TelegramApiException e) {
            log.error("Failed to send Telegram message to {}: {}", chatId, e.getMessage(), e);
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
                🤖 Chào mừng %s đến với HRM AI Bot!
                
                Tôi có thể giúp bạn tra cứu thông tin nhân sự của công ty bằng tiếng Việt tự nhiên.
                
                ━━━━━━━━━━━━━━━━━━━━━━
                💡 Ví dụ bạn có thể hỏi:
                · "Hiện tại công ty có bao nhiêu nhân viên?"
                · "Hôm nay ai đi muộn?"
                · "Bảng lương tháng này thế nào?"
                · "Đang tuyển bao nhiêu vị trí?"
                · "Có yêu cầu nào chờ duyệt không?"
                
                Gõ /help để xem danh sách lệnh nhanh.
                """, sender);
    }

    private String buildHelpMessage() {
        return """
                📋 DANH SÁCH LỆNH HRM AI BOT
                ━━━━━━━━━━━━━━━━━━━━━━
                
                Lệnh nhanh:
                /dashboard — Tổng quan toàn bộ
                /nhanvien  — Thống kê nhân viên
                /chamcong  — Chấm công hôm nay
                /luong     — Bảng lương tháng này
                /tuyendung — Tình hình tuyển dụng
                /request   — Yêu cầu chờ phê duyệt
                /help      — Hiển thị hướng dẫn này
                
                Hỏi tự nhiên:
                Bạn cũng có thể gõ câu hỏi bằng tiếng Việt, ví dụ:
                "Hôm nay có bao nhiêu nhân viên đi muộn?"
                "Tổng chi phí lương tháng này là bao nhiêu?"
                
                🔐 Bot chỉ dành cho CEO và Giám đốc.
                """;
    }

    private String buildUnknownResponse(String originalText) {
        return """
                🤔 Tôi chưa hiểu rõ yêu cầu của bạn.
                
                Hãy thử:
                · Đặt câu hỏi rõ hơn về nhân sự, chấm công, lương, tuyển dụng
                · Dùng lệnh /help để xem danh sách lệnh có sẵn
                · Hoặc gõ /dashboard để xem tổng quan
                """;
    }
}
