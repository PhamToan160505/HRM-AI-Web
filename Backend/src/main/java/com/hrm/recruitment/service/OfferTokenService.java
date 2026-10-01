package com.hrm.recruitment.service;

import com.hrm.exception.AppException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;

@Component
public class OfferTokenService {

    private final byte[] secret;

    public OfferTokenService(@Value("${app.jwt.secret:c3VwZXItc2VjcmV0LWtleS1kZXZlbG9wbWVudC1vbmx5LWhybS1haQ==}") String base64Secret) {
        this.secret = Base64.getDecoder().decode(base64Secret);
    }

    public String tokenFor(String dispatchKey) {
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmac("offer-dispatch:" + dispatchKey));
        String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmac("offer-response:" + payload));
        return payload + "." + signature;
    }

    public String requireValidAndHash(String token) {
        if (token == null || token.isBlank()) {
            throw AppException.badRequest("Token offer là bắt buộc");
        }
        String[] parts = token.split("\\.", -1);
        if (parts.length != 2) {
            throw AppException.forbidden("Token offer không hợp lệ");
        }
        String expected = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmac("offer-response:" + parts[0]));
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                parts[1].getBytes(StandardCharsets.US_ASCII))) {
            throw AppException.forbidden("Token offer không hợp lệ");
        }
        return hash(token);
    }

    public String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("JVM không hỗ trợ SHA-256", exception);
        }
    }

    private byte[] hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể ký token offer", exception);
        }
    }
}
