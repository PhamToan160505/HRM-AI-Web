package com.hrm.common.payroll.repository;

import com.hrm.common.payroll.entity.Payroll;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollRepository extends JpaRepository<Payroll, Long> {
    Optional<Payroll> findByEmployeeIdAndMonthAndYear(Long employeeId, Integer month, Integer year);
    List<Payroll> findByMonthAndYear(Integer month, Integer year);
    List<Payroll> findByMonthAndYearAndEmployeeIdIn(Integer month, Integer year, List<Long> employeeIds);
    List<Payroll> findByEmployeeIdOrderByYearDescMonthDesc(Long employeeId);
}
