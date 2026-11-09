package com.hrm.tech.repository;

import com.hrm.tech.entity.UserTechCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserTechCertificateRepository extends JpaRepository<UserTechCertificate, Long> {

    List<UserTechCertificate> findByUserIdOrderByIssueDateDesc(Long userId);

    List<UserTechCertificate> findByUserIdIn(List<Long> userIds);
}

