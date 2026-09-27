-- Keep the UUID textual representation while matching Hibernate's String type.
ALTER TABLE `outbox_events`
    MODIFY COLUMN `event_id` VARCHAR(36) NOT NULL;
