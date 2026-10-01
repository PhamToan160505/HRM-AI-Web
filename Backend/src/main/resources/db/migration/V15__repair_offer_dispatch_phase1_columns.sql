-- Repair migration for environments where the non-transactional V14 DDL was only
-- partially applied. Every statement is idempotent and safe for a fully migrated DB.

SET @add_offer_details = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `offers` ADD COLUMN `offer_details_json` JSON NULL AFTER `contract_terms`',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'offers'
      AND COLUMN_NAME = 'offer_details_json'
);
PREPARE add_offer_details_stmt FROM @add_offer_details;
EXECUTE add_offer_details_stmt;
DEALLOCATE PREPARE add_offer_details_stmt;

SET @add_candidate_response = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `offer_dispatches` ADD COLUMN `candidate_response_json` JSON NULL AFTER `candidate_comment`',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'offer_dispatches'
      AND COLUMN_NAME = 'candidate_response_json'
);
PREPARE add_candidate_response_stmt FROM @add_candidate_response;
EXECUTE add_candidate_response_stmt;
DEALLOCATE PREPARE add_candidate_response_stmt;

SET @add_viewed_at = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `offer_dispatches` ADD COLUMN `viewed_at` DATETIME(6) NULL AFTER `candidate_response_json`',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'offer_dispatches'
      AND COLUMN_NAME = 'viewed_at'
);
PREPARE add_viewed_at_stmt FROM @add_viewed_at;
EXECUTE add_viewed_at_stmt;
DEALLOCATE PREPARE add_viewed_at_stmt;

SET @add_view_count = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `offer_dispatches` ADD COLUMN `view_count` INT NOT NULL DEFAULT 0 AFTER `viewed_at`',
        'SELECT 1')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'offer_dispatches'
      AND COLUMN_NAME = 'view_count'
);
PREPARE add_view_count_stmt FROM @add_view_count;
EXECUTE add_view_count_stmt;
DEALLOCATE PREPARE add_view_count_stmt;

UPDATE `offer_dispatches` SET `view_count` = 0 WHERE `view_count` IS NULL;

