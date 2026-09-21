package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.ApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import java.time.LocalDateTime;

import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, Long>, JpaSpecificationExecutor<Application> {
    List<Application> findByJobPostingId(Long jobPostingId);
    List<Application> findByCreatedAtAfter(LocalDateTime date);
    
    long countByApprovalStatusNotAndApprovalStatusNot(ApplicationStatus status1, ApplicationStatus status2);
    long countByApprovalStatus(ApplicationStatus status);
    
    java.util.List<Application> findTop5ByOrderByCreatedAtDesc();
    
    boolean existsByEmailAndJobPostingIdAndCreatedAtAfter(String email, Long jobPostingId, LocalDateTime time);
    long countByJobPostingId(Long jobPostingId);
    long countByJobPostingIdAndApprovalStatus(Long jobPostingId, com.hrm.recruitment.entity.ApplicationStatus status);
    long countByApprovalStatusAndJobPosting_DepartmentId(ApplicationStatus status, Long departmentId);
    java.util.List<Application> findTop5ByJobPosting_DepartmentIdOrderByCreatedAtDesc(Long departmentId);
}
