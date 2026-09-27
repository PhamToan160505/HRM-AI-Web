package com.hrm.approval.entity;

import com.hrm.common.entity.Role;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "approval_steps", uniqueConstraints =
        @UniqueConstraint(name = "uk_approval_step_order", columnNames = {"request_id", "step_order"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false)
    private Long requestId;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    @Enumerated(EnumType.STRING)
    @Column(name = "approver_role", nullable = false, length = 50)
    private Role approverRole;

    @Column(name = "resolved_approver_id")
    private Long resolvedApproverId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApprovalStepStatus status;

    @Column(name = "decided_by")
    private Long decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "delegated_from")
    private Long delegatedFrom;

    @Column(name = "resolution_note", nullable = false, length = 500)
    private String resolutionNote;

    @Column(name = "decision_key", unique = true, length = 120)
    private String decisionKey;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    public static ApprovalStep pending(
            Long requestId,
            int stepOrder,
            Role approverRole,
            Long resolvedApproverId,
            String resolutionNote) {
        ApprovalStep step = new ApprovalStep();
        step.requestId = requestId;
        step.stepOrder = stepOrder;
        step.approverRole = approverRole;
        step.resolvedApproverId = resolvedApproverId;
        step.status = ApprovalStepStatus.PENDING;
        step.resolutionNote = resolutionNote;
        return step;
    }

    public void decide(ApprovalDecision decision, Long actorId, String comment, String decisionKey) {
        if (status != ApprovalStepStatus.PENDING) {
            throw new IllegalStateException("Approval step is no longer pending");
        }
        status = switch (decision) {
            case APPROVE -> ApprovalStepStatus.APPROVED;
            case RETURN -> ApprovalStepStatus.RETURNED;
            case REJECT -> ApprovalStepStatus.REJECTED;
        };
        decidedBy = actorId;
        decidedAt = LocalDateTime.now();
        this.comment = comment;
        this.decisionKey = decisionKey;
    }

    public void skip(String reason) {
        if (status == ApprovalStepStatus.PENDING) {
            status = ApprovalStepStatus.SKIPPED;
            comment = reason;
        }
    }
}
