-- Existing records predate the append-only audit timeline. Record their current
-- state as an explicit baseline without inventing historical actors or actions.

INSERT INTO `application_transition_logs` (
    `entity_type`, `entity_id`, `actor_id`, `actor_role`, `action`,
    `from_status`, `to_status`, `comment`, `request_id`, `idempotency_key`, `occurred_at`
)
SELECT
    'APPLICATION', `id`, NULL, 'MIGRATION', 'LEGACY_BASELINE',
    NULL, `approval_status`, 'Trạng thái tại thời điểm đưa dữ liệu cũ vào state machine V2.2',
    NULL, CONCAT('legacy-baseline:APPLICATION:', `id`), CURRENT_TIMESTAMP(6)
FROM `applications`;

INSERT INTO `application_transition_logs` (
    `entity_type`, `entity_id`, `actor_id`, `actor_role`, `action`,
    `from_status`, `to_status`, `comment`, `request_id`, `idempotency_key`, `occurred_at`
)
SELECT
    'JOB_REQUISITION', `id`, NULL, 'MIGRATION', 'LEGACY_BASELINE',
    NULL, `status`, 'Trạng thái tại thời điểm đưa dữ liệu cũ vào state machine V2.2',
    NULL, CONCAT('legacy-baseline:JOB_REQUISITION:', `id`), CURRENT_TIMESTAMP(6)
FROM `job_requisitions`;

INSERT INTO `application_transition_logs` (
    `entity_type`, `entity_id`, `actor_id`, `actor_role`, `action`,
    `from_status`, `to_status`, `comment`, `request_id`, `idempotency_key`, `occurred_at`
)
SELECT
    'JOB_POSTING', `id`, NULL, 'MIGRATION', 'LEGACY_BASELINE',
    NULL, `status`, 'Trạng thái tại thời điểm đưa dữ liệu cũ vào state machine V2.2',
    NULL, CONCAT('legacy-baseline:JOB_POSTING:', `id`), CURRENT_TIMESTAMP(6)
FROM `job_postings`;
