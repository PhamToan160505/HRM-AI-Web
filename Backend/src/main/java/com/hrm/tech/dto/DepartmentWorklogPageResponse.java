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
public class DepartmentWorklogPageResponse {

    private List<TechWorklogResponse> content;
    private int number;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean first;
    private boolean last;

    private long monthTotalCount;
    private long monthPendingCount;
    private long warningCount;
    private long missingEvidenceCount;
    private long allocationOverloadCount;
    private long wfhOrOtCount;
    private long attendanceIssueCount;
}

