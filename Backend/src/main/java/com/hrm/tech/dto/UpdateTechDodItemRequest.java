package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTechDodItemRequest {
    private String title;
    private String description;
    private Boolean isRequired;
    private Boolean isCompleted;
    private String notes;
}

