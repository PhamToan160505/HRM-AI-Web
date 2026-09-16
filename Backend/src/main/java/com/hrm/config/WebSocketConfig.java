package com.hrm.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import com.hrm.security.JwtUtil;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;

/**
 * WebSocket STOMP config — dùng cho hệ thống thông báo real-time (Bước 3).
 * Frontend dùng @stomp/stompjs + sockjs-client, KHÔNG phải socket.io-client.
 * Cấu hình sẵn ở đây, NotificationService sẽ dùng khi implement Bước 3.
 */
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtil jwtUtil;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // CORS cho WS handshake (refinement ở prod)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Client gửi message lên server: /app/...
        config.setApplicationDestinationPrefixes("/app");

        // Server push về client: /user/{userId}/queue/notifications
        config.enableSimpleBroker("/queue", "/topic");

        // Prefix cho user-specific destinations
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        if (jwtUtil.isValid(token)) {
                            CustomUserDetails userDetails = new CustomUserDetails(
                                jwtUtil.getUserId(token),
                                null,
                                jwtUtil.getRole(token),
                                jwtUtil.getDepartmentId(token),
                                jwtUtil.getTeamId(token),
                                jwtUtil.getHoTen(token)
                            );
                            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());
                            accessor.setUser(authentication);
                            System.out.println("STOMP Auth Success for User: " + userDetails.getUserId());
                        } else {
                            System.out.println("STOMP Auth Failed: Invalid JWT Token");
                        }
                    } else {
                        System.out.println("STOMP Auth Failed: No Authorization header found. Headers: " + accessor.toMap());
                    }
                }
                return message;
            }
        });
    }
}
