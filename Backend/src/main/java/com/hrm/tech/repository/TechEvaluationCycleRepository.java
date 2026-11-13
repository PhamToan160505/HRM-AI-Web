package com.hrm.tech.repository;

import com.hrm.tech.entity.TechEvaluationCycle;
import com.hrm.tech.entity.TechEvaluationCycleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TechEvaluationCycleRepository extends JpaRepository<TechEvaluationCycle, Long> {

    Optional<TechEvaluationCycle> findByCycleCodeIgnoreCase(String cycleCode);

    boolean existsByCycleCodeIgnoreCase(String cycleCode);

    List<TechEvaluationCycle> findByDepartmentIdOrderByPeriodEndDescIdDesc(Long departmentId);

    List<TechEvaluationCycle> findAllByOrderByPeriodEndDescIdDesc();

    List<TechEvaluationCycle> findByDepartmentIdAndStatus(Long departmentId, TechEvaluationCycleStatus status);
}
