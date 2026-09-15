package com.hrm.admin.service;

import com.hrm.admin.entity.AccountCreationRequest;
import com.hrm.admin.repository.AccountCreationRequestRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.email.service.EmailService;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountCreationService {

    private final AccountCreationRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public List<AccountCreationRequest> getPendingRequests() {
        return requestRepository.findByStatus(AccountCreationRequest.RequestStatus.PENDING);
    }

    @Transactional
    public void approveRequest(Long requestId) {
        AccountCreationRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu tạo tài khoản"));

        if (request.getStatus() != AccountCreationRequest.RequestStatus.PENDING) {
            throw new AppException(HttpStatus.BAD_REQUEST, "Yêu cầu này đã được xử lý");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            request.setStatus(AccountCreationRequest.RequestStatus.REJECTED);
            requestRepository.save(request);
            throw new AppException(HttpStatus.BAD_REQUEST, "Email " + request.getEmail() + " đã tồn tại trong hệ thống");
        }

        // 1. Sinh mã nhân viên (8 số, format prefix + random)
        String maNhanVien = generateMaNhanVien(Role.NHAN_VIEN, request.getDepartmentId());

        // 2. Sinh mật khẩu ngẫu nhiên (8 ký tự)
        String rawPassword = generateRandomPassword(8);

        // 3. Tạo User
        User newUser = User.builder()
                .hoTen(request.getHoTen())
                .email(request.getEmail())
                .maNhanVien(maNhanVien)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(Role.NHAN_VIEN) // Mặc định là nhân viên, admin có thể đổi sau
                .departmentId(request.getDepartmentId())
                .chucVu(request.getChucVu())
                .active(true)
                .build();

        userRepository.save(newUser);

        // 4. Đánh dấu request là đã duyệt
        request.setStatus(AccountCreationRequest.RequestStatus.APPROVED);
        requestRepository.save(request);

        // 5. Gửi email
        emailService.sendAccountInfo(newUser.getEmail(), newUser.getHoTen(), maNhanVien, rawPassword);

        log.info("Đã tạo tài khoản thành công cho ứng viên {}: maNhanVien={}", request.getHoTen(), maNhanVien);
    }

    @Transactional
    public void rejectRequest(Long requestId) {
        AccountCreationRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new AppException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu"));
        
        request.setStatus(AccountCreationRequest.RequestStatus.REJECTED);
        requestRepository.save(request);
        log.info("Đã từ chối yêu cầu tạo tài khoản {}", requestId);
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

    private String generateRandomPassword(int length) {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
