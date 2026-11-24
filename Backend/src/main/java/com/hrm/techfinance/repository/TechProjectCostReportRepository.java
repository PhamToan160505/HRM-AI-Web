package com.hrm.techfinance.repository;

import com.hrm.techfinance.entity.TechProjectCostReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TechProjectCostReportRepository extends JpaRepository<TechProjectCostReport, Long> {
    Optional<TechProjectCostReport> findByReportMonthAndDepartmentId(String reportMonth, Long departmentId);
    List<TechProjectCostReport> findAllByOrderByReportMonthDescIdDesc();
    List<TechProjectCostReport> findByDepartmentIdOrderByReportMonthDescIdDesc(Long departmentId);
    List<TechProjectCostReport> findByStatusOrderByReportMonthDescIdDesc(String status);
}
