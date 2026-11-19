package com.hrm.tech.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechDodItemRequest {
    @NotBlank(message = "Tiêu đề tiêu chí DoD không được để trống")
    private String title;
    private String description;
    @Builder.Default
    private Boolean isRequired = true;
}

