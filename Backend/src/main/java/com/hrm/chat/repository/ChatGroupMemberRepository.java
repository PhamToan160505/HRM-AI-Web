package com.hrm.chat.repository;

import com.hrm.chat.entity.ChatGroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatGroupMemberRepository extends JpaRepository<ChatGroupMember, Long> {
    List<ChatGroupMember> findByGroupId(Long groupId);
    long countByGroupId(Long groupId);
    List<ChatGroupMember> findByUserId(Long userId);
    Optional<ChatGroupMember> findByGroupIdAndUserId(Long groupId, Long userId);
}

