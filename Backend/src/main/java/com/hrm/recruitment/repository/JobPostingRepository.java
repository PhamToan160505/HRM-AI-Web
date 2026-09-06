package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.JobPosting;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JobPostingRepository extends JpaRepository<JobPosting, Long> {
    Optional<JobPosting> findBySlug(String slug);
    Page<JobPosting> findByDepartmentId(Long departmentId, Pageable pageable);
    
    @Query("SELECT j FROM JobPosting j WHERE (:departmentId IS NULL OR j.departmentId = :departmentId) AND (:capBac IS NULL OR j.capBac = :capBac) AND (:requesterId IS NULL OR j.status = 'OPEN' OR j.jobRequisitionId IN (SELECT r.id FROM JobRequisition r WHERE r.requesterId = :requesterId))")
    Page<JobPosting> findWithFilters(@Param("departmentId") Long departmentId, @Param("capBac") String capBac, @Param("requesterId") Long requesterId, Pageable pageable);
    
    @Query("SELECT j FROM JobPosting j WHERE (:departmentId IS NULL OR j.departmentId = :departmentId) AND (:capBac IS NULL OR j.capBac = :capBac) AND (:requesterId IS NULL OR j.jobRequisitionId IN (SELECT r.id FROM JobRequisition r WHERE r.requesterId = :requesterId))")
    Page<JobPosting> findWithFiltersStrictRequester(@Param("departmentId") Long departmentId, @Param("capBac") String capBac, @Param("requesterId") Long requesterId, Pageable pageable);
    
    long countByStatus(String status);
    long countByStatusAndDepartmentId(String status, Long departmentId);
    java.util.List<JobPosting> findByStatus(String status);
}
