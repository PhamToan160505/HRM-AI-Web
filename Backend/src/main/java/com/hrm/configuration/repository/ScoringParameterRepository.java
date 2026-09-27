package com.hrm.configuration.repository;

import com.hrm.configuration.entity.ScoringParameter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScoringParameterRepository extends JpaRepository<ScoringParameter, Long> {
    List<ScoringParameter> findByScoringProfileIdOrderByParameterKey(Long scoringProfileId);
}
