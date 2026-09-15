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
    private final com.hrm.admin.repository.AccountCreationRequestRepository accountCreationRequestRepository;
    private final com.hrm.employee.service.EmployeeHistoryService employeeHistoryService;
    private final com.hrm.email.service.EmailService emailService;

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email đã tồn tại trong hệ thống");
        }
        
        String maNhanVien = generateMaNhanVien(request.getRole(), request.getDepartmentId());

        String rawPassword = request.getPassword();
        if (rawPassword == null || rawPassword.trim().isEmpty()) {
            rawPassword = java.util.UUID.randomUUID().toString().substring(0, 8);
        }

        User user = User.builder()
                .hoTen(request.getHoTen())
                .email(request.getEmail())
                .maNhanVien(maNhanVien)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(request.getRole())
                .departmentId(request.getDepartmentId())
                .chucVu(request.getChucVu())
                .active(true)
                .build();

        User savedUser = userRepository.save(user);

        emailService.sendAccountInfo(savedUser.getEmail(), savedUser.getHoTen(), savedUser.getMaNhanVien(), rawPassword);

        if (request.getRequestId() != null) {
            accountCreationRequestRepository.findById(request.getRequestId()).ifPresent(req -> {
                req.setStatus(com.hrm.admin.entity.AccountCreationRequest.RequestStatus.APPROVED);
                accountCreationRequestRepository.save(req);
            });
        }

        return savedUser;
    }

    public User updateUser(Long id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        if (request.getHoTen() != null) user.setHoTen(request.getHoTen());
        if (request.getRole() != null) {
            if (user.getRole() != request.getRole()) {
                if (user.getRole() == com.hrm.common.entity.Role.ADMIN || user.getRole() == com.hrm.common.entity.Role.CEO) {
                    throw new RuntimeException("403: Không được phép thay đổi phân quyền của tài khoản ADMIN hoặc CEO");
                }
                employeeHistoryService.logHistory(user.getId(), "ROLE_CHANGED", user.getRole().name(), request.getRole().name(), "Thay đổi phân quyền");
                user.setRole(request.getRole());
            }
        }
        
        // Cập nhật phòng ban, chú ý null cho các role không cần phòng
        if ((user.getDepartmentId() == null && request.getDepartmentId() != null) ||
            (user.getDepartmentId() != null && !user.getDepartmentId().equals(request.getDepartmentId()))) {
            employeeHistoryService.logHistory(user.getId(), "TRANSFERRED", 
                    user.getDepartmentId() != null ? user.getDepartmentId().toString() : "None", 
                    request.getDepartmentId() != null ? request.getDepartmentId().toString() : "None", 
                    "Chuyển phòng ban (Admin)");
            user.setDepartmentId(request.getDepartmentId());
        }
        
        if (request.getChucVu() != null) {
            if (user.getChucVu() == null || !user.getChucVu().equals(request.getChucVu())) {
                employeeHistoryService.logHistory(user.getId(), "PROMOTED", user.getChucVu(), request.getChucVu(), "Thay đổi chức vụ (Admin)");
                user.setChucVu(request.getChucVu());
            }
        }
        
        if (request.getActive() != null) {
            if (user.getRole() == com.hrm.common.entity.Role.ADMIN && !request.getActive()) {
                throw new RuntimeException("403: Không được phép khóa tài khoản ADMIN");
            }
            user.setActive(request.getActive());
        }

        return userRepository.save(user);
    }

    public User resetPassword(Long id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
        
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }

    private String generateMaNhanVien(com.hrm.common.entity.Role role, Long departmentId) {
        String prefix;
        if (role == com.hrm.common.entity.Role.ADMIN || role == com.hrm.common.entity.Role.CEO) {
            prefix = "99";
        } else if (role == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            prefix = "88";
        } else {
            prefix = String.format("%02d", departmentId != null ? departmentId : 0);
        }
        
        String newMaNhanVien;
        java.util.Random random = new java.util.Random();
        do {
            int randomNum = 100000 + random.nextInt(900000);
            newMaNhanVien = prefix + String.valueOf(randomNum);
        } while (userRepository.findByMaNhanVien(newMaNhanVien).isPresent());
        
        return newMaNhanVien;
    }
}
