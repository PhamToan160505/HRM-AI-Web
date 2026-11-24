package com.hrm.techhr.event;

import java.time.LocalDate;

/**
 * Các sự kiện nội bộ (Spring Domain Events) liên kết giữa Phòng Công nghệ và Phòng Nhân sự,
 * tránh phụ thuộc vòng (circular dependency) giữa các module tech, lifecycle, recruitment và request.
 */
public final class TechHrDomainEvents {

    private TechHrDomainEvents() {}

    /** Module 3a: HR vừa tạo hồ sơ PRE_BOARDING cho nhân sự mới thuộc một phòng ban. */
    public record PreboardingCreatedEvent(
            Long lifecycleEmployeeId,
            Long checklistId,
            Long departmentId,
            String fullName,
            String email,
            String positionTitle,
            LocalDate expectedStartDate,
            Integer probationMonths
    ) {}

    /** Module 3b: HR vừa xác nhận nhân viên đã nhận việc (confirmJoined -> EMPLOYED). */
    public record EmployeeJoinedEvent(
            Long lifecycleEmployeeId,
            Long departmentId,
            String fullName,
            String email,
            LocalDate joinDate,
            String probationStatus,
            Long actorId
    ) {}

    /** Module 3c: Phòng Công nghệ vừa chốt phiếu Đánh giá Thử việc (PROBATION -> APPROVED). */
    public record ProbationReviewApprovedEvent(
            Long reviewId,
            Long employeeUserId,
            String employeeName,
            String employeeEmail,
            Long departmentId,
            Double finalScore,
            String finalGrade,
            boolean probationPassed,
            String summaryNote,
            Long actorId
    ) {}

    /** Module 4: Giám đốc Công nghệ / CEO duyệt Thăng chức danh và/hoặc Điều chỉnh C&B. */
    public record CareerCompensationApprovedEvent(
            Long reviewId,
            Long employeeUserId,
            String employeeName,
            String employeeEmail,
            Long departmentId,
            String periodLabel,
            boolean titleChanged,
            String oldTitle,
            String newTitle,
            boolean salaryChanged,
            Double oldBaseSalary,
            Double newBaseSalary,
            Double oldAllowance,
            Double newAllowance,
            String reason,
            Long actorId
    ) {}

    /** Module 5a: Đơn nghỉ phép dài ngày (>= 3 ngày) vừa được duyệt. */
    public record LongLeaveApprovedEvent(
            Long requestId,
            Long employeeUserId,
            String employeeName,
            Long departmentId,
            String requestType,
            LocalDate startDate,
            LocalDate endDate,
            long leaveDays,
            Long approverId
    ) {}
}
