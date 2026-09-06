package com.hrm.recruitment.repository;

import com.hrm.common.entity.Role;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface JobRequisitionRepository extends JpaRepository<JobRequisition, Long> {
    List<JobRequisition> findByRequesterId(Long requesterId);
    List<JobRequisition> findByDepartmentId(Long departmentId);
    List<JobRequisition> findByStatus(JobRequisitionStatus status);
    List<JobRequisition> findByDepartmentIdAndStatus(Long departmentId, JobRequisitionStatus status);

    @Query("SELECT j FROM JobRequisition j WHERE (:departmentId IS NULL OR j.departmentId = :departmentId) AND (:targetRole IS NULL OR j.targetRole = :targetRole) AND (:status IS NULL OR j.status = :status) AND (:filterRequesterId IS NULL OR j.requesterId = :filterRequesterId) AND (j.requesterId = :userId OR :isCEO = true OR (:isHR = true AND j.status IN ('APPROVED', 'POSTED')))")
    Page<JobRequisition> findWithFiltersAndPermissions(
            @Param("departmentId") Long departmentId, 
            @Param("targetRole") Role targetRole, 
            @Param("status") JobRequisitionStatus status, 
            @Param("filterRequesterId") Long filterRequesterId,
            @Param("userId") Long userId, 
            @Param("isCEO") boolean isCEO, 
            @Param("isHR") boolean isHR, 
            Pageable pageable);
}
