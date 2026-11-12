package com.hrm.tech.repository;

import com.hrm.tech.entity.TechProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TechProjectMemberRepository extends JpaRepository<TechProjectMember, Long> {

    List<TechProjectMember> findByProjectId(Long projectId);

    List<TechProjectMember> findByProjectIdAndIsActiveTrue(Long projectId);

    List<TechProjectMember> findByUserIdAndIsActiveTrue(Long userId);

    Optional<TechProjectMember> findByProjectIdAndUserIdAndIsActiveTrue(Long projectId, Long userId);

    boolean existsByProjectIdAndUserIdAndIsActiveTrue(Long projectId, Long userId);

    @Query("SELECT m FROM TechProjectMember m JOIN FETCH m.project p " +
           "WHERE m.userId IN :userIds ORDER BY m.isActive DESC, m.id DESC")
    List<TechProjectMember> findAllByUserIdInWithProjectOrderByActiveDesc(@Param("userIds") Collection<Long> userIds);

    @Query("SELECT COALESCE(SUM(m.allocationPercent), 0) FROM TechProjectMember m " +
           "JOIN m.project p " +
           "WHERE m.userId = :userId AND m.isActive = true AND p.status IN ('PLANNING', 'IN_PROGRESS', 'MAINTENANCE')")
    Integer getTotalActiveAllocationByUserId(@Param("userId") Long userId);

    @Query("SELECT m FROM TechProjectMember m JOIN FETCH m.project p " +
           "WHERE m.userId = :userId AND m.isActive = true AND p.status IN ('PLANNING', 'IN_PROGRESS', 'MAINTENANCE')")
    List<TechProjectMember> findActiveMembershipsWithProject(@Param("userId") Long userId);
}

