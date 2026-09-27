package com.hrm.recruitment.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.approval.entity.*;
import com.hrm.approval.service.ApprovalPolicyResolver;
import com.hrm.approval.service.ApprovalService;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.*;
import com.hrm.recruitment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OfferService {

    private final OfferRepository offerRepository;
    private final OfferDispatchRepository dispatchRepository;
    private final HiringSeatRepository seatRepository;
    private final ApplicationRepository applicationRepository;
    private final JobPostingRepository postingRepository;
    private final JobRequisitionRepository requisitionRepository;
    private final OutboxEventRepository outboxRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final ApprovalService approvalService;
    private final HiringSeatService seatService;
    private final RecruitmentTransitionService transitionService;
    private final OfferTokenService tokenService;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public Offer createDraft(Long applicationId, Long actorId, CreateOfferCommand command) {
        requireOfferOperator(actorId);
        Application application = applicationRepository.lockById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ ứng viên"));
        if (application.getApprovalStatus() != ApplicationStatus.PENDING_HR_OFFER) {
            throw AppException.conflict("Chỉ được soạn offer khi hồ sơ ở PENDING_HR_OFFER");
        }
        Offer previous = offerRepository.findFirstByApplicationIdOrderByVersionNumberDesc(applicationId).orElse(null);
        if (previous != null && previous.getStatus() != OfferStatus.SUPERSEDED
                && previous.getStatus() != OfferStatus.CANCELLED) {
            throw AppException.conflict("Hồ sơ đã có offer version đang hoạt động");
        }
        validateCommand(application, command);
        int version = previous == null ? 1 : previous.getVersionNumber() + 1;
        boolean outsideRange = isOutsideSalaryRange(application, command.baseSalary());
        String rangeReason = outsideRange ? trim(command.outOfRangeReason()) : null;
        if (outsideRange && rangeReason == null) {
            throw AppException.badRequest("Mức lương vượt khung requisition, phải nhập lý do");
        }
        return offerRepository.save(Offer.draft(
                applicationId, version, previous == null ? null : previous.getId(),
                command.baseSalary(), canonicalJson(command.allowances()), command.probationMonths(),
                command.probationSalaryRate(), command.expectedStartDate(), command.contractTerms().trim(),
                trim(command.fileUrl()), outsideRange, rangeReason, actorId));
    }

    @Transactional
    public Offer submitForApproval(Long offerId, Long actorId, String requestId, String idempotencyKey) {
        requireOfferOperator(actorId);
        Offer offer = lockOffer(offerId);
        if (!offer.getCreatedBy().equals(actorId)) {
            throw AppException.forbidden("Chỉ người soạn offer mới được gửi duyệt");
        }
        Application application = lockApplication(offer.getApplicationId());
        offer.submit();
        offerRepository.saveAndFlush(offer);
        transitionService.transitionApplication(application, RecruitmentAction.SUBMIT_OFFER,
                actorId, requireUser(actorId).getRole(), "Gửi offer version " + offer.getVersionNumber() + " để duyệt",
                requestId, childKey(idempotencyKey, "application-submit"));
        JobPosting posting = application.getJobPosting();
        approvalService.openRequest(
                ApprovalEntityType.OFFER, offer.getId(), offer.getRowVersion(), actorId,
                new ApprovalPolicyResolver.ApprovalContext(
                        actorId, posting.getDepartmentId(), posting.getTargetRole(), Set.of(actorId)),
                childKey(idempotencyKey, "approval-submit"));
        return offer;
    }

    @Transactional
    public Offer decide(Long offerId, Long actorId, ApprovalDecision decision, String comment,
                        String requestId, String idempotencyKey) {
        if (decision == null) {
            throw AppException.badRequest("Quyết định duyệt offer là bắt buộc");
        }
        Offer offer = lockOffer(offerId);
        Application application = lockApplication(offer.getApplicationId());
        User actor = requireUser(actorId);
        ApprovalService.ApprovalOutcome outcome = approvalService.decide(
                ApprovalEntityType.OFFER, offerId, offer.getRowVersion(), actorId,
                decision, comment, childKey(idempotencyKey, "approval-decision"));
        if (outcome.idempotentReplay() || !outcome.requestFinalized()) {
            return offer;
        }
        switch (decision) {
            case APPROVE -> {
                offer.approve();
                transitionService.transitionApplication(application, RecruitmentAction.APPROVE_OFFER,
                        actorId, actor.getRole(), comment, requestId,
                        childKey(idempotencyKey, "application-approved"));
            }
            case RETURN -> {
                offer.supersede();
                transitionService.transitionApplication(application, RecruitmentAction.RETURN_OFFER,
                        actorId, actor.getRole(), comment, requestId,
                        childKey(idempotencyKey, "application-returned"));
            }
            case REJECT -> {
                offer.cancel();
                application.setRejectionReason(comment);
                transitionService.transitionApplication(application, RecruitmentAction.REJECT_APPLICATION,
                        actorId, actor.getRole(), comment, requestId,
                        childKey(idempotencyKey, "application-rejected"));
            }
        }
        return offerRepository.save(offer);
    }

    @Transactional
    public Offer withdrawApproval(Long offerId, Long actorId, String requestId, String idempotencyKey) {
        Offer offer = lockOffer(offerId);
        if (!offer.getCreatedBy().equals(actorId)) {
            throw AppException.forbidden("Chỉ người soạn offer mới được thu hồi yêu cầu duyệt");
        }
        Application application = lockApplication(offer.getApplicationId());
        approvalService.cancelOpenRequest(ApprovalEntityType.OFFER, offerId, actorId,
                "Người soạn thu hồi yêu cầu duyệt offer");
        offer.cancel();
        transitionService.transitionApplication(application, RecruitmentAction.RETURN_OFFER,
                actorId, requireUser(actorId).getRole(), "Thu hồi yêu cầu duyệt offer", requestId,
                childKey(idempotencyKey, "application-withdraw-approval"));
        return offerRepository.save(offer);
    }

    @Transactional
    public Offer cancelBeforeSend(Long offerId, Long actorId, String reason,
                                  String requestId, String idempotencyKey) {
        requireOfferOperator(actorId);
        String normalizedReason = trim(reason);
        if (normalizedReason == null) {
            throw AppException.badRequest("Hủy offer bắt buộc có lý do");
        }
        Offer offer = lockOffer(offerId);
        if (offer.getStatus() != OfferStatus.APPROVED) {
            throw AppException.conflict("Chỉ offer APPROVED chưa gửi mới dùng thao tác này");
        }
        Application application = lockApplication(offer.getApplicationId());
        if (application.getApprovalStatus() != ApplicationStatus.OFFER_INTERNALLY_APPROVED) {
            throw AppException.conflict("Hồ sơ không ở trạng thái chờ gửi offer");
        }
        offer.cancel();
        transitionService.transitionApplication(application, RecruitmentAction.RETURN_OFFER,
                actorId, requireUser(actorId).getRole(), normalizedReason, requestId,
                childKey(idempotencyKey, "application-cancel-before-send"));
        return offerRepository.save(offer);
    }

    @Transactional
    public DispatchResult send(Long offerId, Long actorId, LocalDateTime deadline,
                               boolean overbookConfirmed, String overbookReason,
                               String requestId, String idempotencyKey) {
        requireOfferOperator(actorId);
        requireFutureDeadline(deadline);
        String dispatchKey = childKey(idempotencyKey, "dispatch");
        OfferDispatch replay = dispatchRepository.findByDispatchKey(dispatchKey).orElse(null);
        if (replay != null) {
            if (!replay.getOfferId().equals(offerId)) {
                throw AppException.conflict("Idempotency key đã dùng cho lần gửi offer khác");
            }
            return dispatchResult(replay, tokenService.tokenFor(dispatchKey));
        }

        Offer offer = lockOffer(offerId);
        if (offer.getStatus() != OfferStatus.APPROVED) {
            throw AppException.conflict("Chỉ offer APPROVED mới được gửi");
        }
        Application application = lockApplication(offer.getApplicationId());
        if (application.getApprovalStatus() != ApplicationStatus.OFFER_INTERNALLY_APPROVED
                && application.getApprovalStatus() != ApplicationStatus.OFFER_EXPIRED) {
            throw AppException.conflict("Trạng thái hồ sơ không cho phép gửi offer");
        }
        Long requisitionId = requireRequisitionId(application);
        HiringSeat seat = seatService.reserve(requisitionId, application.getId(), offer.getId(), actorId,
                overbookConfirmed, overbookReason, childKey(idempotencyKey, "seat"));
        String token = tokenService.tokenFor(dispatchKey);
        OfferDispatch dispatch = dispatchRepository.save(OfferDispatch.active(
                offerId, seat.getId(), dispatchKey, tokenService.hash(token), deadline, actorId, null));
        RecruitmentAction action = application.getApprovalStatus() == ApplicationStatus.OFFER_EXPIRED
                ? RecruitmentAction.RESEND_OFFER : RecruitmentAction.SEND_OFFER;
        transitionService.transitionApplication(application, action, actorId, requireUser(actorId).getRole(),
                "Gửi offer version " + offer.getVersionNumber(), requestId,
                childKey(idempotencyKey, "application-sent"));
        appendOutbox("OFFER_DISPATCH_REQUESTED", requestId, "OFFER", offerId, Map.of(
                "application_id", application.getId(), "offer_id", offerId,
                "dispatch_id", dispatch.getId(), "response_deadline", deadline.toString()));
        return dispatchResult(dispatch, token);
    }

    @Transactional
    public DispatchResult extend(Long offerId, Long actorId, LocalDateTime newDeadline,
                                 String requestId, String idempotencyKey) {
        requireOfferOperator(actorId);
        requireFutureDeadline(newDeadline);
        Offer offer = lockOffer(offerId);
        OfferDispatch active = dispatchRepository.lockActiveByOfferId(offerId)
                .orElseThrow(() -> AppException.conflict("Offer không có dispatch ACTIVE để gia hạn"));
        if (!active.getResponseDeadline().isAfter(LocalDateTime.now())) {
            throw AppException.conflict("Dispatch đã hết hạn; phải dùng chức năng gửi lại và giữ seat mới");
        }
        HiringSeat seat = seatRepository.lockById(active.getSeatId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy seat đang giữ"));
        if (seat.getStatus() != HiringSeatStatus.RESERVED || !offerId.equals(seat.getOfferId())) {
            throw AppException.conflict("Seat không còn được giữ cho offer này");
        }
        String dispatchKey = childKey(idempotencyKey, "extension-dispatch");
        OfferDispatch replay = dispatchRepository.findByDispatchKey(dispatchKey).orElse(null);
        if (replay != null) {
            return dispatchResult(replay, tokenService.tokenFor(dispatchKey));
        }
        active.supersede();
        dispatchRepository.saveAndFlush(active);
        String token = tokenService.tokenFor(dispatchKey);
        OfferDispatch replacement = dispatchRepository.save(OfferDispatch.active(
                offerId, seat.getId(), dispatchKey, tokenService.hash(token), newDeadline,
                actorId, active.getId()));
        appendOutbox("OFFER_DISPATCH_EXTENDED", requestId, "OFFER", offerId, Map.of(
                "offer_id", offerId, "old_dispatch_id", active.getId(),
                "new_dispatch_id", replacement.getId(), "response_deadline", newDeadline.toString()));
        return dispatchResult(replacement, token);
    }

    @Transactional(readOnly = true)
    public PublicOfferView viewByToken(String token) {
        String hash = tokenService.requireValidAndHash(token);
        OfferDispatch dispatch = dispatchRepository.findByResponseTokenHash(hash)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy offer hoặc token đã vô hiệu"));
        Offer offer = offerRepository.findById(dispatch.getOfferId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy offer"));
        Application application = applicationRepository.findById(offer.getApplicationId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ ứng viên"));
        return new PublicOfferView(offer.getId(), offer.getVersionNumber(), application.getFullName(),
                application.getJobPosting().getTitle(), offer.getBaseSalary(), offer.getAllowancesJson(),
                offer.getProbationMonths(), offer.getProbationSalaryRate(), offer.getExpectedStartDate(),
                offer.getContractTerms(), offer.getFileUrl(), dispatch.getStatus(),
                dispatch.getResponseDeadline(), dispatch.getResponseDeadline().isBefore(LocalDateTime.now()));
    }

    @Transactional
    public PublicOfferView respond(String token, CandidateOfferAction action, String comment,
                                   String requestId, String idempotencyKey) {
        if (action == null) {
            throw AppException.badRequest("Phản hồi offer là bắt buộc");
        }
        String hash = tokenService.requireValidAndHash(token);
        OfferDispatch dispatch = dispatchRepository.lockByTokenHash(hash)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy offer hoặc token đã vô hiệu"));
        if (dispatch.getStatus() != OfferDispatchStatus.ACTIVE) {
            if (isSameCompletedAction(dispatch.getStatus(), action)) {
                return viewByToken(token);
            }
            throw AppException.conflict("Offer đã được phản hồi hoặc token không còn hiệu lực");
        }
        if (!dispatch.getResponseDeadline().isAfter(LocalDateTime.now())) {
            throw AppException.conflict("Offer đã hết hạn phản hồi");
        }
        Offer offer = lockOffer(dispatch.getOfferId());
        Application application = lockApplication(offer.getApplicationId());
        switch (action) {
            case ACCEPT -> accept(dispatch, offer, application, comment, requestId, idempotencyKey);
            case DECLINE -> decline(dispatch, offer, application, comment, requestId, idempotencyKey);
            case NEGOTIATE -> negotiate(dispatch, offer, application, comment, requestId, idempotencyKey);
        }
        return viewByToken(token);
    }

    @Transactional
    public OfferDispatch revoke(Long offerId, Long actorId, String reason,
                                String requestId, String idempotencyKey) {
        requireHrHead(actorId);
        String normalizedReason = trim(reason);
        if (normalizedReason == null) {
            throw AppException.badRequest("Thu hồi offer bắt buộc có lý do");
        }
        OfferDispatch dispatch = dispatchRepository.lockActiveByOfferId(offerId)
                .orElseThrow(() -> AppException.conflict("Offer không có dispatch ACTIVE"));
        Offer offer = lockOffer(offerId);
        Application application = lockApplication(offer.getApplicationId());
        dispatch.revoke(normalizedReason);
        seatService.release(dispatch.getSeatId(), actorId, normalizedReason,
                childKey(idempotencyKey, "seat-revoke"));
        transitionService.transitionApplication(application, RecruitmentAction.REVOKE_OFFER,
                actorId, requireUser(actorId).getRole(), normalizedReason, requestId,
                childKey(idempotencyKey, "application-revoke"));
        appendOutbox("OFFER_REVOKED", requestId, "OFFER", offerId,
                Map.of("offer_id", offerId, "application_id", application.getId(), "reason", normalizedReason));
        return dispatchRepository.save(dispatch);
    }

    @Scheduled(fixedDelayString = "${app.offer.expiry-scan-ms:60000}")
    @Transactional
    public void expireOverdueDispatches() {
        List<OfferDispatch> expired = dispatchRepository
                .findTop100ByStatusAndResponseDeadlineBeforeOrderByResponseDeadline(
                        OfferDispatchStatus.ACTIVE, LocalDateTime.now());
        for (OfferDispatch candidate : expired) {
            OfferDispatch dispatch = dispatchRepository.lockById(candidate.getId()).orElse(null);
            if (dispatch == null || dispatch.getStatus() != OfferDispatchStatus.ACTIVE
                    || dispatch.getResponseDeadline().isAfter(LocalDateTime.now())) {
                continue;
            }
            Offer offer = lockOffer(dispatch.getOfferId());
            Application application = lockApplication(offer.getApplicationId());
            String key = "dispatch-expired:" + dispatch.getId();
            dispatch.expire();
            seatService.release(dispatch.getSeatId(), null, "Offer quá hạn phản hồi", key);
            transitionService.transitionApplication(application, RecruitmentAction.EXPIRE_OFFER,
                    null, null, "Offer quá hạn phản hồi", null, key + ":application");
            dispatchRepository.save(dispatch);
            appendOutbox("OFFER_EXPIRED", key, "OFFER", offer.getId(),
                    Map.of("offer_id", offer.getId(), "application_id", application.getId(),
                            "dispatch_id", dispatch.getId()));
        }
    }

    @Transactional(readOnly = true)
    public List<Offer> getApplicationOffers(Long applicationId, Long actorId) {
        requireOfferOperator(actorId);
        return offerRepository.findByApplicationIdOrderByVersionNumberDesc(applicationId);
    }

    @Transactional(readOnly = true)
    public List<HiringSeat> getRequisitionSeats(Long requisitionId, Long actorId) {
        requireOfferOperator(actorId);
        requisitionRepository.findById(requisitionId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy requisition"));
        return seatRepository.findByRequisitionIdOrderBySeatNumber(requisitionId);
    }

    @Transactional(readOnly = true)
    public List<SeatEventView> getSeatTimeline(Long seatId, Long actorId) {
        requireOfferOperator(actorId);
        seatRepository.findById(seatId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy seat"));
        return jdbcTemplate.query("""
                SELECT id, seat_id, event_type, from_status, to_status, application_id,
                       offer_id, actor_id, reason, idempotency_key, occurred_at
                FROM seat_events WHERE seat_id = ? ORDER BY occurred_at, id
                """, (rs, rowNum) -> new SeatEventView(
                        rs.getLong("id"), rs.getLong("seat_id"), rs.getString("event_type"),
                        rs.getString("from_status"), rs.getString("to_status"),
                        (Long) rs.getObject("application_id"), (Long) rs.getObject("offer_id"),
                        (Long) rs.getObject("actor_id"), rs.getString("reason"),
                        rs.getTimestamp("occurred_at").toLocalDateTime()), seatId);
    }

    private void accept(OfferDispatch dispatch, Offer offer, Application application, String comment,
                        String requestId, String idempotencyKey) {
        dispatch.accept(trim(comment));
        HiringSeat seat = seatService.accept(dispatch.getSeatId(), application.getId(), offer.getId(),
                childKey(idempotencyKey, "seat-accept"));
        offer.accept();
        transitionService.transitionApplication(application, RecruitmentAction.ACCEPT_OFFER,
                null, null, trim(comment), requestId, childKey(idempotencyKey, "application-accept"));
        dispatchRepository.save(dispatch);
        offerRepository.save(offer);
        recalculateFilled(application, seat, requestId, idempotencyKey);
        Long requisitionId = requireRequisitionId(application);
        appendOutbox("OFFER_ACCEPTED", requestId, "APPLICATION", application.getId(), Map.of(
                "conversion_key", application.getId() + ":" + offer.getId(),
                "application_id", application.getId(), "accepted_offer_id", offer.getId(),
                "requisition_id", requisitionId, "seat_id", seat.getId()));
    }

    private void decline(OfferDispatch dispatch, Offer offer, Application application, String comment,
                         String requestId, String idempotencyKey) {
        dispatch.decline(trim(comment));
        seatService.release(dispatch.getSeatId(), null, "Ứng viên từ chối offer",
                childKey(idempotencyKey, "seat-decline"));
        transitionService.transitionApplication(application, RecruitmentAction.DECLINE_OFFER,
                null, null, trim(comment), requestId, childKey(idempotencyKey, "application-decline"));
        dispatchRepository.save(dispatch);
        appendOutbox("OFFER_DECLINED", requestId, "OFFER", offer.getId(),
                Map.of("offer_id", offer.getId(), "application_id", application.getId()));
    }

    private void negotiate(OfferDispatch dispatch, Offer offer, Application application, String comment,
                           String requestId, String idempotencyKey) {
        String candidateComment = trim(comment);
        if (candidateComment == null) {
            throw AppException.badRequest("Đề nghị thương lượng phải có nội dung");
        }
        dispatch.negotiate(candidateComment);
        offer.supersede();
        transitionService.transitionApplication(application, RecruitmentAction.NEGOTIATE_OFFER,
                null, null, candidateComment, requestId, childKey(idempotencyKey, "application-negotiate"));
        dispatchRepository.save(dispatch);
        offerRepository.save(offer);
        appendOutbox("OFFER_NEGOTIATION_REQUESTED", requestId, "OFFER", offer.getId(),
                Map.of("offer_id", offer.getId(), "application_id", application.getId(),
                        "comment", candidateComment));
    }

    private void recalculateFilled(Application application, HiringSeat acceptedSeat,
                                   String requestId, String idempotencyKey) {
        JobPosting posting = postingRepository.lockById(application.getJobPosting().getId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy posting"));
        Long requisitionId = requireRequisitionId(application);
        JobRequisition requisition = requisitionRepository.lockById(requisitionId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy requisition"));
        long standardAccepted = seatRepository.countByRequisitionIdAndKindAndStatusIn(
                requisitionId, HiringSeatKind.STANDARD,
                List.of(HiringSeatStatus.ACCEPTED, HiringSeatStatus.JOINED));
        if (standardAccepted >= requisition.getSoLuong()) {
            if (posting.getStatus() == JobPostingStatus.OPEN) {
                transitionService.transitionPosting(posting, RecruitmentAction.FILL_POSTING,
                        null, null, "Đã đủ seat STANDARD", requestId,
                        childKey(idempotencyKey, "posting-filled"));
            }
            if (requisition.getStatus() == JobRequisitionStatus.APPROVED) {
                transitionService.transitionRequisition(requisition, RecruitmentAction.FULFILL_REQUISITION,
                        null, null, "Đã đủ seat STANDARD", requestId,
                        childKey(idempotencyKey, "requisition-fulfilled"));
            }
        }
        if (acceptedSeat.getKind() == HiringSeatKind.OVERBOOK) {
            jdbcTemplate.update("""
                    INSERT INTO recruitment_tasks
                        (task_type, requisition_id, application_id, seat_id, status, details)
                    VALUES ('OVERBOOK_RESOLUTION_REQUIRED', ?, ?, ?, 'OPEN',
                            JSON_OBJECT('offer_id', ?, 'message', 'Overbook offer đã được chấp nhận'))
                    """, requisitionId, application.getId(), acceptedSeat.getId(), acceptedSeat.getOfferId());
        }
    }

    private void validateCommand(Application application, CreateOfferCommand command) {
        if (command == null || command.baseSalary() == null || command.baseSalary().signum() <= 0) {
            throw AppException.badRequest("Lương cơ bản phải lớn hơn 0");
        }
        if (command.probationMonths() == null || command.probationMonths() < 0) {
            throw AppException.badRequest("Số tháng thử việc không hợp lệ");
        }
        if (command.probationSalaryRate() == null || command.probationSalaryRate().signum() <= 0
                || command.probationSalaryRate().compareTo(new BigDecimal("100")) > 0) {
            throw AppException.badRequest("Tỷ lệ lương thử việc phải lớn hơn 0 và không vượt 100");
        }
        if (command.expectedStartDate() == null || command.expectedStartDate().isBefore(LocalDate.now())) {
            throw AppException.badRequest("Ngày bắt đầu dự kiến không được nằm trong quá khứ");
        }
        if (trim(command.contractTerms()) == null) {
            throw AppException.badRequest("Điều khoản hợp đồng là bắt buộc");
        }
        canonicalJson(command.allowances());
        requireRequisitionId(application);
    }

    private boolean isOutsideSalaryRange(Application application, BigDecimal salary) {
        JobRequisition requisition = requisitionRepository.findById(requireRequisitionId(application))
                .orElseThrow(() -> AppException.notFound("Không tìm thấy requisition"));
        String budget = trim(requisition.getBudget());
        if (budget == null) {
            return false;
        }
        try {
            String normalized = budget.replace("VNĐ", "").replace(".", "").replace(",", "").trim();
            String[] range = normalized.split("\\s*-\\s*");
            if (range.length != 2) {
                throw new NumberFormatException();
            }
            BigDecimal min = new BigDecimal(range[0]);
            BigDecimal max = new BigDecimal(range[1]);
            return salary.compareTo(min) < 0 || salary.compareTo(max) > 0;
        } catch (NumberFormatException exception) {
            throw AppException.conflict("Khung lương requisition không hợp lệ, cần chỉnh trước khi tạo offer");
        }
    }

    private String canonicalJson(JsonNode node) {
        JsonNode value = node == null || node.isNull() ? objectMapper.createObjectNode() : node;
        if (!value.isObject() && !value.isArray()) {
            throw AppException.badRequest("Phụ cấp phải là JSON object hoặc array");
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw AppException.badRequest("Dữ liệu phụ cấp không hợp lệ");
        }
    }

    private void appendOutbox(String eventType, String correlationId, String aggregateType,
                              Long aggregateId, Map<String, Object> payload) {
        try {
            outboxRepository.save(OutboxEvent.pending(eventType, correlationId, aggregateType,
                    aggregateId, objectMapper.writeValueAsString(payload)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Không thể tạo outbox payload", exception);
        }
    }

    private Offer lockOffer(Long id) {
        return offerRepository.lockById(id).orElseThrow(() -> AppException.notFound("Không tìm thấy offer"));
    }

    private Application lockApplication(Long id) {
        return applicationRepository.lockById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy hồ sơ ứng viên"));
    }

    private Long requireRequisitionId(Application application) {
        Long requisitionId = application.getJobPosting().getJobRequisitionId();
        if (requisitionId == null) {
            throw AppException.conflict("Posting chưa gắn requisition nên không thể cấp seat");
        }
        return requisitionId;
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .filter(user -> Boolean.TRUE.equals(user.getActive()))
                .orElseThrow(() -> AppException.forbidden("Tài khoản không tồn tại hoặc đã bị khóa"));
    }

    private void requireOfferOperator(Long actorId) {
        User actor = requireUser(actorId);
        if (actor.getRole() == Role.CEO || isHrManagement(actor)) {
            return;
        }
        throw AppException.forbidden("Chỉ HR có thẩm quyền được thao tác offer");
    }

    private void requireHrHead(Long actorId) {
        User actor = requireUser(actorId);
        if (actor.getRole() == Role.CEO
                || (actor.getRole() == Role.GIAM_DOC_PHONG_BAN && isHrManagement(actor))) {
            return;
        }
        throw AppException.forbidden("Chỉ HR Head hoặc CEO được thực hiện thao tác này");
    }

    private boolean isHrManagement(User actor) {
        if (actor.getRole() != Role.TRUONG_PHONG && actor.getRole() != Role.GIAM_DOC_PHONG_BAN) {
            return false;
        }
        return actor.getDepartmentId() != null && departmentRepository.findById(actor.getDepartmentId())
                .map(department -> "Nhân sự".equalsIgnoreCase(department.getTenPhong().trim()))
                .orElse(false);
    }

    private void requireFutureDeadline(LocalDateTime deadline) {
        if (deadline == null || !deadline.isAfter(LocalDateTime.now())) {
            throw AppException.badRequest("Hạn phản hồi offer phải nằm trong tương lai");
        }
    }

    private DispatchResult dispatchResult(OfferDispatch dispatch, String token) {
        return new DispatchResult(dispatch.getId(), dispatch.getOfferId(), dispatch.getSeatId(),
                dispatch.getStatus(), dispatch.getResponseDeadline(), token);
    }

    private boolean isSameCompletedAction(OfferDispatchStatus status, CandidateOfferAction action) {
        return (status == OfferDispatchStatus.ACCEPTED && action == CandidateOfferAction.ACCEPT)
                || (status == OfferDispatchStatus.DECLINED && action == CandidateOfferAction.DECLINE)
                || (status == OfferDispatchStatus.NEGOTIATION_CLOSED && action == CandidateOfferAction.NEGOTIATE);
    }

    private String childKey(String supplied, String suffix) {
        String base = trim(supplied);
        if (base == null) {
            base = UUID.randomUUID().toString();
        }
        String value = base + ":" + suffix;
        return value.length() <= 100 ? value : UUID.nameUUIDFromBytes(value.getBytes()).toString() + ":" + suffix;
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record CreateOfferCommand(
            BigDecimal baseSalary,
            JsonNode allowances,
            Integer probationMonths,
            BigDecimal probationSalaryRate,
            LocalDate expectedStartDate,
            String contractTerms,
            String fileUrl,
            String outOfRangeReason) {}

    public record DispatchResult(Long dispatchId, Long offerId, Long seatId,
                                 OfferDispatchStatus status, LocalDateTime responseDeadline,
                                 String responseToken) {}

    public record PublicOfferView(Long offerId, Integer versionNumber, String candidateName,
                                  String jobTitle, BigDecimal baseSalary, String allowancesJson,
                                  Integer probationMonths, BigDecimal probationSalaryRate,
                                  LocalDate expectedStartDate, String contractTerms, String fileUrl,
                                  OfferDispatchStatus dispatchStatus, LocalDateTime responseDeadline,
                                  boolean expired) {}

    public record SeatEventView(Long id, Long seatId, String eventType, String fromStatus,
                                String toStatus, Long applicationId, Long offerId, Long actorId,
                                String reason, LocalDateTime occurredAt) {}
}
