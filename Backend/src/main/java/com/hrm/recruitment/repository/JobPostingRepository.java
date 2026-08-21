package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.JobPosting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface JobPostingRepository extends JpaRepository<JobPosting, Long> {
    Optional<JobPosting> findBySlug(String slug);
    java.util.List<JobPosting> findByStatus(String status);
    long countByStatus(String status);
}
