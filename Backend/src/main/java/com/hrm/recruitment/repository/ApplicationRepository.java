package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import java.time.LocalDateTime;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, Long> {
    List<Application> findByJobPostingId(Long jobPostingId);
    List<Application> findByCreatedAtAfter(LocalDateTime date);
    
    long countByApprovalStatusNotAndApprovalStatusNot(String status1, String status2);
    long countByApprovalStatus(String status);
    
    java.util.List<Application> findTop5ByOrderByCreatedAtDesc();
    
    boolean existsByEmailAndJobPostingIdAndCreatedAtAfter(String email, Long jobPostingId, LocalDateTime time);
}
