package com.hrm.request.dto;

import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class EmployeeRequestDto {
    private Long id;
    private Long userId;
    private String hoTen;
    private String maNhanVien;
    private String avatarUrl;
    private RequestType requestType;
    private String reason;
    private LocalDate startDate;
    private LocalDate endDate;
    private RequestStatus status;
    private String note;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
