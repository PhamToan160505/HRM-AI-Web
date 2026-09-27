package com.hrm.ai.entity;

public enum AiAnalysisStatus {
    NOT_RUN,
    QUEUED,
    RUNNING,
    DONE,
    FAILED,
    NEEDS_MANUAL_REVIEW,
    SKIPPED_NO_CONSENT
}
