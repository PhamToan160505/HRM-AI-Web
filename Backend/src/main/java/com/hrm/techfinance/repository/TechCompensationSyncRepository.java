package com.hrm.techfinance.repository;

import com.hrm.techfinance.entity.TechCompensationSync;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TechCompensationSyncRepository extends JpaRepository<TechCompensationSync, Long> {
    Optional<TechCompensationSync> findByReviewId(Long reviewId);
    List<TechCompensationSync> findAllByOrderByCreatedAtDesc();
    List<TechCompensationSync> findByStatusOrderByEffectiveMonthAscCreatedAtAsc(String status);
    List<TechCompensationSync> findByStatusAndEffectiveMonthLessThanEqualOrderByEffectiveMonthAsc(
            String status, String effectiveMonth);
    List<TechCompensationSync> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);
}
