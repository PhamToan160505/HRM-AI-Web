-- BUG-01: chặn tạo trùng kỳ lương khi chốt công đồng thời (bấm đúp / gửi lại request).
-- Mỗi phòng ban mỗi tháng chỉ có 1 kỳ lương report_level = 'DEPARTMENT'.
-- Dùng cột period_key (NULL với dữ liệu luồng cũ) để không đụng tới các báo cáo MANAGER_LEVEL / DIRECTOR_LEVEL cũ.

ALTER TABLE `payroll_reports`
    ADD COLUMN `period_key` VARCHAR(64) NULL;

-- Gán khóa cho kỳ lương hiện có; nếu lỡ có bản trùng thì chỉ bản cũ nhất (id nhỏ nhất) nhận khóa.
UPDATE `payroll_reports` r
JOIN (
    SELECT MIN(id) AS keep_id
    FROM `payroll_reports`
    WHERE report_level = 'DEPARTMENT'
    GROUP BY department_id, `year`, `month`
) k ON k.keep_id = r.id
SET r.period_key = CONCAT('DEPARTMENT:', r.department_id, ':', r.`year`, ':', r.`month`);

CREATE UNIQUE INDEX `uk_payroll_reports_period_key` ON `payroll_reports` (`period_key`);
