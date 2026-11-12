package com.hrm.tech.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RejectWorklogRequest {

    @NotBlank(message = "Vui lòng nhập lý do từ chối nhật ký giờ công")
    @Size(max = 500, message = "Lý do từ chối tối đa 500 ký tự")
    private String rejectionReason;
}

