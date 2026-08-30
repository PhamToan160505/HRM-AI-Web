package com.hrm.request.repository;

import com.hrm.request.entity.EmployeeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface EmployeeRequestRepository extends JpaRepository<EmployeeRequest, Long> {
    List<EmployeeRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    @Query("SELECT r FROM EmployeeRequest r WHERE r.user.id IN :userIds ORDER BY r.createdAt DESC")
    List<EmployeeRequest> findByUserIdInOrderByCreatedAtDesc(@Param("userIds") List<Long> userIds);

    @Query("SELECT r FROM EmployeeRequest r WHERE r.user.id = :userId AND r.status = 'APPROVED' AND r.startDate <= :endDate AND r.endDate >= :startDate ORDER BY r.startDate DESC")
    List<EmployeeRequest> findApprovedRequestsForMonth(@Param("userId") Long userId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
