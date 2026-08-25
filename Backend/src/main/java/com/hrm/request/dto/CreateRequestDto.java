package com.hrm.request.dto;

import com.hrm.request.entity.RequestType;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateRequestDto {
    private RequestType requestType;
    private String reason;
    private LocalDate startDate;
    private LocalDate endDate;
}
