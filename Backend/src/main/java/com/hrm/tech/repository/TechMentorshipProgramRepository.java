package com.hrm.tech.repository;

import com.hrm.tech.entity.TechMentorshipProgram;
import com.hrm.tech.entity.TechMentorshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechMentorshipProgramRepository extends JpaRepository<TechMentorshipProgram, Long> {
    List<TechMentorshipProgram> findByDepartmentIdOrderByCreatedAtDesc(Long departmentId);
    List<TechMentorshipProgram> findByMentorIdOrMenteeIdOrderByCreatedAtDesc(Long mentorId, Long menteeId);
    List<TechMentorshipProgram> findByMentorIdAndStatus(Long mentorId, TechMentorshipStatus status);
    List<TechMentorshipProgram> findByMenteeIdAndStatus(Long menteeId, TechMentorshipStatus status);
}

