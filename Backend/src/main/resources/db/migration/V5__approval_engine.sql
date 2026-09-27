-- Stage 3: generic sequential approval engine.

CREATE TABLE `approval_policies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `policy_code` VARCHAR(100) NOT NULL,
    `version_number` INT NOT NULL,
    `entity_type` ENUM('JOB_REQUISITION', 'APPLICATION_TECH_REVIEW', 'OFFER') NOT NULL,
    `condition_json` JSON NOT NULL,
    `steps_template` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'RETIRED') NOT NULL,
    `effective_from` DATETIME(6) NOT NULL,
    `created_by` BIGINT NULL,
    `change_reason` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_approval_policy_version` UNIQUE (`policy_code`, `version_number`),
    CONSTRAINT `fk_approval_policy_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    INDEX `idx_approval_policy_resolver` (`entity_type`, `status`, `effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `approval_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entity_type` ENUM('JOB_REQUISITION', 'APPLICATION_TECH_REVIEW', 'OFFER') NOT NULL,
    `entity_id` BIGINT NOT NULL,
    `entity_version` BIGINT NOT NULL,
    `policy_id` BIGINT NOT NULL,
    `status` ENUM('OPEN', 'APPROVED', 'RETURNED', 'REJECTED', 'CANCELLED') NOT NULL,
    `requested_by` BIGINT NOT NULL,
    `submission_key` VARCHAR(120) NOT NULL,
    `cancel_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `completed_at` DATETIME(6) NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    `open_entity_key` VARCHAR(160)
        GENERATED ALWAYS AS (
            CASE WHEN `status` = 'OPEN'
                 THEN CONCAT(`entity_type`, ':', `entity_id`)
                 ELSE NULL END
        ) STORED,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_approval_request_submission` UNIQUE (`submission_key`),
    CONSTRAINT `uk_approval_request_open_entity` UNIQUE (`open_entity_key`),
    CONSTRAINT `fk_approval_request_policy` FOREIGN KEY (`policy_id`) REFERENCES `approval_policies` (`id`),
    CONSTRAINT `fk_approval_request_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`),
    INDEX `idx_approval_request_entity_history` (`entity_type`, `entity_id`, `created_at`),
    INDEX `idx_approval_request_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `approval_steps` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `request_id` BIGINT NOT NULL,
    `step_order` INT NOT NULL,
    `approver_role` VARCHAR(50) NOT NULL,
    `resolved_approver_id` BIGINT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'RETURNED', 'REJECTED', 'SKIPPED') NOT NULL,
    `decided_by` BIGINT NULL,
    `decided_at` DATETIME(6) NULL,
    `comment` TEXT NULL,
    `delegated_from` BIGINT NULL,
    `resolution_note` VARCHAR(500) NOT NULL,
    `decision_key` VARCHAR(120) NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_approval_step_order` UNIQUE (`request_id`, `step_order`),
    CONSTRAINT `uk_approval_step_decision_key` UNIQUE (`decision_key`),
    CONSTRAINT `fk_approval_step_request` FOREIGN KEY (`request_id`) REFERENCES `approval_requests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_approval_step_resolved_approver` FOREIGN KEY (`resolved_approver_id`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_approval_step_decided_by` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_approval_step_delegated_from` FOREIGN KEY (`delegated_from`) REFERENCES `users` (`id`),
    INDEX `idx_approval_step_inbox` (`resolved_approver_id`, `status`, `step_order`),
    INDEX `idx_approval_step_request_status` (`request_id`, `status`, `step_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `approval_policies`
    (`policy_code`, `version_number`, `entity_type`, `condition_json`, `steps_template`,
     `status`, `effective_from`, `created_by`, `change_reason`)
VALUES
    ('REQUISITION_DEFAULT', 1, 'JOB_REQUISITION', JSON_OBJECT(),
     JSON_ARRAY(JSON_OBJECT(
         'stepOrder', 1,
         'approvers', JSON_ARRAY(
             JSON_OBJECT('role', 'CEO', 'scope', 'GLOBAL'),
             JSON_OBJECT('role', 'ADMIN', 'scope', 'GLOBAL')
         )
     )),
     'ACTIVE', '2026-01-01 00:00:00', NULL, 'Seed approval policy Chặng 3'),
    ('TECH_CV_EMPLOYEE', 1, 'APPLICATION_TECH_REVIEW', JSON_OBJECT('targetRoles', JSON_ARRAY('NHAN_VIEN')),
     JSON_ARRAY(JSON_OBJECT(
         'stepOrder', 1,
         'approvers', JSON_ARRAY(
             JSON_OBJECT('role', 'TRUONG_PHONG', 'scope', 'ENTITY_DEPARTMENT'),
             JSON_OBJECT('role', 'GIAM_DOC_PHONG_BAN', 'scope', 'ENTITY_DEPARTMENT'),
             JSON_OBJECT('role', 'CEO', 'scope', 'GLOBAL'),
             JSON_OBJECT('role', 'ADMIN', 'scope', 'GLOBAL')
         )
     )),
     'ACTIVE', '2026-01-01 00:00:00', NULL, 'Seed approval policy Chặng 3'),
    ('TECH_CV_MANAGER', 1, 'APPLICATION_TECH_REVIEW', JSON_OBJECT('targetRoles', JSON_ARRAY('TRUONG_PHONG')),
     JSON_ARRAY(JSON_OBJECT(
         'stepOrder', 1,
         'approvers', JSON_ARRAY(
             JSON_OBJECT('role', 'GIAM_DOC_PHONG_BAN', 'scope', 'ENTITY_DEPARTMENT'),
             JSON_OBJECT('role', 'CEO', 'scope', 'GLOBAL'),
             JSON_OBJECT('role', 'ADMIN', 'scope', 'GLOBAL')
         )
     )),
     'ACTIVE', '2026-01-01 00:00:00', NULL, 'Seed approval policy Chặng 3'),
    ('TECH_CV_DIRECTOR', 1, 'APPLICATION_TECH_REVIEW', JSON_OBJECT('targetRoles', JSON_ARRAY('GIAM_DOC_PHONG_BAN')),
     JSON_ARRAY(JSON_OBJECT(
         'stepOrder', 1,
         'approvers', JSON_ARRAY(
             JSON_OBJECT('role', 'CEO', 'scope', 'GLOBAL'),
             JSON_OBJECT('role', 'ADMIN', 'scope', 'GLOBAL')
         )
     )),
     'ACTIVE', '2026-01-01 00:00:00', NULL, 'Seed approval policy Chặng 3'),
    ('OFFER_DEFAULT', 1, 'OFFER', JSON_OBJECT(),
     JSON_ARRAY(JSON_OBJECT(
         'stepOrder', 1,
         'approvers', JSON_ARRAY(
             JSON_OBJECT('role', 'CEO', 'scope', 'GLOBAL'),
             JSON_OBJECT('role', 'ADMIN', 'scope', 'GLOBAL')
         )
     )),
     'ACTIVE', '2026-01-01 00:00:00', NULL, 'Seed approval policy Chặng 3');

-- Backfill only currently pending requisitions. Historical approved/rejected
-- rows do not contain enough trustworthy step data, so their Stage 1 audit
-- baseline remains the source of truth instead of inventing an approver.
INSERT INTO `approval_requests`
    (`entity_type`, `entity_id`, `entity_version`, `policy_id`, `status`,
     `requested_by`, `submission_key`, `created_at`, `updated_at`)
SELECT 'JOB_REQUISITION',
       requisition.id,
       requisition.version,
       policy.id,
       'OPEN',
       requisition.requester_id,
       CONCAT('legacy-requisition-', requisition.id, '-v', requisition.version),
       COALESCE(requisition.created_at, CURRENT_TIMESTAMP(6)),
       CURRENT_TIMESTAMP(6)
FROM `job_requisitions` requisition
JOIN `approval_policies` policy
  ON policy.policy_code = 'REQUISITION_DEFAULT'
 AND policy.version_number = 1
WHERE requisition.status = 'PENDING_APPROVAL';

INSERT INTO `approval_steps`
    (`request_id`, `step_order`, `approver_role`, `resolved_approver_id`, `status`, `resolution_note`)
SELECT request.id,
       1,
       CASE WHEN ceo.id IS NOT NULL THEN 'CEO' ELSE 'ADMIN' END,
       COALESCE(ceo.id, admin_user.id),
       'PENDING',
       CASE WHEN ceo.id IS NOT NULL
            THEN 'Backfill: resolved active CEO'
            ELSE 'Backfill: escalated to active ADMIN' END
FROM `approval_requests` request
LEFT JOIN `users` ceo
  ON ceo.id = (
      SELECT MIN(candidate.id)
      FROM `users` candidate
      WHERE candidate.role = 'CEO'
        AND candidate.active = b'1'
        AND candidate.id <> request.requested_by
  )
LEFT JOIN `users` admin_user
  ON admin_user.id = (
      SELECT MIN(candidate.id)
      FROM `users` candidate
      WHERE candidate.role = 'ADMIN'
        AND candidate.active = b'1'
        AND candidate.id <> request.requested_by
  )
WHERE request.entity_type = 'JOB_REQUISITION'
  AND request.status = 'OPEN';

-- Approval policy templates are versioned configuration. Application code has
-- no update endpoint; replacing a policy creates a new version. Deletion is
-- blocked at the database layer so requests always retain their referenced policy.
CREATE TRIGGER `trg_approval_policy_no_delete`
BEFORE DELETE ON `approval_policies`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approval policies are immutable; retire by creating a replacement version';
