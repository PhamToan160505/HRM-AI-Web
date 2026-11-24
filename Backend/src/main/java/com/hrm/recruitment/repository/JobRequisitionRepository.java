package com.hrm.recruitment.repository;

import com.hrm.common.entity.Role;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

import java.util.List;
import java.util.Optional;

public interface JobRequisitionRepository extends JpaRepository<JobRequisition, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from JobRequisition j where j.id = :id")
    Optional<JobRequisition> lockById(@Param("id") Long id);
    List<JobRequisition> findByRequesterId(Long requesterId);
    List<JobRequisition> findByDepartmentId(Long departmentId);
    List<JobRequisition> findByStatus(JobRequisitionStatus status);
    List<JobRequisition> findByDepartmentIdAndStatus(Long departmentId, JobRequisitionStatus status);
    List<JobRequisition> findByTechProjectIdOrderByCreatedAtDesc(Long techProjectId);

    @Query("""
            SELECT j FROM JobRequisition j
            WHERE (:departmentId IS NULL OR j.departmentId = :departmentId)
              AND (:targetRole IS NULL OR j.targetRole = :targetRole)
              AND (:status IS NULL OR j.status = :status)
              AND (:filterRequesterId IS NULL OR j.requesterId = :filterRequesterId)
              AND (
                    j.requesterId = :userId
                 OR :isCEO = true
                 OR (:isHR = true AND j.status = com.hrm.recruitment.entity.JobRequisitionStatus.APPROVED)
                 OR (:isDeptDirector = true AND :userDeptId IS NOT NULL AND j.departmentId = :userDeptId)
                 OR (:isFinanceApprover = true AND (
                        (:userDeptId IS NOT NULL AND j.departmentId = :userDeptId)
                     OR j.status IN (
                            com.hrm.recruitment.entity.JobRequisitionStatus.PENDING_APPROVAL,
                            com.hrm.recruitment.entity.JobRequisitionStatus.APPROVED,
                            com.hrm.recruitment.entity.JobRequisitionStatus.REVISION_REQUIRED,
                            com.hrm.recruitment.entity.JobRequisitionStatus.REJECTED,
                            com.hrm.recruitment.entity.JobRequisitionStatus.FULFILLED
                        )
                    ))
              )
            """)
    Page<JobRequisition> findWithFiltersAndPermissions(
            @Param("departmentId") Long departmentId,
            @Param("targetRole") Role targetRole,
            @Param("status") JobRequisitionStatus status,
            @Param("filterRequesterId") Long filterRequesterId,
            @Param("userId") Long userId,
            @Param("isCEO") boolean isCEO,
            @Param("isHR") boolean isHR,
            @Param("isDeptDirector") boolean isDeptDirector,
            @Param("userDeptId") Long userDeptId,
            @Param("isFinanceApprover") boolean isFinanceApprover,
            Pageable pageable);
}
