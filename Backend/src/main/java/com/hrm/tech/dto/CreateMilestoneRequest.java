package com.hrm.tech.dto;

import com.hrm.tech.entity.MilestoneStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateMilestoneRequest {

    @NotBlank(message = "Tên mốc tiến độ không được để trống")
    @Size(max = 200, message = "Tên mốc tối đa 200 ký tự")
    private String title;

    private String description;

    @NotNull(message = "Vui lòng chọn hạn chót hoàn thành mốc")
    private LocalDate dueDate;

    private MilestoneStatus status = MilestoneStatus.NOT_STARTED;

    @Min(value = 0, message = "Trọng số phải từ 0% đến 100%")
    @Max(value = 100, message = "Trọng số phải từ 0% đến 100%")
    private Integer weightPercent = 0;

    @Min(value = 0, message = "Tỷ lệ hoàn thành phải từ 0% đến 100%")
    @Max(value = 100, message = "Tỷ lệ hoàn thành phải từ 0% đến 100%")
    private Integer completionPercent = 0;

    @Size(max = 500, message = "Liên kết nghiệm thu tối đa 500 ký tự")
    private String deliverableUrl;
}

