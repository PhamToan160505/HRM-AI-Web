package com.hrm.chat.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisMessageSubscriber implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            // Get string content from Redis message
            String jsonPayload = new String(message.getBody(), StandardCharsets.UTF_8);
            
            // Note: When using GenericJackson2JsonRedisSerializer, the string might have quotes or be a complex JSON.
            // Let's parse it safely to a Map
            Map<String, Object> payload;
            
            // Often GenericJackson2JsonRedisSerializer serializes string containing JSON as "\"{\\\"id\\\":...}\""
            // or directly as the object. Let's try to decode.
            try {
                 // Try to deserialize directly
                 payload = objectMapper.readValue(jsonPayload, new TypeReference<Map<String, Object>>() {});
            } catch (Exception e) {
                 // If it was serialized as a String first by RedisTemplate
                 String innerJson = objectMapper.readValue(jsonPayload, String.class);
                 payload = objectMapper.readValue(innerJson, new TypeReference<Map<String, Object>>() {});
            }

            if (payload != null && payload.containsKey("groupId")) {
                Long groupId = ((Number) payload.get("groupId")).longValue();
                
                // Broadcast to local WebSocket clients
                messagingTemplate.convertAndSend("/topic/group/" + groupId, payload);
            }
        } catch (Exception e) {
            log.error("Failed to process Redis message", e);
        }
    }
}
