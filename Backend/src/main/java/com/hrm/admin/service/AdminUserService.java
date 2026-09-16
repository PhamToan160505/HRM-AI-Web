package com.hrm.admin.service;

import com.hrm.admin.dto.CreateUserRequest;
import com.hrm.admin.dto.UpdateUserRequest;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.chat.service.ChatGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import com.hrm.common.entity.Role;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.hrm.admin.repository.AccountCreationRequestRepository accountCreationRequestRepository;
    private final ChatGroupService chatGroupService;

    public Page<User> getAllUsers(int page, int size, Role role, Long departmentId) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        
        // Cần truy vấn tất cả vai trò nên danh sách roles truyền vào là tất cả các enum Role
        List<Role> allRoles = List.of(Role.values());
        
        return userRepository.findWithFilters(allRoles, departmentId, role, null, pageable);
    }

    public User createUser(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email đã tồn tại trong hệ thống");
        }
        
        String maNhanVien = generateMaNhanVien(request.getDepartmentId());

        User user = User.builder()
                .hoTen(request.getHoTen())
                .email(request.getEmail())
                .maNhanVien(maNhanVien)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .departmentId(request.getDepartmentId())
                .chucVu(request.getChucVu())
                .active(true)
                .build();

        User savedUser = userRepository.save(user);
        
        chatGroupService.handleNewUser(savedUser);

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

    private String generateMaNhanVien(Long departmentId) {
        String companyCode = "23";
        String deptCode = String.format("%02d", departmentId != null ? departmentId : 99);
        String prefix = companyCode + deptCode;
        
        String maxMaNhanVien = userRepository.findMaxMaNhanVienByPrefix(prefix);
        if (maxMaNhanVien == null || maxMaNhanVien.length() < 8) {
            return prefix + "0001";
        }
        
        try {
            int currentSequence = Integer.parseInt(maxMaNhanVien.substring(4));
            return prefix + String.format("%04d", currentSequence + 1);
        } catch (NumberFormatException e) {
            return prefix + "0001";
        }
    }
}
