package com.hrm.tech.repository;

import com.hrm.tech.entity.SkillCategory;
import com.hrm.tech.entity.TechSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TechSkillRepository extends JpaRepository<TechSkill, Long> {

    List<TechSkill> findByCategory(SkillCategory category);

    Optional<TechSkill> findBySkillNameIgnoreCase(String skillName);

    boolean existsBySkillNameIgnoreCase(String skillName);

    List<TechSkill> findAllByOrderByCategoryAscSkillNameAsc();
}

