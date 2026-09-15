package com.hrm.employee.repository;

import com.hrm.employee.entity.PerformanceReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, Long> {
    List<PerformanceReview> findByEmployeeIdOrderByNamDescThangDesc(Long employeeId);
    boolean existsByEmployeeIdAndThangAndNam(Long employeeId, Integer thang, Integer nam);
}
