CREATE TABLE `persons` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `status` ENUM('PROVISIONAL','VERIFIED','MERGED') NOT NULL DEFAULT 'PROVISIONAL',
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `created_from_application_id` BIGINT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_person_application` FOREIGN KEY (`created_from_application_id`) REFERENCES `applications` (`id`),
    INDEX `idx_person_email` (`email`),
    INDEX `idx_person_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `identity_reviews` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `new_person_id` BIGINT NOT NULL,
    `candidate_person_id` BIGINT NOT NULL,
    `matched_on` VARCHAR(20) NOT NULL,
    `status` ENUM('OPEN','LINKED','DISMISSED') NOT NULL DEFAULT 'OPEN',
    `decided_by` BIGINT NULL,
    `decided_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_identity_review_new_person` FOREIGN KEY (`new_person_id`) REFERENCES `persons` (`id`),
    CONSTRAINT `fk_identity_review_candidate_person` FOREIGN KEY (`candidate_person_id`) REFERENCES `persons` (`id`),
    CONSTRAINT `uk_identity_review_pair` UNIQUE (`new_person_id`, `candidate_person_id`, `matched_on`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employees` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `person_id` BIGINT NOT NULL,
    `application_id` BIGINT NOT NULL,
    `offer_id` BIGINT NOT NULL,
    `seat_id` BIGINT NOT NULL,
    `conversion_key` VARCHAR(120) NOT NULL,
    `employee_code` VARCHAR(20) NOT NULL,
    `status` ENUM('PRE_BOARDING','EMPLOYED','TERMINATED','ONBOARD_CANCELLED') NOT NULL,
    `start_date_planned` DATE NOT NULL,
    `join_date` DATE NULL,
    `probation_status` ENUM('NOT_APPLICABLE','PLANNED','IN_PROGRESS','PASSED','FAILED','CANCELLED') NOT NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_employee_person` FOREIGN KEY (`person_id`) REFERENCES `persons` (`id`),
    CONSTRAINT `fk_employee_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_employee_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`),
    CONSTRAINT `fk_employee_seat` FOREIGN KEY (`seat_id`) REFERENCES `hiring_seats` (`id`),
    CONSTRAINT `uk_employee_application` UNIQUE (`application_id`),
    CONSTRAINT `uk_employee_conversion` UNIQUE (`conversion_key`),
    CONSTRAINT `uk_employee_code` UNIQUE (`employee_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employment_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `employee_id` BIGINT NOT NULL,
    `department_id` BIGINT NULL,
    `position_title` VARCHAR(150) NOT NULL,
    `level_name` VARCHAR(100) NULL,
    `manager_id` BIGINT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `record_status` ENUM('SCHEDULED','CURRENT','ENDED','CANCELLED') NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_employment_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    CONSTRAINT `fk_employment_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`),
    INDEX `idx_employment_effective` (`employee_id`, `effective_from`, `effective_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `compensation_records` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `employee_id` BIGINT NOT NULL,
    `salary_type` ENUM('PROBATION','OFFICIAL') NOT NULL,
    `base_salary` DECIMAL(19,2) NOT NULL,
    `allowances_json` JSON NOT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `record_status` ENUM('SCHEDULED','CURRENT','ENDED','CANCELLED') NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_compensation_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    CONSTRAINT `uk_compensation_initial` UNIQUE (`employee_id`, `effective_from`),
    INDEX `idx_compensation_effective` (`employee_id`, `effective_from`, `effective_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `preboarding_checklists` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `employee_id` BIGINT NOT NULL,
    `status` ENUM('OPEN','COMPLETED','OVERRIDDEN','CANCELLED') NOT NULL DEFAULT 'OPEN',
    `override_reason` VARCHAR(1000) NULL,
    `overridden_by` BIGINT NULL,
    `completed_at` DATETIME(6) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_checklist_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    CONSTRAINT `uk_checklist_employee` UNIQUE (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `preboarding_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `checklist_id` BIGINT NOT NULL,
    `item_code` VARCHAR(60) NOT NULL,
    `label` VARCHAR(200) NOT NULL,
    `required_item` BIT(1) NOT NULL DEFAULT b'1',
    `status` ENUM('PENDING','COMPLETED','WAIVED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    `due_date` DATE NULL,
    `completed_by` BIGINT NULL,
    `completed_at` DATETIME(6) NULL,
    `exception_reason` VARCHAR(1000) NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_preboarding_item_checklist` FOREIGN KEY (`checklist_id`) REFERENCES `preboarding_checklists` (`id`),
    CONSTRAINT `uk_preboarding_item_code` UNIQUE (`checklist_id`, `item_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `lifecycle_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `subject_type` VARCHAR(40) NOT NULL,
    `subject_id` BIGINT NOT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `event_date` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `actor_id` BIGINT NULL,
    `ref_type` VARCHAR(40) NULL,
    `ref_id` BIGINT NULL,
    `summary` VARCHAR(1000) NOT NULL,
    `idempotency_key` VARCHAR(140) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_lifecycle_event_key` UNIQUE (`idempotency_key`),
    INDEX `idx_lifecycle_timeline` (`subject_type`, `subject_id`, `event_date`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inbox_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `event_id` VARCHAR(36) NOT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `schema_version` INT NOT NULL,
    `processed_at` DATETIME(6) NULL,
    `result_ref` VARCHAR(120) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_inbox_event_id` UNIQUE (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `account_creation_requests`
    MODIFY `status` ENUM('PENDING','APPROVED','REJECTED','PENDING_ADMIN','APPROVED_REQUEST','PROVISIONING','PROVISIONED','FAILED','CANCELLED') NOT NULL,
    ADD COLUMN `employee_id` BIGINT NULL AFTER `application_id`,
    ADD COLUMN `mode` ENUM('PREPARE_ONLY','ENSURE_ACTIVE') NOT NULL DEFAULT 'PREPARE_ONLY' AFTER `chuc_vu`,
    ADD COLUMN `user_id` BIGINT NULL AFTER `mode`,
    ADD COLUMN `approved_by` BIGINT NULL AFTER `status`,
    ADD COLUMN `approved_at` DATETIME(6) NULL AFTER `approved_by`,
    ADD COLUMN `last_error` VARCHAR(1000) NULL AFTER `approved_at`,
    ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0 AFTER `last_error`;

UPDATE `account_creation_requests` SET `status` = 'PENDING_ADMIN' WHERE `status` = 'PENDING';
UPDATE `account_creation_requests` SET `status` = 'PROVISIONED' WHERE `status` = 'APPROVED';
UPDATE `account_creation_requests` SET `status` = 'CANCELLED' WHERE `status` = 'REJECTED';

ALTER TABLE `account_creation_requests`
    MODIFY `status` ENUM('PENDING_ADMIN','APPROVED_REQUEST','PROVISIONING','PROVISIONED','FAILED','CANCELLED') NOT NULL,
    ADD CONSTRAINT `fk_account_request_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    ADD CONSTRAINT `fk_account_request_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
    ADD CONSTRAINT `uk_account_request_employee` UNIQUE (`employee_id`);

DELIMITER $$
CREATE TRIGGER `trg_lifecycle_event_no_update`
BEFORE UPDATE ON `lifecycle_events`
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'lifecycle_events is append-only';
END$$
CREATE TRIGGER `trg_lifecycle_event_no_delete`
BEFORE DELETE ON `lifecycle_events`
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'lifecycle_events is append-only';
END$$
DELIMITER ;
