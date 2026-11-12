package com.hrm.tech.repository;

import com.hrm.tech.entity.TechWorklog;
import com.hrm.tech.entity.WorklogApprovalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface TechWorklogRepository extends JpaRepository<TechWorklog, Long> {

    @Query("SELECT COALESCE(SUM(w.hoursSpent), 0) FROM TechWorklog w " +
           "WHERE w.userId = :userId AND w.workDate = :workDate " +
           "AND w.approvalStatus IN ('PENDING', 'APPROVED') " +
           "AND (:excludeId IS NULL OR w.id <> :excludeId)")
    BigDecimal sumActiveHoursByUserIdAndWorkDateExcluding(
            @Param("userId") Long userId,
            @Param("workDate") LocalDate workDate,
            @Param("excludeId") Long excludeId);

    @Query("SELECT w FROM TechWorklog w " +
           "JOIN FETCH w.project p " +
           "LEFT JOIN FETCH w.milestone m " +
           "WHERE w.userId = :userId " +
           "AND (:projectId IS NULL OR p.id = :projectId) " +
           "AND (:status IS NULL OR w.approvalStatus = :status) " +
           "AND (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate) " +
           "ORDER BY w.workDate DESC, w.id DESC")
    List<TechWorklog> findMyWorklogsWithFilters(
            @Param("userId") Long userId,
            @Param("projectId") Long projectId,
            @Param("status") WorklogApprovalStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT w FROM TechWorklog w " +
           "JOIN FETCH w.project p " +
           "LEFT JOIN FETCH w.milestone m " +
           "WHERE (:projectId IS NULL OR p.id = :projectId) " +
           "AND (:userId IS NULL OR w.userId = :userId) " +
           "AND (:status IS NULL OR w.approvalStatus = :status) " +
           "AND (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate) " +
           "ORDER BY CASE WHEN w.approvalStatus = 'PENDING' THEN 0 ELSE 1 END, w.workDate DESC, w.id DESC")
    List<TechWorklog> findDepartmentWorklogsWithFilters(
            @Param("projectId") Long projectId,
            @Param("userId") Long userId,
            @Param("status") WorklogApprovalStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query(value = "SELECT w FROM TechWorklog w " +
           "JOIN FETCH w.project p " +
           "LEFT JOIN FETCH w.milestone m " +
           "WHERE (:projectId IS NULL OR p.id = :projectId) " +
           "AND (:userId IS NULL OR w.userId = :userId) " +
           "AND (:status IS NULL OR w.approvalStatus = :status) " +
           "AND (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate) " +
           "ORDER BY CASE WHEN w.approvalStatus = 'PENDING' THEN 0 ELSE 1 END, w.workDate DESC, w.id DESC",
           countQuery = "SELECT COUNT(w) FROM TechWorklog w " +
           "WHERE (:projectId IS NULL OR w.project.id = :projectId) " +
           "AND (:userId IS NULL OR w.userId = :userId) " +
           "AND (:status IS NULL OR w.approvalStatus = :status) " +
           "AND (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate)")
    Page<TechWorklog> findDepartmentWorklogsPage(
            @Param("projectId") Long projectId,
            @Param("userId") Long userId,
            @Param("status") WorklogApprovalStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query(value = "SELECT w FROM TechWorklog w " +
           "JOIN FETCH w.project p " +
           "LEFT JOIN FETCH w.milestone m " +
           "WHERE w.userId IN :userIds " +
           "AND (:projectId IS NULL OR p.id = :projectId) " +
           "AND (:userId IS NULL OR w.userId = :userId) " +
           "AND (:status IS NULL OR w.approvalStatus = :status) " +
           "AND (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate) " +
           "ORDER BY CASE WHEN w.approvalStatus = 'PENDING' THEN 0 ELSE 1 END, w.workDate DESC, w.id DESC",
           countQuery = "SELECT COUNT(w) FROM TechWorklog w " +
           "WHERE w.userId IN :userIds " +
           "AND (:projectId IS NULL OR w.project.id = :projectId) " +
           "AND (:userId IS NULL OR w.userId = :userId) " +
           "AND (:status IS NULL OR w.approvalStatus = :status) " +
           "AND (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate)")
    Page<TechWorklog> findScopedDepartmentWorklogsPage(
            @Param("userIds") Collection<Long> userIds,
            @Param("projectId") Long projectId,
            @Param("userId") Long userId,
            @Param("status") WorklogApprovalStatus status,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate,
            Pageable pageable);

    @Query("SELECT COALESCE(SUM(w.hoursSpent), 0) FROM TechWorklog w " +
           "WHERE w.project.id = :projectId AND w.approvalStatus = :status")
    BigDecimal sumHoursByProjectIdAndStatus(
            @Param("projectId") Long projectId,
            @Param("status") WorklogApprovalStatus status);

    @Query("SELECT w FROM TechWorklog w " +
           "JOIN FETCH w.project p " +
           "WHERE (:startDate IS NULL OR w.workDate >= :startDate) " +
           "AND (:endDate IS NULL OR w.workDate <= :endDate)")
    List<TechWorklog> findAllForAnalyticsInRange(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    List<TechWorklog> findByProjectId(Long projectId);

    @Query("SELECT w FROM TechWorklog w JOIN FETCH w.project p " +
           "WHERE w.userId IN :userIds " +
           "AND w.workDate >= :startDate AND w.workDate <= :endDate " +
           "AND w.approvalStatus IN ('PENDING', 'APPROVED')")
    List<TechWorklog> findActiveWorklogsByUserIdsInRange(
            @Param("userIds") Collection<Long> userIds,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}

