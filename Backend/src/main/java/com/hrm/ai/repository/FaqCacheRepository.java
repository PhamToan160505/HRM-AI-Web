package com.hrm.ai.repository;

import com.hrm.ai.entity.FaqCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FaqCacheRepository extends JpaRepository<FaqCache, Long> {
}
