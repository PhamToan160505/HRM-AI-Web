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
    private final com.hrm.common.payroll.repository.SalaryHistoryRepository salaryHistoryRepository;

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
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
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
        
        Double oldBaseSalary = user.getBaseSalary();
        Double oldAllowance = user.getAllowance();
        boolean salaryChanged = false;

        if (request.containsKey("baseSalary")) {
            Object bs = request.get("baseSalary");
            Double newBs = bs != null && !bs.toString().isEmpty() ? Double.valueOf(bs.toString()) : null;
            if ((oldBaseSalary == null && newBs != null) || (oldBaseSalary != null && !oldBaseSalary.equals(newBs))) {
                user.setBaseSalary(newBs);
                salaryChanged = true;
            }
        }
        
        if (request.containsKey("allowance")) {
            Object al = request.get("allowance");
            Double newAl = al != null && !al.toString().isEmpty() ? Double.valueOf(al.toString()) : null;
            if ((oldAllowance == null && newAl != null) || (oldAllowance != null && !oldAllowance.equals(newAl))) {
                user.setAllowance(newAl);
                salaryChanged = true;
            }
        }
        
        User savedUser = userRepository.save(user);

        if (salaryChanged) {
            String reason = request.containsKey("reason") && request.get("reason") != null ? request.get("reason").toString() : "Cập nhật lương cơ bản/phụ cấp";
            com.hrm.common.payroll.entity.SalaryHistory history = com.hrm.common.payroll.entity.SalaryHistory.builder()
                    .employeeId(savedUser.getId())
                    .changedBy(userDetails.getUserId())
                    .oldBaseSalary(oldBaseSalary)
                    .newBaseSalary(savedUser.getBaseSalary())
                    .oldAllowance(oldAllowance)
                    .newAllowance(savedUser.getAllowance())
                    .reason(reason)
                    .changeDate(java.time.LocalDateTime.now())
                    .build();
            salaryHistoryRepository.save(history);
        }

        return ResponseEntity.ok(ApiResponse.ok(savedUser, "Cập nhật thành công"));
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
    @GetMapping("/salary-history")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getSalaryHistory(@AuthenticationPrincipal CustomUserDetails currentUser) {
        List<com.hrm.common.payroll.entity.SalaryHistory> histories;
        if ("GIAM_DOC".equals(currentUser.getRole().name())) {
            histories = salaryHistoryRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "changeDate"));
        } else {
            List<User> emps = userRepository.findByDepartmentId(currentUser.getDepartmentId());
            List<Long> empIds = emps.stream().map(User::getId).toList();
            if (empIds.isEmpty()) {
                histories = new java.util.ArrayList<>();
            } else {
                histories = salaryHistoryRepository.findByEmployeeIdInOrderByChangeDateDesc(empIds);
            }
        }

        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (com.hrm.common.payroll.entity.SalaryHistory h : histories) {
            User emp = userRepository.findById(h.getEmployeeId()).orElse(null);
            User changer = userRepository.findById(h.getChangedBy()).orElse(null);
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", h.getId());
            map.put("employeeName", emp != null ? emp.getHoTen() : "Unknown");
            map.put("employeeId", h.getEmployeeId());
            map.put("changedByName", changer != null ? changer.getHoTen() : "System");
            map.put("oldBaseSalary", h.getOldBaseSalary());
            map.put("newBaseSalary", h.getNewBaseSalary());
            map.put("oldAllowance", h.getOldAllowance());
            map.put("newAllowance", h.getNewAllowance());
            map.put("reason", h.getReason());
            map.put("changeDate", h.getChangeDate());
            result.add(map);
        }

        return ResponseEntity.ok(ApiResponse.ok(result, "Lấy lịch sử thay đổi lương thành công"));
    }
}
