package com.hrm.tech.repository;

import com.hrm.tech.entity.TechDeploymentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechDeploymentLogRepository extends JpaRepository<TechDeploymentLog, Long> {
    List<TechDeploymentLog> findByEnvironmentIdOrderByDeployedAtDesc(Long environmentId);
    List<TechDeploymentLog> findByEnvironmentProjectIdOrderByDeployedAtDesc(Long projectId);
}

