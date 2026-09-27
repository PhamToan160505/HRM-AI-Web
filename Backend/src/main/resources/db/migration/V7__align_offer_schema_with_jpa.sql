-- V6 is already applied. Align the fixed-length SHA-256 database column with
-- Hibernate's String mapping without rewriting migration history.
ALTER TABLE `offer_dispatches`
    MODIFY COLUMN `response_token_hash` VARCHAR(64) NOT NULL;
