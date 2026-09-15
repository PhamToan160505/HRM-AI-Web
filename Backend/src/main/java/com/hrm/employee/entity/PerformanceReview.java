package com.hrm.employee.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "performance_reviews")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PerformanceReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "thang", nullable = false)
    private Integer thang;

    @Column(name = "nam", nullable = false)
    private Integer nam;

    @Column(name = "ai_evaluation", columnDefinition = "TEXT", nullable = false)
    private String aiEvaluation;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @PrePersist
    protected void onCreate() {
        if (generatedAt == null) {
            generatedAt = LocalDateTime.now();
        }
    }
}
