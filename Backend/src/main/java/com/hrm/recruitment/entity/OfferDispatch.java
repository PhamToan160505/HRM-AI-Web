package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "offer_dispatches")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OfferDispatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "offer_id", nullable = false)
    private Long offerId;

    @Column(name = "seat_id", nullable = false)
    private Long seatId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OfferDispatchStatus status;

    @Column(name = "dispatch_key", nullable = false, unique = true, length = 140)
    private String dispatchKey;

    @Column(name = "response_token_hash", nullable = false, unique = true, length = 64)
    private String responseTokenHash;

    @Column(name = "response_deadline", nullable = false)
    private LocalDateTime responseDeadline;

    @Column(name = "sent_by", nullable = false)
    private Long sentBy;

    @CreationTimestamp
    @Column(name = "sent_at", nullable = false, updatable = false)
    private LocalDateTime sentAt;

    @Column(name = "responded_at")
    private LocalDateTime respondedAt;

    @Column(name = "candidate_comment", columnDefinition = "TEXT")
    private String candidateComment;

    @Column(name = "supersedes_dispatch_id")
    private Long supersedesDispatchId;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    public static OfferDispatch active(Long offerId, Long seatId, String dispatchKey, String tokenHash,
                                       LocalDateTime deadline, Long sentBy, Long supersedesId) {
        OfferDispatch dispatch = new OfferDispatch();
        dispatch.offerId = offerId;
        dispatch.seatId = seatId;
        dispatch.status = OfferDispatchStatus.ACTIVE;
        dispatch.dispatchKey = dispatchKey;
        dispatch.responseTokenHash = tokenHash;
        dispatch.responseDeadline = deadline;
        dispatch.sentBy = sentBy;
        dispatch.supersedesDispatchId = supersedesId;
        return dispatch;
    }

    public void accept(String comment) { complete(OfferDispatchStatus.ACCEPTED, comment); }
    public void decline(String comment) { complete(OfferDispatchStatus.DECLINED, comment); }
    public void negotiate(String comment) { complete(OfferDispatchStatus.NEGOTIATION_CLOSED, comment); }
    public void supersede() { complete(OfferDispatchStatus.SUPERSEDED, null); }
    public void expire() { complete(OfferDispatchStatus.EXPIRED, null); }
    public void revoke(String reason) { complete(OfferDispatchStatus.REVOKED, reason); }

    private void complete(OfferDispatchStatus target, String comment) {
        if (status != OfferDispatchStatus.ACTIVE) {
            throw new IllegalStateException("Dispatch không còn ACTIVE");
        }
        status = target;
        candidateComment = comment;
        respondedAt = LocalDateTime.now();
    }
}
