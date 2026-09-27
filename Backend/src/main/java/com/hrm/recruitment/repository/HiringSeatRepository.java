package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.HiringSeat;
import com.hrm.recruitment.entity.HiringSeatKind;
import com.hrm.recruitment.entity.HiringSeatStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface HiringSeatRepository extends JpaRepository<HiringSeat, Long> {
    List<HiringSeat> findByRequisitionIdOrderBySeatNumber(Long requisitionId);
    long countByRequisitionIdAndKind(Long requisitionId, HiringSeatKind kind);
    long countByRequisitionIdAndKindAndStatusIn(Long requisitionId, HiringSeatKind kind, List<HiringSeatStatus> statuses);
    Optional<HiringSeat> findByApplicationIdAndStatus(Long applicationId, HiringSeatStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(value = "SELECT * FROM hiring_seats WHERE requisition_id = :requisitionId AND kind = 'STANDARD' AND status = 'AVAILABLE' ORDER BY id LIMIT 1 FOR UPDATE", nativeQuery = true)
    Optional<HiringSeat> lockFirstAvailableStandard(@Param("requisitionId") Long requisitionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from HiringSeat s where s.id = :id")
    Optional<HiringSeat> lockById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from HiringSeat s where s.applicationId = :applicationId and s.status = 'RESERVED'")
    Optional<HiringSeat> lockReservedByApplication(@Param("applicationId") Long applicationId);
}
