-- Feature #8: Đánh giá Hiệu suất Kỹ sư Đa chiều, Quản trị Chứng chỉ & Lộ trình Nâng bậc Chuyên môn
-- Dedicated strictly to Phòng Công nghệ (Engineering Department)

-- 1. Kỳ đánh giá nhân sự Phòng Công nghệ (Evaluation Cycles)
CREATE TABLE IF NOT EXISTS tech_evaluation_cycles (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cycle_code VARCHAR(40) NOT NULL UNIQUE,
    title VARCHAR(180) NOT NULL,
    review_type VARCHAR(20) NOT NULL DEFAULT 'QUARTERLY',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    self_review_deadline DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    department_id BIGINT NOT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY idx_tech_cycle_dept_status (department_id, status),
    CONSTRAINT fk_tech_cycle_dept FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_tech_cycle_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Phiếu đánh giá kỹ sư đa chiều (Engineering Performance Reviews)
CREATE TABLE IF NOT EXISTS tech_performance_reviews (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    cycle_id BIGINT NULL,
    employee_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    review_type VARCHAR(20) NOT NULL DEFAULT 'QUARTERLY',
    period_label VARCHAR(50) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Telemetry tự động (tổng max 100)
    delivery_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    impact_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    capability_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    discipline_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    telemetry_total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    telemetry_snapshot_json JSON NULL,

    -- Tự đánh giá của Kỹ sư (Self-Review)
    self_summary TEXT NULL,
    self_achievements TEXT NULL,
    self_challenges TEXT NULL,
    self_goals_next TEXT NULL,
    self_rating_score DECIMAL(5,2) NULL,
    self_submitted_at DATETIME(6) NULL,

    -- Đánh giá định tính của Quản lý (4 tiêu chí x 25 = 100)
    evaluator_id BIGINT NULL,
    qual_craft_score DECIMAL(5,2) NULL,
    qual_ownership_score DECIMAL(5,2) NULL,
    qual_collab_score DECIMAL(5,2) NULL,
    qual_growth_score DECIMAL(5,2) NULL,
    manager_qual_score DECIMAL(5,2) NULL,
    manager_comment TEXT NULL,
    manager_feedback_goals TEXT NULL,
    ai_copilot_summary TEXT NULL,

    -- Hiệu chỉnh & Kết quả cuối
    calibration_delta DECIMAL(4,2) NOT NULL DEFAULT 0.00,
    calibration_reason VARCHAR(500) NULL,
    final_score DECIMAL(5,2) NULL,
    final_grade VARCHAR(5) NULL,

    -- Đề xuất Thăng chức & Điều chỉnh đãi ngộ (B-10: lương tuyệt đối chỉ mở cho CEO/GĐ khi duyệt)
    recommend_promotion BIT(1) NOT NULL DEFAULT b'0',
    recommended_title VARCHAR(100) NULL,
    recommended_salary_increase_pct DECIMAL(5,2) NULL,
    recommended_new_base_salary DOUBLE NULL,
    recommended_new_allowance DOUBLE NULL,
    compensation_reason VARCHAR(500) NULL,
    compensation_status VARCHAR(25) NOT NULL DEFAULT 'NONE',

    -- Trạng thái phê duyệt & Audit
    status VARCHAR(30) NOT NULL DEFAULT 'SELF_REVIEW_PENDING',
    final_approver_id BIGINT NULL,
    final_approved_at DATETIME(6) NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    UNIQUE KEY uk_tech_review_emp_period (employee_id, review_type, period_start, period_end),
    KEY idx_tech_review_cycle (cycle_id),
    KEY idx_tech_review_dept_status (department_id, status),
    KEY idx_tech_review_emp_status (employee_id, status),
    CONSTRAINT fk_tech_review_cycle FOREIGN KEY (cycle_id) REFERENCES tech_evaluation_cycles(id) ON DELETE SET NULL,
    CONSTRAINT fk_tech_review_emp FOREIGN KEY (employee_id) REFERENCES users(id),
    CONSTRAINT fk_tech_review_dept FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_tech_review_evaluator FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_tech_review_approver FOREIGN KEY (final_approver_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_tech_review_calibration CHECK (calibration_delta >= -5.00 AND calibration_delta <= 5.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Danh sách kỹ năng đề xuất nâng bậc gắn theo Phiếu đánh giá
CREATE TABLE IF NOT EXISTS tech_skill_promotion_items (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    review_id BIGINT NOT NULL,
    user_tech_skill_id BIGINT NULL,
    skill_id BIGINT NOT NULL,
    from_level VARCHAR(20) NULL,
    target_level VARCHAR(20) NOT NULL,
    evidence_note VARCHAR(500) NOT NULL,
    evidence_url VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewer_note VARCHAR(300) NULL,
    applied_at DATETIME(6) NULL,
    UNIQUE KEY uk_review_skill_item (review_id, skill_id),
    CONSTRAINT fk_skill_promo_review FOREIGN KEY (review_id) REFERENCES tech_performance_reviews(id) ON DELETE CASCADE,
    CONSTRAINT fk_skill_promo_user_skill FOREIGN KEY (user_tech_skill_id) REFERENCES user_tech_skills(id) ON DELETE SET NULL,
    CONSTRAINT fk_skill_promo_skill FOREIGN KEY (skill_id) REFERENCES tech_skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Lịch sử sự kiện lộ trình nghề nghiệp kỹ thuật (Career Timeline)
CREATE TABLE IF NOT EXISTS tech_career_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    review_id BIGINT NULL,
    event_type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    old_value VARCHAR(150) NULL,
    new_value VARCHAR(150) NULL,
    actor_id BIGINT NULL,
    note VARCHAR(500) NULL,
    event_date DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_career_emp_date (employee_id, event_date),
    CONSTRAINT fk_career_emp FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_career_review FOREIGN KEY (review_id) REFERENCES tech_performance_reviews(id) ON DELETE SET NULL,
    CONSTRAINT fk_career_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
