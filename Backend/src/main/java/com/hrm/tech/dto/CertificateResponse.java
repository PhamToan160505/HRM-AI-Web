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
public class CertificateResponse {
    private Long id;
    private Long userId;
    private String certificateName;
    private String issuingOrganization;
    private LocalDate issueDate;
    private LocalDate expiryDate;
    private String credentialId;
    private String credentialUrl;
    private Boolean isExpired;
    private String status; // ACTIVE, EXPIRED, LIFETIME
    private String expiryStatus; // VALID, EXPIRING_SOON, EXPIRED
    private Long daysRemaining;
}
