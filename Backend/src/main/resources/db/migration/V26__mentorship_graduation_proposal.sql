-- V26: Bổ sung cơ chế Mentor gửi nhận xét tổng kết & Đề xuất Tốt nghiệp để Trưởng phòng phê duyệt (Maker-Checker)
-- Idempotent DDL: an toàn cho cả DB mới lẫn DB dev đã tạo sẵn cột trước khi gộp nhánh main.

SET @add_graduation_proposed = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `tech_mentorship_programs` ADD COLUMN `graduation_proposed` BIT(1) NOT NULL DEFAULT b''0''',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tech_mentorship_programs'
      AND COLUMN_NAME = 'graduation_proposed'
);
PREPARE add_graduation_proposed_stmt FROM @add_graduation_proposed;
EXECUTE add_graduation_proposed_stmt;
DEALLOCATE PREPARE add_graduation_proposed_stmt;

SET @add_mentor_summary = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `tech_mentorship_programs` ADD COLUMN `mentor_summary` TEXT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tech_mentorship_programs'
      AND COLUMN_NAME = 'mentor_summary'
);
PREPARE add_mentor_summary_stmt FROM @add_mentor_summary;
EXECUTE add_mentor_summary_stmt;
DEALLOCATE PREPARE add_mentor_summary_stmt;

SET @add_graduation_proposed_at = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `tech_mentorship_programs` ADD COLUMN `graduation_proposed_at` DATETIME(6) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tech_mentorship_programs'
      AND COLUMN_NAME = 'graduation_proposed_at'
);
PREPARE add_graduation_proposed_at_stmt FROM @add_graduation_proposed_at;
EXECUTE add_graduation_proposed_at_stmt;
DEALLOCATE PREPARE add_graduation_proposed_at_stmt;
