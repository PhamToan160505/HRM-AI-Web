package com.hrm.tech.repository;

import com.hrm.tech.entity.TechPerformanceReview;
import com.hrm.tech.entity.TechRatingGrade;
import com.hrm.tech.entity.TechReviewStatus;
import com.hrm.tech.entity.TechReviewType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

@Repository
public interface TechPerformanceReviewRepository extends JpaRepository<TechPerformanceReview, Long> {

    boolean existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(
            Long employeeId, TechReviewType reviewType, LocalDate periodStart, LocalDate periodEnd);

    List<TechPerformanceReview> findByCycleId(Long cycleId);

    List<TechPerformanceReview> findByEmployeeIdOrderByPeriodEndDescIdDesc(Long employeeId);

    List<TechPerformanceReview> findByDepartmentIdAndCycleId(Long departmentId, Long cycleId);

    List<TechPerformanceReview> findByDepartmentId(Long departmentId);

    long countByCycleId(Long cycleId);

    long countByDepartmentIdAndStatusIn(Long departmentId, Collection<TechReviewStatus> statuses);

    @Query(value = "SELECT r FROM TechPerformanceReview r " +
            "JOIN com.hrm.common.entity.User u ON u.id = r.employeeId " +
            "WHERE (:departmentId IS NULL OR r.departmentId = :departmentId) " +
            "AND (:cycleId IS NULL OR r.cycle.id = :cycleId) " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:grade IS NULL OR r.finalGrade = :grade) " +
            "AND (:keyword IS NULL OR :keyword = '' " +
            "     OR LOWER(u.hoTen) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(COALESCE(u.maNhanVien, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(COALESCE(u.chucVu, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "ORDER BY CASE " +
            "  WHEN r.status = 'DIRECTOR_APPROVAL_PENDING' THEN 0 " +
            "  WHEN r.status = 'MANAGER_REVIEW_PENDING' THEN 1 " +
            "  WHEN r.status = 'REJECTED_FOR_REVISION' THEN 2 " +
            "  WHEN r.status = 'SELF_REVIEW_PENDING' THEN 3 " +
            "  ELSE 4 END, r.periodEnd DESC, r.id DESC",
            countQuery = "SELECT COUNT(r) FROM TechPerformanceReview r " +
            "JOIN com.hrm.common.entity.User u ON u.id = r.employeeId " +
            "WHERE (:departmentId IS NULL OR r.departmentId = :departmentId) " +
            "AND (:cycleId IS NULL OR r.cycle.id = :cycleId) " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:grade IS NULL OR r.finalGrade = :grade) " +
            "AND (:keyword IS NULL OR :keyword = '' " +
            "     OR LOWER(u.hoTen) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(COALESCE(u.maNhanVien, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(COALESCE(u.chucVu, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<TechPerformanceReview> findReviewsPaginated(
            @Param("departmentId") Long departmentId,
            @Param("cycleId") Long cycleId,
            @Param("status") TechReviewStatus status,
            @Param("grade") TechRatingGrade grade,
            @Param("keyword") String keyword,
            Pageable pageable);

    @Query("SELECT r.id FROM TechPerformanceReview r " +
            "JOIN com.hrm.common.entity.User u ON u.id = r.employeeId " +
            "WHERE (:departmentId IS NULL OR r.departmentId = :departmentId) " +
            "AND (:cycleId IS NULL OR r.cycle.id = :cycleId) " +
            "AND (:status IS NULL OR r.status = :status) " +
            "AND (:grade IS NULL OR r.finalGrade = :grade) " +
            "AND (:keyword IS NULL OR :keyword = '' " +
            "     OR LOWER(u.hoTen) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(COALESCE(u.maNhanVien, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(COALESCE(u.chucVu, '')) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "ORDER BY CASE " +
            "  WHEN r.status = 'DIRECTOR_APPROVAL_PENDING' THEN 0 " +
            "  WHEN r.status = 'MANAGER_REVIEW_PENDING' THEN 1 " +
            "  WHEN r.status = 'REJECTED_FOR_REVISION' THEN 2 " +
            "  WHEN r.status = 'SELF_REVIEW_PENDING' THEN 3 " +
            "  ELSE 4 END, r.periodEnd DESC, r.id DESC")
    List<Long> findOrderedReviewIds(
            @Param("departmentId") Long departmentId,
            @Param("cycleId") Long cycleId,
            @Param("status") TechReviewStatus status,
            @Param("grade") TechRatingGrade grade,
            @Param("keyword") String keyword);
}
