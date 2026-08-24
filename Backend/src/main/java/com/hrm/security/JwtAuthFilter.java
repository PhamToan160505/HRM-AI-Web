package com.hrm.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Tương đương verifyToken middleware cũ — theo SKILL_backend-patterns.md mục 3.
 *
 * Luồng: extract Bearer token → validate → parse claims → set Authentication vào
 * SecurityContextHolder. Nếu token vắng/không hợp lệ: bỏ qua, để SecurityConfig
 * reject request (trả 401) — không throw exception ở đây tránh lộ thông tin.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);

        if (StringUtils.hasText(token) && jwtUtil.isValid(token)) {
            try {
                // Parse tất cả claims từ JWT — KHÔNG query DB, không tin client
                CustomUserDetails userDetails = new CustomUserDetails(
                        jwtUtil.getUserId(token),
                        null,                        // email không cần trong filter
                        jwtUtil.getRole(token),
                        jwtUtil.getDepartmentId(token),
                        jwtUtil.getTeamId(token),
                        jwtUtil.getHoTen(token)
                );

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request)
                );

                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (Exception e) {
                // Không leak lỗi — chỉ log debug, để filter chain xử lý tiếp
                log.debug("Could not set user authentication: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
