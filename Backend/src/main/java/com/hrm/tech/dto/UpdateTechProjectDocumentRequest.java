package com.hrm.tech.dto;

import com.hrm.tech.entity.TechProjectDocumentType;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTechProjectDocumentRequest {

    private TechProjectDocumentType docType;

    @Size(max = 255, message = "Tiêu đề không quá 255 ký tự")
    private String title;

    @Size(max = 1000, message = "Đường dẫn không quá 1000 ký tự")
    private String url;

    @Size(max = 500, message = "Mô tả không quá 500 ký tự")
    private String description;
}
