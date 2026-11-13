package com.hrm.tech.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "tech_career_events")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechCareerEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "review_id")
    private Long reviewId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 40)
    private TechCareerEventType eventType;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "old_value", length = 150)
    private String oldValue;

    @Column(name = "new_value", length = 150)
    private String newValue;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "event_date", nullable = false)
    @Builder.Default
    private LocalDateTime eventDate = LocalDateTime.now();
}
