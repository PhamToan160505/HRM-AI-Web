-- V27: Liên kết nghiệp vụ Phòng Công nghệ <-> Phòng Nhân sự (Cross-Department Bridge)
-- 1. Mở rộng job_requisitions gắn ngữ cảnh Dự án Công nghệ & Kỹ năng kỹ thuật chuẩn
-- 2. Mở rộng tech_performance_reviews lưu quyết định tường minh Đạt / Không đạt thử việc
-- 3. Tạo bảng điều phối tác vụ liên phòng ban cross_dept_handoff_tasks

SET @add_jr_proj = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `tech_project_id` BIGINT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'job_requisitions'
      AND COLUMN_NAME = 'tech_project_id'
);
PREPARE stmt_jr_proj FROM @add_jr_proj;
EXECUTE stmt_jr_proj;
DEALLOCATE PREPARE stmt_jr_proj;

SET @add_jr_skills = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `required_tech_skills_json` JSON NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'job_requisitions'
      AND COLUMN_NAME = 'required_tech_skills_json'
);
PREPARE stmt_jr_skills FROM @add_jr_skills;
EXECUTE stmt_jr_skills;
DEALLOCATE PREPARE stmt_jr_skills;

SET @add_jr_urgency = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `urgency_level` VARCHAR(20) NOT NULL DEFAULT ''NORMAL''',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'job_requisitions'
      AND COLUMN_NAME = 'urgency_level'
);
PREPARE stmt_jr_urgency FROM @add_jr_urgency;
EXECUTE stmt_jr_urgency;
DEALLOCATE PREPARE stmt_jr_urgency;

SET @add_prob_passed = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `tech_performance_reviews` ADD COLUMN `probation_passed` BIT(1) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'tech_performance_reviews'
      AND COLUMN_NAME = 'probation_passed'
);
PREPARE stmt_prob_passed FROM @add_prob_passed;
EXECUTE stmt_prob_passed;
DEALLOCATE PREPARE stmt_prob_passed;

CREATE TABLE IF NOT EXISTS cross_dept_handoff_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_type VARCHAR(60) NOT NULL,
    source_department_id BIGINT NULL,
    target_department_id BIGINT NULL,
    employee_user_id BIGINT NULL,
    lifecycle_employee_id BIGINT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NULL,
    metadata_json JSON NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    due_date DATE NULL,
    assigned_to BIGINT NULL,
    completed_by BIGINT NULL,
    completed_at DATETIME(6) NULL,
    resolution_note TEXT NULL,
    created_by BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    KEY idx_handoff_target_status (target_department_id, status),
    KEY idx_handoff_source_status (source_department_id, status),
    KEY idx_handoff_employee_user (employee_user_id),
    KEY idx_handoff_task_type (task_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
