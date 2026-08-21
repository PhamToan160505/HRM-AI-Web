package com.hrm.common.payroll.repository;

import com.hrm.common.payroll.entity.SalaryHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalaryHistoryRepository extends JpaRepository<SalaryHistory, Long> {
    List<SalaryHistory> findByEmployeeIdOrderByChangeDateDesc(Long employeeId);
    List<SalaryHistory> findByEmployeeIdInOrderByChangeDateDesc(List<Long> employeeIds);
}
