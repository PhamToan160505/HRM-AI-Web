-- AI CV Pipeline V1.2: consent, safe document metadata and separated model/computed outputs.

ALTER TABLE `job_postings`
    ADD COLUMN `criteria_definition` JSON NULL AFTER `scoring_profile_version_id`;

UPDATE `job_postings`
SET `criteria_definition` = JSON_ARRAY(JSON_OBJECT(
        'id', 'C1',
        'name', `title`,
        'type', 'MUST',
        'weight', 100,
        'synonyms', JSON_ARRAY(),
        'evidence_expected', COALESCE(`requirements`, `description`)
    ))
WHERE `criteria_definition` IS NULL;

ALTER TABLE `job_postings`
    MODIFY COLUMN `criteria_definition` JSON NOT NULL;

-- Existing criteria snapshots predate the structured criteria contract. Create a new,
-- auditable snapshot instead of mutating historical versions in place.
INSERT INTO `screening_criteria_sets`
    (`posting_id`, `version_number`, `status`, `criteria_snapshot`, `content_hash`,
     `created_by`, `confirmed_by`, `change_reason`, `created_at`, `confirmed_at`)
SELECT jp.id,
       COALESCE(version_state.max_version, 0) + 1,
       'CONFIRMED',
       JSON_OBJECT(
           'title', jp.title,
           'description', jp.description,
           'requirements', jp.requirements,
           'level', jp.cap_bac,
           'targetRole', jp.target_role,
           'criteria', jp.criteria_definition,
           'source', 'AI_CV_V1_2_MIGRATION'
       ),
       SHA2(CAST(JSON_OBJECT(
           'title', jp.title,
           'description', jp.description,
           'requirements', jp.requirements,
           'level', jp.cap_bac,
           'targetRole', jp.target_role,
           'criteria', jp.criteria_definition,
           'source', 'AI_CV_V1_2_MIGRATION'
       ) AS CHAR), 256),
       NULL, NULL, 'Backfill structured criteria for AI CV V1.2', NOW(6), NOW(6)
FROM `job_postings` jp
LEFT JOIN (
    SELECT posting_id, MAX(version_number) AS max_version
    FROM `screening_criteria_sets`
    GROUP BY posting_id
) version_state ON version_state.posting_id = jp.id;

UPDATE `job_postings` jp
JOIN `screening_criteria_sets` scs
  ON scs.posting_id = jp.id
 AND scs.change_reason = 'Backfill structured criteria for AI CV V1.2'
SET jp.criteria_version_id = scs.id;

CREATE TABLE `candidate_consents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `consent_type` ENUM('AI_CV_ANALYSIS') NOT NULL,
    `granted` BIT(1) NOT NULL,
    `terms_version` VARCHAR(80) NOT NULL,
    `purpose` VARCHAR(500) NOT NULL,
    `external_provider_disclosed` BIT(1) NOT NULL,
    `consented_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `withdrawn_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_candidate_consent_application_type` UNIQUE (`application_id`, `consent_type`),
    CONSTRAINT `fk_candidate_consent_application`
        FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
    INDEX `idx_candidate_consent_audit` (`terms_version`, `consented_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `application_documents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `document_type` ENUM('CV') NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `detected_type` ENUM('PDF','DOCX') NOT NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `page_count` INT NOT NULL,
    `storage_url` VARCHAR(1000) NULL,
    `extraction_method` ENUM('TEXT_LAYER','DOCX_XML','OCR','NOT_EXTRACTED') NOT NULL DEFAULT 'NOT_EXTRACTED',
    `extraction_quality` ENUM('OK','LOW','UNREADABLE','TOO_LONG') NOT NULL DEFAULT 'UNREADABLE',
    `extracted_char_count` INT NOT NULL DEFAULT 0,
    `hidden_text_removed_chars` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_application_document_type` UNIQUE (`application_id`, `document_type`),
    CONSTRAINT `fk_application_document_application`
        FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
    INDEX `idx_application_document_quality` (`extraction_quality`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `ai_analyses`
    MODIFY COLUMN `status` ENUM(
        'NOT_RUN','QUEUED','RUNNING','COMPLETED','DONE','FAILED',
        'NEEDS_MANUAL_REVIEW','SKIPPED_NO_CONSENT'
    ) NOT NULL,
    ADD COLUMN `model_output` LONGTEXT NULL AFTER `result_payload`,
    ADD COLUMN `computed_result` LONGTEXT NULL AFTER `model_output`,
    ADD COLUMN `started_at` DATETIME(6) NULL AFTER `created_at`,
    ADD COLUMN `duration_ms` BIGINT NULL AFTER `completed_at`;

UPDATE `ai_analyses`
SET `status` = 'DONE',
    `computed_result` = COALESCE(`computed_result`, `result_payload`)
WHERE `status` = 'COMPLETED';

ALTER TABLE `ai_analyses`
    MODIFY COLUMN `status` ENUM(
        'NOT_RUN','QUEUED','RUNNING','DONE','FAILED',
        'NEEDS_MANUAL_REVIEW','SKIPPED_NO_CONSENT'
    ) NOT NULL,
    ADD CONSTRAINT `chk_ai_done_has_result`
        CHECK (`status` <> 'DONE' OR `computed_result` IS NOT NULL);

INSERT INTO `system_configurations`
    (`config_key`, `config_value`, `value_type`, `description`, `effective_from`, `updated_by`, `change_reason`)
VALUES
    ('ai.consent_terms_version', 'AI-CV-1.0', 'STRING', 'Phiên bản nội dung đồng ý phân tích CV bằng AI', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.consent_purpose', 'AI hỗ trợ cấu trúc hóa CV và gợi ý bằng chứng; con người quyết định tuyển dụng', 'STRING', 'Mục đích xử lý CV bằng AI', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.external_provider_disclosure', 'CV được xử lý bởi nhà cung cấp AI bên ngoài; AI không tự động loại ứng viên', 'STRING', 'Thông báo nhà cung cấp AI bên ngoài', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.prompt_version', 'AI-CV-1.2', 'STRING', 'Phiên bản prompt chấm CV', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.extraction.min_chars', '80', 'INTEGER', 'Số ký tự tối thiểu để chấm tự động', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.hidden_text.min_font_size', '4', 'DECIMAL', 'Cỡ chữ PDF nhỏ hơn ngưỡng được xem là đáng ngờ', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.model.max_quotes_per_criterion', '5', 'INTEGER', 'Số trích dẫn tối đa cho mỗi tiêu chí', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.model.max_quote_chars', '700', 'INTEGER', 'Độ dài tối đa của một trích dẫn', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.max_verify_points', '5', 'INTEGER', 'Số điểm cần xác minh tối đa hiển thị cho HR', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2'),
    ('ai.negation_patterns', '["chưa từng","không có kinh nghiệm","chưa có","không biết","no experience","never worked","have not worked"]', 'JSON', 'Cụm phủ định dùng để hạ mức bằng chứng', '2026-01-01 00:00:00', NULL, 'Seed AI CV V1.2');

