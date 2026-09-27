package com.hrm.ai.repository;

import com.hrm.ai.entity.AiAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AiAnalysisRepository extends JpaRepository<AiAnalysis, Long> {

    @Query("""
            SELECT analysis
            FROM AiAnalysis analysis, Application application
            WHERE analysis.applicationId = application.id
              AND application.jobPosting.id = :postingId
              AND analysis.criteriaVersionId = :criteriaVersionId
              AND analysis.scoringProfileVersionId = :profileVersionId
            ORDER BY analysis.createdAt DESC, analysis.id DESC
            """)
    List<AiAnalysis> findComparableForPosting(
            @Param("postingId") Long postingId,
            @Param("criteriaVersionId") Long criteriaVersionId,
            @Param("profileVersionId") Long profileVersionId);

    List<AiAnalysis> findByApplicationIdOrderByCreatedAtDescIdDesc(Long applicationId);
}
