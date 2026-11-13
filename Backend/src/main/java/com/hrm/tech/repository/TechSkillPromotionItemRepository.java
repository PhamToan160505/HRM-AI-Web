package com.hrm.tech.repository;

import com.hrm.tech.entity.TechSkillPromotionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface TechSkillPromotionItemRepository extends JpaRepository<TechSkillPromotionItem, Long> {

    List<TechSkillPromotionItem> findByReviewIdOrderByIdAsc(Long reviewId);

    List<TechSkillPromotionItem> findByReviewIdInOrderByIdAsc(Collection<Long> reviewIds);

    void deleteByReviewId(Long reviewId);
}
