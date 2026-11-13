package com.hrm.tech.dto;

import com.hrm.tech.entity.TechReviewType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechEvaluationCycleRequest {

    @NotBlank(message = "Mã kỳ đánh giá không được để trống")
    @Size(max = 40, message = "Mã kỳ đánh giá tối đa 40 ký tự")
    private String cycleCode;

    @NotBlank(message = "Tên kỳ đánh giá không được để trống")
    @Size(max = 180, message = "Tên kỳ đánh giá tối đa 180 ký tự")
    private String title;

    @NotNull(message = "Vui lòng chọn loại đánh giá")
    private TechReviewType reviewType;

    @NotNull(message = "Vui lòng chọn ngày bắt đầu kỳ đánh giá")
    private LocalDate periodStart;

    @NotNull(message = "Vui lòng chọn ngày kết thúc kỳ đánh giá")
    private LocalDate periodEnd;

    private LocalDate selfReviewDeadline;

    private Long departmentId;

    // Null/rỗng = tạo cho toàn bộ nhân sự Phòng Công nghệ; có giá trị = chỉ tạo cho nhóm được chọn
    private List<Long> targetEmployeeIds;

    // Tuỳ chọn bao gồm cả Trưởng phòng trong kỳ đánh giá để Giám đốc đánh giá
    @Builder.Default
    private Boolean includeManagers = true;
}
