-- Sales owns commercial data. Shared HR users/departments remain the identity source.
INSERT INTO departments(ten_phong, mo_ta, is_lock, created_at)
SELECT 'Kinh doanh', 'Quản lý khách hàng và hoạt động kinh doanh', b'0', NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('kinh doanh', 'phòng kinh doanh'));

CREATE TABLE sales_customers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    department_id BIGINT NOT NULL,
    owner_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    tax_code VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(500) NULL,
    source VARCHAR(150) NULL,
    notes TEXT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_sales_customer_tax (tax_code),
    UNIQUE KEY uk_sales_customer_name (name),
    UNIQUE KEY uk_sales_customer_email (email),
    UNIQUE KEY uk_sales_customer_phone (phone),
    INDEX ix_sales_customer_scope (department_id, owner_id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE TABLE sales_contacts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    job_title VARCHAR(150) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,
    FOREIGN KEY (customer_id) REFERENCES sales_customers(id)
);
CREATE TABLE sales_opportunities (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    requirements TEXT NOT NULL,
    expected_value DECIMAL(19,2) NOT NULL,
    expected_close DATE NOT NULL,
    stage VARCHAR(30) NOT NULL DEFAULT 'NEW',
    loss_reason VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (customer_id) REFERENCES sales_customers(id),
    CONSTRAINT ck_sales_opportunity_value CHECK (expected_value >= 0),
    CONSTRAINT ck_sales_opportunity_stage CHECK (stage IN ('NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST'))
);
CREATE TABLE sales_activities (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    opportunity_id BIGINT NULL,
    subject VARCHAR(200) NOT NULL,
    notes TEXT NULL,
    due_at DATETIME(6) NOT NULL,
    completed_at DATETIME(6) NULL,
    created_by BIGINT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES sales_customers(id),
    FOREIGN KEY (opportunity_id) REFERENCES sales_opportunities(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX ix_sales_activity_due (due_at, completed_at)
);
CREATE TABLE sales_products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_price DECIMAL(19,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_sales_product_price CHECK (unit_price >= 0)
);
CREATE TABLE sales_quotations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    opportunity_id BIGINT NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_address VARCHAR(500) NULL,
    customer_tax_code VARCHAR(30) NULL,
    opportunity_title VARCHAR(200) NOT NULL,
    revision INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    valid_until DATE NOT NULL,
    discount_amount DECIMAL(19,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(19,2) NOT NULL,
    terms TEXT NOT NULL,
    created_by BIGINT NOT NULL,
    approved_by BIGINT NULL,
    decision_note VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_sales_quote_revision (opportunity_id, revision),
    FOREIGN KEY (opportunity_id) REFERENCES sales_opportunities(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    CONSTRAINT ck_sales_quote_total CHECK (total_amount >= 0 AND discount_amount >= 0),
    CONSTRAINT ck_sales_quote_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED','SENT','ACCEPTED','DECLINED'))
);
CREATE TABLE sales_quotation_lines (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quotation_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    description VARCHAR(500) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(19,2) NOT NULL,
    FOREIGN KEY (quotation_id) REFERENCES sales_quotations(id),
    FOREIGN KEY (product_id) REFERENCES sales_products(id),
    CONSTRAINT ck_sales_quote_line CHECK (quantity > 0 AND unit_price >= 0)
);
CREATE TABLE sales_contracts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quotation_id BIGINT NOT NULL UNIQUE,
    contract_number VARCHAR(100) NOT NULL UNIQUE,
    signed_date DATE NOT NULL,
    end_date DATE NOT NULL,
    signer VARCHAR(150) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    scope TEXT NOT NULL,
    milestones TEXT NOT NULL,
    payment_terms TEXT NOT NULL,
    created_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (quotation_id) REFERENCES sales_quotations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT ck_sales_contract_dates CHECK (end_date >= signed_date)
);
CREATE TABLE sales_handovers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contract_id BIGINT NOT NULL,
    recipient_department_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_by BIGINT NOT NULL,
    received_by BIGINT NULL,
    response_note VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    responded_at DATETIME(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_sales_handover (contract_id, recipient_department_id),
    FOREIGN KEY (contract_id) REFERENCES sales_contracts(id),
    FOREIGN KEY (recipient_department_id) REFERENCES departments(id),
    FOREIGN KEY (sent_by) REFERENCES users(id),
    FOREIGN KEY (received_by) REFERENCES users(id),
    CONSTRAINT ck_sales_handover_status CHECK (status IN ('PENDING','ACCEPTED','RETURNED'))
);
CREATE TABLE sales_events (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id BIGINT NOT NULL,
    details VARCHAR(1000) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (customer_id) REFERENCES sales_customers(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
);

CREATE TABLE sales_reminders (
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    recipient_id BIGINT NOT NULL,
    reminder_date DATE NOT NULL,
    PRIMARY KEY (entity_type, entity_id, recipient_id, reminder_date),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
);
INSERT INTO system_configurations(config_key,config_value,value_type,description,effective_from,change_reason)
VALUES ('sales.renewal_notice_days','30','INTEGER','Số ngày nhắc trước khi hợp đồng thương mại kết thúc',NOW(6),'Khởi tạo module Kinh doanh');

DELIMITER $$
CREATE TRIGGER trg_sales_events_no_update BEFORE UPDATE ON sales_events FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sales audit events are append-only';
END$$
CREATE TRIGGER trg_sales_events_no_delete BEFORE DELETE ON sales_events FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sales audit events are append-only';
END$$
DELIMITER ;
