-- Offer-to-Contract - Giai đoạn 1.
-- Giữ nguyên lifecycle offer/seat hiện tại, chỉ bổ sung snapshot có cấu trúc
-- và bằng chứng ứng viên đã xem/phản hồi.

ALTER TABLE `offers`
    ADD COLUMN `offer_details_json` JSON NULL AFTER `contract_terms`;

ALTER TABLE `offer_dispatches`
    ADD COLUMN `candidate_response_json` JSON NULL AFTER `candidate_comment`,
    ADD COLUMN `viewed_at` DATETIME(6) NULL AFTER `candidate_response_json`,
    ADD COLUMN `view_count` INT NOT NULL DEFAULT 0 AFTER `viewed_at`;

DROP TRIGGER IF EXISTS `trg_offer_terms_immutable`;

DELIMITER $$

CREATE TRIGGER `trg_offer_terms_immutable`
BEFORE UPDATE ON `offers`
FOR EACH ROW
BEGIN
    IF OLD.status IN ('APPROVED','SUPERSEDED','ACCEPTED') AND (
        NOT (OLD.base_salary <=> NEW.base_salary)
        OR NOT (OLD.allowances_json <=> NEW.allowances_json)
        OR NOT (OLD.probation_months <=> NEW.probation_months)
        OR NOT (OLD.probation_salary_rate <=> NEW.probation_salary_rate)
        OR NOT (OLD.expected_start_date <=> NEW.expected_start_date)
        OR NOT (OLD.contract_terms <=> NEW.contract_terms)
        OR NOT (OLD.offer_details_json <=> NEW.offer_details_json)
        OR NOT (OLD.file_url <=> NEW.file_url)
        OR NOT (OLD.salary_out_of_range <=> NEW.salary_out_of_range)
        OR NOT (OLD.out_of_range_reason <=> NEW.out_of_range_reason)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Approved offer terms are immutable; create a new version';
    END IF;
END$$

DELIMITER ;
