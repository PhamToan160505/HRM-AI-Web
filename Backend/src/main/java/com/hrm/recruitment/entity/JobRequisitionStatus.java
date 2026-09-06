package com.hrm.recruitment.entity;

public enum JobRequisitionStatus {
    PENDING_CEO,      // Chờ CEO duyệt
    APPROVED,         // Đã duyệt, chờ HR đăng bài
    REJECTED,         // Bị từ chối
    POSTED            // HR đã tạo JobPosting từ yêu cầu này
}
