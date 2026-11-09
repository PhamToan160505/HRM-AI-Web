-- ====================================================================
-- V20: Ma trận Kỹ năng & Hồ sơ Năng lực Kỹ thuật (Skills Matrix & Tech Profiles)
-- ====================================================================

-- 1. Bảng danh mục kỹ năng công nghệ chuẩn hóa
CREATE TABLE IF NOT EXISTS tech_skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,
    description VARCHAR(255),
    icon_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng kỹ năng của từng kỹ sư
CREATE TABLE IF NOT EXISTS user_tech_skills (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    proficiency_level VARCHAR(20) NOT NULL, -- FRESHER, JUNIOR, MIDDLE, SENIOR, EXPERT
    years_of_experience DECIMAL(4,1) DEFAULT 0.0,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by BIGINT NULL,
    verified_at TIMESTAMP NULL,
    highlight_project VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_tech_skills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_tech_skills_skill FOREIGN KEY (skill_id) REFERENCES tech_skills(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_tech_skills_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_user_skill UNIQUE (user_id, skill_id)
);

-- 3. Bảng chứng chỉ kỹ thuật của kỹ sư
CREATE TABLE IF NOT EXISTS user_tech_certificates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    certificate_name VARCHAR(200) NOT NULL,
    issuing_organization VARCHAR(150) NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NULL,
    credential_id VARCHAR(100) NULL,
    credential_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_cert_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed danh mục kỹ năng chuẩn ban đầu
INSERT INTO tech_skills (skill_name, category, description, icon_name) VALUES
-- Backend
('Java', 'BACKEND', 'Ngôn ngữ lập trình cốt lõi cho các hệ thống doanh nghiệp lớn', 'code-2'),
('Spring Boot', 'BACKEND', 'Framework Java phổ biến phát triển REST API & Microservices', 'layers'),
('Node.js', 'BACKEND', 'Runtime JavaScript phía server tốc độ cao với event loop', 'terminal'),
('NestJS', 'BACKEND', 'Framework Node.js theo kiến trúc module lấy cảm hứng từ Angular', 'layers'),
('Python', 'BACKEND', 'Ngôn ngữ cho backend, AI/Machine Learning và Data Processing', 'code-2'),
('Go (Golang)', 'BACKEND', 'Ngôn ngữ hiệu năng cao của Google cho Microservices & Cloud Native', 'cpu'),
-- Frontend
('React', 'FRONTEND', 'Thư viện UI declarative hàng đầu cho Single Page Application', 'layout'),
('Vue.js', 'FRONTEND', 'Framework giao diện trực quan, linh hoạt và tối ưu hiệu năng', 'layout'),
('TypeScript', 'FRONTEND', 'Superset của JavaScript với static typing an toàn cho dự án lớn', 'file-code'),
('Next.js', 'FRONTEND', 'React framework hỗ trợ SSR, SSG và tối ưu SEO vượt trội', 'globe'),
('Tailwind CSS', 'FRONTEND', 'Utility-first CSS framework thiết kế giao diện hiện đại nhanh chóng', 'palette'),
-- Database
('MySQL', 'DATABASE', 'Hệ quản trị CSDL quan hệ RDBMS phổ biến và ổn định', 'database'),
('PostgreSQL', 'DATABASE', 'Hệ CSDL quan hệ đối tượng mã nguồn mở mạnh mẽ', 'database'),
('MongoDB', 'DATABASE', 'CSDL NoSQL dạng tài liệu JSON linh hoạt theo document', 'database'),
('Redis', 'DATABASE', 'In-memory data store làm Cache tốc độ cao và Pub/Sub messaging', 'zap'),
-- DevOps & Cloud
('Docker', 'DEVOPS_CLOUD', 'Containerization đóng gói ứng dụng đồng nhất giữa các môi trường', 'box'),
('Kubernetes', 'DEVOPS_CLOUD', 'Hệ thống điều phối và tự động hóa quản lý container quy mô lớn', 'cloud'),
('AWS (Amazon Web Services)', 'DEVOPS_CLOUD', 'Nền tảng điện toán đám mây số 1 thế giới (EC2, S3, RDS, Lambda)', 'cloud'),
('CI/CD Pipeline', 'DEVOPS_CLOUD', 'Tự động hóa build, test và deploy (GitHub Actions, GitLab CI, Jenkins)', 'git-merge'),
-- Testing
('Automation Testing', 'TESTING', 'Kiểm thử tự động UI/API với Selenium, Playwright, Cypress', 'check-circle'),
('Manual Testing', 'TESTING', 'Thiết kế Test Case, kiểm thử tính năng và nghiệm thu phần mềm', 'clipboard-check'),
('API Testing (Postman)', 'TESTING', 'Kiểm thử tích hợp các endpoint REST/GraphQL với Postman/Newman', 'send'),
-- Mobile
('Flutter', 'MOBILE', 'Framework cross-platform của Google phát triển app iOS/Android', 'smartphone'),
('React Native', 'MOBILE', 'Framework di động đa nền tảng dựa trên ngôn ngữ React', 'smartphone'),
-- Architecture
('Microservices Architecture', 'ARCHITECTURE', 'Kiến trúc dịch vụ phân tán, độc lập triển khai và mở rộng linh hoạt', 'network'),
('System Design', 'ARCHITECTURE', 'Thiết kế giải pháp, khả năng mở rộng chịu tải cao (High Availability)', 'cpu')
ON DUPLICATE KEY UPDATE skill_name = skill_name;

