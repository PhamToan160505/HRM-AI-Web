package com.hrm.recruitment.service;

import com.hrm.common.entity.Role;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.ApplicationTransitionLog;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.ApplicationTransitionLogRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecruitmentTransitionService {

    private static final EnumSet<RecruitmentAction> COMMENT_REQUIRED = EnumSet.of(
            RecruitmentAction.RETURN_REQUISITION,
            RecruitmentAction.REJECT_REQUISITION,
            RecruitmentAction.CANCEL_REQUISITION,
            RecruitmentAction.CANCEL_POSTING,
            RecruitmentAction.RETURN_TO_HR,
            RecruitmentAction.RETURN_TO_INTERVIEW_1,
            RecruitmentAction.RETURN_TO_INTERVIEW_2,
            RecruitmentAction.RETURN_OFFER,
            RecruitmentAction.REJECT_APPLICATION,
            RecruitmentAction.REVOKE_OFFER,
            RecruitmentAction.REOPEN_APPLICATION);

    private final RecruitmentStateMachine stateMachine;
    private final ApplicationRepository applicationRepository;
    private final JobRequisitionRepository jobRequisitionRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ApplicationTransitionLogRepository transitionLogRepository;

    @Transactional
    public Application transitionApplication(
            Application application,
            RecruitmentAction action,
            Long actorId,
            Role actorRole,
            String comment,
            String requestId,
            String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        if (isAlreadyApplied(key, RecruitmentEntityType.APPLICATION, application.getId(), action)) {
            return application;
        }
        ApplicationStatus from = application.getApprovalStatus();
        ApplicationStatus to = stateMachine.next(from, action);
        requireComment(action, comment);
        application.setApprovalStatus(to);
        Application saved = applicationRepository.save(application);
        appendLog(RecruitmentEntityType.APPLICATION, saved.getId(), actorId, actorRole, action,
                from.name(), to.name(), comment, requestId, key);
        return saved;
    }

    @Transactional
    public JobRequisition transitionRequisition(
            JobRequisition requisition,
            RecruitmentAction action,
            Long actorId,
            Role actorRole,
            String comment,
            String requestId,
            String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        if (isAlreadyApplied(key, RecruitmentEntityType.JOB_REQUISITION, requisition.getId(), action)) {
            return requisition;
        }
        JobRequisitionStatus from = requisition.getStatus();
        JobRequisitionStatus to = stateMachine.next(from, action);
        requireComment(action, comment);
        requisition.setStatus(to);
        JobRequisition saved = jobRequisitionRepository.save(requisition);
        appendLog(RecruitmentEntityType.JOB_REQUISITION, saved.getId(), actorId, actorRole, action,
                from.name(), to.name(), comment, requestId, key);
        return saved;
    }

    @Transactional
    public JobPosting transitionPosting(
            JobPosting posting,
            RecruitmentAction action,
            Long actorId,
            Role actorRole,
            String comment,
            String requestId,
            String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        if (isAlreadyApplied(key, RecruitmentEntityType.JOB_POSTING, posting.getId(), action)) {
            return posting;
        }
        JobPostingStatus from = posting.getStatus();
        JobPostingStatus to = stateMachine.next(from, action);
        requireComment(action, comment);
        if (to == JobPostingStatus.OPEN
                && (posting.getCriteriaVersionId() == null || posting.getScoringProfileVersionId() == null)) {
            throw AppException.conflict(
                    "Posting phải khóa criteria_version_id và scoring_profile_version_id trước khi OPEN");
        }
        posting.setStatus(to);
        JobPosting saved = jobPostingRepository.save(posting);
        appendLog(RecruitmentEntityType.JOB_POSTING, saved.getId(), actorId, actorRole, action,
                from.name(), to.name(), comment, requestId, key);
        return saved;
    }

    @Transactional
    public void recordCreation(
            RecruitmentEntityType entityType,
            Long entityId,
            Long actorId,
            Role actorRole,
            String initialStatus,
            String requestId,
            String idempotencyKey) {
        String key = normalizeKey(idempotencyKey);
        if (isAlreadyApplied(key, entityType, entityId, RecruitmentAction.CREATE)) {
            return;
        }
        appendLog(entityType, entityId, actorId, actorRole, RecruitmentAction.CREATE,
                null, initialStatus, null, requestId, key);
    }

    @Transactional(readOnly = true)
    public List<ApplicationTransitionLog> getTimeline(RecruitmentEntityType entityType, Long entityId) {
        return transitionLogRepository.findByEntityTypeAndEntityIdOrderByOccurredAtAscIdAsc(entityType, entityId);
    }

    private boolean isAlreadyApplied(
            String key,
            RecruitmentEntityType entityType,
            Long entityId,
            RecruitmentAction action) {
        return transitionLogRepository.findByIdempotencyKey(key)
                .map(existing -> {
                    boolean sameOperation = existing.getEntityType() == entityType
                            && existing.getEntityId().equals(entityId)
                            && existing.getAction() == action;
                    if (!sameOperation) {
                        throw AppException.conflict("Idempotency key đã được dùng cho một thao tác khác");
                    }
                    return true;
                })
                .orElse(false);
    }

    private void appendLog(
            RecruitmentEntityType entityType,
            Long entityId,
            Long actorId,
            Role actorRole,
            RecruitmentAction action,
            String fromStatus,
            String toStatus,
            String comment,
            String requestId,
            String idempotencyKey) {
        transitionLogRepository.save(ApplicationTransitionLog.create(
                entityType,
                entityId,
                actorId,
                actorRole == null ? "SYSTEM" : actorRole.name(),
                action,
                fromStatus,
                toStatus,
                trimToNull(comment),
                trimToNull(requestId),
                idempotencyKey));
    }

    private void requireComment(RecruitmentAction action, String comment) {
        if (COMMENT_REQUIRED.contains(action) && trimToNull(comment) == null) {
            throw AppException.badRequest("Hành động " + action + " bắt buộc phải có lý do hoặc nhận xét");
        }
    }

    private String normalizeKey(String idempotencyKey) {
        String value = trimToNull(idempotencyKey);
        return value == null ? UUID.randomUUID().toString() : value;
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
