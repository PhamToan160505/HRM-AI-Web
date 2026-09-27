package com.hrm.recruitment.entity;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class OfferLifecycleTest {

    @Test
    void approvedOfferCanBeAcceptedButNotSubmittedAgain() {
        Offer offer = draft();
        offer.submit();
        offer.approve();
        offer.accept();

        assertEquals(OfferStatus.ACCEPTED, offer.getStatus());
        assertThrows(IllegalStateException.class, offer::submit);
    }

    @Test
    void returnedOfferBecomesSuperseded() {
        Offer offer = draft();
        offer.submit();
        offer.supersede();

        assertEquals(OfferStatus.SUPERSEDED, offer.getStatus());
    }

    @Test
    void approvedOfferCanBeCancelledBeforeDispatch() {
        Offer offer = draft();
        offer.submit();
        offer.approve();
        offer.cancel();

        assertEquals(OfferStatus.CANCELLED, offer.getStatus());
    }

    private Offer draft() {
        return Offer.draft(1L, 1, null, new BigDecimal("15000000"), "{}", 2,
                new BigDecimal("85"), LocalDate.now().plusMonths(1), "Terms", null,
                false, null, 2L);
    }
}
