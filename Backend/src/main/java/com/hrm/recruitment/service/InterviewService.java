package com.hrm.recruitment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.OutboxEvent;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class InterviewService {

    private final JdbcTemplate jdbcTemplate;
    private final ApplicationRepository applicationRepository;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    @Transactional
    public InterviewView schedule(Long applicationId, ScheduleRequest request, Long actorId) {
        Application application = applicationRepository.lockById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));
        requireCanManage(application, actorId);
        requireRoundState(application, request.roundNumber());
        if (request.scheduledStart() == null || request.scheduledEnd() == null
                || !request.scheduledEnd().isAfter(request.scheduledStart())) {
            throw AppException.badRequest("Thời gian kết thúc phỏng vấn phải sau thời gian bắt đầu");
        }
        if (request.leadUserId() == null) throw AppException.badRequest("Người chủ trì phỏng vấn là bắt buộc");
        requireUsersExist(request.leadUserId(), request.participants());

        List<Long> activeIds = jdbcTemplate.queryForList("""
                SELECT id FROM interviews
                WHERE application_id = ? AND round_number = ? AND status = 'SCHEDULED'
                FOR UPDATE
                """, Long.class, applicationId, request.roundNumber());
        activeIds.forEach(id -> jdbcTemplate.update(
                "UPDATE interviews SET status = 'RESCHEDULED', updated_at = CURRENT_TIMESTAMP(6), version = version + 1 WHERE id = ?",
                id));
        Integer attempt = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(attempt_number), 0) + 1 FROM interviews WHERE application_id = ? AND round_number = ?",
                Integer.class, applicationId, request.roundNumber());

        KeyHolder key = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO interviews
                      (application_id, round_number, attempt_number, status, scheduled_start, scheduled_end,
                       timezone, interview_mode, location, meeting_url, lead_user_id, created_by)
                    VALUES (?, ?, ?, 'SCHEDULED', ?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, applicationId);
            statement.setInt(2, request.roundNumber());
            statement.setInt(3, attempt);
            statement.setTimestamp(4, Timestamp.valueOf(request.scheduledStart()));
            statement.setTimestamp(5, Timestamp.valueOf(request.scheduledEnd()));
            statement.setString(6, blankToDefault(request.timezone(), "Asia/Ho_Chi_Minh"));
            statement.setString(7, requireEnum(request.interviewMode(), List.of("ONLINE", "ONSITE", "HYBRID"), "hình thức"));
            statement.setString(8, blankToNull(request.location()));
            statement.setString(9, blankToNull(request.meetingUrl()));
            statement.setLong(10, request.leadUserId());
            statement.setLong(11, actorId);
            return statement;
        }, key);
        Long interviewId = key.getKey().longValue();

        Map<Long, ParticipantRequest> participants = new LinkedHashMap<>();
        participants.put(request.leadUserId(), new ParticipantRequest(request.leadUserId(), "LEAD", true));
        if (request.participants() != null) request.participants().forEach(item -> participants.putIfAbsent(item.userId(), item));
        participants.values().forEach(item -> jdbcTemplate.update("""
                INSERT INTO interview_participants
                  (interview_id, user_id, participant_role, feedback_required)
                VALUES (?, ?, ?, ?)
                """, interviewId, item.userId(),
                item.userId().equals(request.leadUserId()) ? "LEAD"
                        : requireEnum(item.role(), List.of("INTERVIEWER", "HR"), "vai trò người phỏng vấn"),
                item.feedbackRequired() == null || item.feedbackRequired()));

        publish("INTERVIEW_SCHEDULED", interviewId, applicationId, request.roundNumber());
        return get(interviewId);
    }

    @Transactional
    public InterviewView submitFeedback(Long interviewId, FeedbackRequest request, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (!"SCHEDULED".equals(interview.status())) {
            throw AppException.conflict("Chỉ gửi feedback cho lịch phỏng vấn đang SCHEDULED");
        }
        int participant = count("SELECT COUNT(*) FROM interview_participants WHERE interview_id = ? AND user_id = ?",
                interviewId, actorId);
        if (participant == 0) throw AppException.forbidden("Bạn không thuộc hội đồng phỏng vấn này");
        if (request.criteriaScores() == null || !request.criteriaScores().isObject()) {
            throw AppException.badRequest("Điểm theo tiêu chí phải là JSON object");
        }
        if (request.overallScore() == null || request.overallScore().compareTo(BigDecimal.ZERO) < 0
                || request.overallScore().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw AppException.badRequest("Điểm tổng phải từ 0 đến 100");
        }
        if (request.comments() == null || request.comments().isBlank()) {
            throw AppException.badRequest("Nhận xét phỏng vấn là bắt buộc");
        }
        String recommendation = requireEnum(request.recommendation(), List.of("PASS", "FAIL", "HOLD"), "khuyến nghị");
        jdbcTemplate.update("""
                INSERT INTO interview_feedbacks
                  (interview_id, interviewer_id, criteria_scores, overall_score, recommendation, comments)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE criteria_scores = VALUES(criteria_scores),
                  overall_score = VALUES(overall_score), recommendation = VALUES(recommendation),
                  comments = VALUES(comments), updated_at = CURRENT_TIMESTAMP(6)
                """, interviewId, actorId, request.criteriaScores().toString(), request.overallScore(),
                recommendation, request.comments().trim());
        return get(interviewId);
    }

    @Transactional
    public InterviewView complete(Long interviewId, ConclusionRequest request, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (!"SCHEDULED".equals(interview.status())) throw AppException.conflict("Lịch phỏng vấn không còn hiệu lực");
        if (!interview.leadUserId().equals(actorId)) throw AppException.forbidden("Chỉ người chủ trì được kết luận");
        if (request.conclusion() == null || request.conclusion().isBlank()) {
            throw AppException.badRequest("Kết luận tổng hợp là bắt buộc");
        }
        int missing = count("""
                SELECT COUNT(*) FROM interview_participants participant
                LEFT JOIN interview_feedbacks feedback
                  ON feedback.interview_id = participant.interview_id
                 AND feedback.interviewer_id = participant.user_id
                WHERE participant.interview_id = ? AND participant.feedback_required = b'1'
                  AND feedback.id IS NULL
                """, interviewId);
        if (missing > 0) throw AppException.conflict("Còn " + missing + " người phỏng vấn bắt buộc chưa gửi feedback");
        jdbcTemplate.update("""
                UPDATE interviews SET status = 'DONE', conclusion = ?,
                  updated_at = CURRENT_TIMESTAMP(6), version = version + 1
                WHERE id = ? AND status = 'SCHEDULED'
                """, request.conclusion().trim(), interviewId);
        publish("INTERVIEW_COMPLETED", interviewId, interview.applicationId(), interview.roundNumber());
        return get(interviewId);
    }

    @Transactional
    public InterviewView noShow(Long interviewId, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (!"SCHEDULED".equals(interview.status())) throw AppException.conflict("Lịch phỏng vấn không còn hiệu lực");
        requireCanManage(applicationRepository.findById(interview.applicationId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ phỏng vấn")), actorId);
        jdbcTemplate.update("""
                UPDATE interviews SET status = 'NO_SHOW', updated_at = CURRENT_TIMESTAMP(6), version = version + 1
                WHERE id = ?
                """, interviewId);
        publish("INTERVIEW_NO_SHOW", interviewId, interview.applicationId(), interview.roundNumber());
        return get(interviewId);
    }

    @Transactional
    public InterviewView recordNegotiation(Long interviewId, NegotiationRequest request, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (interview.roundNumber() != 2) throw AppException.conflict("Đàm phán lương chỉ thuộc phỏng vấn vòng 2");
        requireCanManage(applicationRepository.findById(interview.applicationId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ phỏng vấn")), actorId);
        if (request.expectedSalary() == null || request.expectedSalary().signum() <= 0
                || request.preliminarySalary() == null || request.preliminarySalary().signum() <= 0
                || (request.currentSalary() != null && request.currentSalary().signum() <= 0)) {
            throw AppException.badRequest("Các mức lương được cung cấp phải lớn hơn 0");
        }
        if (request.notes() == null || request.notes().isBlank()) {
            throw AppException.badRequest("Ghi chú đàm phán sơ bộ là bắt buộc");
        }
        jdbcTemplate.update("""
                INSERT INTO salary_negotiations
                  (interview_id, application_id, current_salary, expected_salary, preliminary_salary,
                   allowances, other_expectations, notes, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE current_salary = VALUES(current_salary),
                  expected_salary = VALUES(expected_salary), preliminary_salary = VALUES(preliminary_salary),
                  allowances = VALUES(allowances), other_expectations = VALUES(other_expectations),
                  notes = VALUES(notes), recorded_by = VALUES(recorded_by), updated_at = CURRENT_TIMESTAMP(6)
                """, interviewId, interview.applicationId(), request.currentSalary(), request.expectedSalary(),
                request.preliminarySalary(), request.allowances() == null ? null : request.allowances().toString(),
                blankToNull(request.otherExpectations()), request.notes().trim(), actorId);
        return get(interviewId);
    }

    public List<InterviewView> list(Long applicationId, Long actorId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));
        if (!canManage(application, actorId) && count("""
                SELECT COUNT(*) FROM interview_participants participant
                JOIN interviews interview ON interview.id = participant.interview_id
                WHERE interview.application_id = ? AND participant.user_id = ?
                """, applicationId, actorId) == 0) {
            throw AppException.forbidden("Bạn không thuộc hội đồng phỏng vấn của hồ sơ này");
        }
        return jdbcTemplate.queryForList("SELECT id FROM interviews WHERE application_id = ? ORDER BY round_number, attempt_number DESC",
                Long.class, applicationId).stream().map(this::get).toList();
    }

    public List<EligibleInterviewer> eligibleInterviewers(Long applicationId, Long actorId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));
        requireCanManage(application, actorId);
        return jdbcTemplate.query("""
                SELECT users.id, users.ho_ten, users.role, users.department_id
                FROM users
                WHERE users.active = b'1'
                ORDER BY users.ho_ten, users.id
                """, (rs, n) -> new EligibleInterviewer(rs.getLong("id"), rs.getString("ho_ten"),
                rs.getString("role"), rs.getObject("department_id", Long.class)));
    }

    public void requireReadyToPass(Long applicationId, int round) {
        List<Long> ids = jdbcTemplate.queryForList("""
                SELECT id FROM interviews WHERE application_id = ? AND round_number = ? AND status = 'DONE'
                ORDER BY attempt_number DESC LIMIT 1
                """, Long.class, applicationId, round);
        if (ids.isEmpty()) throw AppException.conflict("Phỏng vấn vòng " + round + " chưa hoàn tất");
        Long interviewId = ids.get(0);
        String conclusion = jdbcTemplate.queryForObject("SELECT conclusion FROM interviews WHERE id = ?", String.class, interviewId);
        if (conclusion == null || conclusion.isBlank()) throw AppException.conflict("Thiếu kết luận phỏng vấn vòng " + round);
        int missing = count("""
                SELECT COUNT(*) FROM interview_participants participant
                LEFT JOIN interview_feedbacks feedback ON feedback.interview_id = participant.interview_id
                  AND feedback.interviewer_id = participant.user_id
                WHERE participant.interview_id = ? AND participant.feedback_required = b'1' AND feedback.id IS NULL
                """, interviewId);
        if (missing > 0) throw AppException.conflict("Chưa đủ feedback bắt buộc của vòng " + round);
        if (round == 2 && count("SELECT COUNT(*) FROM salary_negotiations WHERE interview_id = ?", interviewId) == 0) {
            throw AppException.conflict("Chưa có kết quả đàm phán sơ bộ của vòng 2");
        }
    }

    private InterviewView get(Long id) {
        InterviewRow row = jdbcTemplate.query("""
                SELECT id, application_id, round_number, attempt_number, status, scheduled_start,
                  scheduled_end, timezone, interview_mode, location, meeting_url, lead_user_id, conclusion
                FROM interviews WHERE id = ?
                """, (rs, n) -> new InterviewRow(rs.getLong("id"), rs.getLong("application_id"),
                rs.getInt("round_number"), rs.getInt("attempt_number"), rs.getString("status"),
                rs.getTimestamp("scheduled_start").toLocalDateTime(), rs.getTimestamp("scheduled_end").toLocalDateTime(),
                rs.getString("timezone"), rs.getString("interview_mode"), rs.getString("location"),
                rs.getString("meeting_url"), rs.getLong("lead_user_id"), rs.getString("conclusion")), id)
                .stream().findFirst().orElseThrow(() -> AppException.notFound("Không tìm thấy lịch phỏng vấn: " + id));
        List<ParticipantView> participants = jdbcTemplate.query("""
                SELECT participant.user_id, users.ho_ten, participant.participant_role,
                  participant.feedback_required, feedback.overall_score, feedback.recommendation,
                  feedback.comments, feedback.criteria_scores, feedback.submitted_at
                FROM interview_participants participant
                JOIN users ON users.id = participant.user_id
                LEFT JOIN interview_feedbacks feedback ON feedback.interview_id = participant.interview_id
                  AND feedback.interviewer_id = participant.user_id
                WHERE participant.interview_id = ? ORDER BY participant.id
                """, (rs, n) -> new ParticipantView(rs.getLong("user_id"), rs.getString("ho_ten"),
                rs.getString("participant_role"), rs.getBoolean("feedback_required"),
                rs.getBigDecimal("overall_score"), rs.getString("recommendation"), rs.getString("comments"),
                parseJson(rs.getString("criteria_scores")),
                rs.getTimestamp("submitted_at") == null ? null : rs.getTimestamp("submitted_at").toLocalDateTime()), id);
        NegotiationView negotiation = jdbcTemplate.query("""
                SELECT current_salary, expected_salary, preliminary_salary, allowances,
                  other_expectations, notes, recorded_by, recorded_at
                FROM salary_negotiations WHERE interview_id = ?
                """, (rs, n) -> new NegotiationView(rs.getBigDecimal("current_salary"),
                rs.getBigDecimal("expected_salary"), rs.getBigDecimal("preliminary_salary"),
                parseJson(rs.getString("allowances")), rs.getString("other_expectations"),
                rs.getString("notes"), rs.getLong("recorded_by"), rs.getTimestamp("recorded_at").toLocalDateTime()), id)
                .stream().findFirst().orElse(null);
        return new InterviewView(row.id(), row.applicationId(), row.roundNumber(), row.attemptNumber(), row.status(),
                row.scheduledStart(), row.scheduledEnd(), row.timezone(), row.interviewMode(), row.location(),
                row.meetingUrl(), row.leadUserId(), row.conclusion(), participants, negotiation);
    }

    private InterviewRow lock(Long interviewId) {
        return jdbcTemplate.query("""
                SELECT id, application_id, round_number, attempt_number, status, scheduled_start,
                  scheduled_end, timezone, interview_mode, location, meeting_url, lead_user_id, conclusion
                FROM interviews WHERE id = ? FOR UPDATE
                """, (rs, n) -> new InterviewRow(rs.getLong("id"), rs.getLong("application_id"),
                rs.getInt("round_number"), rs.getInt("attempt_number"), rs.getString("status"),
                rs.getTimestamp("scheduled_start").toLocalDateTime(), rs.getTimestamp("scheduled_end").toLocalDateTime(),
                rs.getString("timezone"), rs.getString("interview_mode"), rs.getString("location"),
                rs.getString("meeting_url"), rs.getLong("lead_user_id"), rs.getString("conclusion")), interviewId)
                .stream().findFirst().orElseThrow(() -> AppException.notFound("Không tìm thấy lịch phỏng vấn: " + interviewId));
    }

    private void requireRoundState(Application application, int round) {
        ApplicationStatus expected = round == 1 ? ApplicationStatus.PENDING_INTERVIEW_1
                : round == 2 ? ApplicationStatus.PENDING_INTERVIEW_2 : null;
        if (expected == null || application.getApprovalStatus() != expected) {
            throw AppException.conflict("Hồ sơ không ở trạng thái phỏng vấn vòng " + round);
        }
    }

    private void requireUsersExist(Long lead, List<ParticipantRequest> participants) {
        List<Long> ids = new java.util.ArrayList<>();
        ids.add(lead);
        if (participants != null) participants.forEach(item -> {
            if (item.userId() == null) throw AppException.badRequest("Thiếu user_id của người phỏng vấn");
            ids.add(item.userId());
        });
        long unique = ids.stream().distinct().count();
        String placeholders = String.join(",", java.util.Collections.nCopies((int) unique, "?"));
        Object[] values = ids.stream().distinct().toArray();
        int found = count("SELECT COUNT(*) FROM users WHERE active = b'1' AND id IN (" + placeholders + ")", values);
        if (found != unique) throw AppException.badRequest("Có người phỏng vấn không tồn tại hoặc đã bị khóa");
    }

    private void publish(String type, Long interviewId, Long applicationId, int round) {
        var payload = objectMapper.createObjectNode();
        payload.put("interview_id", interviewId).put("application_id", applicationId).put("round", round);
        outboxRepository.save(OutboxEvent.pending(type, "interview-" + interviewId,
                "INTERVIEW", interviewId, payload.toString()));
    }

    private int count(String sql, Object... args) {
        Integer result = jdbcTemplate.queryForObject(sql, Integer.class, args);
        return result == null ? 0 : result;
    }

    private void requireCanManage(Application application, Long actorId) {
        if (!canManage(application, actorId)) {
            throw AppException.forbidden("Bạn không có quyền quản lý phỏng vấn của phòng ban này");
        }
    }

    private boolean canManage(Application application, Long actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người thao tác"));
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) return true;
        if (actor.getRole() != Role.TRUONG_PHONG && actor.getRole() != Role.GIAM_DOC_PHONG_BAN) return false;
        if (actor.getDepartmentId() == null) return false;
        boolean isHr = departmentRepository.findById(actor.getDepartmentId())
                .map(department -> "Nhân sự".equalsIgnoreCase(department.getTenPhong().trim()))
                .orElse(false);
        return isHr || actor.getDepartmentId().equals(application.getJobPosting().getDepartmentId());
    }

    private JsonNode parseJson(String raw) {
        if (raw == null) return null;
        try { return objectMapper.readTree(raw); }
        catch (Exception exception) { throw new IllegalStateException("JSON phỏng vấn không hợp lệ", exception); }
    }

    private String requireEnum(String value, List<String> accepted, String label) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        if (!accepted.contains(normalized)) throw AppException.badRequest("Sai " + label + ": " + value);
        return normalized;
    }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String blankToDefault(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }

    private record InterviewRow(Long id, Long applicationId, int roundNumber, int attemptNumber, String status,
                                LocalDateTime scheduledStart, LocalDateTime scheduledEnd, String timezone,
                                String interviewMode, String location, String meetingUrl, Long leadUserId,
                                String conclusion) {}
    public record ParticipantRequest(Long userId, String role, Boolean feedbackRequired) {}
    public record ScheduleRequest(int roundNumber, LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                                  String timezone, String interviewMode, String location, String meetingUrl,
                                  Long leadUserId, List<ParticipantRequest> participants) {}
    public record FeedbackRequest(JsonNode criteriaScores, BigDecimal overallScore,
                                  String recommendation, String comments) {}
    public record ConclusionRequest(String conclusion) {}
    public record NegotiationRequest(BigDecimal currentSalary, BigDecimal expectedSalary,
                                     BigDecimal preliminarySalary, JsonNode allowances,
                                     String otherExpectations, String notes) {}
    public record ParticipantView(Long userId, String name, String role, boolean feedbackRequired,
                                  BigDecimal overallScore, String recommendation, String comments,
                                  JsonNode criteriaScores, LocalDateTime submittedAt) {}
    public record NegotiationView(BigDecimal currentSalary, BigDecimal expectedSalary,
                                  BigDecimal preliminarySalary, JsonNode allowances,
                                  String otherExpectations, String notes, Long recordedBy,
                                  LocalDateTime recordedAt) {}
    public record InterviewView(Long id, Long applicationId, int roundNumber, int attemptNumber,
                                String status, LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                                String timezone, String interviewMode, String location, String meetingUrl,
                                Long leadUserId, String conclusion, List<ParticipantView> participants,
                                NegotiationView negotiation) {}
    public record EligibleInterviewer(Long id, String name, String role, Long departmentId) {}
}
