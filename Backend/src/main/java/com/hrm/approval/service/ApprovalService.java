package com.hrm.approval.service;

import com.hrm.approval.entity.*;
import com.hrm.approval.repository.ApprovalRequestRepository;
import com.hrm.approval.repository.ApprovalStepRepository;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ApprovalRequestRepository requestRepository;
    private final ApprovalStepRepository stepRepository;
    private final ApprovalPolicyResolver policyResolver;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.hrm.common.repository.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.hrm.common.payroll.service.FinanceAccess financeAccess;

    @Transactional
    public ApprovalRequest openRequest(
            ApprovalEntityType entityType,
            Long entityId,
            Long entityVersion,
            Long requestedBy,
            ApprovalPolicyResolver.ApprovalContext context,
            String idempotencyKey) {
        String submissionKey = normalizeKey(idempotencyKey, "approval-submit");
        ApprovalRequest existingByKey = requestRepository.findBySubmissionKey(submissionKey).orElse(null);
        if (existingByKey != null) {
            if (existingByKey.getEntityType() != entityType
                    || !existingByKey.getEntityId().equals(entityId)
                    || !existingByKey.getEntityVersion().equals(entityVersion)) {
                throw AppException.conflict("Idempotency key đã được dùng cho approval request khác");
            }
            return existingByKey;
        }
        requestRepository.findFirstByEntityTypeAndEntityIdAndStatusOrderByCreatedAtDesc(
                        entityType, entityId, ApprovalRequestStatus.OPEN)
                .ifPresent(open -> {
                    throw AppException.conflict("Thực thể đã có approval request đang mở");
                });

        ApprovalPolicyResolver.ResolvedPolicy resolved = policyResolver.resolve(entityType, context);
        ApprovalRequest request = requestRepository.save(ApprovalRequest.open(
                entityType,
                entityId,
                entityVersion,
                resolved.policyId(),
                requestedBy,
                submissionKey));
        List<ApprovalStep> steps = resolved.steps().stream()
                .map(step -> ApprovalStep.pending(
                        request.getId(),
                        step.stepOrder(),
                        step.approverRole(),
                        step.approverId(),
                        step.resolutionNote(),
                        step.stepScope(),
                        step.stepLabel()))
                .toList();
        stepRepository.saveAll(steps);
        return request;
    }

    @Transactional
    public ApprovalOutcome decide(
            ApprovalEntityType entityType,
            Long entityId,
            Long currentEntityVersion,
            Long actorId,
            ApprovalDecision decision,
            String comment,
            String idempotencyKey) {
        String decisionKey = normalizeKey(idempotencyKey, "approval-decision");
        ApprovalStep previousStep = stepRepository.findByDecisionKey(decisionKey).orElse(null);
        if (previousStep != null) {
            ApprovalRequest previousRequest = requestRepository.findById(previousStep.getRequestId())
                    .orElseThrow(() -> AppException.conflict("Approval request của quyết định cũ không tồn tại"));
            if (previousRequest.getEntityType() != entityType || !previousRequest.getEntityId().equals(entityId)) {
                throw AppException.conflict("Idempotency key đã được dùng cho quyết định khác");
            }
            return toOutcome(previousRequest, previousStep, true);
        }

        ApprovalRequest request = requestRepository.lockOpenRequest(entityType, entityId)
                .orElseThrow(() -> AppException.conflict("Không có approval request đang mở"));
        if (!request.getEntityVersion().equals(currentEntityVersion)) {
            throw AppException.conflict(
                    "Approval request đã cũ: entity_version=" + request.getEntityVersion()
                            + ", phiên bản hiện tại=" + currentEntityVersion);
        }
        if (request.getRequestedBy().equals(actorId)) {
            throw AppException.forbidden("Không được tự duyệt yêu cầu do chính mình gửi");
        }

        ApprovalStep currentStep = stepRepository.findFirstByRequestIdAndStatusOrderByStepOrder(
                        request.getId(), ApprovalStepStatus.PENDING)
                .orElseThrow(() -> AppException.conflict("Approval request không còn bước đang chờ"));
        boolean isAssignedApprover = canActorDecideStep(currentStep, actorId);
        if (!isAssignedApprover) {
            throw AppException.forbidden("Bạn không phải người được phân công cho bước duyệt hiện tại");
        }
        if ((decision == ApprovalDecision.RETURN || decision == ApprovalDecision.REJECT)
                && (comment == null || comment.isBlank())) {
            throw AppException.badRequest("Comment/lý do là bắt buộc khi trả về hoặc từ chối");
        }

        currentStep.decide(decision, actorId, trimToNull(comment), decisionKey);
        List<ApprovalStep> allSteps = stepRepository.findByRequestIdOrderByStepOrder(request.getId());
        switch (decision) {
            case APPROVE -> {
                boolean hasNextPending = allSteps.stream()
                        .anyMatch(step -> !step.getId().equals(currentStep.getId())
                                && step.getStatus() == ApprovalStepStatus.PENDING);
                if (!hasNextPending) {
                    request.approve();
                }
            }
            case RETURN -> {
                skipOtherPending(allSteps, currentStep.getId(), "Bỏ qua do bước trước trả về");
                request.returnForRevision();
            }
            case REJECT -> {
                skipOtherPending(allSteps, currentStep.getId(), "Bỏ qua do bước trước từ chối");
                request.reject();
            }
        }
        stepRepository.save(currentStep);
        requestRepository.save(request);
        return toOutcome(request, currentStep, false);
    }

    @Transactional
    public ApprovalRequest cancelOpenRequest(
            ApprovalEntityType entityType,
            Long entityId,
            Long requesterId,
            String reason) {
        ApprovalRequest request = requestRepository.lockOpenRequest(entityType, entityId)
                .orElseThrow(() -> AppException.conflict("Không có approval request đang mở để thu hồi"));
        if (!request.getRequestedBy().equals(requesterId)) {
            throw AppException.forbidden("Chỉ người gửi mới được thu hồi approval request");
        }
        List<ApprovalStep> steps = stepRepository.findByRequestIdOrderByStepOrder(request.getId());
        boolean hasCompletedDecision = steps.stream().anyMatch(step ->
                step.getStatus() == ApprovalStepStatus.APPROVED
                        || step.getStatus() == ApprovalStepStatus.RETURNED
                        || step.getStatus() == ApprovalStepStatus.REJECTED);
        if (hasCompletedDecision) {
            throw AppException.conflict("Không thể thu hồi vì đã có bước hoàn tất quyết định");
        }
        steps.forEach(step -> step.skip("Người gửi thu hồi approval request"));
        request.cancel(reason);
        return requestRepository.save(request);
    }

    public boolean canActorDecideStep(ApprovalStep step, Long actorId) {
        if (step == null || actorId == null || step.getStatus() != ApprovalStepStatus.PENDING) {
            return false;
        }
        if (step.getResolvedApproverId() != null && step.getResolvedApproverId().equals(actorId)) {
            return true;
        }
        if (userRepository == null) {
            return false;
        }
        com.hrm.common.entity.User actor = userRepository.findById(actorId)
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .orElse(null);
        if (actor == null) {
            return false;
        }
        // Bước thẩm định ngân sách Phòng Tài chính: cho phép cả Kế toán trưởng (TRUONG_PHONG) và Giám đốc Tài chính (GIAM_DOC_PHONG_BAN)
        if ("FINANCE_DEPARTMENT".equals(step.getStepScope()) && financeAccess != null) {
            Long finDeptId = financeAccess.financeDepartmentId().orElse(null);
            return finDeptId != null
                    && finDeptId.equals(actor.getDepartmentId())
                    && (actor.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG
                        || actor.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN);
        }
        // Bước duyệt Giám đốc Phòng ban: cho phép Giám đốc cùng phòng với người được phân công
        if ("ENTITY_DEPARTMENT".equals(step.getStepScope())
                && step.getApproverRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN
                && actor.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN
                && step.getResolvedApproverId() != null) {
            Long targetDeptId = userRepository.findById(step.getResolvedApproverId())
                    .map(com.hrm.common.entity.User::getDepartmentId)
                    .orElse(null);
            return targetDeptId != null && targetDeptId.equals(actor.getDepartmentId());
        }
        // Bước CEO / ADMIN toàn cục
        if ((actor.getRole() == com.hrm.common.entity.Role.CEO
                || actor.getRole() == com.hrm.common.entity.Role.ADMIN)
                && actor.getRole() == step.getApproverRole()) {
            return true;
        }
        return false;
    }

    @Transactional
    public void syncOpenRequestEntityVersion(
            ApprovalEntityType entityType,
            Long entityId,
            Long newEntityVersion) {
        if (entityType == null || entityId == null || newEntityVersion == null) {
            return;
        }
        requestRepository.findFirstByEntityTypeAndEntityIdAndStatusOrderByCreatedAtDesc(
                        entityType, entityId, ApprovalRequestStatus.OPEN)
                .ifPresent(req -> {
                    req.syncEntityVersion(newEntityVersion);
                    requestRepository.save(req);
                });
    }

    @Transactional(readOnly = true)
    public java.util.Optional<ApprovalRequestView> getLatestRequestView(ApprovalEntityType entityType, Long entityId) {
        return requestRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId)
                .stream()
                .findFirst()
                .map(this::toView);
    }

    @Transactional(readOnly = true)
    public java.util.Optional<ApprovalStep> getCurrentPendingStep(ApprovalEntityType entityType, Long entityId) {
        return requestRepository.findFirstByEntityTypeAndEntityIdAndStatusOrderByCreatedAtDesc(
                        entityType, entityId, ApprovalRequestStatus.OPEN)
                .flatMap(req -> stepRepository.findByRequestIdOrderByStepOrder(req.getId()).stream()
                        .filter(s -> s.getStatus() == ApprovalStepStatus.PENDING)
                        .findFirst());
    }

    @Transactional(readOnly = true)
    public List<ApprovalRequestView> getHistory(ApprovalEntityType entityType, Long entityId) {
        return requestRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId)
                .stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalInboxItem> getPendingInbox(Long approverId) {
        return stepRepository.findCurrentPendingByApprover(approverId)
                .stream()
                .map(step -> {
                    ApprovalRequest request = requestRepository.findById(step.getRequestId())
                            .orElseThrow(() -> AppException.conflict("Approval request không tồn tại"));
                    return new ApprovalInboxItem(
                            request.getId(), request.getEntityType(), request.getEntityId(),
                            request.getEntityVersion(), step.getId(), step.getStepOrder(),
                            step.getApproverRole(), request.getCreatedAt());
                })
                .toList();
    }

    private ApprovalRequestView toView(ApprovalRequest request) {
        List<ApprovalStepView> steps = stepRepository.findByRequestIdOrderByStepOrder(request.getId()).stream()
                .map(step -> {
                    String decidedByName = (step.getDecidedBy() != null && userRepository != null)
                            ? userRepository.findById(step.getDecidedBy()).map(com.hrm.common.entity.User::getHoTen).orElse(null)
                            : null;
                    return new ApprovalStepView(
                            step.getId(), step.getStepOrder(), step.getApproverRole(),
                            step.getResolvedApproverId(), step.getStatus(), step.getDecidedBy(),
                            step.getDecidedAt(), step.getComment(), step.getDelegatedFrom(), step.getResolutionNote(),
                            step.getStepScope(), step.getStepLabel(), decidedByName);
                })
                .toList();
        return new ApprovalRequestView(
                request.getId(), request.getEntityType(), request.getEntityId(), request.getEntityVersion(),
                request.getPolicyId(), request.getStatus(), request.getRequestedBy(),
                request.getCreatedAt(), request.getCompletedAt(), steps);
    }

    private ApprovalOutcome toOutcome(ApprovalRequest request, ApprovalStep step, boolean idempotentReplay) {
        return new ApprovalOutcome(
                request.getId(),
                request.getStatus(),
                step.getId(),
                step.getStatus(),
                request.getStatus() != ApprovalRequestStatus.OPEN,
                idempotentReplay,
                step.getStepScope(),
                step.getStepOrder());
    }

    private void skipOtherPending(List<ApprovalStep> steps, Long decidedStepId, String reason) {
        steps.stream()
                .filter(step -> !step.getId().equals(decidedStepId))
                .forEach(step -> step.skip(reason));
    }

    private String normalizeKey(String supplied, String prefix) {
        String key = supplied == null || supplied.isBlank()
                ? prefix + ":" + UUID.randomUUID()
                : prefix + ":" + supplied.trim();
        if (key.length() <= 120) {
            return key;
        }
        return prefix + ":sha256:" + sha256(key);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("JVM không hỗ trợ SHA-256", exception);
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record ApprovalOutcome(
            Long requestId,
            ApprovalRequestStatus requestStatus,
            Long stepId,
            ApprovalStepStatus stepStatus,
            boolean requestFinalized,
            boolean idempotentReplay,
            String stepScope,
            Integer stepOrder) {

        public ApprovalOutcome(
                Long requestId,
                ApprovalRequestStatus requestStatus,
                Long stepId,
                ApprovalStepStatus stepStatus,
                boolean requestFinalized,
                boolean idempotentReplay) {
            this(requestId, requestStatus, stepId, stepStatus, requestFinalized, idempotentReplay, null, null);
        }
    }

    public record ApprovalRequestView(
            Long id,
            ApprovalEntityType entityType,
            Long entityId,
            Long entityVersion,
            Long policyId,
            ApprovalRequestStatus status,
            Long requestedBy,
            java.time.LocalDateTime createdAt,
            java.time.LocalDateTime completedAt,
            List<ApprovalStepView> steps) {}

    public record ApprovalStepView(
            Long id,
            Integer stepOrder,
            com.hrm.common.entity.Role approverRole,
            Long resolvedApproverId,
            ApprovalStepStatus status,
            Long decidedBy,
            java.time.LocalDateTime decidedAt,
            String comment,
            Long delegatedFrom,
            String resolutionNote,
            String stepScope,
            String stepLabel,
            String decidedByName) {

        public ApprovalStepView(
                Long id,
                Integer stepOrder,
                com.hrm.common.entity.Role approverRole,
                Long resolvedApproverId,
                ApprovalStepStatus status,
                Long decidedBy,
                java.time.LocalDateTime decidedAt,
                String comment,
                Long delegatedFrom,
                String resolutionNote) {
            this(id, stepOrder, approverRole, resolvedApproverId, status, decidedBy, decidedAt, comment, delegatedFrom, resolutionNote, null, null, null);
        }
    }

    public record ApprovalInboxItem(
            Long requestId,
            ApprovalEntityType entityType,
            Long entityId,
            Long entityVersion,
            Long stepId,
            Integer stepOrder,
            com.hrm.common.entity.Role approverRole,
            java.time.LocalDateTime requestedAt) {}
}
