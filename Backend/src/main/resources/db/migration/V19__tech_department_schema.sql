-- Phase 1: Tech Department - Projects and Resource Allocation Schema

CREATE TABLE `tech_projects` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `project_code` VARCHAR(50) NOT NULL,
    `project_name` VARCHAR(150) NOT NULL,
    `project_type` ENUM('INTERNAL', 'CLIENT') NOT NULL DEFAULT 'INTERNAL',
    `status` ENUM('PLANNING', 'IN_PROGRESS', 'MAINTENANCE', 'COMPLETED', 'PAUSED') NOT NULL DEFAULT 'PLANNING',
    `tech_stack` JSON NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `git_repo_url` VARCHAR(500) NULL,
    `jira_url` VARCHAR(500) NULL,
    `figma_url` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tech_project_code` (`project_code`),
    KEY `idx_tech_project_status` (`status`),
    CONSTRAINT `fk_tech_project_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tech_project_members` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `project_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    `project_role` ENUM('TECH_LEAD', 'BACKEND_DEV', 'FRONTEND_DEV', 'FULLSTACK_DEV', 'MOBILE_DEV', 'QA_TESTER', 'DEVOPS', 'UI_UX_DESIGNER') NOT NULL,
    `allocation_percent` INT NOT NULL DEFAULT 100,
    `joined_at` DATE NOT NULL,
    `left_at` DATE NULL,
    `is_active` BIT(1) NOT NULL DEFAULT b'1',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `idx_tech_member_project` (`project_id`),
    KEY `idx_tech_member_user` (`user_id`),
    KEY `idx_tech_member_active` (`is_active`),
    CONSTRAINT `fk_tech_member_project` FOREIGN KEY (`project_id`) REFERENCES `tech_projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_tech_member_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
    CONSTRAINT `chk_tech_member_allocation` CHECK (`allocation_percent` >= 0 AND `allocation_percent` <= 200)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

