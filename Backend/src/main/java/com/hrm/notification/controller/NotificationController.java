package com.hrm.notification.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.notification.entity.Notification;
import com.hrm.notification.service.NotificationService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Notification>>> getNotifications(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<Notification> notifications = notificationService.getNotificationsForUser(userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(notifications, "Lấy thông báo thành công"));
    }

    @PatchMapping("/{id}/read")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        notificationService.markAsRead(id, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã đánh dấu đọc"));
    }

    // NÚT TEST TẠM THỜI (SẼ BỎ KHI LÊN PROD)
    @PostMapping("/test-send")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Notification>> testSendNotification(@AuthenticationPrincipal CustomUserDetails userDetails) {
        Notification notification = notificationService.createNotification(
                userDetails.getUserId(),
                "test",
                "Thông báo Test",
                "Đây là thông báo test WebSocket lúc: " + System.currentTimeMillis(),
                "khan",
                "/test"
        );
        return ResponseEntity.ok(ApiResponse.ok(notification, "Gửi test thành công"));
    }
}
