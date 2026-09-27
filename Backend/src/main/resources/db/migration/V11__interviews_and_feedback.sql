-- Structured interview rounds, participant feedback and round-2 salary negotiation.

CREATE TABLE `interviews` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `round_number` TINYINT NOT NULL,
    `attempt_number` INT NOT NULL,
    `status` ENUM('SCHEDULED','DONE','NO_SHOW','RESCHEDULED','CANCELLED') NOT NULL,
    `scheduled_start` DATETIME(6) NOT NULL,
    `scheduled_end` DATETIME(6) NOT NULL,
    `timezone` VARCHAR(60) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    `interview_mode` ENUM('ONLINE','ONSITE','HYBRID') NOT NULL,
    `location` VARCHAR(500) NULL,
    `meeting_url` VARCHAR(1000) NULL,
    `lead_user_id` BIGINT NOT NULL,
    `conclusion` TEXT NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `version` BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_interview_attempt` UNIQUE (`application_id`, `round_number`, `attempt_number`),
    CONSTRAINT `fk_interview_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_interview_lead` FOREIGN KEY (`lead_user_id`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_interview_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `chk_interview_round` CHECK (`round_number` IN (1, 2)),
    CONSTRAINT `chk_interview_time` CHECK (`scheduled_end` > `scheduled_start`),
    INDEX `idx_interview_application_status` (`application_id`, `round_number`, `status`),
    INDEX `idx_interview_schedule` (`scheduled_start`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `interview_participants` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `interview_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `participant_role` ENUM('LEAD','INTERVIEWER','HR') NOT NULL,
    `feedback_required` BIT(1) NOT NULL DEFAULT b'1',
    `invited_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_interview_participant` UNIQUE (`interview_id`, `user_id`),
    CONSTRAINT `fk_interview_participant_interview` FOREIGN KEY (`interview_id`) REFERENCES `interviews` (`id`),
    CONSTRAINT `fk_interview_participant_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
    INDEX `idx_interview_participant_user` (`user_id`, `interview_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `interview_feedbacks` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `interview_id` BIGINT NOT NULL,
    `interviewer_id` BIGINT NOT NULL,
    `criteria_scores` JSON NOT NULL,
    `overall_score` DECIMAL(5,2) NOT NULL,
    `recommendation` ENUM('PASS','FAIL','HOLD') NOT NULL,
    `comments` TEXT NOT NULL,
    `submitted_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_interview_feedback_author` UNIQUE (`interview_id`, `interviewer_id`),
    CONSTRAINT `fk_interview_feedback_interview` FOREIGN KEY (`interview_id`) REFERENCES `interviews` (`id`),
    CONSTRAINT `fk_interview_feedback_user` FOREIGN KEY (`interviewer_id`) REFERENCES `users` (`id`),
    CONSTRAINT `chk_interview_score` CHECK (`overall_score` >= 0 AND `overall_score` <= 100),
    INDEX `idx_interview_feedback_interview` (`interview_id`, `submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `salary_negotiations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `interview_id` BIGINT NOT NULL,
    `application_id` BIGINT NOT NULL,
    `current_salary` DECIMAL(19,2) NULL,
    `expected_salary` DECIMAL(19,2) NOT NULL,
    `preliminary_salary` DECIMAL(19,2) NOT NULL,
    `allowances` JSON NULL,
    `other_expectations` TEXT NULL,
    `notes` TEXT NOT NULL,
    `recorded_by` BIGINT NOT NULL,
    `recorded_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_salary_negotiation_interview` UNIQUE (`interview_id`),
    CONSTRAINT `fk_salary_negotiation_interview` FOREIGN KEY (`interview_id`) REFERENCES `interviews` (`id`),
    CONSTRAINT `fk_salary_negotiation_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_salary_negotiation_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`),
    CONSTRAINT `chk_salary_negotiation_positive` CHECK (
        (`current_salary` IS NULL OR `current_salary` > 0)
        AND `expected_salary` > 0 AND `preliminary_salary` > 0
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
