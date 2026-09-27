package com.hrm.configuration.repository;

import com.hrm.configuration.entity.ScoringProfile;
import com.hrm.configuration.entity.ScoringProfileStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ScoringProfileRepository extends JpaRepository<ScoringProfile, Long> {
    Optional<ScoringProfile> findFirstByStatusAndEffectiveFromLessThanEqualOrderByEffectiveFromDescIdDesc(
            ScoringProfileStatus status, LocalDateTime effectiveAt);

    List<ScoringProfile> findAllByOrderByProfileCodeAscVersionNumberDesc();

    Optional<ScoringProfile> findFirstByProfileCodeOrderByVersionNumberDesc(String profileCode);

    List<ScoringProfile> findByStatus(ScoringProfileStatus status);
}
