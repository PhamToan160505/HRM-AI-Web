package com.hrm.common.payroll.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Kỳ lương của một phòng ban trong một tháng, kèm các thao tác người dùng hiện tại được phép làm.
 * id = null nghĩa là phòng ban chưa chốt công tháng đó (status = OPEN).
 */
public record PayrollBatchView(
        Long id,
        Long departmentId,
        String departmentName,
        int month,
        int year,
        String status,
        Integer totalEmployees,
        Double totalGrossSalary,
        Double totalNetSalary,
        boolean hasDirector,
        String attendanceClosedByName,
        LocalDateTime attendanceClosedAt,
        String generatedByName,
        LocalDateTime generatedAt,
        String submittedByName,
        LocalDateTime submittedAt,
        String directorConfirmedByName,
        LocalDateTime directorConfirmedAt,
        String chiefReviewedByName,
        LocalDateTime chiefReviewedAt,
        String ceoApprovedByName,
        LocalDateTime ceoApprovedAt,
        String paidByName,
        LocalDateTime paidAt,
        String paymentReference,
        String rejectedStage,
        String rejectedByName,
        String rejectionReason,
        List<String> actions
) {
}
