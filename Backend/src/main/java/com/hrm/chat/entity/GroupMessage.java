package com.hrm.chat.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "group_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "sender_id")
    private Long senderId;

    @Column(name = "is_ai", nullable = false)
    private boolean isAi = false;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "private_user_id")
    private Long privateUserId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "is_recalled", nullable = false)
    private boolean isRecalled = false;

    @Column(name = "deleted_by_sender", nullable = false)
    private boolean deletedBySender = false;
}

