package com.hrm.recruitment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.email.service.EmailService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Outbox processor xử lý các sự kiện tuyển dụng (INTERVIEW_SCHEDULED, v.v.)
 * Tách biệt với LifecycleOutboxProcessor để dễ mở rộng và bảo trì.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecruitmentOutboxProcessor {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final OfferTokenService offerTokenService;

    @Value("${app.public-web-base-url:${APP_PUBLIC_WEB_BASE_URL:http://localhost:5173}}")
    private String publicWebBaseUrl;

    private static final DateTimeFormatter VN_FORMATTER =
            DateTimeFormatter.ofPattern("HH:mm, dd/MM/yyyy");
    private static final List<String> HANDLED_TYPES = List.of(
            "INTERVIEW_SCHEDULED",
            "OFFER_DISPATCH_REQUESTED",
            "OFFER_DISPATCH_EXTENDED");

    public List<Long> pendingEventIds() {
        String placeholders = String.join(",", HANDLED_TYPES.stream().map(t -> "?").toList());
        Object[] params = new Object[HANDLED_TYPES.size() + 0];
        for (int i = 0; i < HANDLED_TYPES.size(); i++) params[i] = HANDLED_TYPES.get(i);
        return jdbcTemplate.query("""
                SELECT id FROM outbox_events
                WHERE status = 'PENDING' AND next_attempt_at <= NOW(6)
                  AND event_type IN (%s)
                ORDER BY id LIMIT 20
                """.formatted(placeholders), (rs, row) -> rs.getLong(1), params);
    }

    @Transactional
    public void process(Long outboxId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, event_id, event_type, payload
                FROM outbox_events WHERE id = ? AND status = 'PENDING' FOR UPDATE
                """, outboxId);
        if (rows.isEmpty()) return;

        Map<String, Object> event = rows.get(0);
        String eventType = (String) event.get("event_type");
        JsonNode payload = parse(String.valueOf(event.get("payload")));

        switch (eventType) {
            case "INTERVIEW_SCHEDULED" -> processInterviewScheduled(payload);
            case "OFFER_DISPATCH_REQUESTED", "OFFER_DISPATCH_EXTENDED" -> processOfferDispatch(payload);
            default -> throw AppException.badRequest("Sự kiện tuyển dụng không được hỗ trợ: " + eventType);
        }

        jdbcTemplate.update("""
                UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW(6), last_error = NULL
                WHERE id = ?
                """, outboxId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(Long outboxId, String error) {
        String safeError = error == null ? "Unknown recruitment outbox error" : error;
        jdbcTemplate.update("""
                UPDATE outbox_events
                SET attempt_count = attempt_count + 1,
                    status = CASE WHEN attempt_count + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END,
                    next_attempt_at = DATE_ADD(NOW(6), INTERVAL LEAST(60, POW(2, attempt_count + 1)) SECOND),
                    last_error = ?
                WHERE id = ? AND status = 'PENDING'
                """, safeError.substring(0, Math.min(safeError.length(), 1000)), outboxId);
    }

    // ── Handlers ────────────────────────────────────────────────────────────────

    private void processInterviewScheduled(JsonNode payload) {
        String candidateEmail = payload.path("candidate_email").asText(null);
        String candidateName  = payload.path("candidate_name").asText("Ứng viên");
        long interviewId      = payload.path("interview_id").asLong();
        int  round            = payload.path("round").asInt(1);

        // Lấy chi tiết lịch phỏng vấn từ DB để điền email
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT i.scheduled_start, i.scheduled_end, i.interview_mode,
                       i.location, i.meeting_url, i.application_id,
                       a.full_name AS candidate_name, jp.title AS job_title
                FROM interviews i
                JOIN applications a ON a.id = i.application_id
                JOIN job_postings jp ON jp.id = a.job_posting_id
                WHERE i.id = ?
                """, interviewId);

        if (rows.isEmpty()) {
            log.warn("INTERVIEW_SCHEDULED: Không tìm thấy interview id={}", interviewId);
            return;
        }

        Map<String, Object> row = rows.get(0);
        String jobTitle      = (String) row.get("job_title");
        String mode          = (String) row.get("interview_mode");
        String location      = (String) row.get("location");
        String meetingUrl    = (String) row.get("meeting_url");
        String locationOrLink = (location != null && !location.isBlank()) ? location
                : (meetingUrl != null && !meetingUrl.isBlank()) ? meetingUrl : null;

        String startFormatted = formatDateTime(row.get("scheduled_start"));
        String endFormatted   = formatDateTime(row.get("scheduled_end"));
        long applicationId    = ((Number) row.get("application_id")).longValue();
        if (candidateName == null || candidateName.isBlank()) {
            candidateName = String.valueOf(row.get("candidate_name"));
        }

        if (candidateEmail == null || candidateEmail.isBlank()) {
            log.warn("INTERVIEW_SCHEDULED: Không có email ứng viên trong payload (interviewId={}).", interviewId);
        } else {
            emailService.sendInterviewScheduledEmail(
                    candidateEmail, candidateName, jobTitle,
                    round, startFormatted, endFormatted,
                    mode, locationOrLink
            );
            log.info("INTERVIEW_SCHEDULED: Đã kích hoạt gửi email lịch phỏng vấn vòng {} cho {} (interviewId={})",
                    round, candidateEmail, interviewId);
        }

        List<Long> participantIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT participant.user_id
                FROM interview_participants participant
                JOIN users ON users.id = participant.user_id
                WHERE participant.interview_id = ? AND users.active = b'1'
                  AND participant.invitation_status = 'PENDING'
                """, Long.class, interviewId);
        String notificationBody = "Bạn được mời tham gia phỏng vấn " + candidateName
                + " cho vị trí " + jobTitle + " vào " + startFormatted
                + ". Vui lòng mở hồ sơ để chấp nhận hoặc từ chối lời mời.";
        String notificationLink = "/recruitment/applications/" + applicationId;
        participantIds.forEach(userId -> notificationService.createNotification(
                userId,
                "INTERVIEW_INVITATION",
                "Lời mời phỏng vấn vòng " + round,
                notificationBody,
                "binh_thuong",
                notificationLink));
    }

    private void processOfferDispatch(JsonNode payload) {
        long dispatchId = payload.hasNonNull("dispatch_id")
                ? payload.path("dispatch_id").asLong()
                : payload.path("new_dispatch_id").asLong();
        if (dispatchId <= 0) {
            throw AppException.badRequest("Payload gửi offer thiếu dispatch_id");
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT d.dispatch_key, d.response_deadline, d.status,
                       a.email AS candidate_email, a.full_name AS candidate_name,
                       jp.title AS job_title, o.version_number
                FROM offer_dispatches d
                JOIN offers o ON o.id = d.offer_id
                JOIN applications a ON a.id = o.application_id
                JOIN job_postings jp ON jp.id = a.job_posting_id
                WHERE d.id = ?
                """, dispatchId);
        if (rows.isEmpty()) {
            throw AppException.notFound("Không tìm thấy lần gửi offer id=" + dispatchId);
        }

        Map<String, Object> row = rows.get(0);
        String candidateEmail = (String) row.get("candidate_email");
        if (candidateEmail == null || candidateEmail.isBlank()) {
            throw AppException.badRequest("Hồ sơ ứng viên chưa có email để nhận offer");
        }
        String dispatchKey = String.valueOf(row.get("dispatch_key"));
        String token = offerTokenService.tokenFor(dispatchKey);
        String offerUrl = publicWebBaseUrl.replaceAll("/+$", "") + "/offer/" + token;
        emailService.sendOfferEmail(
                candidateEmail,
                String.valueOf(row.get("candidate_name")),
                String.valueOf(row.get("job_title")),
                ((Number) row.get("version_number")).intValue(),
                formatDateTime(row.get("response_deadline")),
                offerUrl);
        log.info("Đã gửi email offer version {} cho {} (dispatchId={})",
                row.get("version_number"), candidateEmail, dispatchId);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private String formatDateTime(Object value) {
        if (value == null) return null;
        try {
            if (value instanceof java.sql.Timestamp ts) {
                return ts.toLocalDateTime().format(VN_FORMATTER);
            }
            return LocalDateTime.parse(value.toString()).format(VN_FORMATTER);
        } catch (Exception e) {
            return value.toString();
        }
    }

    private JsonNode parse(String json) {
        try { return objectMapper.readTree(json); }
        catch (Exception e) { throw AppException.badRequest("Payload outbox không hợp lệ"); }
    }
}

// ── Poller ───────────────────────────────────────────────────────────────────

@Component
@RequiredArgsConstructor
class RecruitmentOutboxPoller {

    private final RecruitmentOutboxProcessor processor;

    @Scheduled(fixedDelayString = "${app.recruitment.outbox-poll-ms:3000}",
               initialDelayString = "${app.recruitment.outbox-initial-delay-ms:5000}")
    public void poll() {
        for (Long eventId : processor.pendingEventIds()) {
            try {
                processor.process(eventId);
            } catch (Exception ex) {
                processor.recordFailure(eventId, ex.getMessage());
            }
        }
    }
}
