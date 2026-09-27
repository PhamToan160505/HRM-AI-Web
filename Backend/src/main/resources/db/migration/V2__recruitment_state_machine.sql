-- Recruitment state-machine foundation for HRM AI V2.2.
-- This migration deliberately preserves legacy business records and maps only
-- states whose meaning can be established without inventing candidate actions.

ALTER TABLE `applications`
    MODIFY COLUMN `approval_status` ENUM(
        'NEW',
        'OFFER_APPROVED',
        'PENDING_CEO_EVALUATION',
        'PENDING_HR_CV_REVIEW',
        'PENDING_HR_OFFER',
        'PENDING_INTERVIEW_1',
        'PENDING_INTERVIEW_2',
        'PENDING_OFFER_APPROVAL',
        'PENDING_TECH_CV_REVIEW',
        'REJECTED',
        'OFFER_INTERNALLY_APPROVED',
        'OFFER_SENT',
        'OFFER_ACCEPTED',
        'TALENT_POOL',
        'WITHDRAWN',
        'OFFER_DECLINED',
        'OFFER_EXPIRED',
        'OFFER_REVOKED'
    ) NOT NULL;

UPDATE `applications`
SET `approval_status` = 'PENDING_HR_CV_REVIEW'
WHERE `approval_status` = 'NEW';

UPDATE `applications`
SET `approval_status` = 'PENDING_INTERVIEW_2'
WHERE `approval_status` = 'PENDING_CEO_EVALUATION';

UPDATE `applications`
SET `approval_status` = 'OFFER_INTERNALLY_APPROVED'
WHERE `approval_status` = 'OFFER_APPROVED';

ALTER TABLE `applications`
    MODIFY COLUMN `approval_status` ENUM(
        'PENDING_HR_CV_REVIEW',
        'PENDING_TECH_CV_REVIEW',
        'PENDING_INTERVIEW_1',
        'PENDING_INTERVIEW_2',
        'PENDING_HR_OFFER',
        'PENDING_OFFER_APPROVAL',
        'OFFER_INTERNALLY_APPROVED',
        'OFFER_SENT',
        'OFFER_ACCEPTED',
        'REJECTED',
        'TALENT_POOL',
        'WITHDRAWN',
        'OFFER_DECLINED',
        'OFFER_EXPIRED',
        'OFFER_REVOKED'
    ) NOT NULL,
    ADD COLUMN `version` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN `first_viewed_at` DATETIME(6) NULL,
    ADD COLUMN `viewed_by` BIGINT NULL,
    ADD COLUMN `normalized_email` VARCHAR(255)
        GENERATED ALWAYS AS (LOWER(TRIM(`email`))) STORED,
    ADD COLUMN `normalized_phone` VARCHAR(30)
        GENERATED ALWAYS AS (REGEXP_REPLACE(`phone`, '[^0-9]', '')) STORED,
    ADD CONSTRAINT `uk_application_posting_email`
        UNIQUE (`job_posting_id`, `normalized_email`),
    ADD CONSTRAINT `uk_application_posting_phone`
        UNIQUE (`job_posting_id`, `normalized_phone`),
    ADD CONSTRAINT `fk_application_viewed_by`
        FOREIGN KEY (`viewed_by`) REFERENCES `users` (`id`);

ALTER TABLE `job_requisitions`
    MODIFY COLUMN `status` ENUM(
        'PENDING_CEO',
        'POSTED',
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REVISION_REQUIRED',
        'REJECTED',
        'CANCELLED',
        'FULFILLED'
    ) NOT NULL;

UPDATE `job_requisitions`
SET `status` = 'PENDING_APPROVAL'
WHERE `status` = 'PENDING_CEO';

UPDATE `job_requisitions`
SET `status` = 'APPROVED'
WHERE `status` = 'POSTED';

ALTER TABLE `job_requisitions`
    MODIFY COLUMN `status` ENUM(
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REVISION_REQUIRED',
        'REJECTED',
        'CANCELLED',
        'FULFILLED'
    ) NOT NULL,
    ADD COLUMN `version` BIGINT NOT NULL DEFAULT 0;

UPDATE `job_postings`
SET `status` = CASE
    WHEN `status` = 'CLOSED' AND `han_nop_ho_so` < CURRENT_TIMESTAMP(6) THEN 'EXPIRED'
    WHEN `status` = 'CLOSED' THEN 'PAUSED'
    ELSE `status`
END;

ALTER TABLE `job_postings`
    MODIFY COLUMN `status` ENUM(
        'DRAFT',
        'OPEN',
        'PAUSED',
        'FILLED',
        'EXPIRED',
        'CANCELLED'
    ) NOT NULL,
    ADD COLUMN `version` BIGINT NOT NULL DEFAULT 0;

CREATE TABLE `application_transition_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entity_type` ENUM('APPLICATION', 'JOB_REQUISITION', 'JOB_POSTING') NOT NULL,
    `entity_id` BIGINT NOT NULL,
    `actor_id` BIGINT NULL,
    `actor_role` VARCHAR(50) NULL,
    `action` VARCHAR(60) NOT NULL,
    `from_status` VARCHAR(50) NULL,
    `to_status` VARCHAR(50) NOT NULL,
    `comment` TEXT NULL,
    `request_id` VARCHAR(100) NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `occurred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_transition_idempotency_key` UNIQUE (`idempotency_key`),
    CONSTRAINT `fk_transition_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`),
    INDEX `idx_transition_entity_timeline` (`entity_type`, `entity_id`, `occurred_at`, `id`),
    INDEX `idx_transition_request_id` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
