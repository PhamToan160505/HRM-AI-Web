package com.hrm.techhr.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectHiringStatusResponse {
    private Long projectId;
    private String projectCode;
    private String projectName;
    private int totalRequisitions;
    private int totalRequestedHeadcount;
    private int totalFilledSeats;
    private List<RequisitionSummaryItem> requisitions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RequisitionSummaryItem {
        private Long requisitionId;
        private String title;
        private String capBac;
        private Integer soLuong;
        private String status;
        private String urgencyLevel;
        private String requiredTechSkillsJson;
        private int openSeats;
        private int reservedSeats;
        private int acceptedSeats;
        private int joinedSeats;
        private int activeApplications;
        private LocalDateTime createdAt;
    }
}
