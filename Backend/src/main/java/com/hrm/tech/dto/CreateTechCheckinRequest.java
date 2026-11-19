package com.hrm.tech.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
public class CreateTechCheckinRequest {
    @NotNull(message = "Ngày check-in không được để trống")
    private LocalDate checkinDate;

    @NotBlank(message = "Nội dung trao đổi / kiến thức ôn tập không được để trống")
    private String topicsCovered;

    @NotNull(message = "Đánh giá tiến độ không được để trống (1-5 sao)")
    @Min(value = 1, message = "Điểm đánh giá tối thiểu là 1")
    @Max(value = 5, message = "Điểm đánh giá tối đa là 5")
    @Builder.Default
    private Integer progressRating = 3;

    private String mentorFeedback;
    private String menteeNotes;
}

