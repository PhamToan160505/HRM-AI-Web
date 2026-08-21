package com.hrm.common.controller;

import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.service.CloudinaryService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeManagementController {

    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<User>>> getAllEmployees() {
        // Chỉ lấy nhân viên (những user có role = NHAN_VIEN), tránh hiển thị sếp hoặc chính mình
        List<User> employees = userRepository.findByRole(com.hrm.common.entity.Role.NHAN_VIEN);
        return ResponseEntity.ok(ApiResponse.ok(employees, "Thành công"));
    }

    @PutMapping("/{id}/assignment")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<User>> updateAssignment(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (user.getRole() != com.hrm.common.entity.Role.NHAN_VIEN) {
            throw new RuntimeException("403: Không thể phân công cho tài khoản cấp cao hơn hoặc ngang cấp");
        }
        
        if (request.containsKey("departmentId")) {
            Object depId = request.get("departmentId");
            if (depId != null) {
                user.setDepartmentId(Long.valueOf(depId.toString()));
            } else {
                user.setDepartmentId(null);
            }
        }
        
        if (request.containsKey("chucVu")) {
            Object chucVu = request.get("chucVu");
            user.setChucVu(chucVu != null ? chucVu.toString() : null);
        }
        
        if (request.containsKey("baseSalary")) {
            Object bs = request.get("baseSalary");
            user.setBaseSalary(bs != null && !bs.toString().isEmpty() ? Double.valueOf(bs.toString()) : null);
        }
        
        if (request.containsKey("allowance")) {
            Object al = request.get("allowance");
            user.setAllowance(al != null && !al.toString().isEmpty() ? Double.valueOf(al.toString()) : null);
        }
        
        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok(savedUser, "Cập nhật chức vụ & phòng ban thành công"));
    }

    @GetMapping("/{id}/cccd-image-url")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, String>>> getCccdImageUrl(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        // Kiểm tra quyền: CHỈ chính chủ HOẶC (Trưởng phòng/Giám đốc) mới được xem
        boolean isOwner = id.equals(userDetails.getUserId());
        boolean isManager = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TRUONG_PHONG") || a.getAuthority().equals("ROLE_GIAM_DOC"));
                
        if (!isOwner && !isManager) {
            throw new RuntimeException("Bạn không có quyền xem ảnh CCCD này");
        }
        
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
                
        String frontUrl = cloudinaryService.generateSignedUrl(user.getCccdFrontPublicId());
        String backUrl = cloudinaryService.generateSignedUrl(user.getCccdBackPublicId());
        
        return ResponseEntity.ok(ApiResponse.ok(Map.of("frontUrl", frontUrl != null ? frontUrl : "", "backUrl", backUrl != null ? backUrl : ""), "Lấy link ảnh CCCD thành công"));
    }
}
