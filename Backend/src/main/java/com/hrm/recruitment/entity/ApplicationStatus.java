package com.hrm.recruitment.entity;

public enum ApplicationStatus {
    NEW,                        // Vừa nộp, chờ AI chạy
    PENDING_HR_CV_REVIEW,       // AI duyệt xong, chờ HR đánh giá CV
    PENDING_TECH_CV_REVIEW,     // HR duyệt xong, chờ Trưởng phòng/GĐ đánh giá CV chuyên môn
    PENDING_INTERVIEW_1,        // Chờ phỏng vấn vòng 1
    PENDING_CEO_EVALUATION,     // (Chỉ dành cho Trưởng phòng) Chờ TGĐ đánh giá sau PV1
    PENDING_INTERVIEW_2,        // Chờ phỏng vấn vòng 2 (Đàm phán/Chốt)
    PENDING_HR_OFFER,           // Chờ HR lên Bảng Offer trình CEO
    PENDING_OFFER_APPROVAL,     // Chờ TGĐ duyệt Offer cuối cùng
    OFFER_APPROVED,             // Đã duyệt Offer (HIRED)
    REJECTED                    // Đã bị loại
}
