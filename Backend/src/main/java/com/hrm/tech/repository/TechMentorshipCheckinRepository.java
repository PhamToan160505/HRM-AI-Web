package com.hrm.tech.repository;

import com.hrm.tech.entity.TechMentorshipCheckin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechMentorshipCheckinRepository extends JpaRepository<TechMentorshipCheckin, Long> {
    List<TechMentorshipCheckin> findByProgramIdOrderByCheckinDateDescCreatedAtDesc(Long programId);
    long countByProgramId(Long programId);
}

