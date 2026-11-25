-- Pre-Flyway installations may predate group chat. Their baseline skips V1,
-- so restore the three missing V1 tables without changing existing chat data.
CREATE TABLE IF NOT EXISTS chat_group_members (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    group_id BIGINT NOT NULL,
    joined_at DATETIME(6) DEFAULT NULL,
    last_read_message_id BIGINT DEFAULT NULL,
    user_id BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS chat_groups (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    created_at DATETIME(6) DEFAULT NULL,
    department_id BIGINT DEFAULT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('DEPARTMENT','EXECUTIVE') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS group_messages (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at DATETIME(6) DEFAULT NULL,
    deleted_by_sender BIT(1) NOT NULL,
    group_id BIGINT NOT NULL,
    is_ai BIT(1) NOT NULL,
    is_recalled BIT(1) NOT NULL,
    private_user_id BIGINT DEFAULT NULL,
    sender_id BIGINT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
