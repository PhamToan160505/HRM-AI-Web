package com.hrm.attendance.repository;

import com.hrm.attendance.entity.FaceEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FaceEmbeddingRepository extends JpaRepository<FaceEmbedding, Long> {
    Optional<FaceEmbedding> findFirstByEmployeeIdOrderByIdDesc(Long employeeId);
    void deleteAllByEmployeeId(Long employeeId);
}
