package com.hrm.techhr.entity;

public enum CrossDeptTaskType {
    TECH_PREBOARDING_SETUP,         // HR -> Tech: Chuẩn bị môi trường Git/Jira & Buddy cho kỹ sư sắp nhận việc
    PROBATION_OFFICIAL_CONTRACT,    // Tech -> HR: Đạt thử việc -> Lập Hợp đồng Chính thức
    PROBATION_TERMINATION_REVIEW,   // Tech -> HR: Không đạt thử việc -> Xử lý kết thúc thử việc
    CONTRACT_ADDENDUM_REQUIRED,     // Tech -> HR: Thăng chức danh / điều chỉnh C&B -> Lập Phụ lục Hợp đồng
    TECH_OFFBOARDING_HANDOVER       // HR -> Tech: Bàn giao dự án / Tech Lead / Mentor / Server trước khi nghỉ việc/chuyển phòng
}
