package com.hrm.techhr.repository;

import com.hrm.techhr.entity.CrossDeptHandoffTask;
import com.hrm.techhr.entity.CrossDeptTaskStatus;
import com.hrm.techhr.entity.CrossDeptTaskType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CrossDeptHandoffTaskRepository extends JpaRepository<CrossDeptHandoffTask, Long> {

    List<CrossDeptHandoffTask> findByTargetDepartmentIdOrderByCreatedAtDesc(Long targetDepartmentId);

    List<CrossDeptHandoffTask> findByTargetDepartmentIdOrSourceDepartmentIdOrderByCreatedAtDesc(
            Long targetDepartmentId, Long sourceDepartmentId);

    List<CrossDeptHandoffTask> findAllByOrderByCreatedAtDesc();

    Optional<CrossDeptHandoffTask> findFirstByTaskTypeAndReferenceTypeAndReferenceIdAndStatusIn(
            CrossDeptTaskType taskType,
            String referenceType,
            Long referenceId,
            List<CrossDeptTaskStatus> statuses);

    List<CrossDeptHandoffTask> findByEmployeeUserIdAndStatusIn(
            Long employeeUserId, List<CrossDeptTaskStatus> statuses);

    List<CrossDeptHandoffTask> findByReferenceTypeAndReferenceIdAndStatusIn(
            String referenceType, Long referenceId, List<CrossDeptTaskStatus> statuses);
}
