package com.hrm.tech.repository;

import com.hrm.tech.entity.TechMilestoneDodItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechMilestoneDodItemRepository extends JpaRepository<TechMilestoneDodItem, Long> {
    List<TechMilestoneDodItem> findByMilestoneIdOrderByCreatedAtAsc(Long milestoneId);
    long countByMilestoneIdAndIsRequiredTrueAndIsCompletedFalse(Long milestoneId);
    long countByMilestoneId(Long milestoneId);
    long countByMilestoneIdAndIsCompletedTrue(Long milestoneId);
}

