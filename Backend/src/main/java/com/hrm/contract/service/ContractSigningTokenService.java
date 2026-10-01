package com.hrm.contract.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

@Component
public class ContractSigningTokenService {

    private final byte[] secret;
    private final SecureRandom random = new SecureRandom();

    public ContractSigningTokenService(
            @Value("${app.jwt.secret:c3VwZXItc2VjcmV0LWtleS1kZXZlbG9wbWVudC1vbmx5LWhybS1haQ==}") String base64Secret) {
        byte[] resolved;
        try {
            resolved = Base64.getDecoder().decode(base64Secret);
        } catch (IllegalArgumentException ignored) {
            // Tương thích môi trường hiện hữu dùng secret chuỗi thay vì Base64.
            resolved = base64Secret.getBytes(StandardCharsets.UTF_8);
        }
        if (resolved.length < 32) {
            try {
                resolved = MessageDigest.getInstance("SHA-256").digest(resolved);
            } catch (Exception exception) {
                throw new IllegalStateException("Không thể chuẩn hóa secret ký", exception);
            }
        }
        this.secret = resolved;
    }

    public String newToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String newVerificationProof() {
        return newToken();
    }

    public String newOtp() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    public String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(secret);
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể băm dữ liệu ký", exception);
        }
    }

    public boolean matches(String value, String expectedHash) {
        if (value == null || expectedHash == null) return false;
        return MessageDigest.isEqual(hash(value).getBytes(StandardCharsets.US_ASCII),
                expectedHash.getBytes(StandardCharsets.US_ASCII));
    }

    public String webhookSignature(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể xác thực webhook", exception);
        }
    }
}
