package com.hrm.tech.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
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
public class FinalDecisionRequest {

    @NotBlank(message = "Vui lòng chọn quyết định: APPROVED hoặc REJECTED_FOR_REVISION")
    private String decision; // APPROVED | REJECTED_FOR_REVISION

    @Size(max = 500, message = "Lý do trả lại chỉnh sửa tối đa 500 ký tự")
    private String rejectionReason;

    @DecimalMin(value = "-5.0", message = "Điểm hiệu chỉnh tối thiểu -5.0")
    @DecimalMax(value = "5.0", message = "Điểm hiệu chỉnh tối đa +5.0")
    private Double calibrationDelta;

    @Size(max = 500, message = "Lý do hiệu chỉnh tối đa 500 ký tự")
    private String calibrationReason;

    // Chỉ áp dụng khi CEO duyệt đề xuất chức danh / lương
    private Boolean approveCompensation;

    @Size(max = 100, message = "Chức danh mới tối đa 100 ký tự")
    private String overrideTitle;

    @DecimalMin(value = "0.0", message = "Lương cơ bản mới không được âm")
    private Double newBaseSalary;

    @DecimalMin(value = "0.0", message = "Phụ cấp mới không được âm")
    private Double newAllowance;

    @Size(max = 500, message = "Ghi chú quyết định tối đa 500 ký tự")
    private String compensationNote;
}
