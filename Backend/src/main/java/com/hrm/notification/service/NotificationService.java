package com.hrm.notification.service;

import com.hrm.notification.entity.Notification;
import com.hrm.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public Notification createNotification(Long userId, String loai, String tieuDe, String noiDung, String mucDo, String lienKet) {
        Notification notification = Notification.builder()
                .userId(userId)
                .loai(loai)
                .tieuDe(tieuDe)
                .noiDung(noiDung)
                .mucDo(mucDo != null ? mucDo : "binh_thuong")
                .lienKet(lienKet)
                .daDoc(false)
                .build();

        Notification saved = notificationRepository.save(notification);

        // Push qua WebSocket STOMP
        messagingTemplate.convertAndSendToUser(
                userId.toString(), 
                "/queue/notifications", 
                saved
        );

        return saved;
    }

    public List<Notification> getNotificationsForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public void markAsRead(Long notificationId, Long currentUserId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        
        if (!notification.getUserId().equals(currentUserId)) {
            throw new RuntimeException("Access Denied");
        }
        
        notification.setDaDoc(true);
        notificationRepository.save(notification);
    }
}
