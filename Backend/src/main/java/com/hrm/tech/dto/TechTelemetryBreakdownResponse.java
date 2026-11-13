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
public class TechTelemetryBreakdownResponse {
    private Double deliveryScore;
    private Double impactScore;
    private Double capabilityScore;
    private Double disciplineScore;
    private Double telemetryTotalScore;

    // Pillar 1: Delivery
    private Integer workingDaysInPeriod;
    private Double standardPeriodHours;
    private Integer activeAllocationPercent;
    private Double expectedHours;
    private Double approvedHours;
    private Boolean isBench;
    private Double coverageScore;
    private String coverageLabel;
    private Integer totalApprovedWorklogs;
    private Integer cleanAuditWorklogs;
    private Double cleanAuditRatePercent;
    private Double auditScore;
    private Integer dueMilestonesCount;
    private Integer onTimeMilestonesCount;
    private Double milestoneScore;

    // Pillar 2: Impact
    private Double coreHours;
    private Double coreWorkRatioPercent;
    private Boolean isTechLead;
    private Boolean leadBonusApplied;
    private Double coreEngScore;
    private Boolean hasClientProjects;
    private Double clientApprovedHours;
    private Double clientBillableHours;
    private Double rdImpactHours;
    private Double valueEfficiencyScore;
    private String impactMethodLabel;

    // Pillar 3: Capability & Certificates
    private Integer totalSkillsCount;
    private Integer verifiedSkillsCount;
    private Double skillScore;
    private Integer validCertCount;
    private Integer expiringSoonCertCount;
    private Integer expiredCertCount;
    private Double certScore;
    private String certStatusLabel;

    // Pillar 4: Discipline
    private Integer lateCount;
    private Integer freeLateQuota;
    private Integer penalizedLateCount;
    private Integer unexcusedAbsentCount;
    private Integer excusedLeaveOrWfhDays;

    private List<String> projectHighlights;
}
