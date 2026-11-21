package com.hrm.tech.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProposeTechGraduationRequest {

    @NotBlank(message = "Vui lòng nhập nhận xét tổng kết & đánh giá quá trình kèm cặp của Mentor")
    @Size(max = 2000, message = "Nhận xét tổng kết không được vượt quá 2000 ký tự")
    private String mentorSummary;
}
