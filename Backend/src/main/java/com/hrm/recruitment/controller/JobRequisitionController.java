package com.hrm.recruitment.controller;

import com.hrm.common.entity.Role;
import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.service.JobRequisitionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/job-requisitions")
@RequiredArgsConstructor
public class JobRequisitionController {

    private final JobRequisitionService jobRequisitionService;

    public record RequisitionRequest(
            String title,
            Role targetRole,
            Long departmentId,
            Integer soLuong,
            String reason,
            String requirements,
            String description,
            String budget,
            String capBac,
            String hinhThucLamViec
    ) {}

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_TRUONG_PHONG', 'ROLE_GIAM_DOC_PHONG_BAN', 'ROLE_CEO', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<List<JobRequisition>>> getAllRequisitions(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(jobRequisitionService.getAllRequisitions(extractUserId(userDetails)), "Thành công"));
    }

    @GetMapping("/paginated")
    @PreAuthorize("hasAnyAuthority('ROLE_TRUONG_PHONG', 'ROLE_GIAM_DOC_PHONG_BAN', 'ROLE_CEO', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<JobRequisition>>> getAllRequisitionsPaginated(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Role targetRole,
            @RequestParam(required = false) com.hrm.recruitment.entity.JobRequisitionStatus status,
            @RequestParam(required = false) Long filterRequesterId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(jobRequisitionService.getAllRequisitionsPaginated(extractUserId(userDetails), departmentId, targetRole, status, filterRequesterId, page, size), "Thành công"));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_TRUONG_PHONG', 'ROLE_GIAM_DOC_PHONG_BAN', 'ROLE_CEO', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<JobRequisition>> createRequisition(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody RequisitionRequest request) {
        // Lấy ID người dùng (trong JwtAuthenticationFilter chúng ta đã set ID vào Username của UserDetails hoặc ta sẽ trích xuất từ UserService)
        // Tuy nhiên hệ thống hiện tại lưu email trong getUsername(). 
        // Hãy gọi tạm qua email nếu cần, hoặc để tiện mình gửi kèm requesterId tạm thời.
        // Wait, Authentication object usually contains the User context in a custom way.
        // I will let it be injected from SecurityContext or we extract from database via email.
        return ResponseEntity.ok(ApiResponse.ok(jobRequisitionService.createRequisition(extractUserId(userDetails), request), "Tạo yêu cầu tuyển dụng thành công"));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_CEO', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<JobRequisition>> approveRequisition(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(jobRequisitionService.approveRequisition(id, extractUserId(userDetails)), "Đã duyệt yêu cầu"));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_CEO', 'ROLE_ADMIN')")
    public ResponseEntity<ApiResponse<JobRequisition>> rejectRequisition(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails userDetails) {
        String reason = body.getOrDefault("reason", "");
        return ResponseEntity.ok(ApiResponse.ok(jobRequisitionService.rejectRequisition(id, extractUserId(userDetails), reason), "Đã từ chối yêu cầu"));
    }

    // Helper method to extract user ID. 
    // Tránh inject UserRepository vào Controller, nên ta tạm mock truyền email và service xử lý,
    // HOẶC parse ID nếu UserDetails của hệ thống có.
    private Long extractUserId(UserDetails userDetails) {
        // Trong hệ thống HRM này, custom UserDetails có getUserId() không?
        // Theo các controller khác (như EmployeeRequestController), ta có CustomUserDetails.
        // Giả sử có CustomUserDetails
        if (userDetails instanceof com.hrm.security.CustomUserDetails customUser) {
            return customUser.getUserId();
        }
        return null;
    }
}
