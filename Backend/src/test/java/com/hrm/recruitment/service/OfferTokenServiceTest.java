package com.hrm.recruitment.service;

import com.hrm.exception.AppException;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class OfferTokenServiceTest {

    private final OfferTokenService service = new OfferTokenService(
            Base64.getEncoder().encodeToString("stage-four-test-secret-key-32-bytes".getBytes()));

    @Test
    void deterministicSignedTokenCanBeValidatedAndHashed() {
        String first = service.tokenFor("dispatch-key-1");
        String second = service.tokenFor("dispatch-key-1");

        assertEquals(first, second);
        assertEquals(service.hash(first), service.requireValidAndHash(first));
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = service.tokenFor("dispatch-key-1");
        String tampered = token.substring(0, token.length() - 1)
                + (token.endsWith("A") ? "B" : "A");

        assertThrows(AppException.class, () -> service.requireValidAndHash(tampered));
    }
}
