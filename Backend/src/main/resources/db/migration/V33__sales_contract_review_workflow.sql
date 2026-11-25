-- Preserve existing signed records; new contracts begin as drafts.
ALTER TABLE sales_contracts
    MODIFY scope MEDIUMTEXT NOT NULL,
    MODIFY signed_date DATE NULL,
    MODIFY file_url VARCHAR(1000) NULL,
    ADD status VARCHAR(40) NOT NULL DEFAULT 'CONFIRMED',
    ADD version BIGINT NOT NULL DEFAULT 0,
    ADD implementation_notes TEXT NULL,
    ADD last_edited_by BIGINT NULL,
    ADD reviewed_by BIGINT NULL,
    ADD confirmed_by BIGINT NULL,
    ADD current_signature_id BIGINT NULL,
    ADD decision_note VARCHAR(1000) NULL,
    ADD legacy_record BOOLEAN NOT NULL DEFAULT TRUE,
    ADD confirmed_at DATETIME(6) NULL,
    ADD FOREIGN KEY (last_edited_by) REFERENCES users(id),
    ADD FOREIGN KEY (reviewed_by) REFERENCES users(id),
    ADD FOREIGN KEY (confirmed_by) REFERENCES users(id),
    ADD CONSTRAINT ck_sales_contract_status CHECK (status IN ('DRAFT','PENDING_REVIEW','RETURNED','READY_TO_SIGN','SIGNED_PENDING_CONFIRMATION','SIGNED_RETURNED','CONFIRMED','CANCELLED'));
ALTER TABLE sales_contracts ALTER COLUMN status SET DEFAULT 'DRAFT', ALTER COLUMN legacy_record SET DEFAULT FALSE;

CREATE TABLE sales_contract_sequences (
    period INT PRIMARY KEY,
    next_value BIGINT NOT NULL
);
CREATE TABLE sales_contract_signatures (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contract_id BIGINT NOT NULL,
    signed_date DATE NOT NULL,
    customer_signer VARCHAR(150) NOT NULL,
    company_signer VARCHAR(150) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    submitted_by BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (contract_id) REFERENCES sales_contracts(id),
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);
ALTER TABLE sales_contracts ADD FOREIGN KEY (current_signature_id) REFERENCES sales_contract_signatures(id);
CREATE TABLE sales_contract_history (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    contract_id BIGINT NOT NULL,
    version BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    note VARCHAR(1000) NULL,
    snapshot JSON NOT NULL,
    actor_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_sales_contract_history(contract_id,version),
    FOREIGN KEY (contract_id) REFERENCES sales_contracts(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
);
INSERT INTO sales_contract_history(contract_id,version,action,note,snapshot,actor_id)
SELECT id,0,'LEGACY_IMPORTED','Hồ sơ được ghi nhận trước quy trình rà soát; không suy diễn người đã phê duyệt.',
    JSON_OBJECT('status','CONFIRMED','contract_number',contract_number,'quotation_id',quotation_id,
        'scope',scope,'milestones',milestones,'payment_terms',payment_terms,'file_url',file_url,
        'signed_date',signed_date,'end_date',end_date,'signer',signer),created_by
FROM sales_contracts;

ALTER TABLE sales_quotations DROP CHECK ck_sales_quote_status,
    ADD CONSTRAINT ck_sales_quote_status CHECK (status IN ('DRAFT','PENDING_TECHNICAL','PENDING_APPROVAL','RETURNED','APPROVED','SENT','ACCEPTED','DECLINED','SUPERSEDED'));

DELIMITER $$
CREATE TRIGGER trg_sales_contract_freeze BEFORE UPDATE ON sales_contracts FOR EACH ROW
BEGIN
    IF OLD.status IN ('CONFIRMED','CANCELLED') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Final sales contracts are immutable';
    END IF;
    IF NOT (OLD.quotation_id <=> NEW.quotation_id) OR NOT (OLD.contract_number <=> NEW.contract_number)
        OR NOT (OLD.scope <=> NEW.scope) OR NOT (OLD.milestones <=> NEW.milestones)
        OR NOT (OLD.payment_terms <=> NEW.payment_terms) OR NOT (OLD.created_by <=> NEW.created_by)
        OR NOT (OLD.legacy_record <=> NEW.legacy_record) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Contract commercial content must come from an approved quotation';
    END IF;
END$$
CREATE TRIGGER trg_sales_contract_signature_no_update BEFORE UPDATE ON sales_contract_signatures FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Signed submissions are immutable';
END$$
CREATE TRIGGER trg_sales_contract_signature_no_delete BEFORE DELETE ON sales_contract_signatures FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Signed submissions are immutable';
END$$
CREATE TRIGGER trg_sales_contract_history_no_update BEFORE UPDATE ON sales_contract_history FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Contract history is append-only';
END$$
CREATE TRIGGER trg_sales_contract_history_no_delete BEFORE DELETE ON sales_contract_history FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Contract history is append-only';
END$$
DELIMITER ;
