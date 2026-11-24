package com.hrm.techhr.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class TechHrIntegrationDtos {

    private TechHrIntegrationDtos() {}

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechInterviewerSuggestion {
        private Long userId;
        private String hoTen;
        private String email;
        private String chucVu;
        private String role; // TRUONG_PHONG | GIAM_DOC_PHONG_BAN | NHAN_VIEN
        private boolean canLeadRound1;
        private boolean canLeadRound2;
        private int totalAllocation;
        private int availableCapacity;
        private boolean onLeaveThatDay;
        private double matchScore;
        private List<String> matchedSkills;
        private String recommendationReason;
        private String availabilityBadge; // OPTIMAL | BUSY | OVERLOADED | ON_LEAVE
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MyTechInterviewItem {
        private Long interviewId;
        private Long applicationId;
        private String candidateName;
        private String jobTitle;
        private Integer roundNumber;
        private String status;
        private LocalDateTime scheduledStart;
        private LocalDateTime scheduledEnd;
        private String interviewMode;
        private String location;
        private String meetingUrl;
        private String participantRole;
        private String invitationStatus;
        private boolean feedbackSubmitted;
        private int requiredFeedbackCount;
        private int submittedFeedbackCount;
        private boolean allRequiredFeedbackDone;
        private String pendingFeedbackNames;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechPreboardingEngineer {
        private Long lifecycleEmployeeId;
        private Long userId;
        private String employeeCode;
        private String fullName;
        private String email;
        private String positionTitle;
        private String levelName;
        private String status; // PRE_BOARDING | EMPLOYED
        private String probationStatus; // PLANNED | IN_PROGRESS | PASSED | FAILED | NOT_APPLICABLE
        private LocalDate startDatePlanned;
        private LocalDate joinDate;
        private Long originTechProjectId;
        private String originTechProjectCode;
        private List<TechChecklistItem> techChecklistItems;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechChecklistItem {
        private Long itemId;
        private String itemCode;
        private String label;
        private String status; // PENDING | COMPLETED
        private LocalDate dueDate;
        private LocalDateTime completedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechLeaveImpactResponse {
        private Long userId;
        private String employeeName;
        @JsonProperty("isTechEngineer")
        private boolean isTechEngineer;
        private long leaveDays;
        private String riskLevel; // NONE | LOW | MEDIUM | HIGH
        @JsonProperty("isTechLeadAnywhere")
        private boolean isTechLeadAnywhere;
        private int activeProjectsCount;
        private int affectedMilestonesCount;
        private int activeMentorshipsCount;
        private List<String> affectedProjectNames;
        private List<String> affectedMilestoneAlerts;
        private String summaryMessage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechOffboardingImpactResponse {
        private Long userId;
        private String hoTen;
        private String email;
        private String chucVu;
        private boolean hasBlockers;
        private String riskLevel; // NONE | MEDIUM | HIGH | CRITICAL
        private int activeProjectsCount;
        private int techLeadProjectsCount;
        private int activeMentorshipsCount;
        private int ownedEnvironmentsCount;
        private int pendingWorklogsCount;
        private List<String> projectDetails;
        private List<String> mentorshipDetails;
        private List<String> environmentDetails;
        private boolean openHandoverTaskExists;
        private Long existingHandoverTaskId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CrossDeptHandoffTaskResponse {
        private Long id;
        private String taskType;
        private Long sourceDepartmentId;
        private String sourceDepartmentName;
        private Long targetDepartmentId;
        private String targetDepartmentName;
        private Long employeeUserId;
        private String employeeName;
        private String employeeEmail;
        private Long lifecycleEmployeeId;
        private String referenceType;
        private Long referenceId;
        private String title;
        private String summary;
        private String metadataJson;
        private String priority;
        private String status;
        private LocalDate dueDate;
        private boolean overdue;
        private Long completedBy;
        private String completedByName;
        private LocalDateTime completedAt;
        private String resolutionNote;
        private LocalDateTime createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CrossDeptSlaSummaryResponse {
        private long totalTasks;
        private long openTasks;
        private long inProgressTasks;
        private long completedTasks;
        private long overdueTasks;
        private long techToHrCount;
        private long hrToTechCount;
        private double onTimeCompletionRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CompleteHandoffTaskRequest {
        private String status; // IN_PROGRESS | COMPLETED | CANCELLED
        private String resolutionNote;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TriggerOffboardingRequest {
        private String reason;
        private LocalDate lastWorkingDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TechHiringRequisitionDetailResponse {
        private Long requisitionId;
        private String title;
        private String capBac;
        private String hinhThucLamViec;
        private Integer soLuong;
        private String status;
        private String urgencyLevel;
        private String budget;
        private String reason;
        private String description;
        private String requiredTechSkillsJson;
        private Long techProjectId;
        private String techProjectCode;
        private String techProjectName;
        private String requesterName;
        private String approverName;
        private String rejectionReason;
        private LocalDateTime createdAt;
        private List<HiringSeatDetailItem> seats;
        private List<JobPostingSummaryItem> postings;
        private List<CandidateProgressItem> candidates;
        private List<HiringTimelineEventItem> timeline;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HiringSeatDetailItem {
        private Long seatId;
        private Integer seatNumber;
        private String kind;
        private String status;
        private Long applicationId;
        private String candidateName;
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JobPostingSummaryItem {
        private Long postingId;
        private String title;
        private String status;
        private Integer soLuongTuyen;
        private String mucLuong;
        private LocalDateTime ngayBatDau;
        private LocalDateTime hanNopHoSo;
        private int totalApplications;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CandidateProgressItem {
        private Long applicationId;
        private String fullName;
        private String email;
        private String approvalStatus;
        private Integer fitScore;
        private String postingTitle;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HiringTimelineEventItem {
        private String source; // TRANSITION | APPROVAL | POSTING | CANDIDATE
        private String action;
        private String title;
        private String detail;
        private String actorName;
        private String actorRole;
        private String statusBadge;
        private LocalDateTime occurredAt;
    }
}
