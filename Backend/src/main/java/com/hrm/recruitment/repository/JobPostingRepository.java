package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.JobPostingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface JobPostingRepository extends JpaRepository<JobPosting, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from JobPosting j where j.id = :id")
    Optional<JobPosting> lockById(@Param("id") Long id);
    Optional<JobPosting> findBySlug(String slug);
    Page<JobPosting> findByDepartmentId(Long departmentId, Pageable pageable);
    
    @Query("SELECT j FROM JobPosting j WHERE (:departmentId IS NULL OR j.departmentId = :departmentId) AND (:capBac IS NULL OR j.capBac = :capBac) AND (:requesterId IS NULL OR j.status = com.hrm.recruitment.entity.JobPostingStatus.OPEN OR j.jobRequisitionId IN (SELECT r.id FROM JobRequisition r WHERE r.requesterId = :requesterId))")
    Page<JobPosting> findWithFilters(@Param("departmentId") Long departmentId, @Param("capBac") String capBac, @Param("requesterId") Long requesterId, Pageable pageable);
    
    @Query("SELECT j FROM JobPosting j WHERE (:departmentId IS NULL OR j.departmentId = :departmentId) AND (:capBac IS NULL OR j.capBac = :capBac) AND (:requesterId IS NULL OR j.jobRequisitionId IN (SELECT r.id FROM JobRequisition r WHERE r.requesterId = :requesterId))")
    Page<JobPosting> findWithFiltersStrictRequester(@Param("departmentId") Long departmentId, @Param("capBac") String capBac, @Param("requesterId") Long requesterId, Pageable pageable);

    @Query("SELECT j FROM JobPosting j WHERE (:departmentId IS NULL OR j.departmentId = :departmentId) AND (:capBac IS NULL OR j.capBac = :capBac) AND (:requesterId IS NULL OR j.jobRequisitionId IN (SELECT r.id FROM JobRequisition r WHERE r.requesterId = :requesterId) OR j.id IN :assignedJobIds)")
    Page<JobPosting> findWithFiltersForRequesterOrInterviewer(
            @Param("departmentId") Long departmentId,
            @Param("capBac") String capBac,
            @Param("requesterId") Long requesterId,
            @Param("assignedJobIds") List<Long> assignedJobIds,
            Pageable pageable);
    
    long countByStatus(JobPostingStatus status);
    long countByStatusAndDepartmentId(JobPostingStatus status, Long departmentId);
    java.util.List<JobPosting> findByStatus(JobPostingStatus status);
}
