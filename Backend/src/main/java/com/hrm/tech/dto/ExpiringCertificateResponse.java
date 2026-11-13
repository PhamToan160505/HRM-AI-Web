package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExpiringCertificateResponse {
    private Long certId;
    private Long userId;
    private String hoTen;
    private String maNhanVien;
    private String chucVu;
    private String certificateName;
    private String issuingOrganization;
    private LocalDate issueDate;
    private LocalDate expiryDate;
    private String expiryStatus; // EXPIRING_SOON, EXPIRED
    private Long daysRemaining;
    private String credentialUrl;
}
