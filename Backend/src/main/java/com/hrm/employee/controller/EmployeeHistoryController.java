package com.hrm.employee.controller;

import com.hrm.employee.entity.EmployeeHistory;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeHistoryController {

    private final EmployeeHistoryService employeeHistoryService;

    @GetMapping("/{employeeId}/history")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<EmployeeHistory>>> getHistory(@PathVariable Long employeeId) {
        List<EmployeeHistory> historyList = employeeHistoryService.getEmployeeHistory(employeeId);
        return ResponseEntity.ok(ApiResponse.ok(historyList, "Lấy lịch sử vòng đời nhân sự thành công"));
    }
}
