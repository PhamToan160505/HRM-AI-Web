package com.hrm.recruitment.entity;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HiringSeatLifecycleTest {

    @Test
    void standardSeatReturnsToAvailableAfterRelease() {
        HiringSeat seat = HiringSeat.standard(1L, 1);
        seat.reserve(10L, 20L);
        seat.release();

        assertEquals(HiringSeatStatus.AVAILABLE, seat.getStatus());
        assertNull(seat.getApplicationId());
        assertNull(seat.getOfferId());
    }

    @Test
    void overbookSeatClosesAfterRelease() {
        HiringSeat seat = HiringSeat.overbook(1L, 2, 3L, "Offer dự phòng");
        seat.reserve(10L, 20L);
        seat.release();

        assertEquals(HiringSeatStatus.CLOSED, seat.getStatus());
    }

    @Test
    void seatCannotBeAcceptedByAnotherOffer() {
        HiringSeat seat = HiringSeat.standard(1L, 1);
        seat.reserve(10L, 20L);

        assertThrows(IllegalStateException.class, () -> seat.accept(10L, 21L));
        assertEquals(HiringSeatStatus.RESERVED, seat.getStatus());
    }

    @Test
    void acceptedSeatBecomesJoinedForTheSameApplication() {
        HiringSeat seat = HiringSeat.standard(1L, 1);
        seat.reserve(10L, 20L);
        seat.accept(10L, 20L);

        seat.join(10L);

        assertEquals(HiringSeatStatus.JOINED, seat.getStatus());
        assertThrows(IllegalStateException.class, () -> seat.release());
    }

    @Test
    void seatCannotJoinForAnotherApplication() {
        HiringSeat seat = HiringSeat.standard(1L, 1);
        seat.reserve(10L, 20L);
        seat.accept(10L, 20L);

        assertThrows(IllegalStateException.class, () -> seat.join(11L));
        assertEquals(HiringSeatStatus.ACCEPTED, seat.getStatus());
    }
}
