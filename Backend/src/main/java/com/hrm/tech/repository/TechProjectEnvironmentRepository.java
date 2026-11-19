package com.hrm.tech.repository;

import com.hrm.tech.entity.TechProjectEnvironment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TechProjectEnvironmentRepository extends JpaRepository<TechProjectEnvironment, Long> {
    List<TechProjectEnvironment> findByProjectIdOrderByEnvNameAsc(Long projectId);
    Optional<TechProjectEnvironment> findByProjectIdAndEnvName(Long projectId, String envName);
}

