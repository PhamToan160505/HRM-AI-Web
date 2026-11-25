-- No assumed monetary limits. CEO must publish a policy before new submissions.
CREATE TABLE sales_pricing_policies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    enabled BOOLEAN NOT NULL,
    standard_max DECIMAL(19,2) NOT NULL,
    manager_max DECIMAL(19,2) NOT NULL,
    director_max DECIMAL(19,2) NOT NULL,
    manager_discount DECIMAL(5,2) NOT NULL,
    director_discount DECIMAL(5,2) NOT NULL,
    standard_terms TEXT NOT NULL,
    ceo_delegate_id BIGINT NULL,
    change_reason VARCHAR(1000) NOT NULL,
    created_by BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (ceo_delegate_id) REFERENCES users(id),
    CONSTRAINT ck_sales_policy_limits CHECK (standard_max >= 0 AND manager_max >= standard_max AND director_max >= manager_max
        AND manager_discount >= 0 AND director_discount >= manager_discount AND director_discount <= 100)
);
INSERT INTO sales_pricing_policies(enabled,standard_max,manager_max,director_max,manager_discount,director_discount,standard_terms,change_reason)
VALUES (FALSE,0,0,0,0,0,'','Chưa thiết lập hạn mức. CEO cần công bố chính sách.');

ALTER TABLE sales_products
    ADD floor_price DECIMAL(19,2) NULL,
    ADD standard_package BOOLEAN NOT NULL DEFAULT FALSE,
    ADD standard_scope VARCHAR(500) NULL;
UPDATE sales_products SET floor_price=unit_price, standard_scope=name;
ALTER TABLE sales_products MODIFY floor_price DECIMAL(19,2) NOT NULL,
    ADD CONSTRAINT ck_sales_product_floor CHECK (floor_price >= 0 AND floor_price <= unit_price);

ALTER TABLE sales_quotation_lines
    ADD catalog_price DECIMAL(19,2) NULL,
    ADD floor_price DECIMAL(19,2) NULL,
    ADD product_version BIGINT NULL,
    ADD standard_package BOOLEAN NOT NULL DEFAULT FALSE,
    ADD standard_scope VARCHAR(500) NULL;
-- Existing drafts must be recreated to capture an authoritative catalog snapshot.
ALTER TABLE sales_quotations
    DROP CHECK ck_sales_quote_status,
    ADD pricing_policy_id BIGINT NULL,
    ADD policy_snapshot JSON NULL,
    ADD approval_level VARCHAR(20) NULL,
    ADD routing_reasons TEXT NULL,
    ADD custom_scope BOOLEAN NOT NULL DEFAULT FALSE,
    ADD new_technology BOOLEAN NOT NULL DEFAULT FALSE,
    ADD resource_exception BOOLEAN NOT NULL DEFAULT FALSE,
    ADD exclusive_rights BOOLEAN NOT NULL DEFAULT FALSE,
    ADD strategic_exception BOOLEAN NOT NULL DEFAULT FALSE,
    ADD exception_note VARCHAR(2000) NULL,
    ADD technical_department_id BIGINT NULL,
    ADD technical_status VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD FOREIGN KEY (pricing_policy_id) REFERENCES sales_pricing_policies(id),
    ADD FOREIGN KEY (technical_department_id) REFERENCES departments(id),
    ADD CONSTRAINT ck_sales_quote_status CHECK (status IN ('DRAFT','PENDING_TECHNICAL','PENDING_APPROVAL','RETURNED','APPROVED','SENT','ACCEPTED','DECLINED')),
    ADD CONSTRAINT ck_sales_quote_level CHECK (approval_level IS NULL OR approval_level IN ('STANDARD','MANAGER','DIRECTOR','CEO')),
    ADD CONSTRAINT ck_sales_quote_technical CHECK (technical_status IN ('NOT_REQUIRED','PENDING','APPROVED','RETURNED'));
UPDATE sales_quotations SET approval_level='MANAGER',routing_reasons='Báo giá theo quy trình trước khi áp dụng chính sách phân cấp.'
WHERE status NOT IN ('DRAFT','RETURNED');

CREATE TABLE sales_technical_reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    quotation_id BIGINT NOT NULL UNIQUE,
    approved BOOLEAN NOT NULL,
    effort_days DECIMAL(10,2) NOT NULL,
    feasibility VARCHAR(1000) NOT NULL,
    delivery_plan VARCHAR(2000) NOT NULL,
    resource_needs VARCHAR(2000) NOT NULL,
    requires_executive BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (quotation_id) REFERENCES sales_quotations(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    CONSTRAINT ck_sales_review_effort CHECK (effort_days > 0)
);

DELIMITER $$
CREATE TRIGGER trg_sales_quote_snapshot BEFORE UPDATE ON sales_quotations FOR EACH ROW
BEGIN
    IF (OLD.pricing_policy_id IS NOT NULL AND
        (NOT (OLD.pricing_policy_id <=> NEW.pricing_policy_id) OR NOT (OLD.policy_snapshot <=> NEW.policy_snapshot)))
        OR NOT (OLD.opportunity_id <=> NEW.opportunity_id) OR NOT (OLD.revision <=> NEW.revision)
        OR NOT (OLD.valid_until <=> NEW.valid_until) OR NOT (OLD.discount_amount <=> NEW.discount_amount)
        OR NOT (OLD.total_amount <=> NEW.total_amount) OR NOT (OLD.terms <=> NEW.terms)
        OR NOT (OLD.customer_name <=> NEW.customer_name) OR NOT (OLD.customer_address <=> NEW.customer_address)
        OR NOT (OLD.customer_tax_code <=> NEW.customer_tax_code) OR NOT (OLD.opportunity_title <=> NEW.opportunity_title)
        OR NOT (OLD.created_by <=> NEW.created_by) OR NOT (OLD.custom_scope <=> NEW.custom_scope)
        OR NOT (OLD.new_technology <=> NEW.new_technology) OR NOT (OLD.resource_exception <=> NEW.resource_exception)
        OR NOT (OLD.exclusive_rights <=> NEW.exclusive_rights) OR NOT (OLD.strategic_exception <=> NEW.strategic_exception)
        OR NOT (OLD.exception_note <=> NEW.exception_note) OR NOT (OLD.technical_department_id <=> NEW.technical_department_id)
    THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Create a new quotation revision to change commercial data';
    END IF;
END$$
CREATE TRIGGER trg_sales_quote_line_no_update BEFORE UPDATE ON sales_quotation_lines FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quotation lines are immutable';
END$$
CREATE TRIGGER trg_sales_quote_line_no_delete BEFORE DELETE ON sales_quotation_lines FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quotation lines are immutable';
END$$
CREATE TRIGGER trg_sales_policy_no_update BEFORE UPDATE ON sales_pricing_policies FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Publish a new sales policy version';
END$$
CREATE TRIGGER trg_sales_policy_no_delete BEFORE DELETE ON sales_pricing_policies FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sales policies are append-only';
END$$
CREATE TRIGGER trg_sales_review_no_update BEFORE UPDATE ON sales_technical_reviews FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Technical reviews are immutable';
END$$
CREATE TRIGGER trg_sales_review_no_delete BEFORE DELETE ON sales_technical_reviews FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Technical reviews are immutable';
END$$
DELIMITER ;
