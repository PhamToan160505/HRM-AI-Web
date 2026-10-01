-- Offer-to-Contract - Giai đoạn 2: thư viện điều khoản, sinh hợp đồng,
-- rà soát pháp chế, phát hành và lưu bản đã ký.

CREATE TABLE `contract_clauses` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `clause_code` VARCHAR(60) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `content` TEXT NOT NULL,
    `required_clause` BIT(1) NOT NULL DEFAULT b'0',
    `active` BIT(1) NOT NULL DEFAULT b'1',
    `version_number` INT NOT NULL DEFAULT 1,
    `created_by` BIGINT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_clause_code_version` (`clause_code`, `version_number`),
    KEY `idx_contract_clause_active_category` (`active`, `category`),
    CONSTRAINT `fk_contract_clause_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `employment_contracts` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `application_id` BIGINT NOT NULL,
    `offer_id` BIGINT NOT NULL,
    `employee_id` BIGINT NULL,
    `contract_number` VARCHAR(80) NULL,
    `version_number` INT NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT','PENDING_LEGAL_REVIEW','LEGAL_CHANGES_REQUESTED','LEGAL_APPROVED','ISSUED','SIGNED_UPLOADED') NOT NULL,
    `contract_data_json` JSON NOT NULL,
    `generated_html` LONGTEXT NULL,
    `generated_at` DATETIME(6) NULL,
    `created_by` BIGINT NOT NULL,
    `legal_reviewer_id` BIGINT NULL,
    `legal_comment` TEXT NULL,
    `legal_reviewed_at` DATETIME(6) NULL,
    `issued_by` BIGINT NULL,
    `issued_at` DATETIME(6) NULL,
    `signed_file_url` VARCHAR(1000) NULL,
    `signed_file_name` VARCHAR(255) NULL,
    `signed_file_sha256` VARCHAR(64) NULL,
    `signed_uploaded_by` BIGINT NULL,
    `signed_uploaded_at` DATETIME(6) NULL,
    `row_version` BIGINT NOT NULL DEFAULT 0,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_application_version` (`application_id`, `version_number`),
    UNIQUE KEY `uk_contract_number` (`contract_number`),
    KEY `idx_contract_application_status` (`application_id`, `status`, `version_number`),
    KEY `fk_contract_offer` (`offer_id`),
    KEY `fk_contract_employee` (`employee_id`),
    KEY `fk_contract_creator` (`created_by`),
    KEY `fk_contract_legal_reviewer` (`legal_reviewer_id`),
    CONSTRAINT `fk_contract_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
    CONSTRAINT `fk_contract_offer` FOREIGN KEY (`offer_id`) REFERENCES `offers` (`id`),
    CONSTRAINT `fk_contract_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
    CONSTRAINT `fk_contract_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_contract_legal_reviewer` FOREIGN KEY (`legal_reviewer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `contract_clause_snapshots` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `contract_id` BIGINT NOT NULL,
    `clause_id` BIGINT NOT NULL,
    `clause_code` VARCHAR(60) NOT NULL,
    `clause_version` INT NOT NULL,
    `title_snapshot` VARCHAR(200) NOT NULL,
    `content_snapshot` TEXT NOT NULL,
    `required_clause` BIT(1) NOT NULL,
    `sort_order` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_clause_snapshot` (`contract_id`, `clause_code`),
    KEY `fk_contract_clause_snapshot_clause` (`clause_id`),
    CONSTRAINT `fk_contract_clause_snapshot_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`),
    CONSTRAINT `fk_contract_clause_snapshot_clause` FOREIGN KEY (`clause_id`) REFERENCES `contract_clauses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `contract_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `contract_id` BIGINT NOT NULL,
    `event_type` VARCHAR(60) NOT NULL,
    `from_status` VARCHAR(40) NULL,
    `to_status` VARCHAR(40) NOT NULL,
    `actor_id` BIGINT NULL,
    `comment` TEXT NULL,
    `idempotency_key` VARCHAR(140) NOT NULL,
    `occurred_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_contract_event_idempotency` (`idempotency_key`),
    KEY `idx_contract_event_timeline` (`contract_id`, `occurred_at`, `id`),
    CONSTRAINT `fk_contract_event_contract` FOREIGN KEY (`contract_id`) REFERENCES `employment_contracts` (`id`),
    CONSTRAINT `fk_contract_event_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `contract_clauses`
    (`clause_code`, `title`, `category`, `content`, `required_clause`, `active`, `version_number`)
VALUES
    ('WORK_AND_LOCATION', 'Công việc và địa điểm làm việc', 'CÔNG VIỆC',
     'Người lao động thực hiện công việc theo chức danh ghi trong hợp đồng và tuân thủ sự phân công hợp lý của người sử dụng lao động. Địa điểm làm việc theo thông tin tại hợp đồng hoặc thông báo hợp lệ của công ty.', b'1', b'1', 1),
    ('WORKING_TIME', 'Thời giờ làm việc và nghỉ ngơi', 'THỜI GIAN',
     'Thời giờ làm việc, thời giờ nghỉ ngơi, ngày nghỉ hằng tuần và nghỉ phép được áp dụng theo nội quy lao động, chính sách công ty và quy định pháp luật hiện hành.', b'1', b'1', 1),
    ('SALARY_PAYMENT', 'Tiền lương và phương thức thanh toán', 'THU NHẬP',
     'Tiền lương được thanh toán theo kỳ trả lương của công ty bằng hình thức chuyển khoản. Các khoản thuế, bảo hiểm và nghĩa vụ khác được khấu trừ theo quy định pháp luật.', b'1', b'1', 1),
    ('CONFIDENTIALITY', 'Bảo mật thông tin', 'BẢO MẬT',
     'Người lao động có trách nhiệm bảo mật thông tin kinh doanh, dữ liệu cá nhân, bí mật công nghệ và tài sản thông tin được tiếp cận trong quá trình làm việc.', b'1', b'1', 1),
    ('INTELLECTUAL_PROPERTY', 'Quyền sở hữu trí tuệ', 'SỞ HỮU TRÍ TUỆ',
     'Kết quả công việc và tài sản trí tuệ được tạo ra trong phạm vi nhiệm vụ, bằng nguồn lực của công ty, được quản lý theo thỏa thuận, nội quy và quy định pháp luật.', b'0', b'1', 1),
    ('TERMINATION', 'Chấm dứt hợp đồng', 'CHẤM DỨT',
     'Việc tạm hoãn, sửa đổi hoặc chấm dứt hợp đồng được thực hiện theo thỏa thuận giữa các bên và quy định pháp luật lao động hiện hành.', b'1', b'1', 1);
