package com.hrm.chat.controller;

import com.hrm.ai.service.ChatbotService;
import com.hrm.chat.entity.GroupMessage;
import com.hrm.chat.repository.GroupMessageRepository;
import com.hrm.security.CustomUserDetails;
import com.hrm.config.RedisConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.util.Map;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {
    
    private final SimpMessagingTemplate messagingTemplate;
    private final GroupMessageRepository groupMessageRepository;
    private final ChatbotService chatbotService;
    private final com.hrm.common.repository.UserRepository userRepository;
    private final com.hrm.common.repository.DepartmentRepository departmentRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ObjectMapper objectMapper;
    private final com.hrm.email.service.EmailService emailService;
    private final com.hrm.chat.repository.ChatGroupRepository chatGroupRepository;
    private final com.hrm.chat.repository.ChatGroupMemberRepository chatGroupMemberRepository;

    public record GroupChatMessageRequest(Long groupId, String content, java.util.List<Long> taggedUserIds) {}
    public record RecallMessageRequest(Long messageId, String mode) {}

    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload GroupChatMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        Authentication auth = (Authentication) headerAccessor.getUser();
        if (auth == null || !auth.isAuthenticated()) {
            log.error("STOMP sendMessage failed: auth is null or not authenticated. Headers: {}", headerAccessor.toMap());
            return;
        }

        CustomUserDetails user = (CustomUserDetails) auth.getPrincipal();
        Long senderId = user.getUserId();
        String senderName = user.getHoTen();

        boolean isPrivateMessage = request.content() != null && request.content().contains("@AI-pv");
        
        // 1. Save user message to DB
        GroupMessage message = GroupMessage.builder()
                .groupId(request.groupId())
                .senderId(senderId)
                .isAi(false)
                .content(request.content())
                .privateUserId(isPrivateMessage ? senderId : null)
                .build();
        final GroupMessage savedMessage = groupMessageRepository.save(message);

        // Update sender's lastReadMessageId so they don't see their own message as unread
        chatGroupMemberRepository.findByGroupIdAndUserId(request.groupId(), senderId).ifPresent(member -> {
            if (member.getLastReadMessageId() == null || savedMessage.getId() > member.getLastReadMessageId()) {
                member.setLastReadMessageId(savedMessage.getId());
                chatGroupMemberRepository.save(member);
            }
        });

        com.hrm.common.entity.User dbUser = userRepository.findById(senderId).orElse(null);
        String senderRoleDisplay = "";
        if (dbUser != null) {
            String roleStr = switch (dbUser.getRole().name()) {
                case "CEO" -> "CEO";
                case "GIAM_DOC_PHONG_BAN" -> "Giám đốc";
                case "TRUONG_PHONG" -> "Trưởng phòng";
                case "NHAN_VIEN" -> "Nhân viên";
                default -> "Quản trị viên";
            };
            String deptName = "";
            if (dbUser.getDepartmentId() != null) {
                deptName = departmentRepository.findById(dbUser.getDepartmentId())
                        .map(d -> d.getTenPhong())
                        .orElse("");
            }
            if (!deptName.isEmpty() && !roleStr.equals("CEO")) {
                senderRoleDisplay = roleStr + " " + deptName;
            } else {
                senderRoleDisplay = roleStr;
            }
        }

        // 2. Broadcast user message to Redis (so all instances get it)
        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "CHAT");
            payload.put("id", savedMessage.getId());
            payload.put("groupId", savedMessage.getGroupId());
            payload.put("senderId", senderId);
            payload.put("senderName", senderName);
            payload.put("senderRole", senderRoleDisplay);
            payload.put("privateUserId", isPrivateMessage ? senderId : -1L);
            payload.put("isAi", false);
            payload.put("isRecalled", false);
            payload.put("content", savedMessage.getContent());
            payload.put("createdAt", savedMessage.getCreatedAt().toString());
            
            String jsonPayload = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend(RedisConfig.CHAT_TOPIC, jsonPayload);
        } catch (Exception e) {
            log.error("Failed to publish user message to Redis", e);
        }

        // Send email notifications if anyone is tagged
        if (request.taggedUserIds() != null && !request.taggedUserIds().isEmpty()) {
            java.util.List<Long> targets = new java.util.ArrayList<>(request.taggedUserIds());
            if (targets.contains(-1L)) {
                // @All tag
                targets = chatGroupMemberRepository.findByGroupId(request.groupId()).stream()
                        .map(m -> m.getUserId())
                        .filter(id -> !id.equals(senderId))
                        .collect(java.util.stream.Collectors.toList());
            } else {
                targets.remove(senderId);
            }
            
            if (!targets.isEmpty()) {
                String groupName = chatGroupRepository.findById(request.groupId())
                        .map(g -> g.getName()).orElse("Nhóm chat");
                        
                for (Long targetId : targets) {
                    com.hrm.common.entity.User targetUser = userRepository.findById(targetId).orElse(null);
                    if (targetUser != null && targetUser.getEmail() != null) {
                        emailService.sendChatTagNotification(
                            targetUser.getEmail(), 
                            targetUser.getHoTen(), 
                            senderName, 
                            groupName, 
                            request.content()
                        );
                    }
                }
            }
        }

        // 3. Check for @AI, @AI-pv, @AI-pl tags
        if (request.content() != null) {
            boolean isPrivateAi = request.content().contains("@AI-pv");
            boolean isPublicAi = request.content().contains("@AI-pl") || request.content().contains("@AI ");
            
            if (isPrivateAi || isPublicAi) {
                Long privateUserId = isPrivateAi ? senderId : null;
                handleAiResponse(request.groupId(), request.content(), senderId, senderName, privateUserId);
            }
        }
    }

    private void handleAiResponse(Long groupId, String userMessage, Long senderId, String senderName, Long privateUserId) {
        new Thread(() -> {
            try {
                String cleanMessage = userMessage
                        .replace("@AI-pv", "")
                        .replace("@AI-pl", "")
                        .replace("@AI", "").trim();
                String aiResponseText = chatbotService.handleGroupMessage(groupId, senderId, cleanMessage);
                
                GroupMessage aiMessage = GroupMessage.builder()
                        .groupId(groupId)
                        .senderId(null)
                        .isAi(true)
                        .content(aiResponseText)
                        .privateUserId(privateUserId)
                        .build();
                aiMessage = groupMessageRepository.save(aiMessage);

                java.util.Map<String, Object> aiPayload = new java.util.HashMap<>();
                aiPayload.put("type", "CHAT");
                aiPayload.put("id", aiMessage.getId());
                aiPayload.put("groupId", aiMessage.getGroupId());
                aiPayload.put("senderId", -1L);
                aiPayload.put("senderName", "Trợ lý AI");
                aiPayload.put("senderRole", "AI Assistant");
                aiPayload.put("privateUserId", privateUserId != null ? privateUserId : -1L);
                aiPayload.put("isAi", true);
                aiPayload.put("isRecalled", false);
                aiPayload.put("content", aiMessage.getContent());
                aiPayload.put("createdAt", aiMessage.getCreatedAt().toString());
                
                String jsonPayload = objectMapper.writeValueAsString(aiPayload);
                redisTemplate.convertAndSend(RedisConfig.CHAT_TOPIC, jsonPayload);

            } catch (Exception e) {
                log.error("Error generating AI response for group chat", e);
            }
        }).start();
    }

    @MessageMapping("/chat.recallMessage")
    public void recallMessage(@Payload RecallMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        Authentication auth = (Authentication) headerAccessor.getUser();
        if (auth == null || !auth.isAuthenticated()) return;
        CustomUserDetails user = (CustomUserDetails) auth.getPrincipal();
        Long senderId = user.getUserId();

        GroupMessage message = groupMessageRepository.findById(request.messageId()).orElse(null);
        if (message == null) return;

        if (message.getSenderId() == null || !message.getSenderId().equals(senderId)) return;

        if ("EVERYONE".equals(request.mode())) {
            message.setRecalled(true);
        } else if ("SENDER".equals(request.mode())) {
            message.setDeletedBySender(true);
        }
        
        groupMessageRepository.save(message);

        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "RECALL");
            payload.put("messageId", message.getId());
            payload.put("groupId", message.getGroupId());
            payload.put("mode", request.mode());
            payload.put("senderId", senderId);
            
            String jsonPayload = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend(RedisConfig.CHAT_TOPIC, jsonPayload);
        } catch (Exception e) {
            log.error("Failed to publish recall message to Redis", e);
        }
    }
}

