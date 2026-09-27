package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.ScreeningCriteriaSet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ScreeningCriteriaSetRepository extends JpaRepository<ScreeningCriteriaSet, Long> {
    Optional<ScreeningCriteriaSet> findFirstByPostingIdOrderByVersionNumberDesc(Long postingId);
}
