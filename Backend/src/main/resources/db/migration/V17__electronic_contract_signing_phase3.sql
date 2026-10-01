-- Offer-to-Contract - Giai đoạn 3: ký điện tử OTP, chứng cứ ký,
-- tài liệu bất biến và tách điều kiện tạo PRE_BOARDING khỏi OFFER_ACCEPTED.

ALTER TABLE `employment_contracts`
    MODIFY COLUMN `status` ENUM(
        'DRAFT','PENDING_LEGAL_REVIEW','LEGAL_CHANGES_REQUESTED','LEGAL_APPROVED','ISSUED',
        'SIGNED_UPLOADED','COMPANY_SIGNED','SENT_TO_CANDIDATE','CANDIDATE_VIEWED',
        'CANDIDATE_SIGNED','ACTIVE','DECLINED','SIGNING_EXPIRED'
    ) NOT NULL,
    ADD COLUMN `candidate_signed_at` DATETIME(6) NULL AFTER `signed_uploaded_at`,
    ADD COLUMN `candidate_signer_name` VARCHAR(200) NULL AFTER `candidate_signed_at`,
    ADD COLUMN `candidate_sign_method` VARCHAR(30) NULL AFTER `candidate_signer_name`,
    ADD COLUMN `final_file_url` VARCHAR(1000) NULL AFTER `candidate_sign_method`,
    ADD COLUMN `final_file_sha256` VARCHAR(64) NULL AFTER `final_file_url`,
    ADD COLUMN `activated_by` BIGINT NULL AFTER `final_file_sha256`,
    ADD COLUMN `activated_at` DATETIME(6) NULL AFTER `activated_by`,
    ADD CONSTRAINT `fk_contract_activated_by` FOREIGN KEY (`activated_by`) REFERENCES `users` (`id`);

-- Dữ liệu giai đoạn 2 chỉ chứng minh công ty đã upload một bản ký.
UPDATE `employment_contracts`
SET `status` = 'COMPANY_SIGNED'
WHERE `status` = 'SIGNED_UPLOADED';

CREATE TABLE `contract_artifacts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `contract_id` BIGINT NOT NULL,
    `artifact_type` ENUM('COMPANY_SIGNED','FULLY_SIGNED') NOT NULL,
    `version_number` INT NOT NULL DEFAULT 1,
    `file_url` VARCHAR(1000) NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `sha256` VARCHAR(64) NOT NULL,
    `file_bytes` MEDIUMBLOB NULL,
    `immutable_artifact` BIT(1) NOT NULL DEFAULT b'1',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_artifact_type_version` (`contract_id`, `artifact_type`, `version_number`),
    KEY `idx_contract_artifact_hash` (`sha256`),
    CONSTRAINT `fk_contract_artifact_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `contract_artifacts`
    (`contract_id`, `artifact_type`, `version_number`, `file_url`, `file_name`, `sha256`, `file_bytes`)
SELECT `id`, 'COMPANY_SIGNED', 1, `signed_file_url`, COALESCE(`signed_file_name`, 'company-signed.pdf'),
       `signed_file_sha256`, NULL
FROM `employment_contracts`
WHERE `status` = 'COMPANY_SIGNED' AND `signed_file_sha256` IS NOT NULL;

CREATE TABLE `contract_signing_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `contract_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `status` ENUM('ACTIVE','OTP_VERIFIED','SIGNED','DECLINED','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `expires_at` DATETIME(6) NOT NULL,
    `viewed_at` DATETIME(6) NULL,
    `otp_hash` VARCHAR(64) NULL,
    `otp_expires_at` DATETIME(6) NULL,
    `otp_attempts` INT NOT NULL DEFAULT 0,
    `last_otp_sent_at` DATETIME(6) NULL,
    `otp_verified_at` DATETIME(6) NULL,
    `verification_proof_hash` VARCHAR(64) NULL,
    `verification_expires_at` DATETIME(6) NULL,
    `signer_name` VARCHAR(200) NULL,
    `sign_method` VARCHAR(30) NULL,
    `signature_data_hash` VARCHAR(64) NULL,
    `consent_version` VARCHAR(30) NULL,
    `consent_text` TEXT NULL,
    `signed_at` DATETIME(6) NULL,
    `declined_at` DATETIME(6) NULL,
    `decline_reason` TEXT NULL,
    `ip_address` VARCHAR(100) NULL,
    `user_agent` VARCHAR(500) NULL,
    `provider` VARCHAR(40) NOT NULL DEFAULT 'INTERNAL_OTP',
    `provider_envelope_id` VARCHAR(200) NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_signing_token` (`token_hash`),
    KEY `idx_contract_signing_contract_status` (`contract_id`, `status`, `created_at`),
    CONSTRAINT `fk_contract_signing_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`),
    CONSTRAINT `fk_contract_signing_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `esign_webhook_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `provider` VARCHAR(40) NOT NULL,
    `provider_event_id` VARCHAR(200) NOT NULL,
    `payload_sha256` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `signature_valid` BIT(1) NOT NULL,
    `status` ENUM('RECEIVED','PROCESSED','REJECTED','FAILED') NOT NULL,
    `error_message` VARCHAR(1000) NULL,
    `received_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `processed_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_esign_provider_event` (`provider`, `provider_event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `employees`
    ADD COLUMN `contract_id` BIGINT NULL AFTER `offer_id`,
    ADD KEY `idx_employee_contract` (`contract_id`),
    ADD CONSTRAINT `fk_employee_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`);

