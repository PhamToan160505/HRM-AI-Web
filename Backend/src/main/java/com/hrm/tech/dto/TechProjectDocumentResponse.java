package com.hrm.tech.dto;

import com.hrm.tech.entity.TechProjectDocumentType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProjectDocumentResponse {
    private Long id;
    private Long projectId;
    private TechProjectDocumentType docType;
    private String title;
    private String url;
    private String description;
    private Long createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
}

