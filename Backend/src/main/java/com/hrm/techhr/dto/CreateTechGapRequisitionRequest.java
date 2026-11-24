package com.hrm.techhr.dto;

import com.hrm.common.entity.Role;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTechGapRequisitionRequest {

    private Long techProjectId; // Nullable nếu tuyển bổ sung chung cho phòng từ Skill Matcher / Bench

    @NotBlank(message = "Tiêu đề vị trí cần tuyển không được để trống")
    private String title;

    @Builder.Default
    private Role targetRole = Role.NHAN_VIEN;

    @NotNull(message = "Số lượng cần tuyển không được để trống")
    @Min(value = 1, message = "Số lượng tuyển tối thiểu là 1")
    private Integer soLuong;

    @NotBlank(message = "Cấp bậc chuyên môn không được để trống")
    private String capBac; // Fresher / Junior / Middle / Senior / Expert

    private String hinhThucLamViec; // Toàn thời gian / Hybrid / Remote
    private String budget;          // VD: 20.000.000 - 30.000.000 VNĐ
    private String urgencyLevel;    // NORMAL | HIGH | CRITICAL

    @NotBlank(message = "Lý do tuyển dụng không được để trống")
    private String reason;

    private String description;
    private String additionalRequirements;

    private List<RequiredTechSkillItem> requiredSkills;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RequiredTechSkillItem {
        private Long skillId;
        private String skillName;
        private String minLevel; // FRESHER | JUNIOR | MIDDLE | SENIOR | EXPERT
    }
}
