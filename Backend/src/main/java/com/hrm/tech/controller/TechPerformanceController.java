package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.TechRatingGrade;
import com.hrm.tech.entity.TechReviewStatus;
import com.hrm.tech.service.TechPerformanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tech/reviews")
@RequiredArgsConstructor
public class TechPerformanceController {

    private final TechPerformanceService performanceService;

    @GetMapping("/my")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TechMyPerformanceOverviewResponse>> getMyPerformance(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.getMyPerformanceOverview(userDetails.getUserId())));
    }

    @PostMapping("/{id}/self-review")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TechPerformanceReviewResponse>> submitSelfReview(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody SubmitSelfReviewRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.submitSelfReview(id, req, userDetails.getUserId()),
                "Đã gửi bản Tự đánh giá & đề xuất nâng bậc thành công"));
    }

    @GetMapping("/cycles")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechEvaluationCycleResponse>>> getCycles(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.getCycles(userDetails.getUserId())));
    }

    @PostMapping("/cycles")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechEvaluationCycleResponse>> createCycle(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CreateTechEvaluationCycleRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.createCycle(req, userDetails.getUserId()),
                "Khởi tạo kỳ đánh giá hiệu suất Phòng Công nghệ thành công"));
    }

    @PutMapping("/cycles/{id}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechEvaluationCycleResponse>> updateCycle(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody UpdateTechEvaluationCycleRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.updateCycle(id, req, userDetails.getUserId()),
                "Cập nhật kỳ đánh giá thành công"));
    }

    @DeleteMapping("/cycles/{id}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCycle(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        performanceService.deleteCycle(id, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Xóa kỳ đánh giá thành công"));
    }

    @GetMapping("/paginated")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechPerformancePageResponse>> getReviewsPaginated(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) Long cycleId,
            @RequestParam(required = false) TechReviewStatus status,
            @RequestParam(required = false) TechRatingGrade grade,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long focusReviewId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.getReviewsPaginated(
                        userDetails.getUserId(), cycleId, status, grade, keyword, focusReviewId, page, size)));
    }

    @GetMapping("/analytics")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechPerformanceAnalyticsResponse>> getAnalytics(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) Long cycleId) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.getAnalytics(userDetails.getUserId(), cycleId)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<TechPerformanceReviewResponse>> getReviewById(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.getReviewById(id, userDetails.getUserId())));
    }

    @PostMapping("/{id}/recalculate-telemetry")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechPerformanceReviewResponse>> recalculateTelemetry(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.recalculateTelemetry(id, userDetails.getUserId()),
                "Đã đồng bộ lại điểm Telemetry từ dữ liệu thực tế"));
    }

    @PostMapping("/{id}/ai-copilot")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechAiCopilotResponse>> generateAiCopilot(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                performanceService.generateAiCopilotSummary(id, userDetails.getUserId()),
                "Đã tổng hợp nhận xét đánh giá kỹ thuật thành công"));
    }

    @PutMapping("/{id}/evaluate")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'CEO', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechPerformanceReviewResponse>> evaluateReview(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ManagerEvaluateReviewRequest req) {
        TechPerformanceReviewResponse result = performanceService.evaluateReview(id, req, userDetails.getUserId());
        String msg = result.getStatus() == TechReviewStatus.DIRECTOR_APPROVAL_PENDING
                ? "Đã lưu đánh giá và trình cấp trên phê duyệt theo quy trình leo thang"
                : "Đã thẩm định và chốt kết quả đánh giá thành công";
        return ResponseEntity.ok(ApiResponse.ok(result, msg));
    }

    @PutMapping("/{id}/final-decision")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechPerformanceReviewResponse>> finalDecision(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody FinalDecisionRequest req) {
        TechPerformanceReviewResponse result = performanceService.finalDecision(id, req, userDetails.getUserId());
        String msg = result.getStatus() == TechReviewStatus.APPROVED
                ? "Đã phê duyệt hoàn tất phiếu đánh giá kỹ sư"
                : "Đã trả lại phiếu đánh giá để hiệu chỉnh";
        return ResponseEntity.ok(ApiResponse.ok(result, msg));
    }
}
