package com.hrm.configuration.entity;

import com.hrm.exception.AppException;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ScoringProfileTest {

    @Test
    void draftCanBeActivatedAndRetired() {
        ScoringProfile profile = ScoringProfile.draft(
                "CV_EVIDENCE", 2, "Profile v2", LocalDateTime.now(), 1L, "Hiệu chỉnh trên tập CV");

        profile.activate(LocalDateTime.now());
        assertEquals(ScoringProfileStatus.ACTIVE, profile.getStatus());

        profile.retire();
        assertEquals(ScoringProfileStatus.RETIRED, profile.getStatus());
    }

    @Test
    void retiredProfileCannotBeActivatedAgain() {
        ScoringProfile profile = ScoringProfile.draft(
                "CV_EVIDENCE", 2, "Profile v2", LocalDateTime.now(), 1L, "Hiệu chỉnh trên tập CV");
        profile.activate(LocalDateTime.now());
        profile.retire();

        assertThrows(AppException.class, () -> profile.activate(LocalDateTime.now()));
    }

    @Test
    void versionReasonIsRequired() {
        assertThrows(AppException.class, () -> ScoringProfile.draft(
                "CV_EVIDENCE", 2, "Profile v2", LocalDateTime.now(), 1L, " "));
    }
}
