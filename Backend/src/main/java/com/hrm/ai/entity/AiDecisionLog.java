package com.hrm.ai.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_decision_logs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiDecisionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long applicationId; // Tham chiếu đến Application id, không join cứng để dễ tách microservice nếu cần

    @Column(nullable = false)
    private String actionType; // OCR, FIT_SCORE, FRAUD_DETECTION

    @Column(columnDefinition = "TEXT")
    private String rawRequest; // Request gốc gửi đi Gemini

    @Column(columnDefinition = "TEXT")
    private String rawResponse; // Response gốc từ Gemini

    @Column(columnDefinition = "TEXT")
    private String decisionReason; // Lý do rút gọn

    @Column
    private Boolean isSuccess; // Thành công hay timeout/lỗi

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
