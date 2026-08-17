package com.hrm.auth.service;

import com.hrm.auth.dto.LoginRequest;
import com.hrm.auth.dto.LoginResponse;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Logic đăng nhập — xác thực email/password, sinh JWT.
 * Không bao giờ trả thông tin phân biệt "email sai" vs "password sai"
 * để tránh user enumeration attack.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        // Tìm user theo email — Spring Data tự parameterize, không nối chuỗi SQL
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new AppException(HttpStatus.UNAUTHORIZED,
                        "Email hoặc mật khẩu không đúng"));

        // Kiểm tra tài khoản còn hoạt động
        if (!user.getActive()) {
            throw new AppException(HttpStatus.UNAUTHORIZED,
                    "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
        }

        // BCrypt verify — không tự viết hàm hash
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.debug("Password mismatch for email: {}", request.getEmail());
            throw new AppException(HttpStatus.UNAUTHORIZED,
                    "Email hoặc mật khẩu không đúng");
        }

        String token = jwtUtil.generateToken(user);

        log.info("Login success: userId={}, role={}", user.getId(), user.getRole());

        return LoginResponse.builder()
                .token(token)
                .userId(user.getId())
                .hoTen(user.getHoTen())
                .role(user.getRole())
                .departmentId(user.getDepartmentId())
                .build();
    }
}
