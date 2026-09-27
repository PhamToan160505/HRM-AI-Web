package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "outbox_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OutboxEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "event_id", nullable = false, unique = true, length = 36) private String eventId;
    @Column(name = "event_type", nullable = false, length = 80) private String eventType;
    @Column(name = "schema_version", nullable = false) private Integer schemaVersion;
    @Column(name = "correlation_id", nullable = false, length = 100) private String correlationId;
    @Column(nullable = false, length = 60) private String producer;
    @Column(name = "aggregate_type", nullable = false, length = 60) private String aggregateType;
    @Column(name = "aggregate_id", nullable = false, length = 100) private String aggregateId;
    @Column(nullable = false, columnDefinition = "JSON") private String payload;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20) private OutboxEventStatus status;
    @Column(name = "attempt_count", nullable = false) private Integer attemptCount;
    @Column(name = "next_attempt_at", nullable = false) private LocalDateTime nextAttemptAt;
    @Column(name = "published_at") private LocalDateTime publishedAt;
    @Column(name = "last_error", length = 1000) private String lastError;
    @CreationTimestamp @Column(name = "occurred_at", nullable = false, updatable = false) private LocalDateTime occurredAt;

    public static OutboxEvent pending(String eventType, String correlationId,
                                      String aggregateType, Long aggregateId, String payload) {
        OutboxEvent event = new OutboxEvent();
        event.eventId = UUID.randomUUID().toString();
        event.eventType = eventType;
        event.schemaVersion = 1;
        event.correlationId = correlationId == null || correlationId.isBlank()
                ? UUID.randomUUID().toString() : correlationId;
        event.producer = "recruitment";
        event.aggregateType = aggregateType;
        event.aggregateId = aggregateId.toString();
        event.payload = payload;
        event.status = OutboxEventStatus.PENDING;
        event.attemptCount = 0;
        event.nextAttemptAt = LocalDateTime.now();
        return event;
    }
}
