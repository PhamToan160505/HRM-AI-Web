package com.hrm.tech.repository;

import com.hrm.tech.entity.TechProjectMilestone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechProjectMilestoneRepository extends JpaRepository<TechProjectMilestone, Long> {

    List<TechProjectMilestone> findByProjectIdOrderByDueDateAscIdAsc(Long projectId);

    @Query("SELECT COALESCE(SUM(m.weightPercent), 0) FROM TechProjectMilestone m WHERE m.project.id = :projectId AND (:excludeId IS NULL OR m.id <> :excludeId)")
    Integer sumWeightPercentByProjectIdExcluding(@Param("projectId") Long projectId, @Param("excludeId") Long excludeId);
}

