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

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@RequiredArgsConstructor
public class DepartmentController {

    private final DepartmentRepository departmentRepository;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<Department>>> getAllDepartments() {
        List<Department> departments = departmentRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(departments, "Thành công"));
    }
}
