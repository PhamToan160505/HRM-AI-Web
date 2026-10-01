-- Offer-to-Contract - Giai đoạn 4: phụ lục, gia hạn, chấm dứt và chỉ số vòng đời.

ALTER TABLE `employment_contracts`
    MODIFY COLUMN `status` ENUM(
        'DRAFT','PENDING_LEGAL_REVIEW','LEGAL_CHANGES_REQUESTED','LEGAL_APPROVED','ISSUED',
        'SIGNED_UPLOADED','COMPANY_SIGNED','SENT_TO_CANDIDATE','CANDIDATE_VIEWED',
        'CANDIDATE_SIGNED','ACTIVE','TERMINATION_PENDING','TERMINATED','EXPIRED',
        'DECLINED','SIGNING_EXPIRED'
    ) NOT NULL;

CREATE TABLE `contract_amendments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `contract_id` BIGINT NOT NULL,
    `amendment_number` VARCHAR(80) NOT NULL,
    `amendment_type` ENUM('GENERAL','RENEWAL','SALARY','POSITION') NOT NULL,
    `version_number` INT NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','EFFECTIVE','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(255) NOT NULL,
    `reason` TEXT NOT NULL,
    `effective_date` DATE NOT NULL,
    `new_end_date` DATE NULL,
    `change_data_json` JSON NOT NULL,
    `created_by` BIGINT NOT NULL,
    `approved_by` BIGINT NULL,
    `approval_comment` TEXT NULL,
    `approved_at` DATETIME(6) NULL,
    `effective_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_amendment_number_version` (`amendment_number`, `version_number`),
    KEY `idx_contract_amendment_status` (`contract_id`, `status`, `effective_date`),
    CONSTRAINT `fk_amendment_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`),
    CONSTRAINT `fk_amendment_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_amendment_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `contract_terminations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `contract_id` BIGINT NOT NULL,
    `termination_type` ENUM('MUTUAL','RESIGNATION','DISMISSAL','EXPIRY','OTHER') NOT NULL,
    `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','EFFECTIVE','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `requested_date` DATE NOT NULL,
    `effective_date` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `settlement_notes` TEXT NULL,
    `created_by` BIGINT NOT NULL,
    `approved_by` BIGINT NULL,
    `approval_comment` TEXT NULL,
    `approved_at` DATETIME(6) NULL,
    `effective_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `idx_contract_termination_contract_status` (`contract_id`, `status`),
    KEY `idx_contract_termination_status` (`status`, `effective_date`),
    CONSTRAINT `fk_termination_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`),
    CONSTRAINT `fk_termination_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_termination_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
