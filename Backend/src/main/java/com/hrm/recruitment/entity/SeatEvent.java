package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "seat_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SeatEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "seat_id", nullable = false) private Long seatId;
    @Column(name = "event_type", nullable = false, length = 60) private String eventType;
    @Column(name = "from_status", length = 20) private String fromStatus;
    @Column(name = "to_status", nullable = false, length = 20) private String toStatus;
    @Column(name = "application_id") private Long applicationId;
    @Column(name = "offer_id") private Long offerId;
    @Column(name = "actor_id") private Long actorId;
    @Column(length = 1000) private String reason;
    @Column(name = "idempotency_key", nullable = false, unique = true, length = 140) private String idempotencyKey;
    @CreationTimestamp @Column(name = "occurred_at", nullable = false, updatable = false) private LocalDateTime occurredAt;

    public static SeatEvent of(HiringSeat seat, String eventType, HiringSeatStatus from,
                               Long actorId, String reason, String idempotencyKey) {
        return of(seat, eventType, from, seat.getApplicationId(), seat.getOfferId(),
                actorId, reason, idempotencyKey);
    }

    public static SeatEvent of(HiringSeat seat, String eventType, HiringSeatStatus from,
                               Long applicationId, Long offerId, Long actorId,
                               String reason, String idempotencyKey) {
        SeatEvent event = new SeatEvent();
        event.seatId = seat.getId();
        event.eventType = eventType;
        event.fromStatus = from == null ? null : from.name();
        event.toStatus = seat.getStatus().name();
        event.applicationId = applicationId;
        event.offerId = offerId;
        event.actorId = actorId;
        event.reason = reason;
        event.idempotencyKey = idempotencyKey;
        return event;
    }
}
