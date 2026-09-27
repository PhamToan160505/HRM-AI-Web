package com.hrm.approval.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "approval_requests")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 40)
    private ApprovalEntityType entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @Column(name = "entity_version", nullable = false)
    private Long entityVersion;

    @Column(name = "policy_id", nullable = false)
    private Long policyId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApprovalRequestStatus status;

    @Column(name = "requested_by", nullable = false)
    private Long requestedBy;

    @Column(name = "submission_key", nullable = false, unique = true, length = 120)
    private String submissionKey;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    @Column(name = "open_entity_key", length = 160, insertable = false, updatable = false)
    private String openEntityKey;

    public static ApprovalRequest open(
            ApprovalEntityType entityType,
            Long entityId,
            Long entityVersion,
            Long policyId,
            Long requestedBy,
            String submissionKey) {
        ApprovalRequest request = new ApprovalRequest();
        request.entityType = entityType;
        request.entityId = entityId;
        request.entityVersion = entityVersion;
        request.policyId = policyId;
        request.status = ApprovalRequestStatus.OPEN;
        request.requestedBy = requestedBy;
        request.submissionKey = submissionKey;
        return request;
    }

    public void approve() {
        complete(ApprovalRequestStatus.APPROVED, null);
    }

    public void returnForRevision() {
        complete(ApprovalRequestStatus.RETURNED, null);
    }

    public void reject() {
        complete(ApprovalRequestStatus.REJECTED, null);
    }

    public void cancel(String reason) {
        complete(ApprovalRequestStatus.CANCELLED, reason);
    }

    private void complete(ApprovalRequestStatus target, String reason) {
        if (status != ApprovalRequestStatus.OPEN) {
            throw new IllegalStateException("Approval request is no longer open");
        }
        status = target;
        cancelReason = reason;
        completedAt = LocalDateTime.now();
    }
}
