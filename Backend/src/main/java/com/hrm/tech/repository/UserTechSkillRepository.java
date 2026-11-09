package com.hrm.tech.repository;

import com.hrm.tech.entity.UserTechSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserTechSkillRepository extends JpaRepository<UserTechSkill, Long> {

    List<UserTechSkill> findByUserId(Long userId);

    Optional<UserTechSkill> findByUserIdAndSkillId(Long userId, Long skillId);

    boolean existsByUserIdAndSkillId(Long userId, Long skillId);

    List<UserTechSkill> findByUserIdIn(List<Long> userIds);

    @Query("SELECT uts FROM UserTechSkill uts WHERE uts.skill.id = :skillId")
    List<UserTechSkill> findBySkillId(@Param("skillId") Long skillId);
}

