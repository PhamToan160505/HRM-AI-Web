package com.hrm.employee.controller;

import com.hrm.ai.service.AiPerformanceReviewService;
import com.hrm.employee.entity.PerformanceReview;
import com.hrm.employee.repository.PerformanceReviewRepository;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class PerformanceReviewController {

    private final PerformanceReviewRepository performanceReviewRepository;
    private final AiPerformanceReviewService aiPerformanceReviewService;
    private final UserRepository userRepository;

    @GetMapping("/{employeeId}/performance-reviews")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<PerformanceReview>>> getReviews(
            @PathVariable Long employeeId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails principal) {
        
        verifyManagerAccess(employeeId, principal);
        
        List<PerformanceReview> reviews = performanceReviewRepository.findByEmployeeIdOrderByNamDescThangDesc(employeeId);
        return ResponseEntity.ok(ApiResponse.ok(reviews, "Lấy danh sách đánh giá thành công"));
    }

    @PostMapping("/{employeeId}/performance-reviews/generate")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC_PHONG_BAN', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<PerformanceReview>> generateReview(
            @PathVariable Long employeeId,
            @RequestBody Map<String, Integer> request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.hrm.security.CustomUserDetails principal) {
        
        verifyManagerAccess(employeeId, principal);
        
        Integer thang = request.get("thang");
        Integer nam = request.get("nam");
        
        if (thang == null || nam == null) {
            throw new RuntimeException("Thiếu thông tin tháng/năm");
        }

        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên"));
                
        if (employee.getCreatedAt() != null) {
            int createdYear = employee.getCreatedAt().getYear();
            int createdMonth = employee.getCreatedAt().getMonthValue();
            
            if (nam < createdYear || (nam == createdYear && thang < createdMonth)) {
                throw new RuntimeException("Không thể đánh giá nhân viên trước thời điểm tạo tài khoản (" + createdMonth + "/" + createdYear + ")");
            }
        }

        PerformanceReview review = aiPerformanceReviewService.generateReview(employeeId, thang, nam);
        return ResponseEntity.ok(ApiResponse.ok(review, "Tạo đánh giá AI thành công"));
    }
    
    private void verifyManagerAccess(Long employeeId, com.hrm.security.CustomUserDetails principal) {
        if (principal.getRole().name().equals("CEO") || principal.getRole().name().equals("ADMIN")) {
            return;
        }
        
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên"));
                
        if (principal.getRole().name().equals("TRUONG_PHONG") || principal.getRole().name().equals("GIAM_DOC_PHONG_BAN")) {
            if (employee.getDepartmentId() == null || !employee.getDepartmentId().equals(principal.getDepartmentId())) {
                throw new RuntimeException("403: Bạn chỉ được phép đánh giá nhân viên trong phòng ban của mình");
            }
        }
    }
}
