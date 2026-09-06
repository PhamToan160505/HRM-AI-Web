package com.hrm.common.payroll.repository;

import com.hrm.common.payroll.entity.PayrollReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollReportRepository extends JpaRepository<PayrollReport, Long> {

    Optional<PayrollReport> findByDepartmentIdAndCreatedByAndMonthAndYearAndReportLevel(
            Long departmentId, Long createdBy, Integer month, Integer year, String reportLevel);

    List<PayrollReport> findByDepartmentIdAndMonthAndYearAndReportLevel(
            Long departmentId, Integer month, Integer year, String reportLevel);
            
    List<PayrollReport> findByMonthAndYearAndReportLevel(
            Integer month, Integer year, String reportLevel);
}
