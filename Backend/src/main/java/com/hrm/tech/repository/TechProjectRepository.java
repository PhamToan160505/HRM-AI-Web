package com.hrm.tech.repository;

import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.entity.TechProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TechProjectRepository extends JpaRepository<TechProject, Long> {

    Optional<TechProject> findByProjectCode(String projectCode);

    boolean existsByProjectCode(String projectCode);

    List<TechProject> findByStatus(ProjectStatus status);

    List<TechProject> findAllByOrderByCreatedAtDesc();

    @Query("SELECT p FROM TechProject p WHERE " +
           "(:status IS NULL OR p.status = :status) AND " +
           "(:keyword IS NULL OR LOWER(p.projectName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           " LOWER(p.projectCode) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY p.createdAt DESC")
    List<TechProject> searchProjects(@Param("status") ProjectStatus status, @Param("keyword") String keyword);

    @Query("SELECT DISTINCT p FROM TechProject p JOIN p.members m WHERE m.userId = :userId AND m.isActive = true ORDER BY p.createdAt DESC")
    List<TechProject> findProjectsByMemberUserId(@Param("userId") Long userId);
}

