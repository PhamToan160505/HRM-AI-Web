package com.hrm.contract.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ContractSigningTokenServiceTest {

    private final ContractSigningTokenService service = new ContractSigningTokenService(
            "c3VwZXItc2VjcmV0LWtleS1kZXZlbG9wbWVudC1vbmx5LWhybS1haQ==");

    @Test
    void createsUnpredictableDistinctTokensAndVerifiableHashes() {
        String first = service.newToken();
        String second = service.newToken();

        assertNotEquals(first, second);
        assertTrue(first.length() >= 40);
        assertTrue(service.matches(first, service.hash(first)));
        assertFalse(service.matches(second, service.hash(first)));
    }

    @Test
    void otpAlwaysContainsSixDigits() {
        for (int index = 0; index < 50; index++) {
            assertTrue(service.newOtp().matches("\\d{6}"));
        }
    }

    @Test
    void acceptsExistingPlainTextSecrets() {
        ContractSigningTokenService plain = new ContractSigningTokenService(
                "plain-secret-with-$-and-special-characters");
        String token = plain.newToken();
        assertTrue(plain.matches(token, plain.hash(token)));
    }
}
