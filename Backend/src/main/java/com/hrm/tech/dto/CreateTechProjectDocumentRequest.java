package com.hrm.tech.dto;

import com.hrm.tech.entity.TechProjectDocumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechProjectDocumentRequest {
    @NotNull(message = "Loại tài liệu không được để trống")
    @Builder.Default
    private TechProjectDocumentType docType = TechProjectDocumentType.ARCHITECTURE_SPEC;

    @NotBlank(message = "Tiêu đề tài liệu không được để trống")
    private String title;

    @NotBlank(message = "Đường dẫn URL tài liệu không được để trống")
    private String url;

    private String description;
}

