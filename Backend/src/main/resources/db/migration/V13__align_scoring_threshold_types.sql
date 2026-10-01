-- The evidence grading algorithm compares score thresholds as BigDecimal values.
-- V4 seeded these two thresholds as INTEGER, which made runtime type validation fail.
-- Temporarily remove the immutability guard so this corrective migration can fix
-- the original seed metadata, then restore the guard immediately afterwards.
DROP TRIGGER IF EXISTS `trg_scoring_parameters_no_update`;

UPDATE `scoring_parameters`
SET `value_type` = 'DECIMAL'
WHERE `parameter_key` IN (
    'scoring.evidence_grade.low_score_max',
    'scoring.evidence_grade.high_score_min'
)
  AND `value_type` <> 'DECIMAL';

CREATE TRIGGER `trg_scoring_parameters_no_update`
BEFORE UPDATE ON `scoring_parameters`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scoring parameters are immutable; create a new profile version';
