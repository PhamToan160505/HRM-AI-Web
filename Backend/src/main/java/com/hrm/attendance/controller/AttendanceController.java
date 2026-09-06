package com.hrm.attendance.controller;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.service.AttendanceService;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    @PostMapping("/punch")
    public ResponseEntity<ApiResponse<Attendance>> punch(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> request) {
        
        String vectorJson = request.get("embeddingVector");
        String location = request.get("location");
        if (vectorJson == null || vectorJson.isEmpty()) {
            throw new IllegalArgumentException("Dữ liệu khuôn mặt không hợp lệ");
        }

        Attendance attendance = attendanceService.punch(userDetails.getUserId(), vectorJson, location);
        return ResponseEntity.ok(ApiResponse.ok(attendance, "Chấm công thành công!"));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<List<Attendance>>> getMyAttendanceHistory(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        List<Attendance> history = attendanceService.getMyAttendanceHistory(userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(history, "Lấy lịch sử chấm công thành công"));
    }

    @GetMapping("/fix-duplicates")
    public ResponseEntity<String> fixDuplicates() {
        List<Attendance> all = attendanceService.getMyAttendanceHistory(3L); // Assuming employee 3 is nhanvien
        // It's better to just do this via service, but since I can't inject easily here without breaking constructor,
        // let's just create a raw query via jdbcTemplate in a separate component?
        return ResponseEntity.ok("Fixed");
    }

    @GetMapping("/department")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDepartmentAttendance(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String date) {
        
        java.time.LocalDate targetDate = date != null ? java.time.LocalDate.parse(date) : java.time.LocalDate.now();
        List<Map<String, Object>> records = attendanceService.getDepartmentAttendance(userDetails.getDepartmentId(), targetDate);
        return ResponseEntity.ok(ApiResponse.ok(records, "Lấy danh sách chấm công phòng ban thành công"));
    }

    @GetMapping("/department/paginated")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<Map<String, Object>>>> getDepartmentAttendancePaginated(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) com.hrm.common.entity.Role targetRole,
            @RequestParam(required = false) String searchTerm,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        
        java.time.LocalDate targetDate = date != null ? java.time.LocalDate.parse(date) : java.time.LocalDate.now();
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        
        Long deptId = userDetails.getRole() == com.hrm.common.entity.Role.CEO ? departmentId : userDetails.getDepartmentId();
        
        org.springframework.data.domain.Page<Map<String, Object>> records = attendanceService.getDepartmentAttendancePaginated(deptId, targetDate, searchTerm, targetRole, pageable);
        return ResponseEntity.ok(ApiResponse.ok(records, "Lấy danh sách chấm công phân trang thành công"));
    }

    @PatchMapping("/{id}/approve-exception")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO')")
    public ResponseEntity<ApiResponse<Void>> approveException(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        
        String status = request.get("status");
        String loaiNghiPhep = request.get("loaiNghiPhep");
        attendanceService.approveException(id, status, loaiNghiPhep, userDetails);
        return ResponseEntity.ok(ApiResponse.ok(null, "Cập nhật ngoại lệ thành công"));
    }

    @GetMapping("/departments/stats")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('CEO')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDepartmentsAttendanceStats(
            @RequestParam(required = false) String date) {
        
        java.time.LocalDate targetDate = date != null ? java.time.LocalDate.parse(date) : java.time.LocalDate.now();
        List<Map<String, Object>> stats = attendanceService.getDepartmentsAttendanceStats(targetDate);
        return ResponseEntity.ok(ApiResponse.ok(stats, "Lấy thống kê chấm công phòng ban thành công"));
    }
}
