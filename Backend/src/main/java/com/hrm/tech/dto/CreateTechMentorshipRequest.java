package com.hrm.tech.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechMentorshipRequest {
    @NotNull(message = "Mentor ID không được để trống")
    private Long mentorId;

    @NotNull(message = "Mentee ID không được để trống")
    private Long menteeId;

    private Long focusSkillId;

    @NotBlank(message = "Tiêu đề chương trình kèm cặp không được để trống")
    private String programTitle;

    @NotBlank(message = "Mục tiêu đào tạo không được để trống")
    private String targetGoal;

    @NotNull(message = "Ngày bắt đầu không được để trống")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    private LocalDate endDate;
}

