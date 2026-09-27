package com.hrm.recruitment.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "application_transition_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApplicationTransitionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RecruitmentEntityType entityType;

    @Column(nullable = false)
    private Long entityId;

    private Long actorId;

    @Column(length = 50)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private RecruitmentAction action;

    @Column(length = 50)
    private String fromStatus;

    @Column(nullable = false, length = 50)
    private String toStatus;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(length = 100)
    private String requestId;

    @Column(nullable = false, unique = true, length = 100)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime occurredAt;

    public static ApplicationTransitionLog create(
            RecruitmentEntityType entityType,
            Long entityId,
            Long actorId,
            String actorRole,
            RecruitmentAction action,
            String fromStatus,
            String toStatus,
            String comment,
            String requestId,
            String idempotencyKey) {
        ApplicationTransitionLog log = new ApplicationTransitionLog();
        log.entityType = entityType;
        log.entityId = entityId;
        log.actorId = actorId;
        log.actorRole = actorRole;
        log.action = action;
        log.fromStatus = fromStatus;
        log.toStatus = toStatus;
        log.comment = comment;
        log.requestId = requestId;
        log.idempotencyKey = idempotencyKey;
        return log;
    }
}
