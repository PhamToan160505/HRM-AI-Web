package com.hrm.approval.repository;

import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.approval.entity.ApprovalRequest;
import com.hrm.approval.entity.ApprovalRequestStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequest, Long> {
    Optional<ApprovalRequest> findBySubmissionKey(String submissionKey);

    Optional<ApprovalRequest> findFirstByEntityTypeAndEntityIdAndStatusOrderByCreatedAtDesc(
            ApprovalEntityType entityType, Long entityId, ApprovalRequestStatus status);

    List<ApprovalRequest> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(
            ApprovalEntityType entityType, Long entityId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT request FROM ApprovalRequest request
            WHERE request.entityType = :entityType
              AND request.entityId = :entityId
              AND request.status = com.hrm.approval.entity.ApprovalRequestStatus.OPEN
            """)
    Optional<ApprovalRequest> lockOpenRequest(
            @Param("entityType") ApprovalEntityType entityType,
            @Param("entityId") Long entityId);
}
