-- Luồng lương mới do phòng Tài chính - Kế toán điều phối.
-- Mỗi phòng ban mỗi tháng có 1 "kỳ lương" (payroll_reports.report_level = 'DEPARTMENT'):
--   Trưởng phòng chốt công -> Kế toán tính lương -> Giám đốc phòng xác nhận
--   -> Kế toán trưởng kiểm tra -> CEO chốt -> Kế toán chi trả (PAID).
-- Các bản ghi cấp MANAGER_LEVEL / DIRECTOR_LEVEL cũ được giữ nguyên để tra cứu.

ALTER TABLE `payroll_reports`
    ADD COLUMN `total_net_salary` DOUBLE NULL,
    ADD COLUMN `attendance_closed_by` BIGINT NULL,
    ADD COLUMN `attendance_closed_at` DATETIME(6) NULL,
    ADD COLUMN `generated_by` BIGINT NULL,
    ADD COLUMN `generated_at` DATETIME(6) NULL,
    ADD COLUMN `submitted_by` BIGINT NULL,
    ADD COLUMN `submitted_at` DATETIME(6) NULL,
    ADD COLUMN `director_confirmed_by` BIGINT NULL,
    ADD COLUMN `director_confirmed_at` DATETIME(6) NULL,
    ADD COLUMN `chief_reviewed_by` BIGINT NULL,
    ADD COLUMN `chief_reviewed_at` DATETIME(6) NULL,
    ADD COLUMN `ceo_approved_by` BIGINT NULL,
    ADD COLUMN `ceo_approved_at` DATETIME(6) NULL,
    ADD COLUMN `paid_by` BIGINT NULL,
    ADD COLUMN `paid_at` DATETIME(6) NULL,
    ADD COLUMN `payment_reference` VARCHAR(255) NULL,
    ADD COLUMN `rejected_stage` VARCHAR(50) NULL,
    ADD COLUMN `rejected_by` BIGINT NULL,
    ADD COLUMN `rejection_reason` TEXT NULL;

CREATE INDEX `idx_payroll_reports_period` ON `payroll_reports` (`report_level`, `year`, `month`, `department_id`);

ALTER TABLE `payrolls`
    ADD COLUMN `payroll_report_id` BIGINT NULL,
    ADD COLUMN `department_id` BIGINT NULL;

CREATE INDEX `idx_payrolls_report` ON `payrolls` (`payroll_report_id`);
