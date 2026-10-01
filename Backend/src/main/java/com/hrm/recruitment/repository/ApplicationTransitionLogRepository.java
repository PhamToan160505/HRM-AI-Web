package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.ApplicationTransitionLog;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ApplicationTransitionLogRepository extends JpaRepository<ApplicationTransitionLog, Long> {
    Optional<ApplicationTransitionLog> findByIdempotencyKey(String idempotencyKey);

    Optional<ApplicationTransitionLog> findFirstByEntityTypeAndEntityIdAndActionAndActorIdIsNotNullOrderByOccurredAtDescIdDesc(
            RecruitmentEntityType entityType,
            Long entityId,
            RecruitmentAction action);

    List<ApplicationTransitionLog> findByEntityTypeAndEntityIdOrderByOccurredAtAscIdAsc(
            RecruitmentEntityType entityType,
            Long entityId);
}
