package com.hrm.tech.dto;

import com.hrm.tech.entity.ProficiencyLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitSelfReviewRequest {

    @NotBlank(message = "Vui lòng tóm tắt kết quả công việc trong kỳ")
    private String selfSummary;

    private String selfAchievements;
    private String selfChallenges;
    private String selfGoalsNext;

    @DecimalMin(value = "0.0", message = "Điểm tự đánh giá tối thiểu 0")
    @DecimalMax(value = "100.0", message = "Điểm tự đánh giá tối đa 100")
    private Double selfRatingScore;

    @Valid
    @Size(max = 3, message = "Mỗi kỳ đánh giá chỉ được đề xuất nâng bậc tối đa 3 kỹ năng")
    private List<SkillPromotionProposalInput> skillPromotions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkillPromotionProposalInput {
        @NotNull(message = "Vui lòng chọn kỹ năng đề xuất nâng bậc")
        private Long skillId;

        @NotNull(message = "Vui lòng chọn cấp bậc mục tiêu")
        private ProficiencyLevel targetLevel;

        @NotBlank(message = "Vui lòng nhập minh chứng dự án / đóng góp cho kỹ năng này")
        @Size(max = 500, message = "Minh chứng không được vượt quá 500 ký tự")
        private String evidenceNote;

        @Size(max = 500, message = "Link minh chứng không được vượt quá 500 ký tự")
        private String evidenceUrl;
    }
}
