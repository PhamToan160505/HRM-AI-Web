package com.hrm.recruitment.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class OfferDispatchTrackingTest {

    @Test
    void recordsViewsWithoutChangingOfferLifecycleStatus() {
        OfferDispatch dispatch = OfferDispatch.active(
                10L, 20L, "dispatch-1", "a".repeat(64),
                LocalDateTime.now().plusDays(3), 1L, null);

        dispatch.markViewed();
        dispatch.markViewed();

        assertEquals(OfferDispatchStatus.ACTIVE, dispatch.getStatus());
        assertEquals(2, dispatch.getViewCount());
        assertNotNull(dispatch.getViewedAt());
    }

    @Test
    void keepsStructuredCandidateResponseWithNegotiation() {
        OfferDispatch dispatch = OfferDispatch.active(
                10L, 20L, "dispatch-2", "b".repeat(64),
                LocalDateTime.now().plusDays(3), 1L, null);

        dispatch.negotiate("Muốn trao đổi mức lương", "{\"topics\":[\"Lương\"]}");

        assertEquals(OfferDispatchStatus.NEGOTIATION_CLOSED, dispatch.getStatus());
        assertEquals("{\"topics\":[\"Lương\"]}", dispatch.getCandidateResponseJson());
    }
}
