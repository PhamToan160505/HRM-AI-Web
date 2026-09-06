package com.hrm.common.controller;

import com.hrm.common.entity.Department;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hrm.common.repository.UserRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    public record DepartmentRequest(String tenPhong, String moTa) {}

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Department>>> getAllDepartments() {
        List<Department> departments = departmentRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(departments, "Thành công"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public ResponseEntity<ApiResponse<Department>> createDepartment(@RequestBody DepartmentRequest request) {
        Department dept = Department.builder()
                .tenPhong(request.tenPhong())
                .moTa(request.moTa())
                .isLock(false)
                .build();
        return ResponseEntity.ok(ApiResponse.ok(departmentRepository.save(dept), "Tạo phòng ban thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public ResponseEntity<ApiResponse<Department>> updateDepartment(@PathVariable Long id, @RequestBody DepartmentRequest request) {
        Optional<Department> deptOpt = departmentRepository.findById(id);
        if (deptOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Phòng ban không tồn tại"));
        }
        Department dept = deptOpt.get();
        dept.setTenPhong(request.tenPhong());
        dept.setMoTa(request.moTa());
        return ResponseEntity.ok(ApiResponse.ok(departmentRepository.save(dept), "Cập nhật phòng ban thành công"));
    }

    @PutMapping("/{id}/toggle-lock")
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public ResponseEntity<ApiResponse<Department>> toggleLockDepartment(@PathVariable Long id) {
        Optional<Department> deptOpt = departmentRepository.findById(id);
        if (deptOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Phòng ban không tồn tại"));
        }
        Department dept = deptOpt.get();
        
        // Nếu đang mở khóa và muốn khóa
        if (!dept.getIsLock()) {
            long activeUsersCount = userRepository.countByDepartmentIdAndActiveTrue(id);
            if (activeUsersCount > 0) {
                return ResponseEntity.badRequest().body(ApiResponse.error(
                    "Không thể khóa phòng ban này vì vẫn còn " + activeUsersCount + " nhân sự. Vui lòng chuyển công tác hoặc khóa các tài khoản này trước."));
            }
        }
        
        dept.setIsLock(!dept.getIsLock());
        return ResponseEntity.ok(ApiResponse.ok(departmentRepository.save(dept), 
                dept.getIsLock() ? "Đã khóa phòng ban" : "Đã mở khóa phòng ban"));
    }
}
