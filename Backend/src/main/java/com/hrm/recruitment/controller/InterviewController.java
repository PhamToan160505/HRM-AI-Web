package com.hrm.recruitment.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.service.InterviewService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recruitment")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;

    @GetMapping("/applications/{applicationId}/interviews")
    @PreAuthorize("hasAnyRole('NHAN_VIEN','TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<List<InterviewService.InterviewView>>> list(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                interviewService.list(applicationId, actor.getUserId()), "Lịch sử phỏng vấn"));
    }

    @GetMapping("/applications/{applicationId}/interviewers")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<List<InterviewService.EligibleInterviewer>>> interviewers(
            @PathVariable Long applicationId,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(interviewService.eligibleInterviewers(applicationId, actor.getUserId()),
                "Danh sách người phỏng vấn"));
    }

    @PostMapping("/applications/{applicationId}/interviews")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<InterviewService.InterviewView>> schedule(
            @PathVariable Long applicationId,
            @RequestBody InterviewService.ScheduleRequest request,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                interviewService.schedule(applicationId, request, actor.getUserId()),
                "Đã tạo lịch phỏng vấn"));
    }

    @PutMapping("/interviews/{interviewId}/feedback")
    @PreAuthorize("hasAnyRole('NHAN_VIEN','TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<InterviewService.InterviewView>> feedback(
            @PathVariable Long interviewId,
            @RequestBody InterviewService.FeedbackRequest request,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                interviewService.submitFeedback(interviewId, request, actor.getUserId()),
                "Đã lưu phiếu feedback"));
    }

    @PostMapping("/interviews/{interviewId}/complete")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<InterviewService.InterviewView>> complete(
            @PathVariable Long interviewId,
            @RequestBody InterviewService.ConclusionRequest request,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                interviewService.complete(interviewId, request, actor.getUserId()),
                "Đã hoàn tất phỏng vấn"));
    }

    @PostMapping("/interviews/{interviewId}/no-show")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<InterviewService.InterviewView>> noShow(
            @PathVariable Long interviewId,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                interviewService.noShow(interviewId, actor.getUserId()),
                "Đã ghi nhận ứng viên vắng mặt"));
    }

    @PutMapping("/interviews/{interviewId}/salary-negotiation")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<InterviewService.InterviewView>> negotiation(
            @PathVariable Long interviewId,
            @RequestBody InterviewService.NegotiationRequest request,
            @AuthenticationPrincipal CustomUserDetails actor) {
        return ResponseEntity.ok(ApiResponse.ok(
                interviewService.recordNegotiation(interviewId, request, actor.getUserId()),
                "Đã lưu kết quả đàm phán sơ bộ"));
    }
}
