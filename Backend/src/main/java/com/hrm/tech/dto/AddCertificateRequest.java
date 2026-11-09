package com.hrm.tech.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddCertificateRequest {
    @NotBlank(message = "Tên chứng chỉ không được để trống")
    private String certificateName;

    @NotBlank(message = "Tổ chức cấp chứng chỉ không được để trống")
    private String issuingOrganization;

    @NotNull(message = "Vui lòng chọn ngày cấp")
    @PastOrPresent(message = "Ngày cấp chứng chỉ không được ở tương lai")
    private LocalDate issueDate;

    private LocalDate expiryDate;
    private String credentialId;
    private String credentialUrl;
}

