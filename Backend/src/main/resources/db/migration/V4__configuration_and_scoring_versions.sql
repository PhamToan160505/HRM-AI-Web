-- Stage 2: versioned business configuration and immutable AI scoring profiles.

CREATE TABLE `system_configurations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `config_key` VARCHAR(160) NOT NULL,
    `config_value` TEXT NOT NULL,
    `value_type` ENUM('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON') NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    `updated_by` BIGINT NULL,
    `change_reason` VARCHAR(500) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_system_config_key_effective` UNIQUE (`config_key`, `effective_from`),
    CONSTRAINT `fk_system_config_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
    INDEX `idx_system_config_lookup` (`config_key`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `scoring_profiles` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `profile_code` VARCHAR(80) NOT NULL,
    `version_number` INT NOT NULL,
    `display_name` VARCHAR(180) NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'RETIRED') NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    `created_by` BIGINT NULL,
    `change_reason` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `activated_at` DATETIME(6) NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_scoring_profile_version` UNIQUE (`profile_code`, `version_number`),
    CONSTRAINT `fk_scoring_profile_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    INDEX `idx_scoring_profile_status` (`status`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `scoring_parameters` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `scoring_profile_id` BIGINT NOT NULL,
    `parameter_key` VARCHAR(180) NOT NULL,
    `parameter_value` TEXT NOT NULL,
    `value_type` ENUM('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON') NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_scoring_parameter` UNIQUE (`scoring_profile_id`, `parameter_key`),
    CONSTRAINT `fk_scoring_parameter_profile` FOREIGN KEY (`scoring_profile_id`) REFERENCES `scoring_profiles` (`id`),
    INDEX `idx_scoring_parameter_profile` (`scoring_profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `legal_parameters` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `parameter_key` VARCHAR(180) NOT NULL,
    `parameter_value` TEXT NOT NULL,
    `value_type` ENUM('STRING', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'JSON') NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    `source_reference` VARCHAR(1000) NOT NULL,
    `verified_by` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_legal_parameter_effective` UNIQUE (`parameter_key`, `effective_from`),
    INDEX `idx_legal_parameter_lookup` (`parameter_key`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `redaction_rules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `rule_key` VARCHAR(120) NOT NULL,
    `pattern_text` VARCHAR(1000) NOT NULL,
    `replacement_text` VARCHAR(255) NOT NULL,
    `priority` INT NOT NULL,
    `active` BIT(1) NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_redaction_rule_key` UNIQUE (`rule_key`),
    INDEX `idx_redaction_rule_active` (`active`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `injection_patterns` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `pattern_key` VARCHAR(120) NOT NULL,
    `pattern_text` VARCHAR(1000) NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    `active` BIT(1) NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_injection_pattern_key` UNIQUE (`pattern_key`),
    INDEX `idx_injection_pattern_active` (`active`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `common_phrases` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phrase_text` VARCHAR(500) NOT NULL,
    `normalized_phrase` VARCHAR(500) NOT NULL,
    `locale` VARCHAR(20) NOT NULL,
    `active` BIT(1) NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_common_phrase_locale` UNIQUE (`normalized_phrase`, `locale`),
    INDEX `idx_common_phrase_active` (`active`, `locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A criteria set is a versioned snapshot. posting_id is intentionally retained
-- as an audit identifier even if a posting is later deleted.
CREATE TABLE `screening_criteria_sets` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `posting_id` BIGINT NOT NULL,
    `version_number` INT NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'SUPERSEDED') NOT NULL,
    `criteria_snapshot` JSON NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `created_by` BIGINT NULL,
    `confirmed_by` BIGINT NULL,
    `change_reason` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `confirmed_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_criteria_set_version` UNIQUE (`posting_id`, `version_number`),
    CONSTRAINT `fk_criteria_set_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_criteria_set_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`),
    INDEX `idx_criteria_set_posting_status` (`posting_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `system_configurations`
    (`config_key`, `config_value`, `value_type`, `description`, `effective_from`, `updated_by`, `change_reason`)
VALUES
    ('seat.max_overbook_per_requisition', '1', 'INTEGER', 'Số offer dự phòng tối đa cho mỗi yêu cầu tuyển dụng', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2'),
    ('application.reopen_window_days', '30', 'INTEGER', 'Số ngày cho phép HR Head mở lại hồ sơ bị từ chối', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2'),
    ('upload.max_file_size_mb', '5', 'INTEGER', 'Dung lượng CV tối đa theo MB', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2'),
    ('upload.max_pages', '10', 'INTEGER', 'Số trang CV tối đa trước khi chuyển kiểm tra thủ công', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2'),
    ('ai.timeout_seconds', '45', 'INTEGER', 'Thời gian chờ tối đa cho một lần gọi AI', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2'),
    ('ai.max_retry', '2', 'INTEGER', 'Số lần gọi lại AI tối đa', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2'),
    ('ai.mode', 'ON', 'STRING', 'Chế độ AI toàn hệ thống: ON hoặc MANUAL_ONLY', '2026-01-01 00:00:00', NULL, 'Seed Chặng 2');

INSERT INTO `scoring_profiles`
    (`profile_code`, `version_number`, `display_name`, `status`, `effective_from`, `created_by`, `change_reason`, `activated_at`)
VALUES
    ('CV_EVIDENCE', 1, 'Chấm CV theo bằng chứng v1', 'ACTIVE', '2026-01-01 00:00:00', NULL,
     'Profile mặc định được seed ở Chặng 2', CURRENT_TIMESTAMP(6));

INSERT INTO `scoring_parameters`
    (`scoring_profile_id`, `parameter_key`, `parameter_value`, `value_type`, `description`)
SELECT p.id, seed.parameter_key, seed.parameter_value, seed.value_type, seed.description
FROM `scoring_profiles` p
JOIN (
    SELECT 'scoring.evidence_multiplier.listed_only' parameter_key, '0.25' parameter_value, 'DECIMAL' value_type, 'Hệ số khi kỹ năng chỉ được liệt kê' description
    UNION ALL SELECT 'scoring.evidence_multiplier.mentioned', '0.6', 'DECIMAL', 'Hệ số khi kỹ năng xuất hiện trong kinh nghiệm'
    UNION ALL SELECT 'scoring.evidence_multiplier.demonstrated', '1.0', 'DECIMAL', 'Hệ số khi CV có bằng chứng thực hành'
    UNION ALL SELECT 'scoring.evidence_grade.low_ratio', '0.4', 'DECIMAL', 'Tỷ lệ dưới mức này được xếp bằng chứng thấp'
    UNION ALL SELECT 'scoring.evidence_grade.high_ratio', '0.7', 'DECIMAL', 'Tỷ lệ từ mức này được xếp bằng chứng cao'
    UNION ALL SELECT 'scoring.evidence_grade.low_score_max', '30', 'INTEGER', 'Điểm trần tham chiếu cho mức bằng chứng thấp'
    UNION ALL SELECT 'scoring.evidence_grade.high_score_min', '50', 'INTEGER', 'Điểm sàn tham chiếu cho mức bằng chứng cao'
    UNION ALL SELECT 'scoring.ngram_n', '6', 'INTEGER', 'Kích thước n-gram dùng kiểm tra trùng JD'
    UNION ALL SELECT 'scoring.copy_span_threshold', '0.5', 'DECIMAL', 'Ngưỡng span bị xem là sao chép JD'
    UNION ALL SELECT 'scoring.mirroring_warn_threshold', '0.72', 'DECIMAL', 'Giá trị seed để demo, phải hiệu chỉnh bằng tập CV thật'
    UNION ALL SELECT 'scoring.confidence.unverified_citation_ratio_max', '0.2', 'DECIMAL', 'Tỷ lệ citation chưa xác minh tối đa'
    UNION ALL SELECT 'scoring.max_input_chars', '30000', 'INTEGER', 'Độ dài CV tối đa được đưa vào chấm tự động'
) seed
WHERE p.profile_code = 'CV_EVIDENCE' AND p.version_number = 1;

INSERT INTO `redaction_rules`
    (`rule_key`, `pattern_text`, `replacement_text`, `priority`, `active`, `effective_from`, `description`)
VALUES
    ('DATE_OF_BIRTH', '(?i)(ngày sinh|date of birth|dob)\\s*[:\\-].*', '[ĐÃ ẨN NGÀY SINH]', 10, b'1', '2026-01-01 00:00:00', 'Che ngày sinh và tuổi trước khi gửi AI'),
    ('GENDER', '(?i)(giới tính|gender|sex)\\s*[:\\-].*', '[ĐÃ ẨN GIỚI TÍNH]', 20, b'1', '2026-01-01 00:00:00', 'Che giới tính trước khi gửi AI'),
    ('MARITAL_STATUS', '(?i)(hôn nhân|marital status)\\s*[:\\-].*', '[ĐÃ ẨN HÔN NHÂN]', 30, b'1', '2026-01-01 00:00:00', 'Che tình trạng hôn nhân'),
    ('RELIGION', '(?i)(tôn giáo|religion)\\s*[:\\-].*', '[ĐÃ ẨN TÔN GIÁO]', 40, b'1', '2026-01-01 00:00:00', 'Che tôn giáo'),
    ('ETHNICITY', '(?i)(dân tộc|ethnicity)\\s*[:\\-].*', '[ĐÃ ẨN DÂN TỘC]', 50, b'1', '2026-01-01 00:00:00', 'Che dân tộc'),
    ('NATIONAL_ID', '(?i)(cccd|cmnd|national id)\\s*[:\\-].*', '[ĐÃ ẨN ĐỊNH DANH]', 60, b'1', '2026-01-01 00:00:00', 'Che số định danh'),
    ('DETAILED_ADDRESS', '(?i)(địa chỉ|address)\\s*[:\\-].*', '[ĐÃ ẨN ĐỊA CHỈ]', 70, b'1', '2026-01-01 00:00:00', 'Che địa chỉ chi tiết');

INSERT INTO `injection_patterns`
    (`pattern_key`, `pattern_text`, `severity`, `active`, `effective_from`, `description`)
VALUES
    ('IGNORE_INSTRUCTIONS', '(?i)ignore (all |the )?(previous|prior) instructions', 'HIGH', b'1', '2026-01-01 00:00:00', 'Yêu cầu bỏ qua chỉ dẫn hệ thống'),
    ('OVERRIDE_SCORE', '(?i)(give|assign|cho).{0,20}(100|maximum|max).{0,12}(score|points|điểm)', 'HIGH', b'1', '2026-01-01 00:00:00', 'Yêu cầu tự gán điểm tối đa'),
    ('SYSTEM_PROMPT', '(?i)(system prompt|developer message|chỉ dẫn hệ thống)', 'MEDIUM', b'1', '2026-01-01 00:00:00', 'Dò hỏi hoặc giả mạo chỉ dẫn hệ thống'),
    ('ROLE_OVERRIDE', '(?i)(you are now|act as|hãy đóng vai)', 'MEDIUM', b'1', '2026-01-01 00:00:00', 'Cố thay đổi vai trò của mô hình');

INSERT INTO `common_phrases`
    (`phrase_text`, `normalized_phrase`, `locale`, `active`, `effective_from`)
VALUES
    ('Có khả năng làm việc nhóm', 'co kha nang lam viec nhom', 'vi-VN', b'1', '2026-01-01 00:00:00'),
    ('Kỹ năng giao tiếp tốt', 'ky nang giao tiep tot', 'vi-VN', b'1', '2026-01-01 00:00:00'),
    ('Chịu được áp lực công việc', 'chiu duoc ap luc cong viec', 'vi-VN', b'1', '2026-01-01 00:00:00'),
    ('Tinh thần trách nhiệm cao', 'tinh than trach nhiem cao', 'vi-VN', b'1', '2026-01-01 00:00:00'),
    ('Team player', 'team player', 'en', b'1', '2026-01-01 00:00:00'),
    ('Excellent communication skills', 'excellent communication skills', 'en', b'1', '2026-01-01 00:00:00');

-- Preserve every legacy posting with a deterministic confirmed criteria snapshot.
INSERT INTO `screening_criteria_sets`
    (`posting_id`, `version_number`, `status`, `criteria_snapshot`, `content_hash`,
     `created_by`, `confirmed_by`, `change_reason`, `created_at`, `confirmed_at`)
SELECT jp.id,
       1,
       'CONFIRMED',
       JSON_OBJECT(
           'title', jp.title,
           'description', jp.description,
           'requirements', jp.requirements,
           'level', jp.cap_bac,
           'source', 'LEGACY_JD_SNAPSHOT'
       ),
       SHA2(CONCAT_WS('|', jp.title, jp.description, COALESCE(jp.requirements, ''), COALESCE(jp.cap_bac, '')), 256),
       NULL,
       NULL,
       'Backfill posting có trước Chặng 2',
       COALESCE(jp.created_at, CURRENT_TIMESTAMP(6)),
       CURRENT_TIMESTAMP(6)
FROM `job_postings` jp;

ALTER TABLE `job_postings`
    ADD COLUMN `criteria_version_id` BIGINT NULL,
    ADD COLUMN `scoring_profile_version_id` BIGINT NULL;

UPDATE `job_postings` jp
JOIN `screening_criteria_sets` criteria_set
  ON criteria_set.posting_id = jp.id AND criteria_set.version_number = 1
JOIN `scoring_profiles` profile
  ON profile.profile_code = 'CV_EVIDENCE' AND profile.version_number = 1
SET jp.criteria_version_id = criteria_set.id,
    jp.scoring_profile_version_id = profile.id;

ALTER TABLE `job_postings`
    ADD CONSTRAINT `fk_job_posting_criteria_version`
        FOREIGN KEY (`criteria_version_id`) REFERENCES `screening_criteria_sets` (`id`),
    ADD CONSTRAINT `fk_job_posting_scoring_profile_version`
        FOREIGN KEY (`scoring_profile_version_id`) REFERENCES `scoring_profiles` (`id`),
    ADD CONSTRAINT `chk_open_posting_has_scoring_versions`
        CHECK (`status` = 'DRAFT' OR (`criteria_version_id` IS NOT NULL AND `scoring_profile_version_id` IS NOT NULL)),
    ADD INDEX `idx_job_posting_scoring_pair` (`criteria_version_id`, `scoring_profile_version_id`);

CREATE TABLE `ai_analyses` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `criteria_version_id` BIGINT NOT NULL,
    `scoring_profile_version_id` BIGINT NOT NULL,
    `status` ENUM('RUNNING', 'COMPLETED', 'FAILED', 'NEEDS_MANUAL_REVIEW', 'SKIPPED_NO_CONSENT') NOT NULL,
    `claim_coverage` DECIMAL(5,2) NULL,
    `evidence_score` DECIMAL(5,2) NULL,
    `result_payload` LONGTEXT NULL,
    `model_name` VARCHAR(120) NOT NULL,
    `prompt_version` VARCHAR(80) NOT NULL,
    `input_hash` CHAR(64) NOT NULL,
    `error_message` VARCHAR(1000) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `completed_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_ai_analysis_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ai_analysis_criteria_version` FOREIGN KEY (`criteria_version_id`) REFERENCES `screening_criteria_sets` (`id`),
    CONSTRAINT `fk_ai_analysis_scoring_profile_version` FOREIGN KEY (`scoring_profile_version_id`) REFERENCES `scoring_profiles` (`id`),
    INDEX `idx_ai_analysis_comparable` (`criteria_version_id`, `scoring_profile_version_id`, `status`),
    INDEX `idx_ai_analysis_application_history` (`application_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Parameter rows are immutable. A changed value must be copied into a new
-- scoring profile version instead of being updated or deleted in place.
CREATE TRIGGER `trg_scoring_parameters_no_update`
BEFORE UPDATE ON `scoring_parameters`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scoring parameters are immutable; create a new profile version';

CREATE TRIGGER `trg_scoring_parameters_no_delete`
BEFORE DELETE ON `scoring_parameters`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scoring parameters are immutable; retire the profile instead';
