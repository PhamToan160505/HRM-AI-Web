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
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.ApplicationTransitionLogRepository;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class InterviewService {

    private final JdbcTemplate jdbcTemplate;
    private final ApplicationRepository applicationRepository;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final ApplicationTransitionLogRepository transitionLogRepository;

    private static final java.time.ZoneId VN_ZONE = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    private LocalDateTime nowVn() {
        return LocalDateTime.now(VN_ZONE);
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.hrm.notification.service.NotificationService notificationService;

    private void broadcastInterviewUpdate(Long applicationId, Long interviewId, String action) {
        if (notificationService == null) return;
        try {
            notificationService.broadcastTopic("/topic/recruitment-updates", Map.of(
                    "entityType", "INTERVIEW",
                    "entityId", applicationId != null ? applicationId : 0L,
                    "interviewId", interviewId != null ? interviewId : 0L,
                    "action", action,
                    "timestamp", System.currentTimeMillis()
            ));
        } catch (Exception ignored) {
        }
    }

    @Transactional
    public InterviewView schedule(Long applicationId, ScheduleRequest request, Long actorId) {
        Application application = applicationRepository.lockById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));
        requireCanSchedule(application, actorId);
        requireRoundState(application, request.roundNumber());
        if (request.scheduledStart() == null) {
            throw AppException.badRequest("Thời gian bắt đầu phỏng vấn là bắt buộc");
        }
        LocalDateTime now = nowVn();
        LocalDateTime start = request.scheduledStart();
        LocalDateTime end = request.scheduledEnd() != null ? request.scheduledEnd() : start.plusMinutes(45);
        if (start.isBefore(now.minusMinutes(1))) {
            throw AppException.badRequest("Thời gian bắt đầu phỏng vấn không được nằm trong quá khứ");
        }
        if (start.isAfter(now.plusMonths(6))) {
            throw AppException.badRequest("Thời gian phỏng vấn không được vượt quá 6 tháng kể từ hiện tại");
        }
        if (!end.isAfter(start)) {
            throw AppException.badRequest("Thời gian kết thúc phỏng vấn phải sau thời gian bắt đầu");
        }
        long durationMinutes = java.time.Duration.between(start, end).toMinutes();
        if (durationMinutes < 15 || durationMinutes > 480) {
            throw AppException.badRequest("Thời lượng buổi phỏng vấn phải từ 15 phút đến 8 giờ");
        }
        if (request.roundNumber() == 2) {
            validateRound2AfterRound1(applicationId, start);
        }
        String normalizedMeetingUrl = blankToNull(request.meetingUrl());
        if (normalizedMeetingUrl != null
                && !normalizedMeetingUrl.matches("(?i)^https?://\\S+$")) {
            throw AppException.badRequest("Link họp online phải bắt đầu bằng http:// hoặc https://");
        }
        if (request.leadUserId() == null) throw AppException.badRequest("Người chủ trì phỏng vấn là bắt buộc");
        requireUsersEligible(application, request.roundNumber(), request.leadUserId(), request.participants());
        validateNoScheduleConflict(applicationId, request.roundNumber(), start, end, request.leadUserId(), request.participants());

        List<Long> activeIds = jdbcTemplate.queryForList("""
                SELECT id FROM interviews
                WHERE application_id = ? AND round_number = ? AND status = 'SCHEDULED'
                FOR UPDATE
                """, Long.class, applicationId, request.roundNumber());
        Timestamp nowTs = Timestamp.valueOf(nowVn());
        activeIds.forEach(id -> jdbcTemplate.update(
                "UPDATE interviews SET status = 'RESCHEDULED', updated_at = ?, version = version + 1 WHERE id = ?",
                nowTs, id));
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
            statement.setTimestamp(4, Timestamp.valueOf(start));
            statement.setTimestamp(5, Timestamp.valueOf(end));
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
        if (request.participants() != null) {
            request.participants().forEach(item -> {
                if (item != null && item.userId() != null) {
                    participants.putIfAbsent(item.userId(), item);
                }
            });
        }
        Long responsibleHrId = findResponsibleHr(application).map(User::getId).orElse(null);
        participants.values().forEach(item -> {
            String resolvedRole;
            if (item.userId().equals(request.leadUserId())) {
                resolvedRole = "LEAD";
            } else if (item.role() == null || item.role().isBlank()) {
                resolvedRole = item.userId().equals(responsibleHrId) ? "HR" : "INTERVIEWER";
            } else {
                String normalized = requireEnum(item.role(), List.of("INTERVIEWER", "HR"), "vai trò người phỏng vấn");
                resolvedRole = item.userId().equals(responsibleHrId) ? "HR" : normalized;
            }
            jdbcTemplate.update("""
                    INSERT INTO interview_participants
                      (interview_id, user_id, participant_role, feedback_required,
                       invitation_status, responded_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, interviewId, item.userId(), resolvedRole,
                    item.feedbackRequired() == null || item.feedbackRequired(),
                    item.userId().equals(actorId) ? "ACCEPTED" : "PENDING",
                    item.userId().equals(actorId) ? nowTs : null);
        });

        publish("INTERVIEW_SCHEDULED", interviewId, applicationId, request.roundNumber());
        notifyInvitedParticipants(application, interviewId, request.roundNumber(), start, participants.values(), actorId);
        broadcastInterviewUpdate(applicationId, interviewId, "INTERVIEW_SCHEDULED");
        return get(interviewId);
    }

    private void validateRound2AfterRound1(Long applicationId, LocalDateTime round2Start) {
        List<LocalDateTime> round1Ends = jdbcTemplate.query("""
                SELECT scheduled_end FROM interviews
                WHERE application_id = ? AND round_number = 1 AND status IN ('DONE', 'COMPLETED', 'SCHEDULED')
                ORDER BY attempt_number DESC LIMIT 1
                """, (rs, n) -> rs.getTimestamp("scheduled_end").toLocalDateTime(), applicationId);
        if (!round1Ends.isEmpty()) {
            LocalDateTime round1End = round1Ends.get(0);
            if (round2Start.isBefore(round1End)) {
                String label = round1End.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
                throw AppException.badRequest(
                        "Thời gian phỏng vấn Vòng 2 phải diễn ra sau khi kết thúc Vòng 1 (" + label + ")");
            }
        }
    }

    private void validateNoScheduleConflict(
            Long applicationId,
            int roundNumber,
            LocalDateTime start,
            LocalDateTime end,
            Long leadUserId,
            List<ParticipantRequest> participants) {
        java.util.LinkedHashSet<Long> userIds = new java.util.LinkedHashSet<>();
        if (leadUserId != null) userIds.add(leadUserId);
        if (participants != null) {
            participants.forEach(p -> {
                if (p != null && p.userId() != null) userIds.add(p.userId());
            });
        }
        if (userIds.isEmpty()) return;

        Timestamp startTs = Timestamp.valueOf(start);
        Timestamp endTs = Timestamp.valueOf(end);
        java.time.format.DateTimeFormatter timeFmt = java.time.format.DateTimeFormatter.ofPattern("HH:mm");
        java.time.format.DateTimeFormatter dateFmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

        for (Long uid : userIds) {
            List<Map<String, Object>> conflicts = jdbcTemplate.queryForList("""
                    SELECT u.ho_ten, i.scheduled_start, i.scheduled_end
                    FROM interview_participants ip
                    JOIN interviews i ON i.id = ip.interview_id
                    JOIN users u ON u.id = ip.user_id
                    WHERE ip.user_id = ?
                      AND ip.invitation_status <> 'DECLINED'
                      AND i.status = 'SCHEDULED'
                      AND NOT (i.application_id = ? AND i.round_number = ?)
                      AND i.scheduled_start < ?
                      AND i.scheduled_end > ?
                    LIMIT 1
                    """, uid, applicationId, roundNumber, endTs, startTs);
            if (!conflicts.isEmpty()) {
                Map<String, Object> c = conflicts.get(0);
                String name = String.valueOf(c.get("ho_ten"));
                LocalDateTime cStart = ((Timestamp) c.get("scheduled_start")).toLocalDateTime();
                LocalDateTime cEnd = ((Timestamp) c.get("scheduled_end")).toLocalDateTime();
                throw AppException.conflict(
                        "Trùng lịch phỏng vấn: " + name + " đã có lịch khác vào lúc "
                                + cStart.format(timeFmt) + "–" + cEnd.format(timeFmt)
                                + " ngày " + cStart.format(dateFmt));
            }
        }
    }

    private void notifyInvitedParticipants(
            Application application,
            Long interviewId,
            int roundNumber,
            LocalDateTime scheduledStart,
            java.util.Collection<ParticipantRequest> participants,
            Long actorId) {
        if (notificationService == null || participants == null) return;
        String candidateName = application.getFullName() != null ? application.getFullName() : "Ứng viên";
        String jobTitle = application.getJobPosting() != null && application.getJobPosting().getTitle() != null
                ? application.getJobPosting().getTitle()
                : "Tuyển dụng";
        String timeStr = scheduledStart != null
                ? scheduledStart.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"))
                : "";
        for (ParticipantRequest p : participants) {
            if (p.userId() == null || p.userId().equals(actorId)) continue;
            try {
                User participant = userRepository.findById(p.userId()).orElse(null);
                if (participant == null) continue;
                String link;
                String notifType;
                if (participant.getRole() == Role.NHAN_VIEN && isTechDepartment(participant.getDepartmentId())) {
                    link = "/employee/my-projects";
                    notifType = "TECH_INTERVIEW_INVITE";
                } else if (participant.getRole() == Role.GIAM_DOC_PHONG_BAN) {
                    link = "/director/recruitment/applications/" + application.getId();
                    notifType = "RECRUITMENT_INTERVIEW";
                } else if (participant.getRole() == Role.CEO) {
                    link = "/ceo/recruitment/applications/" + application.getId();
                    notifType = "RECRUITMENT_INTERVIEW";
                } else {
                    link = "/manager/recruitment/applications/" + application.getId();
                    notifType = "RECRUITMENT_INTERVIEW";
                }
                notificationService.createNotification(
                        participant.getId(),
                        notifType,
                        "Lời mời tham gia phỏng vấn Vòng " + roundNumber + " — " + jobTitle,
                        "Bạn được mời tham gia hội đồng phỏng vấn ứng viên " + candidateName
                                + " (Vòng " + roundNumber + (timeStr.isEmpty() ? "" : ", lúc " + timeStr)
                                + "). Vui lòng xác nhận tham gia.",
                        "quan_trong",
                        link
                );
            } catch (Exception ignored) {
            }
        }
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
        int accepted = count("""
                SELECT COUNT(*) FROM interview_participants
                WHERE interview_id = ? AND user_id = ? AND invitation_status = 'ACCEPTED'
                """, interviewId, actorId);
        if (accepted == 0) {
            throw AppException.conflict("Bạn phải chấp nhận lời mời phỏng vấn trước khi gửi feedback");
        }
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
        Timestamp nowTs = Timestamp.valueOf(nowVn());
        jdbcTemplate.update("""
                INSERT INTO interview_feedbacks
                  (interview_id, interviewer_id, criteria_scores, overall_score, recommendation, comments, submitted_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE criteria_scores = VALUES(criteria_scores),
                  overall_score = VALUES(overall_score), recommendation = VALUES(recommendation),
                  comments = VALUES(comments), updated_at = VALUES(updated_at)
                """, interviewId, actorId, request.criteriaScores().toString(), request.overallScore(),
                recommendation, request.comments().trim(), nowTs, nowTs);
        broadcastInterviewUpdate(interview.applicationId(), interviewId, "INTERVIEW_FEEDBACK_SUBMITTED");
        return get(interviewId);
    }

    @Transactional
    public InterviewView complete(Long interviewId, ConclusionRequest request, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (!"SCHEDULED".equals(interview.status())) throw AppException.conflict("Lịch phỏng vấn không còn hiệu lực");
        if (!interview.leadUserId().equals(actorId)) throw AppException.forbidden("Chỉ người chủ trì được kết luận");
        if (count("""
                SELECT COUNT(*) FROM interview_participants
                WHERE interview_id = ? AND user_id = ? AND invitation_status = 'ACCEPTED'
                """, interviewId, actorId) == 0) {
            throw AppException.conflict("Người chủ trì chưa chấp nhận lời mời phỏng vấn");
        }
        if (request.conclusion() == null || request.conclusion().isBlank()) {
            throw AppException.badRequest("Kết luận tổng hợp là bắt buộc");
        }
        int missing = count("""
                SELECT COUNT(*) FROM interview_participants participant
                LEFT JOIN interview_feedbacks feedback
                  ON feedback.interview_id = participant.interview_id
                 AND feedback.interviewer_id = participant.user_id
                WHERE participant.interview_id = ? AND participant.feedback_required = b'1'
                  AND (participant.invitation_status <> 'ACCEPTED' OR feedback.id IS NULL)
                """, interviewId);
        if (missing > 0) throw AppException.conflict("Còn " + missing + " người phỏng vấn bắt buộc chưa gửi feedback");
        jdbcTemplate.update("""
                UPDATE interviews SET status = 'DONE', conclusion = ?,
                  updated_at = ?, version = version + 1
                WHERE id = ? AND status = 'SCHEDULED'
                """, request.conclusion().trim(), Timestamp.valueOf(nowVn()), interviewId);
        publish("INTERVIEW_COMPLETED", interviewId, interview.applicationId(), interview.roundNumber());
        broadcastInterviewUpdate(interview.applicationId(), interviewId, "INTERVIEW_COMPLETED");
        return get(interviewId);
    }

    @Transactional
    public InterviewView noShow(Long interviewId, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (!"SCHEDULED".equals(interview.status())) throw AppException.conflict("Lịch phỏng vấn không còn hiệu lực");
        if (interview.scheduledStart() != null && nowVn().isBefore(interview.scheduledStart())) {
            String startLabel = interview.scheduledStart()
                    .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
            throw AppException.conflict(
                    "Chưa đến giờ phỏng vấn (" + startLabel + ") — không thể đánh dấu ứng viên vắng mặt trước giờ hẹn");
        }
        requireCanSchedule(applicationRepository.findById(interview.applicationId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ phỏng vấn")), actorId);
        jdbcTemplate.update("""
                UPDATE interviews SET status = 'NO_SHOW', updated_at = ?, version = version + 1
                WHERE id = ?
                """, Timestamp.valueOf(nowVn()), interviewId);
        publish("INTERVIEW_NO_SHOW", interviewId, interview.applicationId(), interview.roundNumber());
        broadcastInterviewUpdate(interview.applicationId(), interviewId, "INTERVIEW_NO_SHOW");
        return get(interviewId);
    }

    @Transactional
    public InterviewView recordNegotiation(Long interviewId, NegotiationRequest request, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (interview.roundNumber() != 2) throw AppException.conflict("Đàm phán lương chỉ thuộc phỏng vấn vòng 2");
        requireCanSchedule(applicationRepository.findById(interview.applicationId())
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
        requireCanSchedule(application, actorId);
        return resolveEligibleInterviewers(application);
    }

    public InterviewAccess access(Long applicationId, Long actorId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ: " + applicationId));
        boolean participant = count("""
                SELECT COUNT(*) FROM interview_participants participant
                JOIN interviews interview ON interview.id = participant.interview_id
                WHERE interview.application_id = ? AND participant.user_id = ?
                """, applicationId, actorId) > 0;
        if (!canManage(application, actorId) && !participant) {
            throw AppException.forbidden("Bạn không có quyền xem luồng phỏng vấn của hồ sơ này");
        }
        return new InterviewAccess(canSchedule(application, actorId), participant);
    }

    @Transactional
    public InterviewView respondInvitation(Long interviewId, InvitationResponse request, Long actorId) {
        InterviewRow interview = lock(interviewId);
        if (!"SCHEDULED".equals(interview.status())) {
            throw AppException.conflict("Chỉ có thể phản hồi lời mời của lịch đang hoạt động");
        }
        String decision = requireEnum(request.decision(), List.of("ACCEPTED", "DECLINED"), "phản hồi lời mời");
        int updated = jdbcTemplate.update("""
                UPDATE interview_participants
                SET invitation_status = ?, responded_at = ?,
                    feedback_required = CASE WHEN ? = 'DECLINED' THEN b'0' ELSE feedback_required END
                WHERE interview_id = ? AND user_id = ? AND invitation_status = 'PENDING'
                """, decision, Timestamp.valueOf(nowVn()), decision, interviewId, actorId);
        if (updated == 0) {
            String current = jdbcTemplate.query("""
                    SELECT invitation_status FROM interview_participants
                    WHERE interview_id = ? AND user_id = ?
                    """, (rs, rowNum) -> rs.getString(1), interviewId, actorId)
                    .stream().findFirst()
                    .orElseThrow(() -> AppException.forbidden("Bạn không được mời tham gia lịch phỏng vấn này"));
            if (!decision.equals(current)) {
                throw AppException.conflict("Bạn đã phản hồi lời mời này với trạng thái " + current);
            }
        }
        broadcastInterviewUpdate(interview.applicationId(), interviewId, "INTERVIEW_INVITATION_" + decision);
        return get(interviewId);
    }

    /** Các hồ sơ có lịch đang chờ feedback của người dùng. */
    public List<Long> assignedApplicationIds(Long userId) {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT interview.application_id
                FROM interview_participants participant
                JOIN interviews interview ON interview.id = participant.interview_id
                WHERE participant.user_id = ? AND interview.status = 'SCHEDULED'
                  AND participant.invitation_status <> 'DECLINED'
                """, Long.class, userId);
    }

    /** Các chiến dịch chứa lịch đang chờ feedback của người dùng. */
    public List<Long> assignedJobPostingIds(Long userId) {
        return jdbcTemplate.queryForList("""
                SELECT DISTINCT application.job_posting_id
                FROM interview_participants participant
                JOIN interviews interview ON interview.id = participant.interview_id
                JOIN applications application ON application.id = interview.application_id
                WHERE participant.user_id = ? AND interview.status = 'SCHEDULED'
                  AND participant.invitation_status <> 'DECLINED'
                """, Long.class, userId);
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
                WHERE participant.interview_id = ? AND participant.feedback_required = b'1'
                  AND (participant.invitation_status <> 'ACCEPTED' OR feedback.id IS NULL)
                """, interviewId);
        if (missing > 0) throw AppException.conflict("Chưa đủ feedback bắt buộc của vòng " + round);
        if (round == 2 && count("SELECT COUNT(*) FROM salary_negotiations WHERE interview_id = ?", interviewId) == 0) {
            throw AppException.conflict("Chưa có kết quả đàm phán sơ bộ của vòng 2");
        }
    }

    private InterviewView get(Long id) {
        InterviewRow row = jdbcTemplate.query("""
                SELECT id, application_id, round_number, attempt_number, status, scheduled_start,
                  scheduled_end, timezone, interview_mode, location, meeting_url, lead_user_id, conclusion, updated_at
                FROM interviews WHERE id = ?
                """, (rs, n) -> new InterviewRow(rs.getLong("id"), rs.getLong("application_id"),
                rs.getInt("round_number"), rs.getInt("attempt_number"), rs.getString("status"),
                rs.getTimestamp("scheduled_start").toLocalDateTime(), rs.getTimestamp("scheduled_end").toLocalDateTime(),
                rs.getString("timezone"), rs.getString("interview_mode"), rs.getString("location"),
                rs.getString("meeting_url"), rs.getLong("lead_user_id"), rs.getString("conclusion"),
                rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime()), id)
                .stream().findFirst().orElseThrow(() -> AppException.notFound("Không tìm thấy lịch phỏng vấn: " + id));
        LocalDateTime scheduledStart = row.scheduledStart();
        List<ParticipantView> participants = jdbcTemplate.query("""
                SELECT participant.user_id, users.ho_ten, participant.participant_role,
                  participant.feedback_required, participant.invitation_status, participant.responded_at,
                  feedback.overall_score, feedback.recommendation,
                  feedback.comments, feedback.criteria_scores, feedback.submitted_at
                FROM interview_participants participant
                JOIN users ON users.id = participant.user_id
                LEFT JOIN interview_feedbacks feedback ON feedback.interview_id = participant.interview_id
                  AND feedback.interviewer_id = participant.user_id
                WHERE participant.interview_id = ? ORDER BY participant.id
                """, (rs, n) -> {
            LocalDateTime submittedAt = rs.getTimestamp("submitted_at") == null
                    ? null : rs.getTimestamp("submitted_at").toLocalDateTime();
            boolean submittedBeforeSchedule = submittedAt != null && scheduledStart != null
                    && submittedAt.isBefore(scheduledStart);
            return new ParticipantView(rs.getLong("user_id"), rs.getString("ho_ten"),
                    rs.getString("participant_role"), rs.getBoolean("feedback_required"),
                    rs.getString("invitation_status"),
                    rs.getTimestamp("responded_at") == null ? null : rs.getTimestamp("responded_at").toLocalDateTime(),
                    rs.getBigDecimal("overall_score"), rs.getString("recommendation"), rs.getString("comments"),
                    parseJson(rs.getString("criteria_scores")),
                    submittedAt, submittedBeforeSchedule);
        }, id);
        NegotiationView negotiation = jdbcTemplate.query("""
                SELECT current_salary, expected_salary, preliminary_salary, allowances,
                  other_expectations, notes, recorded_by, recorded_at
                FROM salary_negotiations WHERE interview_id = ?
                """, (rs, n) -> new NegotiationView(rs.getBigDecimal("current_salary"),
                rs.getBigDecimal("expected_salary"), rs.getBigDecimal("preliminary_salary"),
                parseJson(rs.getString("allowances")), rs.getString("other_expectations"),
                rs.getString("notes"), rs.getLong("recorded_by"), rs.getTimestamp("recorded_at").toLocalDateTime()), id)
                .stream().findFirst().orElse(null);
        boolean isDone = "DONE".equals(row.status()) || "COMPLETED".equals(row.status());
        LocalDateTime completedAt = isDone ? row.updatedAt() : null;
        boolean completedBeforeSchedule = isDone && completedAt != null && scheduledStart != null
                && completedAt.isBefore(scheduledStart);
        return new InterviewView(row.id(), row.applicationId(), row.roundNumber(), row.attemptNumber(), row.status(),
                row.scheduledStart(), row.scheduledEnd(), row.timezone(), row.interviewMode(), row.location(),
                row.meetingUrl(), row.leadUserId(), row.conclusion(), completedAt, completedBeforeSchedule,
                participants, negotiation);
    }

    private InterviewRow lock(Long interviewId) {
        return jdbcTemplate.query("""
                SELECT id, application_id, round_number, attempt_number, status, scheduled_start,
                  scheduled_end, timezone, interview_mode, location, meeting_url, lead_user_id, conclusion, updated_at
                FROM interviews WHERE id = ? FOR UPDATE
                """, (rs, n) -> new InterviewRow(rs.getLong("id"), rs.getLong("application_id"),
                rs.getInt("round_number"), rs.getInt("attempt_number"), rs.getString("status"),
                rs.getTimestamp("scheduled_start").toLocalDateTime(), rs.getTimestamp("scheduled_end").toLocalDateTime(),
                rs.getString("timezone"), rs.getString("interview_mode"), rs.getString("location"),
                rs.getString("meeting_url"), rs.getLong("lead_user_id"), rs.getString("conclusion"),
                rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime()), interviewId)
                .stream().findFirst().orElseThrow(() -> AppException.notFound("Không tìm thấy lịch phỏng vấn: " + interviewId));
    }

    private void requireRoundState(Application application, int round) {
        ApplicationStatus expected = round == 1 ? ApplicationStatus.PENDING_INTERVIEW_1
                : round == 2 ? ApplicationStatus.PENDING_INTERVIEW_2 : null;
        if (expected == null || application.getApprovalStatus() != expected) {
            throw AppException.conflict("Hồ sơ không ở trạng thái phỏng vấn vòng " + round);
        }
    }

    private void requireUsersEligible(
            Application application,
            int roundNumber,
            Long lead,
            List<ParticipantRequest> participants) {
        List<Long> ids = new java.util.ArrayList<>();
        ids.add(lead);
        if (participants != null) participants.forEach(item -> {
            if (item.userId() == null) throw AppException.badRequest("Thiếu user_id của người phỏng vấn");
            ids.add(item.userId());
        });
        Map<Long, EligibleInterviewer> eligibleById = resolveEligibleInterviewers(application).stream()
                .collect(java.util.stream.Collectors.toMap(
                        EligibleInterviewer::id,
                        item -> item,
                        (first, second) -> first,
                        LinkedHashMap::new));
        if (ids.stream().anyMatch(id -> !eligibleById.containsKey(id))) {
            throw AppException.badRequest(
                    "Người phỏng vấn phải là Trưởng phòng/Giám đốc, Kỹ sư Senior/Tech Lead (Phòng Công nghệ) của phòng ban đang tuyển hoặc HR phụ trách chiến dịch");
        }
        EligibleInterviewer leadInfo = eligibleById.get(lead);
        if (roundNumber == 2 && !leadInfo.canLeadRound2()) {
            throw AppException.badRequest(
                    "Phỏng vấn Vòng 2 bắt buộc do Trưởng phòng/Giám đốc phòng ban đang tuyển hoặc HR phụ trách chiến dịch chủ trì; Kỹ sư chuyên môn chỉ tham gia với vai trò thành viên hội đồng");
        }
        if (roundNumber == 1 && !leadInfo.canLeadRound1()) {
            throw AppException.badRequest("Người được chọn không đủ thẩm quyền chủ trì phỏng vấn Vòng 1");
        }
    }

    /**
     * Hội đồng hợp lệ gồm:
     * - Trưởng phòng / Giám đốc đúng phòng ban đang tuyển (chủ trì được cả Vòng 1 và Vòng 2).
     * - Kỹ sư Senior / Expert / Tech Lead thuộc Phòng Công nghệ khi tuyển cho Phòng Công nghệ
     *   (chủ trì được Vòng 1 chuyên môn, hoặc tham gia làm Thành viên hội đồng ở cả Vòng 1 & Vòng 2;
     *    không chủ trì Vòng 2 vì Vòng 2 gắn với chốt đội ngũ & đàm phán lương).
     * - HR phụ trách chiến dịch (tạo posting hoặc duyệt CV dự phòng).
     */
    private List<EligibleInterviewer> resolveEligibleInterviewers(Application application) {
        Map<Long, User> eligible = new LinkedHashMap<>();
        Long jobDepartmentId = application.getJobPosting() == null
                ? null
                : application.getJobPosting().getDepartmentId();

        Long responsibleHrId = findResponsibleHr(application).map(User::getId).orElse(null);

        if (jobDepartmentId != null) {
            boolean techDept = isTechDepartment(jobDepartmentId);
            Set<Long> qualifiedTechIds = techDept ? findQualifiedSeniorOrLeadTechUserIds(jobDepartmentId) : Set.of();
            userRepository.findByDepartmentId(jobDepartmentId).stream()
                    .filter(user -> Boolean.TRUE.equals(user.getActive()))
                    .filter(user -> user.getRole() == Role.TRUONG_PHONG
                            || user.getRole() == Role.GIAM_DOC_PHONG_BAN
                            || (techDept && user.getRole() == Role.NHAN_VIEN
                                && (qualifiedTechIds.contains(user.getId()) || hasSeniorOrLeadTitle(user))))
                    .sorted(Comparator
                            .comparingInt(this::interviewerOrder)
                            .thenComparing(User::getHoTen, String.CASE_INSENSITIVE_ORDER)
                            .thenComparing(User::getId))
                    .forEach(user -> eligible.put(user.getId(), user));
        }

        findResponsibleHr(application).ifPresent(user -> eligible.put(user.getId(), user));

        return eligible.values().stream()
                .map(user -> {
                    boolean isManagerOrHr = user.getRole() == Role.TRUONG_PHONG
                            || user.getRole() == Role.GIAM_DOC_PHONG_BAN
                            || user.getId().equals(responsibleHrId);
                    return new EligibleInterviewer(
                            user.getId(),
                            user.getHoTen(),
                            user.getRole().name(),
                            user.getDepartmentId(),
                            true,
                            isManagerOrHr);
                })
                .toList();
    }

    /**
     * Chỉ công nhận Kỹ sư Phòng Công nghệ đạt chuẩn hội đồng phỏng vấn khi:
     * (1) Có ít nhất 1 kỹ năng mức SENIOR hoặc EXPERT trong user_tech_skills, HOẶC
     * (2) Đang giữ vai trò TECH_LEAD / LEAD đang hoạt động trong tech_project_members.
     */
    private Set<Long> findQualifiedSeniorOrLeadTechUserIds(Long departmentId) {
        Set<Long> qualified = new java.util.HashSet<>();
        try {
            List<Long> seniorSkillUsers = jdbcTemplate.queryForList("""
                    SELECT DISTINCT uts.user_id
                    FROM user_tech_skills uts
                    JOIN users u ON u.id = uts.user_id
                    WHERE u.department_id = ? AND u.active = b'1'
                      AND uts.proficiency_level IN ('SENIOR', 'EXPERT')
                    """, Long.class, departmentId);
            if (seniorSkillUsers != null) qualified.addAll(seniorSkillUsers);
        } catch (Exception ignored) {
        }
        try {
            List<Long> techLeadUsers = jdbcTemplate.queryForList("""
                    SELECT DISTINCT pm.user_id
                    FROM tech_project_members pm
                    JOIN users u ON u.id = pm.user_id
                    WHERE u.department_id = ? AND u.active = b'1'
                      AND pm.is_active = b'1'
                      AND UPPER(pm.project_role) IN ('TECH_LEAD', 'LEAD')
                    """, Long.class, departmentId);
            if (techLeadUsers != null) qualified.addAll(techLeadUsers);
        } catch (Exception ignored) {
        }
        return qualified;
    }

    private boolean hasSeniorOrLeadTitle(User user) {
        if (user == null || user.getChucVu() == null) return false;
        String title = user.getChucVu().trim().toLowerCase();
        return title.contains("senior")
                || title.contains("lead")
                || title.contains("architect")
                || title.contains("principal")
                || title.contains("staff")
                || title.contains("expert")
                || title.contains("chuyên gia");
    }

    private boolean isTechDepartment(Long departmentId) {
        if (departmentId == null) return false;
        return departmentRepository.findById(departmentId)
                .map(department -> {
                    String name = department.getTenPhong() == null
                            ? ""
                            : department.getTenPhong().trim().toLowerCase();
                    return name.contains("công nghệ")
                            || name.contains("cong nghe")
                            || name.contains("kỹ thuật")
                            || name.contains("ky thuat")
                            || name.equals("tech")
                            || name.equals("it");
                })
                .orElse(false);
    }

    private java.util.Optional<User> findDirectHrReviewer(Application application) {
        java.util.Optional<User> fromAudit = transitionLogRepository
                .findFirstByEntityTypeAndEntityIdAndActionAndActorIdIsNotNullOrderByOccurredAtDescIdDesc(
                        RecruitmentEntityType.APPLICATION,
                        application.getId(),
                        RecruitmentAction.APPROVE_HR_CV)
                .flatMap(log -> userRepository.findById(log.getActorId()))
                .filter(this::isActiveHr);
        if (fromAudit.isPresent()) return fromAudit;

        String reviewer = application.getHrReviewer();
        if (reviewer == null || reviewer.isBlank()) return java.util.Optional.empty();
        String reviewerName = reviewer.split("\\s+-\\s+", 2)[0].trim();
        return userRepository.findFirstByHoTenAndActiveTrueOrderByIdAsc(reviewerName)
                .filter(this::isActiveHr);
    }

    private java.util.Optional<User> findResponsibleHr(Application application) {
        if (application.getJobPosting() != null && application.getJobPosting().getId() != null) {
            java.util.Optional<User> postingCreator = transitionLogRepository
                    .findFirstByEntityTypeAndEntityIdAndActionAndActorIdIsNotNullOrderByOccurredAtDescIdDesc(
                            RecruitmentEntityType.JOB_POSTING,
                            application.getJobPosting().getId(),
                            RecruitmentAction.CREATE)
                    .flatMap(log -> userRepository.findById(log.getActorId()))
                    .filter(this::isActiveHr);
            if (postingCreator.isPresent()) return postingCreator;
        }
        return findDirectHrReviewer(application);
    }

    private boolean isActiveHr(User user) {
        return Boolean.TRUE.equals(user.getActive())
                && user.getDepartmentId() != null
                && departmentRepository.findById(user.getDepartmentId())
                .map(department -> {
                    String name = department.getTenPhong() == null
                            ? ""
                            : department.getTenPhong().trim();
                    return "Nhân sự".equalsIgnoreCase(name)
                            || "Nhân Su".equalsIgnoreCase(name)
                            || "Phòng Nhân sự".equalsIgnoreCase(name)
                            || "Phong Nhan Su".equalsIgnoreCase(name);
                })
                .orElse(false);
    }

    private int interviewerOrder(User user) {
        if (user.getRole() == Role.TRUONG_PHONG) return 0;
        if (user.getRole() == Role.GIAM_DOC_PHONG_BAN) return 1;
        return 2;
    }

    private void publish(String type, Long interviewId, Long applicationId, int round) {
        var payload = objectMapper.createObjectNode();
        payload.put("interview_id", interviewId).put("application_id", applicationId).put("round", round);
        // Đính kèm thông tin ứng viên để outbox processor gửi email thông báo lịch phỏng vấn
        if ("INTERVIEW_SCHEDULED".equals(type)) {
            applicationRepository.findById(applicationId).ifPresent(app -> {
                payload.put("candidate_email", app.getEmail());
                payload.put("candidate_name", app.getFullName());
            });
        }
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

    private void requireCanSchedule(Application application, Long actorId) {
        if (!canSchedule(application, actorId)) {
            throw AppException.forbidden("Chỉ HR phụ trách chiến dịch được tạo hoặc thay đổi lịch phỏng vấn");
        }
    }

    private boolean canSchedule(Application application, Long actorId) {
        return findResponsibleHr(application)
                .map(hr -> hr.getId().equals(actorId))
                .orElse(false);
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
                                String conclusion, LocalDateTime updatedAt) {}
    public record ParticipantRequest(Long userId, String role, Boolean feedbackRequired) {}
    public record ScheduleRequest(int roundNumber, LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                                  String timezone, String interviewMode, String location, String meetingUrl,
                                  Long leadUserId, List<ParticipantRequest> participants) {}
    public record FeedbackRequest(JsonNode criteriaScores, BigDecimal overallScore,
                                  String recommendation, String comments) {}
    public record InvitationResponse(String decision) {}
    public record InterviewAccess(boolean canSchedule, boolean participant) {}
    public record ConclusionRequest(String conclusion) {}
    public record NegotiationRequest(BigDecimal currentSalary, BigDecimal expectedSalary,
                                     BigDecimal preliminarySalary, JsonNode allowances,
                                     String otherExpectations, String notes) {}
    public record ParticipantView(Long userId, String name, String role, boolean feedbackRequired,
                                  String invitationStatus, LocalDateTime respondedAt,
                                  BigDecimal overallScore, String recommendation, String comments,
                                  JsonNode criteriaScores, LocalDateTime submittedAt,
                                  boolean submittedBeforeSchedule) {}
    public record NegotiationView(BigDecimal currentSalary, BigDecimal expectedSalary,
                                  BigDecimal preliminarySalary, JsonNode allowances,
                                  String otherExpectations, String notes, Long recordedBy,
                                  LocalDateTime recordedAt) {}
    public record InterviewView(Long id, Long applicationId, int roundNumber, int attemptNumber,
                                String status, LocalDateTime scheduledStart, LocalDateTime scheduledEnd,
                                String timezone, String interviewMode, String location, String meetingUrl,
                                Long leadUserId, String conclusion, LocalDateTime completedAt,
                                boolean completedBeforeSchedule, List<ParticipantView> participants,
                                NegotiationView negotiation) {}
    public record EligibleInterviewer(Long id, String name, String role, Long departmentId,
                                      boolean canLeadRound1, boolean canLeadRound2) {}
}
