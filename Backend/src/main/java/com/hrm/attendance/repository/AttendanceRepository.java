package com.hrm.attendance.repository;

import com.hrm.attendance.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    Optional<Attendance> findFirstByEmployeeIdAndDateOrderByIdDesc(Long employeeId, LocalDate date);
    List<Attendance> findByEmployeeIdOrderByDateDesc(Long employeeId);
    List<Attendance> findByEmployeeIdInAndDate(List<Long> employeeIds, LocalDate date);
    List<Attendance> findByEmployeeIdAndDateBetween(Long employeeId, LocalDate startDate, LocalDate endDate);
    boolean existsByEmployeeIdAndDateBetweenAndExceptionStatus(Long employeeId, LocalDate startDate, LocalDate endDate, String exceptionStatus);
    
    long countByDateAndStatus(LocalDate date, String status);
    
    @org.springframework.data.jpa.repository.Query("SELECT COUNT(a) FROM Attendance a JOIN com.hrm.common.entity.User u ON a.employeeId = u.id WHERE a.exceptionStatus = :status AND u.departmentId = :departmentId")
    long countByExceptionStatusAndDepartmentId(@org.springframework.data.repository.query.Param("status") String status, @org.springframework.data.repository.query.Param("departmentId") Long departmentId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(a) FROM Attendance a JOIN com.hrm.common.entity.User u ON a.employeeId = u.id WHERE a.exceptionStatus = :status AND u.teamId = :teamId")
    long countByExceptionStatusAndTeamId(@org.springframework.data.repository.query.Param("status") String status, @org.springframework.data.repository.query.Param("teamId") Long teamId);

    java.util.List<Attendance> findTop5ByIsExceptionTrueOrderByIdDesc();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(a) FROM Attendance a JOIN com.hrm.common.entity.User u ON a.employeeId = u.id WHERE u.departmentId = :departmentId AND a.date = :date AND a.status IN ('PRESENT', 'LATE')")
    long countByDepartmentIdAndDateAndPresentOrLate(@org.springframework.data.repository.query.Param("departmentId") Long departmentId, @org.springframework.data.repository.query.Param("date") LocalDate date);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(a) FROM Attendance a JOIN com.hrm.common.entity.User u ON a.employeeId = u.id WHERE u.teamId = :teamId AND a.date = :date AND a.status IN ('PRESENT', 'LATE')")
    long countByTeamIdAndDateAndPresentOrLate(@org.springframework.data.repository.query.Param("teamId") Long teamId, @org.springframework.data.repository.query.Param("date") LocalDate date);
}
