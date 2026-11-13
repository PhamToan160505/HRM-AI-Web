package com.hrm.tech.dto;

import com.hrm.tech.entity.TechEvaluationCycleStatus;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTechEvaluationCycleRequest {

    @Size(max = 180, message = "Tên kỳ đánh giá tối đa 180 ký tự")
    private String title;

    private LocalDate periodEnd;

    private LocalDate selfReviewDeadline;

    private TechEvaluationCycleStatus status;
}

