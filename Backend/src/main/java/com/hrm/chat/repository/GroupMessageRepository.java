package com.hrm.chat.repository;

import com.hrm.chat.entity.GroupMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.repository.query.Param;

@Repository
public interface GroupMessageRepository extends JpaRepository<GroupMessage, Long> {
    @org.springframework.data.jpa.repository.Query("SELECT m FROM GroupMessage m WHERE m.groupId = :groupId AND (m.privateUserId IS NULL OR m.privateUserId = :userId) AND (m.deletedBySender = false OR m.senderId != :userId) ORDER BY m.createdAt DESC")
    Page<GroupMessage> findGroupMessagesForUser(@Param("groupId") Long groupId, @Param("userId") Long userId, Pageable pageable);
    
    List<GroupMessage> findByGroupIdOrderByCreatedAtAsc(Long groupId);

    List<GroupMessage> findTop30ByGroupIdOrderByCreatedAtDesc(Long groupId);

    java.util.Optional<GroupMessage> findTopByGroupIdOrderByCreatedAtDesc(Long groupId);
}

