package com.hrm.admin.service;

import com.hrm.admin.dto.CreateUserRequest;
import com.hrm.admin.dto.UpdateUserRequest;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email đã tồn tại trong hệ thống");
        }

        User user = User.builder()
                .hoTen(request.getHoTen())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .departmentId(request.getDepartmentId())
                .chucVu(request.getChucVu())
                .active(true)
                .build();

        return userRepository.save(user);
    }

    public User updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        if (request.getHoTen() != null) user.setHoTen(request.getHoTen());
        if (request.getRole() != null) user.setRole(request.getRole());
        
        // Cập nhật phòng ban, chú ý null cho các role không cần phòng
        user.setDepartmentId(request.getDepartmentId());
        
        if (request.getChucVu() != null) user.setChucVu(request.getChucVu());
        if (request.getActive() != null) user.setActive(request.getActive());

        return userRepository.save(user);
    }

    public User resetPassword(Long id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }
}
