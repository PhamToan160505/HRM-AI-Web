package com.hrm.ai.controller;

import com.hrm.ai.entity.ChatMessage;
import com.hrm.ai.service.ChatbotService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatbotService chatbotService;

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<ChatMessage> history = chatbotService.getChatHistory(userDetails.getUserId());
        return ResponseEntity.ok(Map.of("success", true, "data", history));
    }

    @PostMapping("/ask")
    public ResponseEntity<?> askChatbot(@AuthenticationPrincipal CustomUserDetails userDetails,
                                        @RequestBody Map<String, String> request) {
        String message = request.get("message");
        if (message == null || message.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Message is required"));
        }

        try {
            String answer = chatbotService.handleUserMessage(userDetails, message);
            return ResponseEntity.ok(Map.of("success", true, "data", answer));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @DeleteMapping("/history")
    public ResponseEntity<?> clearHistory(@AuthenticationPrincipal CustomUserDetails userDetails) {
        chatbotService.clearHistory(userDetails.getUserId());
        return ResponseEntity.ok(Map.of("success", true, "message", "Chat history cleared"));
    }
}
