package com.hrm.tech.dto;

import com.hrm.tech.entity.TechCareerEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechCareerEventResponse {
    private Long id;
    private Long employeeId;
    private Long reviewId;
    private TechCareerEventType eventType;
    private String title;
    private String oldValue;
    private String newValue;
    private Long actorId;
    private String actorName;
    private String note;
    private LocalDateTime eventDate;
}
