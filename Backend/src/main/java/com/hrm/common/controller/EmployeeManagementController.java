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
    private final com.hrm.employee.service.EmployeeHistoryService employeeHistoryService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<List<User>>> getAllEmployees(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<User> employees = new java.util.ArrayList<>();
        
        if (userDetails.getRole() == com.hrm.common.entity.Role.CEO) {
            employees = userRepository.findByRoleIn(java.util.List.of(
                com.hrm.common.entity.Role.NHAN_VIEN,
                com.hrm.common.entity.Role.TRUONG_PHONG,
                com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN
            ));
        } else if (userDetails.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            List<User> deptUsers = userRepository.findByDepartmentId(userDetails.getDepartmentId());
            employees = deptUsers.stream().filter(u -> u.getRole() == com.hrm.common.entity.Role.NHAN_VIEN || u.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG).toList();
        } else if (userDetails.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            List<User> deptUsers = userRepository.findByDepartmentId(userDetails.getDepartmentId());
            employees = deptUsers.stream().filter(u -> u.getRole() == com.hrm.common.entity.Role.NHAN_VIEN).toList();
        }
        
        return ResponseEntity.ok(ApiResponse.ok(employees, "Thành công"));
    }

    @GetMapping("/paginated")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<User>>> getEmployeesPaginated(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) com.hrm.common.entity.Role targetRole,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        org.springframework.data.domain.Page<User> employeePage = null;

        if (userDetails.getRole() == com.hrm.common.entity.Role.CEO) {
            employeePage = userRepository.findWithFilters(java.util.List.of(
                com.hrm.common.entity.Role.NHAN_VIEN,
                com.hrm.common.entity.Role.TRUONG_PHONG,
                com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN
            ), departmentId, targetRole, searchTerm, pageable);
        } else if (userDetails.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            employeePage = userRepository.findWithFilters(java.util.List.of(
                com.hrm.common.entity.Role.NHAN_VIEN,
                com.hrm.common.entity.Role.TRUONG_PHONG
            ), userDetails.getDepartmentId(), targetRole, searchTerm, pageable);
        } else if (userDetails.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            employeePage = userRepository.findWithFilters(java.util.List.of(
                com.hrm.common.entity.Role.NHAN_VIEN
            ), userDetails.getDepartmentId(), targetRole, searchTerm, pageable);
        }
        
        return ResponseEntity.ok(ApiResponse.ok(employeePage, "Thành công"));
    }

    @PutMapping("/{id}/assignment")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<User>> updateAssignment(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        if (user.getRole() != com.hrm.common.entity.Role.NHAN_VIEN) {
            throw new RuntimeException("403: Không thể phân công cho tài khoản cấp cao hơn hoặc ngang cấp");
        }
        
        // Kiểm tra phạm vi dữ liệu
        if ((userDetails.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN || userDetails.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) 
                && !user.getDepartmentId().equals(userDetails.getDepartmentId())) {
            throw new RuntimeException("403: Không có quyền thao tác nhân viên ngoài phòng ban");
        }
        
        if (request.containsKey("departmentId")) {
            if (userDetails.getRole() != com.hrm.common.entity.Role.CEO) {
                throw new RuntimeException("403: Chỉ Tổng giám đốc mới có quyền chuyển phòng ban cho nhân viên");
            }
            Object depId = request.get("departmentId");
            if (depId != null) {
                user.setDepartmentId(Long.valueOf(depId.toString()));
                employeeHistoryService.logHistory(user.getId(), "TRANSFERRED", null, "Phòng ban ID: " + user.getDepartmentId(), "Chuyển phòng ban");
            } else {
                user.setDepartmentId(null);
                employeeHistoryService.logHistory(user.getId(), "TRANSFERRED", null, "Không có", "Xóa khỏi phòng ban");
            }
        }
        
        if (request.containsKey("chucVu")) {
            Object chucVu = request.get("chucVu");
            String cvString = chucVu != null ? chucVu.toString().trim() : null;
            if (cvString != null && cvString.isEmpty()) {
                throw new RuntimeException("400: Chức vụ không được để trống");
            }
            if (cvString != null && cvString.length() > 100) {
                throw new RuntimeException("400: Chức vụ không được vượt quá 100 ký tự");
            }
            String oldChucVu = user.getChucVu();
            user.setChucVu(cvString);
            if (oldChucVu == null || !oldChucVu.equals(cvString)) {
                employeeHistoryService.logHistory(user.getId(), "PROMOTED", oldChucVu, cvString, "Thay đổi chức vụ");
            }
        }
        
        Double oldBaseSalary = user.getBaseSalary();
        Double oldAllowance = user.getAllowance();
        boolean salaryChanged = false;

        if (request.containsKey("baseSalary")) {
            Object bs = request.get("baseSalary");
            Double newBs = bs != null && !bs.toString().isEmpty() ? Double.valueOf(bs.toString()) : null;
            if (newBs != null && newBs < 0) {
                throw new RuntimeException("400: Lương cơ bản không được là số âm");
            }
            if ((oldBaseSalary == null && newBs != null) || (oldBaseSalary != null && !oldBaseSalary.equals(newBs))) {
                user.setBaseSalary(newBs);
                salaryChanged = true;
            }
        }
        
        if (request.containsKey("allowance")) {
            Object al = request.get("allowance");
            Double newAl = al != null && !al.toString().isEmpty() ? Double.valueOf(al.toString()) : null;
            if (newAl != null && newAl < 0) {
                throw new RuntimeException("400: Phụ cấp không được là số âm");
            }
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
            
            String oldSal = String.format("Lương CB: %.0f, Phụ cấp: %.0f", oldBaseSalary != null ? oldBaseSalary : 0, oldAllowance != null ? oldAllowance : 0);
            String newSal = String.format("Lương CB: %.0f, Phụ cấp: %.0f", savedUser.getBaseSalary() != null ? savedUser.getBaseSalary() : 0, savedUser.getAllowance() != null ? savedUser.getAllowance() : 0);
            employeeHistoryService.logHistory(savedUser.getId(), "SALARY_CHANGED", oldSal, newSal, reason);
        }

        return ResponseEntity.ok(ApiResponse.ok(savedUser, "Cập nhật thành công"));
    }

    @GetMapping("/{id}/cccd-image-url")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Map<String, String>>> getCccdImageUrl(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        boolean isOwner = id.equals(userDetails.getUserId());
        boolean isManager = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TRUONG_PHONG") || a.getAuthority().equals("ROLE_GIAM_DOC_PHONG_BAN") || a.getAuthority().equals("ROLE_CEO"));
                
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
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getSalaryHistory(@AuthenticationPrincipal CustomUserDetails currentUser) {
        List<com.hrm.common.payroll.entity.SalaryHistory> histories;
        if ("CEO".equals(currentUser.getRole().name())) {
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
