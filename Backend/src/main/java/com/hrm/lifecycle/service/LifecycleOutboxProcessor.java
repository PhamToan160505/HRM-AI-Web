package com.hrm.lifecycle.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.admin.service.AccountCreationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.service.HiringSeatService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LifecycleOutboxProcessor {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final EmployeeLifecycleService lifecycleService;
    private final HiringSeatService seatService;
    private final AccountCreationService accountCreationService;

    public List<Long> pendingEventIds() {
        return jdbcTemplate.query("""
                SELECT id FROM outbox_events
                WHERE status = 'PENDING' AND next_attempt_at <= NOW(6)
                  AND event_type IN ('OFFER_ACCEPTED','EMPLOYEE_JOINED','ONBOARD_CANCELLED','ENSURE_ACCOUNT_ACTIVE')
                ORDER BY id LIMIT 20
                """, (rs, row) -> rs.getLong(1));
    }

    @Transactional
    public void process(Long outboxId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, event_id, event_type, schema_version, payload, aggregate_id
                FROM outbox_events WHERE id = ? AND status = 'PENDING' FOR UPDATE
                """, outboxId);
        if (rows.isEmpty()) return;
        Map<String, Object> event = rows.get(0);
        String eventType = (String) event.get("event_type");
        String payloadJson = String.valueOf(event.get("payload"));
        JsonNode payload = parse(payloadJson);

        switch (eventType) {
            case "OFFER_ACCEPTED" -> lifecycleService.consumeOfferAccepted(
                    (String) event.get("event_id"), eventType,
                    ((Number) event.get("schema_version")).intValue(), payloadJson);
            case "EMPLOYEE_JOINED" -> seatService.join(
                    requiredLong(payload, "seat_id"), requiredLong(payload, "application_id"),
                    "outbox:" + event.get("event_id"));
            case "ONBOARD_CANCELLED" -> processOnboardCancelled(payload, (String) event.get("event_id"));
            case "ENSURE_ACCOUNT_ACTIVE" -> accountCreationService.ensureActiveForEmployee(
                    requiredLong(payload, "employee_id"));
            default -> throw AppException.badRequest("Loại sự kiện vòng đời không được hỗ trợ");
        }
        jdbcTemplate.update("""
                UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW(6), last_error = NULL
                WHERE id = ?
                """, outboxId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(Long outboxId, String error) {
        String safeError = error == null ? "Unknown lifecycle consumer error" : error;
        jdbcTemplate.update("""
                UPDATE outbox_events
                SET attempt_count = attempt_count + 1,
                    status = CASE WHEN attempt_count + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END,
                    next_attempt_at = DATE_ADD(NOW(6), INTERVAL LEAST(60, POW(2, attempt_count + 1)) SECOND),
                    last_error = ?
                WHERE id = ? AND status = 'PENDING'
                """, safeError.substring(0, Math.min(safeError.length(), 1000)), outboxId);
        jdbcTemplate.update("""
                UPDATE account_creation_requests acr
                JOIN outbox_events oe ON oe.aggregate_id = CAST(acr.employee_id AS CHAR)
                SET acr.status = 'FAILED', acr.last_error = ?, acr.retry_count = acr.retry_count + 1
                WHERE oe.id = ? AND oe.event_type = 'ENSURE_ACCOUNT_ACTIVE'
                """, safeError.substring(0, Math.min(safeError.length(), 1000)), outboxId);
    }

    private void processOnboardCancelled(JsonNode payload, String eventId) {
        long seatId = requiredLong(payload, "seat_id");
        long applicationId = requiredLong(payload, "application_id");
        String reason = payload.path("reason_code").asText("Ứng viên không nhận việc");
        seatService.release(seatId, null, reason, "outbox:" + eventId);
        Long requisitionId = jdbcTemplate.queryForObject(
                "SELECT requisition_id FROM hiring_seats WHERE id = ?", Long.class, seatId);
        jdbcTemplate.update("""
                INSERT INTO recruitment_tasks(task_type, requisition_id, application_id, seat_id, status, details)
                VALUES ('REOPEN_REVIEW_REQUIRED', ?, ?, ?, 'OPEN',
                        JSON_OBJECT('reason', ?, 'source_event_id', ?))
                """, requisitionId, applicationId, seatId, reason, eventId);
    }

    private JsonNode parse(String payload) {
        try { return objectMapper.readTree(payload); }
        catch (Exception exception) { throw AppException.badRequest("Payload outbox không hợp lệ"); }
    }

    private long requiredLong(JsonNode payload, String field) {
        JsonNode value = payload.get(field);
        if (value == null || !value.canConvertToLong()) throw AppException.badRequest("Thiếu " + field);
        return value.asLong();
    }
}

@Component
@RequiredArgsConstructor
class LifecycleOutboxPoller {

    private final LifecycleOutboxProcessor processor;

    @Scheduled(fixedDelayString = "${app.lifecycle.outbox-poll-ms:2000}", initialDelayString = "${app.lifecycle.outbox-initial-delay-ms:3000}")
    public void poll() {
        for (Long eventId : processor.pendingEventIds()) {
            try {
                processor.process(eventId);
            } catch (Exception exception) {
                processor.recordFailure(eventId, exception.getMessage());
            }
        }
    }
}
