package com.hrm.tech.dto;

import com.hrm.tech.entity.ProficiencyLevel;
import com.hrm.tech.entity.TechPromotionItemStatus;
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
public class ManagerEvaluateReviewRequest {

    @NotNull(message = "Vui lòng chấm điểm Thiết kế & Chất lượng mã nguồn (0 - 25đ)")
    @DecimalMin(value = "0.0", message = "Điểm tối thiểu là 0")
    @DecimalMax(value = "25.0", message = "Điểm tối đa tiêu chí này là 25")
    private Double qualCraftScore;

    @NotNull(message = "Vui lòng chấm điểm Làm chủ kỹ thuật & Xử lý sự cố (0 - 25đ)")
    @DecimalMin(value = "0.0", message = "Điểm tối thiểu là 0")
    @DecimalMax(value = "25.0", message = "Điểm tối đa tiêu chí này là 25")
    private Double qualOwnershipScore;

    @NotNull(message = "Vui lòng chấm điểm Hợp tác nhóm & Code Review (0 - 25đ)")
    @DecimalMin(value = "0.0", message = "Điểm tối thiểu là 0")
    @DecimalMax(value = "25.0", message = "Điểm tối đa tiêu chí này là 25")
    private Double qualCollabScore;

    @NotNull(message = "Vui lòng chấm điểm Giao tiếp tiến độ & Chủ động học hỏi (0 - 25đ)")
    @DecimalMin(value = "0.0", message = "Điểm tối thiểu là 0")
    @DecimalMax(value = "25.0", message = "Điểm tối đa tiêu chí này là 25")
    private Double qualGrowthScore;

    @DecimalMin(value = "-5.0", message = "Điểm hiệu chỉnh tối thiểu -5.0")
    @DecimalMax(value = "5.0", message = "Điểm hiệu chỉnh tối đa +5.0")
    private Double calibrationDelta;

    @Size(max = 500, message = "Lý do hiệu chỉnh tối đa 500 ký tự")
    private String calibrationReason;

    @NotBlank(message = "Vui lòng nhập nhận xét đánh giá của quản lý")
    private String managerComment;

    private String managerFeedbackGoals;

    @Valid
    private List<SkillDecisionInput> skillDecisions;

    @Builder.Default
    private Boolean recommendPromotion = false;

    @Size(max = 100, message = "Chức danh đề xuất tối đa 100 ký tự")
    private String recommendedTitle;

    @DecimalMin(value = "0.0", message = "Tỷ lệ tăng lương đề xuất không được âm")
    @DecimalMax(value = "100.0", message = "Tỷ lệ tăng lương đề xuất tối đa 100%")
    private Double recommendedSalaryIncreasePct;

    @Size(max = 500, message = "Lý do đề xuất đãi ngộ tối đa 500 ký tự")
    private String compensationReason;

    // Bắt buộc giải trình ngoại lệ nếu đề xuất tăng lương/chức danh khi finalScore < 75.0
    @Size(max = 500, message = "Giải trình ngoại lệ tối đa 500 ký tự")
    private String exceptionJustification;

    // B-10: Chỉ Giám đốc hoặc CEO mới được truyền lương đề xuất tham chiếu
    @DecimalMin(value = "0.0", message = "Lương cơ bản đề xuất không được âm")
    private Double recommendedNewBaseSalary;

    @DecimalMin(value = "0.0", message = "Phụ cấp đề xuất không được âm")
    private Double recommendedNewAllowance;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkillDecisionInput {
        private Long itemId;
        private Long skillId;
        private ProficiencyLevel targetLevel;
        private String evidenceNote;
        private String evidenceUrl;
        private TechPromotionItemStatus status;
        private String reviewerNote;
    }
}
