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
public class TechPerformancePageResponse {
    private List<TechPerformanceReviewResponse> content;
    private int number;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;
    private Long totalAllInScope;
    private Long pendingReviewCount;
    private Long directorPendingCount;
    private Long approvedCount;
}
