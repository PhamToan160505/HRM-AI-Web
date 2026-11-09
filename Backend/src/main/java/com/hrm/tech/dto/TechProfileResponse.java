package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProfileResponse {
    private Long userId;
    private String hoTen;
    private String email;
    private String maNhanVien;
    private String chucVu;
    private String departmentName;
    private String avatarUrl;
    private int totalAllocation;
    private int availableCapacity;
    private List<UserSkillResponse> skills;
    private List<CertificateResponse> certificates;
    private Map<String, Double> radarScores; // Key: BACKEND, FRONTEND, DATABASE, DEVOPS_CLOUD, TESTING, ARCHITECTURE (thang 0-100)
    private int totalSkills;
    private int verifiedSkills;
}

