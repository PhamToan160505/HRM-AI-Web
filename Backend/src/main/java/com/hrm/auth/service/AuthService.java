package com.hrm.auth.service;

import com.hrm.auth.dto.LoginRequest;
import com.hrm.auth.dto.LoginResponse;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
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
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        // Tìm user theo mã nhân viên
        User user = userRepository.findByMaNhanVien(request.getMaNhanVien()).orElse(null);
        
        if (user == null) {
            throw new AppException(HttpStatus.UNAUTHORIZED, "Tài khoản hoặc mật khẩu không đúng");
        }

        // Kiểm tra tài khoản còn hoạt động
        if (!user.getActive()) {
            throw new AppException(HttpStatus.UNAUTHORIZED,
                    "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.");
        }

        // BCrypt verify — không tự viết hàm hash
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.debug("Password mismatch for maNhanVien: {}", request.getMaNhanVien());
            throw new AppException(HttpStatus.UNAUTHORIZED,
                    "Mã nhân viên hoặc mật khẩu không đúng");
        }

        String token = jwtUtil.generateToken(user);

        log.info("Login success: userId={}, role={}", user.getId(), user.getRole());

        String tenPhong = null;
        if (user.getDepartmentId() != null) {
            tenPhong = departmentRepository.findById(user.getDepartmentId())
                    .map(dept -> dept.getTenPhong())
                    .orElse(null);
        }

        return LoginResponse.builder()
                .token(token)
                .userId(user.getId())
                .hoTen(user.getHoTen())
                .role(user.getRole())
                .departmentId(user.getDepartmentId())
                .tenPhong(tenPhong)
                .teamId(user.getTeamId())
                .build();
    }
}
