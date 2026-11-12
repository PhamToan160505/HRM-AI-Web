package com.hrm.tech.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BatchApproveWorklogRequest {

    @NotEmpty(message = "Vui lòng chọn ít nhất một bản ghi giờ công cần duyệt")
    private List<Long> worklogIds;
}

