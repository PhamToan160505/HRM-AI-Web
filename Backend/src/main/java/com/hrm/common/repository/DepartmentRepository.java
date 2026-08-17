package com.hrm.common.repository;

import com.hrm.common.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {
    Optional<Department> findByTenPhong(String tenPhong);
    boolean existsByTenPhong(String tenPhong);
}
