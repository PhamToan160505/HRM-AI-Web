-- V24: Bổ sung cơ chế Mentor gửi nhận xét tổng kết & Đề xuất Tốt nghiệp để Trưởng phòng phê duyệt (Maker-Checker)
ALTER TABLE tech_mentorship_programs
    ADD COLUMN graduation_proposed BIT(1) NOT NULL DEFAULT b'0',
    ADD COLUMN mentor_summary TEXT NULL,
    ADD COLUMN graduation_proposed_at DATETIME(6) NULL;
