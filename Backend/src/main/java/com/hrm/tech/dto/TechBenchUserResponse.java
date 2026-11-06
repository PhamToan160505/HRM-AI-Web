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
public class TechBenchUserResponse {
    private Long userId;
    private String hoTen;
    private String email;
    private String maNhanVien;
    private String chucVu;
    private String avatarUrl;
    private String departmentName;
    private Integer totalAllocation;
    private Integer availableCapacity;
    private Integer activeProjectsCount;
    private Boolean isOverloaded;
    private List<String> activeProjectNames;
}

