-- Phase 3: Project Milestones & Engineering Timesheet / Worklogs

-- 1. Mốc tiến độ & bàn giao dự án (Project Milestones)
CREATE TABLE IF NOT EXISTS `tech_project_milestones` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `project_id` BIGINT NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `due_date` DATE NOT NULL,
    `completed_at` DATETIME(6) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    `weight_percent` INT NOT NULL DEFAULT 0,
    `completion_percent` INT NOT NULL DEFAULT 0,
    `deliverable_url` VARCHAR(500) NULL,
    `created_by` BIGINT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `idx_milestone_project` (`project_id`),
    KEY `idx_milestone_due_status` (`due_date`, `status`),
    CONSTRAINT `fk_milestone_project` FOREIGN KEY (`project_id`) REFERENCES `tech_projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_milestone_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `chk_milestone_weight` CHECK (`weight_percent` >= 0 AND `weight_percent` <= 100),
    CONSTRAINT `chk_milestone_completion` CHECK (`completion_percent` >= 0 AND `completion_percent` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Nhật ký giờ công kỹ thuật theo dự án (Engineering Worklogs / Timesheet)
CREATE TABLE IF NOT EXISTS `tech_worklogs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `project_id` BIGINT NOT NULL,
    `milestone_id` BIGINT NULL,
    `user_id` BIGINT NOT NULL,
    `work_date` DATE NOT NULL,
    `hours_spent` DECIMAL(4,2) NOT NULL,
    `work_type` VARCHAR(30) NOT NULL DEFAULT 'DEVELOPMENT',
    `is_billable` BIT(1) NOT NULL DEFAULT b'1',
    `task_summary` VARCHAR(500) NOT NULL,
    `reference_url` VARCHAR(500) NULL,
    `approval_status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `approved_by` BIGINT NULL,
    `approved_at` DATETIME(6) NULL,
    `rejection_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    KEY `idx_worklog_project_date` (`project_id`, `work_date`),
    KEY `idx_worklog_user_date` (`user_id`, `work_date`),
    KEY `idx_worklog_status` (`approval_status`),
    CONSTRAINT `fk_worklog_project` FOREIGN KEY (`project_id`) REFERENCES `tech_projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_worklog_milestone` FOREIGN KEY (`milestone_id`) REFERENCES `tech_project_milestones` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_worklog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_worklog_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_worklog_hours` CHECK (`hours_spent` > 0 AND `hours_spent` <= 16.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

