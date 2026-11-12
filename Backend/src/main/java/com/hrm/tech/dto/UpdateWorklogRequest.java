package com.hrm.tech.dto;

import com.hrm.tech.entity.WorklogType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateWorklogRequest {

    private Long milestoneId;

    @NotNull(message = "Vui lòng chọn ngày làm việc")
    private LocalDate workDate;

    @NotNull(message = "Vui lòng nhập số giờ thực hiện")
    private Double hoursSpent;

    private WorklogType workType;

    private Boolean isBillable;

    @NotBlank(message = "Vui lòng mô tả tóm tắt nội dung công việc")
    @Size(max = 500, message = "Mô tả công việc tối đa 500 ký tự")
    private String taskSummary;

    @Size(max = 500, message = "Liên kết tham chiếu tối đa 500 ký tự")
    private String referenceUrl;
}

