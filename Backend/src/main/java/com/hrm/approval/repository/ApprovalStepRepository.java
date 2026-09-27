package com.hrm.approval.repository;

import com.hrm.approval.entity.ApprovalStep;
import com.hrm.approval.entity.ApprovalStepStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApprovalStepRepository extends JpaRepository<ApprovalStep, Long> {
    List<ApprovalStep> findByRequestIdOrderByStepOrder(Long requestId);
    Optional<ApprovalStep> findByDecisionKey(String decisionKey);
    @Query("""
            SELECT step
            FROM ApprovalStep step, ApprovalRequest request
            WHERE step.requestId = request.id
              AND request.status = com.hrm.approval.entity.ApprovalRequestStatus.OPEN
              AND step.resolvedApproverId = :approverId
              AND step.status = com.hrm.approval.entity.ApprovalStepStatus.PENDING
              AND NOT EXISTS (
                  SELECT earlier.id
                  FROM ApprovalStep earlier
                  WHERE earlier.requestId = step.requestId
                    AND earlier.status = com.hrm.approval.entity.ApprovalStepStatus.PENDING
                    AND earlier.stepOrder < step.stepOrder
              )
            ORDER BY request.createdAt DESC, step.id DESC
            """)
    List<ApprovalStep> findCurrentPendingByApprover(@Param("approverId") Long approverId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ApprovalStep> findFirstByRequestIdAndStatusOrderByStepOrder(
            Long requestId, ApprovalStepStatus status);
}
