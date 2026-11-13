package com.hrm.tech.repository;

import com.hrm.tech.entity.TechCareerEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechCareerEventRepository extends JpaRepository<TechCareerEvent, Long> {

    List<TechCareerEvent> findByEmployeeIdOrderByEventDateDescIdDesc(Long employeeId);
}
