-- Stage 4: immutable offer versions, dispatch lifecycle, hiring seat ledger and outbox.

CREATE TABLE `offers` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `version_number` INT NOT NULL,
    `previous_offer_id` BIGINT NULL,
    `status` ENUM('DRAFT','PENDING_APPROVAL','APPROVED','SUPERSEDED','CANCELLED','ACCEPTED') NOT NULL,
    `base_salary` DECIMAL(19,2) NOT NULL,
    `allowances_json` JSON NOT NULL,
    `probation_months` INT NOT NULL,
    `probation_salary_rate` DECIMAL(5,2) NOT NULL,
    `expected_start_date` DATE NOT NULL,
    `contract_terms` TEXT NOT NULL,
    `file_url` VARCHAR(500) NULL,
    `salary_out_of_range` BIT(1) NOT NULL DEFAULT b'0',
    `out_of_range_reason` VARCHAR(1000) NULL,
    `created_by` BIGINT NOT NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_offer_application_version` UNIQUE (`application_id`, `version_number`),
    CONSTRAINT `fk_offer_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_offer_previous` FOREIGN KEY (`previous_offer_id`) REFERENCES `offers` (`id`),
    CONSTRAINT `fk_offer_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    INDEX `idx_offer_application_status` (`application_id`, `status`, `version_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `hiring_seats` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `requisition_id` BIGINT NOT NULL,
    `seat_number` INT NOT NULL,
    `kind` ENUM('STANDARD','OVERBOOK') NOT NULL,
    `status` ENUM('AVAILABLE','RESERVED','ACCEPTED','JOINED','CLOSED') NOT NULL,
    `application_id` BIGINT NULL,
    `offer_id` BIGINT NULL,
    `overbook_confirmed_by` BIGINT NULL,
    `overbook_confirmed_at` DATETIME(6) NULL,
    `overbook_reason` VARCHAR(1000) NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `active_application_key` BIGINT GENERATED ALWAYS AS (
        CASE WHEN `status` IN ('RESERVED','ACCEPTED','JOINED') THEN `application_id` ELSE NULL END
    ) STORED,
    `active_offer_key` BIGINT GENERATED ALWAYS AS (
        CASE WHEN `status` IN ('RESERVED','ACCEPTED','JOINED') THEN `offer_id` ELSE NULL END
    ) STORED,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_hiring_seat_number` UNIQUE (`requisition_id`, `seat_number`),
    CONSTRAINT `uk_hiring_seat_active_application` UNIQUE (`active_application_key`),
    CONSTRAINT `uk_hiring_seat_active_offer` UNIQUE (`active_offer_key`),
    CONSTRAINT `fk_hiring_seat_requisition` FOREIGN KEY (`requisition_id`) REFERENCES `job_requisitions` (`id`),
    CONSTRAINT `fk_hiring_seat_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_hiring_seat_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`),
    CONSTRAINT `fk_hiring_seat_overbook_actor` FOREIGN KEY (`overbook_confirmed_by`) REFERENCES `users` (`id`),
    INDEX `idx_hiring_seat_allocate` (`requisition_id`, `kind`, `status`, `id`),
    INDEX `idx_hiring_seat_offer` (`offer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `offer_dispatches` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `offer_id` BIGINT NOT NULL,
    `seat_id` BIGINT NOT NULL,
    `status` ENUM('ACTIVE','ACCEPTED','DECLINED','NEGOTIATION_CLOSED','SUPERSEDED','EXPIRED','REVOKED') NOT NULL,
    `dispatch_key` VARCHAR(140) NOT NULL,
    `response_token_hash` CHAR(64) NOT NULL,
    `response_deadline` DATETIME(6) NOT NULL,
    `sent_by` BIGINT NOT NULL,
    `sent_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `responded_at` DATETIME(6) NULL,
    `candidate_comment` TEXT NULL,
    `supersedes_dispatch_id` BIGINT NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    `active_offer_key` BIGINT GENERATED ALWAYS AS (
        CASE WHEN `status` = 'ACTIVE' THEN `offer_id` ELSE NULL END
    ) STORED,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_offer_dispatch_key` UNIQUE (`dispatch_key`),
    CONSTRAINT `uk_offer_dispatch_token_hash` UNIQUE (`response_token_hash`),
    CONSTRAINT `uk_offer_dispatch_active_offer` UNIQUE (`active_offer_key`),
    CONSTRAINT `fk_offer_dispatch_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`),
    CONSTRAINT `fk_offer_dispatch_seat` FOREIGN KEY (`seat_id`) REFERENCES `hiring_seats` (`id`),
    CONSTRAINT `fk_offer_dispatch_sender` FOREIGN KEY (`sent_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_offer_dispatch_supersedes` FOREIGN KEY (`supersedes_dispatch_id`) REFERENCES `offer_dispatches` (`id`),
    INDEX `idx_offer_dispatch_expiry` (`status`, `response_deadline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `seat_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `seat_id` BIGINT NOT NULL,
    `event_type` VARCHAR(60) NOT NULL,
    `from_status` VARCHAR(20) NULL,
    `to_status` VARCHAR(20) NOT NULL,
    `application_id` BIGINT NULL,
    `offer_id` BIGINT NULL,
    `actor_id` BIGINT NULL,
    `reason` VARCHAR(1000) NULL,
    `idempotency_key` VARCHAR(140) NOT NULL,
    `occurred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_seat_event_idempotency` UNIQUE (`idempotency_key`),
    CONSTRAINT `fk_seat_event_seat` FOREIGN KEY (`seat_id`) REFERENCES `hiring_seats` (`id`),
    CONSTRAINT `fk_seat_event_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_seat_event_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`),
    CONSTRAINT `fk_seat_event_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`),
    INDEX `idx_seat_event_timeline` (`seat_id`, `occurred_at`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `outbox_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `event_id` CHAR(36) NOT NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `schema_version` INT NOT NULL,
    `correlation_id` VARCHAR(100) NOT NULL,
    `producer` VARCHAR(60) NOT NULL,
    `aggregate_type` VARCHAR(60) NOT NULL,
    `aggregate_id` VARCHAR(100) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING','PUBLISHED','FAILED') NOT NULL DEFAULT 'PENDING',
    `attempt_count` INT NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `published_at` DATETIME(6) NULL,
    `last_error` VARCHAR(1000) NULL,
    `occurred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_outbox_event_id` UNIQUE (`event_id`),
    INDEX `idx_outbox_delivery` (`status`, `next_attempt_at`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `recruitment_tasks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `task_type` ENUM('OVERBOOK_RESOLUTION_REQUIRED','REOPEN_REVIEW_REQUIRED') NOT NULL,
    `requisition_id` BIGINT NOT NULL,
    `application_id` BIGINT NULL,
    `seat_id` BIGINT NULL,
    `status` ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
    `details` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `resolved_at` DATETIME(6) NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_recruitment_task_requisition` FOREIGN KEY (`requisition_id`) REFERENCES `job_requisitions` (`id`),
    CONSTRAINT `fk_recruitment_task_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_recruitment_task_seat` FOREIGN KEY (`seat_id`) REFERENCES `hiring_seats` (`id`),
    INDEX `idx_recruitment_task_open` (`status`, `task_type`, `requisition_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Existing approved requisitions receive their STANDARD seats. This backfill does
-- not invent offer/acceptance history for legacy applications.
INSERT INTO `hiring_seats` (`requisition_id`, `seat_number`, `kind`, `status`)
SELECT requisition.id,
       digits.n + 1,
       'STANDARD',
       'AVAILABLE'
FROM `job_requisitions` requisition
JOIN (
    SELECT ones.n + tens.n * 10 + hundreds.n * 100 AS n
    FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
          UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) ones
    CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) tens
    CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) hundreds
) digits ON digits.n < requisition.so_luong
WHERE requisition.status IN ('APPROVED','FULFILLED');

INSERT INTO `seat_events`
    (`seat_id`, `event_type`, `from_status`, `to_status`, `reason`, `idempotency_key`, `occurred_at`)
SELECT seat.id, 'CREATED', NULL, 'AVAILABLE', 'Backfill Chặng 4 cho requisition đã duyệt',
       CONCAT('seat-backfill-', seat.id), seat.created_at
FROM `hiring_seats` seat;

DELIMITER $$

CREATE TRIGGER `trg_offer_terms_immutable`
BEFORE UPDATE ON `offers`
FOR EACH ROW
BEGIN
    IF OLD.status IN ('APPROVED','SUPERSEDED','ACCEPTED') AND (
        NOT (OLD.base_salary <=> NEW.base_salary)
        OR NOT (OLD.allowances_json <=> NEW.allowances_json)
        OR NOT (OLD.probation_months <=> NEW.probation_months)
        OR NOT (OLD.probation_salary_rate <=> NEW.probation_salary_rate)
        OR NOT (OLD.expected_start_date <=> NEW.expected_start_date)
        OR NOT (OLD.contract_terms <=> NEW.contract_terms)
        OR NOT (OLD.file_url <=> NEW.file_url)
        OR NOT (OLD.salary_out_of_range <=> NEW.salary_out_of_range)
        OR NOT (OLD.out_of_range_reason <=> NEW.out_of_range_reason)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approved offer terms are immutable; create a new version';
    END IF;
END$$

DELIMITER ;

CREATE TRIGGER `trg_seat_event_no_update`
BEFORE UPDATE ON `seat_events`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seat events are append-only';

CREATE TRIGGER `trg_seat_event_no_delete`
BEFORE DELETE ON `seat_events`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Seat events are append-only';
