package com.hrm.auth.service;

import com.hrm.auth.dto.ChangePasswordRequest;
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
import org.springframework.transaction.annotation.Transactional;

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
                .mustChangePassword(Boolean.TRUE.equals(user.getMustChangePassword()))
                .build();
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài khoản người dùng"));

        if (!Boolean.TRUE.equals(user.getActive())) {
            throw new AppException(HttpStatus.FORBIDDEN, "Tài khoản đã bị vô hiệu hóa");
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw AppException.badRequest("Mật khẩu hiện tại không chính xác");
        }

        String newPass = request.getNewPassword().trim();
        if (!newPass.equals(request.getConfirmPassword().trim())) {
            throw AppException.badRequest("Xác nhận mật khẩu mới không khớp");
        }

        if (newPass.length() < 8) {
            throw AppException.badRequest("Mật khẩu mới phải có ít nhất 8 ký tự");
        }

        boolean hasLetter = newPass.chars().anyMatch(Character::isLetter);
        boolean hasDigit = newPass.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw AppException.badRequest("Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số");
        }

        if (passwordEncoder.matches(newPass, user.getPasswordHash())) {
            throw AppException.badRequest("Mật khẩu mới không được trùng với mật khẩu hiện tại");
        }

        user.setPasswordHash(passwordEncoder.encode(newPass));
        user.setMustChangePassword(false);
        userRepository.save(user);
        log.info("Password changed successfully for userId={}", userId);
    }
}
