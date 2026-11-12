package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.entity.ProjectType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorklogAnalyticsResponse {

    private String month;
    private Double totalPlannedFteHours;
    private Double totalApprovedHours;
    private Double totalPendingHours;
    private Double totalRejectedHours;
    private Double billableApprovedHours;
    private Double internalApprovedHours;
    private Integer billablePercent;
    private Integer burnUtilizationPercent;
    private Double totalApprovedManDays;
    private Double totalPendingManDays;

    // Chỉ CEO & Giám đốc phòng được xem tổng hợp chi phí ước tính cấp dự án (tuân thủ bảo mật B-10, không trả lương cá nhân)
    private Boolean canViewCost;
    private Double estimatedTotalLaborCost;
    private Integer projectsWithConfiguredSalaryCount;

    private List<ProjectBurnItem> projectBreakdowns;
    private List<EngineerBurnItem> engineerBreakdowns;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProjectBurnItem {
        private Long projectId;
        private String projectCode;
        private String projectName;
        private ProjectType projectType;
        private ProjectStatus status;
        private Integer allocatedPercentSum;
        private Double plannedFteHours;
        private Double actualApprovedHours;
        private Double pendingHours;
        private Double billableApprovedHours;
        private Integer burnUtilizationPercent;
        private Double approvedManDays;
        private Double estimatedLaborCost; // Null nếu không có quyền hoặc chưa cấu hình lương
        private Boolean hasSalaryData;
        private Integer actualProgressPercent;
        private Integer overdueMilestonesCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EngineerBurnItem {
        private Long userId;
        private String hoTen;
        private String maNhanVien;
        private String chucVu;
        private Integer allocatedPercent;
        private Double plannedHours;
        private Double approvedHours;
        private Double pendingHours;
        private Double billableHours;
        private Integer utilizationPercent;
        private Double approvedManDays;
    }
}

