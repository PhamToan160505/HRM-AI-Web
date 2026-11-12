package com.hrm.tech.dto;

import com.hrm.tech.entity.ProjectType;
import com.hrm.tech.entity.WorklogApprovalStatus;
import com.hrm.tech.entity.WorklogType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechWorklogResponse {
    private Long id;
    private Long projectId;
    private String projectCode;
    private String projectName;
    private ProjectType projectType;
    private Long milestoneId;
    private String milestoneTitle;
    private Long userId;
    private String userName;
    private String userMaNhanVien;
    private String userEmail;
    private LocalDate workDate;
    private Double hoursSpent;
    private WorklogType workType;
    private Boolean isBillable;
    private String taskSummary;
    private String referenceUrl;
    private WorklogApprovalStatus approvalStatus;
    private Long approvedBy;
    private String approverName;
    private LocalDateTime approvedAt;
    private String rejectionReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Đối chiếu thông minh (Chấm công / WFH / OT / Nghỉ phép, Link PR/Jira, Lệch tải phân bổ ngày)
    private String attendanceContextCode;
    private String attendanceContextLabel;
    private String attendanceSeverity; // INFO | OK | WARNING | DANGER
    private Double dailyLoggedHours;
    private Double projectDailyLoggedHours;
    private Integer projectAllocationPercent;
    private Boolean hasAuditWarning;
    private List<AuditAlertItem> auditAlerts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuditAlertItem {
        private String code;
        private String category; // ATTENDANCE | EVIDENCE | ALLOCATION
        private String severity; // INFO | OK | WARNING | DANGER
        private String label;
        private String detail;
    }
}

