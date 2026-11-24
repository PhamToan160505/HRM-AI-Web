-- V29: Nâng cấp luồng duyệt JobRequisition 3 cấp & Liên kết Phòng Công nghệ <-> Phòng Tài chính - Kế toán
-- 1. Mở rộng approval_steps (step_scope, step_label) & nâng cấp policy REQUISITION_DEFAULT v2 (3 cấp tuần tự)
-- 2. Mở rộng job_requisitions (thẩm định ngân sách Tài chính) & tech_projects (ngân sách dự án)
-- 3. Tạo 3 bảng nghiệp vụ liên kết Tech <-> Finance:
--    - tech_project_cost_reports (Module F2: Hạch toán & đối soát giờ công/chi phí dự án theo tháng)
--    - tech_compensation_syncs   (Module F3: Đồng bộ tăng lương/phụ cấp theo kỳ hiệu lực, tôn trọng PayrollPeriodLock)
--    - tech_cert_reimbursements  (Module F4: Tài trợ / hoàn ứng lệ phí Chứng chỉ Quốc tế)

-- ─── 1. APPROVAL STEPS & 3-LEVEL REQUISITION POLICY ───────────────────────────
SET @add_as_scope = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `approval_steps` ADD COLUMN `step_scope` VARCHAR(40) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approval_steps' AND COLUMN_NAME = 'step_scope'
);
PREPARE stmt_as_scope FROM @add_as_scope;
EXECUTE stmt_as_scope;
DEALLOCATE PREPARE stmt_as_scope;

SET @add_as_label = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `approval_steps` ADD COLUMN `step_label` VARCHAR(150) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'approval_steps' AND COLUMN_NAME = 'step_label'
);
PREPARE stmt_as_label FROM @add_as_label;
EXECUTE stmt_as_label;
DEALLOCATE PREPARE stmt_as_label;

UPDATE `approval_policies`
SET `status` = 'RETIRED'
WHERE `policy_code` = 'REQUISITION_DEFAULT' AND `version_number` = 1;

INSERT INTO `approval_policies`
    (`policy_code`, `version_number`, `entity_type`, `condition_json`, `steps_template`,
     `status`, `effective_from`, `created_by`, `change_reason`)
SELECT
    'REQUISITION_DEFAULT',
    2,
    'JOB_REQUISITION',
    JSON_OBJECT(),
    JSON_ARRAY(
        JSON_OBJECT(
            'stepOrder', 1,
            'stepScope', 'ENTITY_DEPARTMENT',
            'stepLabel', 'Giám đốc Phòng ban duyệt chuyên môn & Bench',
            'optionalIfMissing', true,
            'approvers', JSON_ARRAY(
                JSON_OBJECT('role', 'GIAM_DOC_PHONG_BAN', 'scope', 'ENTITY_DEPARTMENT')
            )
        ),
        JSON_OBJECT(
            'stepOrder', 2,
            'stepScope', 'FINANCE_DEPARTMENT',
            'stepLabel', 'Phòng Tài chính - Kế toán thẩm định ngân sách',
            'optionalIfMissing', true,
            'approvers', JSON_ARRAY(
                JSON_OBJECT('role', 'TRUONG_PHONG', 'scope', 'FINANCE_DEPARTMENT'),
                JSON_OBJECT('role', 'GIAM_DOC_PHONG_BAN', 'scope', 'FINANCE_DEPARTMENT')
            )
        ),
        JSON_OBJECT(
            'stepOrder', 3,
            'stepScope', 'GLOBAL',
            'stepLabel', 'Tổng Giám đốc phê duyệt cuối',
            'optionalIfMissing', false,
            'approvers', JSON_ARRAY(
                JSON_OBJECT('role', 'CEO', 'scope', 'GLOBAL'),
                JSON_OBJECT('role', 'ADMIN', 'scope', 'GLOBAL')
            )
        )
    ),
    'ACTIVE',
    '2026-01-01 00:00:00',
    NULL,
    'Nâng cấp luồng duyệt Yêu cầu Tuyển dụng tuần tự 3 cấp (GĐ Phòng ban -> Tài chính - Kế toán -> CEO)'
WHERE NOT EXISTS (
    SELECT 1 FROM `approval_policies`
    WHERE `policy_code` = 'REQUISITION_DEFAULT' AND `version_number` = 2
);

-- ─── 2. EXTEND JOB_REQUISITIONS & TECH_PROJECTS ───────────────────────────────
SET @add_jr_annual = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `estimated_annual_cost` DECIMAL(15,2) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_requisitions' AND COLUMN_NAME = 'estimated_annual_cost'
);
PREPARE stmt_jr_annual FROM @add_jr_annual;
EXECUTE stmt_jr_annual;
DEALLOCATE PREPARE stmt_jr_annual;

SET @add_jr_fin_note = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `finance_budget_note` TEXT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_requisitions' AND COLUMN_NAME = 'finance_budget_note'
);
PREPARE stmt_jr_fin_note FROM @add_jr_fin_note;
EXECUTE stmt_jr_fin_note;
DEALLOCATE PREPARE stmt_jr_fin_note;

SET @add_jr_fin_by = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `finance_reviewed_by` BIGINT NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_requisitions' AND COLUMN_NAME = 'finance_reviewed_by'
);
PREPARE stmt_jr_fin_by FROM @add_jr_fin_by;
EXECUTE stmt_jr_fin_by;
DEALLOCATE PREPARE stmt_jr_fin_by;

SET @add_jr_fin_at = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `job_requisitions` ADD COLUMN `finance_reviewed_at` DATETIME(6) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_requisitions' AND COLUMN_NAME = 'finance_reviewed_at'
);
PREPARE stmt_jr_fin_at FROM @add_jr_fin_at;
EXECUTE stmt_jr_fin_at;
DEALLOCATE PREPARE stmt_jr_fin_at;

SET @add_tp_budget = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `tech_projects` ADD COLUMN `budget_amount` DECIMAL(15,2) NULL',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tech_projects' AND COLUMN_NAME = 'budget_amount'
);
PREPARE stmt_tp_budget FROM @add_tp_budget;
EXECUTE stmt_tp_budget;
DEALLOCATE PREPARE stmt_tp_budget;

-- ─── 3. MODULE F2: TECH PROJECT COST REPORTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `tech_project_cost_reports` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `report_month` VARCHAR(7) NOT NULL,
    `department_id` BIGINT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    `total_approved_hours` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_billable_hours` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_internal_hours` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_man_days` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total_labor_cost` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `pending_worklogs_at_submit` INT NOT NULL DEFAULT 0,
    `project_breakdown_json` JSON NULL,
    `engineer_breakdown_json` JSON NULL,
    `submitted_by` BIGINT NOT NULL,
    `submitted_at` DATETIME(6) NOT NULL,
    `submit_note` TEXT NULL,
    `reviewed_by` BIGINT NULL,
    `reviewed_at` DATETIME(6) NULL,
    `accounting_voucher_no` VARCHAR(100) NULL,
    `finance_note` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_tech_cost_month_dept` UNIQUE (`report_month`, `department_id`),
    INDEX `idx_tech_cost_status` (`status`, `report_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 4. MODULE F3: TECH COMPENSATION SYNCS (RESPECTING PAYROLL PERIOD LOCK) ───
CREATE TABLE IF NOT EXISTS `tech_compensation_syncs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `review_id` BIGINT NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `department_id` BIGINT NOT NULL,
    `old_title` VARCHAR(150) NULL,
    `new_title` VARCHAR(150) NULL,
    `old_base_salary` DECIMAL(15,2) NULL,
    `new_base_salary` DECIMAL(15,2) NULL,
    `old_allowance` DECIMAL(15,2) NULL,
    `new_allowance` DECIMAL(15,2) NULL,
    `effective_month` VARCHAR(7) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING_FINANCE_APPLY',
    `approved_by_ceo` BIGINT NOT NULL,
    `approved_at` DATETIME(6) NOT NULL,
    `ceo_note` TEXT NULL,
    `applied_by` BIGINT NULL,
    `applied_at` DATETIME(6) NULL,
    `finance_note` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    CONSTRAINT `uk_tech_comp_sync_review` UNIQUE (`review_id`),
    INDEX `idx_tech_comp_sync_month_status` (`effective_month`, `status`),
    INDEX `idx_tech_comp_sync_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 5. MODULE F4: TECH CERT REIMBURSEMENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `tech_cert_reimbursements` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `certificate_id` BIGINT NOT NULL,
    `employee_id` BIGINT NOT NULL,
    `department_id` BIGINT NOT NULL,
    `certificate_name` VARCHAR(200) NOT NULL,
    `issuing_organization` VARCHAR(150) NOT NULL,
    `exam_fee_vnd` DECIMAL(15,2) NOT NULL,
    `requested_amount_vnd` DECIMAL(15,2) NOT NULL,
    `approved_amount_vnd` DECIMAL(15,2) NULL,
    `support_percent` INT NOT NULL DEFAULT 100,
    `invoice_number` VARCHAR(100) NULL,
    `receipt_url` VARCHAR(500) NULL,
    `commitment_months` INT NOT NULL DEFAULT 0,
    `employee_note` TEXT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
    `tech_reviewer_id` BIGINT NULL,
    `tech_reviewed_at` DATETIME(6) NULL,
    `tech_note` TEXT NULL,
    `finance_approver_id` BIGINT NULL,
    `finance_approved_at` DATETIME(6) NULL,
    `finance_note` TEXT NULL,
    `payout_method` VARCHAR(30) NULL,
    `payout_payroll_month` VARCHAR(7) NULL,
    `payment_reference` VARCHAR(100) NULL,
    `disbursed_by` BIGINT NULL,
    `disbursed_at` DATETIME(6) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    INDEX `idx_cert_reimb_cert` (`certificate_id`),
    INDEX `idx_cert_reimb_employee` (`employee_id`),
    INDEX `idx_cert_reimb_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
