package com.hrm.common.payroll.repository;

import com.hrm.common.payroll.entity.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface HolidayRepository extends JpaRepository<Holiday, Long> {
    List<Holiday> findByNgayLeBetween(LocalDate startDate, LocalDate endDate);
}
