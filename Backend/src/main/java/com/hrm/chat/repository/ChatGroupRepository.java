package com.hrm.chat.repository;

import com.hrm.chat.entity.ChatGroup;
import com.hrm.chat.entity.ChatGroupType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatGroupRepository extends JpaRepository<ChatGroup, Long> {
    List<ChatGroup> findByType(ChatGroupType type);
    Optional<ChatGroup> findByDepartmentId(Long departmentId);
}

