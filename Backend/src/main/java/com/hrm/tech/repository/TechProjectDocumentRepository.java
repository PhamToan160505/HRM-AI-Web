package com.hrm.tech.repository;

import com.hrm.tech.entity.TechProjectDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TechProjectDocumentRepository extends JpaRepository<TechProjectDocument, Long> {
    List<TechProjectDocument> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    long countByProjectId(Long projectId);
}

