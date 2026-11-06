package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechProjectMemberResponse {
    private Long id;
    private Long projectId;
    private Long userId;
    private String userName;
    private String userEmail;
    private String userMaNhanVien;
    private String userAvatarUrl;
    private String userChucVu;
    private ProjectRole projectRole;
    private Integer allocationPercent;
    private LocalDate joinedAt;
    private LocalDate leftAt;
    private Boolean isActive;
    private Integer totalCurrentAllocation;
    private Boolean isOverloaded;
}

