package com.hrm.tech.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SkillMatchCandidateResponse {
    private Long userId;
    private String hoTen;
    private String email;
    private String maNhanVien;
    private String chucVu;
    private String avatarUrl;
    private int totalAllocation;
    private int availableCapacity;
    private int matchScore; // 0 - 100%
    private List<UserSkillResponse> matchedSkills;
    private List<UserSkillResponse> allSkills;
}

