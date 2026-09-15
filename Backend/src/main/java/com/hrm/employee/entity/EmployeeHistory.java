package com.hrm.employee.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "employee_histories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType; // e.g., JOINED, PROMOTED, TRANSFERRED, SALARY_CHANGED

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "event_date", nullable = false)
    private LocalDateTime eventDate;

    @PrePersist
    protected void onCreate() {
        if (eventDate == null) {
            eventDate = LocalDateTime.now();
        }
    }
}
