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

    @Query("SELECT r FROM EmployeeRequest r JOIN FETCH r.user WHERE r.status = :status ORDER BY r.createdAt DESC")
    List<EmployeeRequest> findByStatusWithUser(@Param("status") com.hrm.request.entity.RequestStatus status);

    @Query("SELECT r FROM EmployeeRequest r JOIN FETCH r.user ORDER BY r.createdAt DESC")
    List<EmployeeRequest> findAllWithUser();

    /** Đơn của các nhân viên có ngày nằm trong khoảng [startDate, endDate] và đang ở các trạng thái cho trước (dùng khi chốt công). */
    @Query("SELECT r FROM EmployeeRequest r JOIN FETCH r.user WHERE r.user.id IN :userIds AND r.status IN :statuses AND r.startDate <= :endDate AND r.endDate >= :startDate")
    List<EmployeeRequest> findOverlappingByUsersAndStatuses(@Param("userIds") List<Long> userIds,
                                                            @Param("statuses") List<com.hrm.request.entity.RequestStatus> statuses,
                                                            @Param("startDate") LocalDate startDate,
                                                            @Param("endDate") LocalDate endDate);
}
