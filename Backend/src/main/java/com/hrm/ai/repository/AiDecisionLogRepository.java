package com.hrm.ai.repository;

import com.hrm.ai.entity.AiDecisionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiDecisionLogRepository extends JpaRepository<AiDecisionLog, Long> {
    List<AiDecisionLog> findByApplicationId(Long applicationId);
}
