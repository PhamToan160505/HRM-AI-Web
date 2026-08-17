package com.hrm.security;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Sinh và xác thực JWT.
 * JWT_SECRET bắt buộc từ biến môi trường — không hardcode.
 * Payload chứa: sub (userId), role, departmentId, hoTen theo SKILL_backend-patterns.md mục 3.
 */
@Component
@Slf4j
public class JwtUtil {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    private SecretKey getSigningKey() {
        byte[] keyBytes = Decoders.BASE64.decode(jwtSecret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Sinh JWT từ User entity — gọi sau khi xác thực thành công.
     */
    public String generateToken(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole().name());
        claims.put("departmentId", user.getDepartmentId());
        claims.put("hoTen", user.getHoTen());

        return Jwts.builder()
                .claims(claims)
                .subject(user.getId().toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(getSigningKey())
                .compact();
    }

    /**
     * Validate token — trả false nếu expired/invalid/tampered, không throw.
     */
    public boolean isValid(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }

    public Long getUserId(String token) {
        return Long.parseLong(parseClaims(token).getSubject());
    }

    public Role getRole(String token) {
        String roleStr = parseClaims(token).get("role", String.class);
        return Role.valueOf(roleStr);
    }

    public Long getDepartmentId(String token) {
        Object deptId = parseClaims(token).get("departmentId");
        if (deptId == null) return null;
        return ((Number) deptId).longValue();
    }

    public String getHoTen(String token) {
        return parseClaims(token).get("hoTen", String.class);
    }

    public String getEmail(String token) {
        // email không trong claims — chỉ userId; nếu cần email phải query DB
        // Dùng userId (sub) thay thế cho most use cases
        return parseClaims(token).getSubject();
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
