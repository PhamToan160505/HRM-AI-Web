package com.hrm;

import io.jsonwebtoken.io.Decoders;
import org.junit.jupiter.api.Test;

public class JwtTest {
    @Test
    public void test() {
        try {
            System.out.println("TEST_START");
            byte[] keyBytes = Decoders.BASE64.decode("my_super_secret_key_for_local_development");
            System.out.println("TEST_SUCCESS: " + keyBytes.length);
        } catch (Exception e) {
            System.out.println("TEST_EXCEPTION: " + e.getClass().getName() + " - " + e.getMessage());
        }
    }
}
