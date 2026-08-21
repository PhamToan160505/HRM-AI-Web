package com.hrm.attendance.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendances")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Attendance {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Long employeeId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "time_in", nullable = false)
    private LocalTime timeIn;

    @Column(name = "time_out")
    private LocalTime timeOut;

    @Column(name = "scan_history", columnDefinition = "TEXT")
    private String scanHistory;

    // PRESENT, LATE, ABSENT, HALF_DAY
    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "is_exception", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private Boolean isException = false;

    @Column(name = "exception_reason", columnDefinition = "TEXT")
    private String exceptionReason;

    // PENDING, APPROVED, REJECTED
    @Column(name = "exception_status")
    private String exceptionStatus;

    // NORMAL_LEAVE, HALF_DAY_LEAVE, SPECIAL_WFH_LEAVE, UNPAID
    @Column(name = "loai_nghi_phep", length = 50)
    private String loaiNghiPhep;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
