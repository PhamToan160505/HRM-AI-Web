-- V23: Tech Advanced Suite: DoD Checklist, Environment Management, Architecture Docs & Mentorship Program

-- 1. Tiêu chuẩn Kỹ thuật & Checklist Nghiệm thu Mốc (Definition of Done - DoD)
CREATE TABLE IF NOT EXISTS tech_milestone_dod_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    milestone_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(500) NULL,
    is_required BIT(1) NOT NULL DEFAULT b'1',
    is_completed BIT(1) NOT NULL DEFAULT b'0',
    completed_by BIGINT NULL,
    completed_at DATETIME(6) NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_dod_item_milestone FOREIGN KEY (milestone_id) REFERENCES tech_project_milestones(id) ON DELETE CASCADE,
    CONSTRAINT fk_dod_item_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
    KEY idx_dod_milestone (milestone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tài liệu Kiến trúc Dự án (Architecture Decision Records, Specs, Diagrams)
CREATE TABLE IF NOT EXISTS tech_project_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    doc_type VARCHAR(50) NOT NULL DEFAULT 'ARCHITECTURE_SPEC',
    title VARCHAR(255) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    description VARCHAR(500) NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_proj_doc_project FOREIGN KEY (project_id) REFERENCES tech_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_proj_doc_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    KEY idx_proj_doc_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Quản lý Môi trường Triển khai (Dev, Staging, UAT, Production)
CREATE TABLE IF NOT EXISTS tech_project_environments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    env_name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    access_url VARCHAR(500) NULL,
    git_branch VARCHAR(100) NULL,
    server_host VARCHAR(255) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    owner_id BIGINT NULL,
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_proj_env_project FOREIGN KEY (project_id) REFERENCES tech_projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_proj_env_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uk_proj_env_name (project_id, env_name),
    KEY idx_proj_env_project (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Nhật ký Triển khai Môi trường (Deployment Logs)
CREATE TABLE IF NOT EXISTS tech_deployment_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    environment_id BIGINT NOT NULL,
    version_tag VARCHAR(50) NOT NULL,
    commit_hash VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    changelog TEXT NULL,
    deployed_by BIGINT NOT NULL,
    deployed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_deploy_log_env FOREIGN KEY (environment_id) REFERENCES tech_project_environments(id) ON DELETE CASCADE,
    CONSTRAINT fk_deploy_log_user FOREIGN KEY (deployed_by) REFERENCES users(id) ON DELETE RESTRICT,
    KEY idx_deploy_log_env (environment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Chương trình Kèm cặp Kỹ sư 1-1 (Engineering Mentorship Program)
CREATE TABLE IF NOT EXISTS tech_mentorship_programs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    department_id BIGINT NOT NULL,
    mentor_id BIGINT NOT NULL,
    mentee_id BIGINT NOT NULL,
    focus_skill_id BIGINT NULL,
    program_title VARCHAR(255) NOT NULL,
    target_goal VARCHAR(500) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    final_assessment TEXT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_mentor_prog_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mentor_prog_mentor FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mentor_prog_mentee FOREIGN KEY (mentee_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_mentor_prog_skill FOREIGN KEY (focus_skill_id) REFERENCES tech_skills(id) ON DELETE SET NULL,
    CONSTRAINT fk_mentor_prog_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    KEY idx_mentor_prog_dept (department_id),
    KEY idx_mentor_prog_mentor (mentor_id),
    KEY idx_mentor_prog_mentee (mentee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Nhật ký Trao đổi Kèm cặp Định kỳ (Mentorship Check-ins)
CREATE TABLE IF NOT EXISTS tech_mentorship_checkins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT NOT NULL,
    checkin_date DATE NOT NULL,
    topics_covered TEXT NOT NULL,
    progress_rating INT NOT NULL DEFAULT 3,
    mentor_feedback TEXT NULL,
    mentee_notes TEXT NULL,
    logged_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT fk_checkin_program FOREIGN KEY (program_id) REFERENCES tech_mentorship_programs(id) ON DELETE CASCADE,
    CONSTRAINT fk_checkin_logger FOREIGN KEY (logged_by) REFERENCES users(id) ON DELETE RESTRICT,
    KEY idx_checkin_program (program_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

