package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.*;
import com.hrm.tech.service.TechMentorshipService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tech/mentorship")
@RequiredArgsConstructor
public class TechMentorshipController {

    private final TechMentorshipService mentorshipService;

    @GetMapping("/department/{departmentId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechMentorshipProgramResponse>>> getDepartmentPrograms(
            @PathVariable Long departmentId) {
        return ResponseEntity.ok(ApiResponse.ok(mentorshipService.getDepartmentPrograms(departmentId)));
    }

    @GetMapping("/my-programs")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechMentorshipProgramResponse>>> getMyPrograms(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(mentorshipService.getMyPrograms(userDetails.getUserId())));
    }

    @PostMapping("/department/{departmentId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechMentorshipProgramResponse>> createProgram(
            @PathVariable Long departmentId,
            @Valid @RequestBody CreateTechMentorshipRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechMentorshipProgramResponse created = mentorshipService.createProgram(departmentId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Khởi tạo chương trình kèm cặp 1-1 thành công"));
    }

    @GetMapping("/programs/{programId}")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechMentorshipProgramResponse>> getProgramById(
            @PathVariable Long programId) {
        return ResponseEntity.ok(ApiResponse.ok(mentorshipService.getProgramById(programId)));
    }

    @PutMapping("/programs/{programId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechMentorshipProgramResponse>> updateProgram(
            @PathVariable Long programId,
            @RequestBody UpdateTechMentorshipRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechMentorshipProgramResponse updated = mentorshipService.updateProgram(programId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật chương trình kèm cặp thành công"));
    }

    @DeleteMapping("/programs/{programId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteProgram(
            @PathVariable Long programId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        mentorshipService.deleteProgram(programId, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa chương trình kèm cặp thành công"));
    }

    @GetMapping("/programs/{programId}/checkins")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechMentorshipCheckinResponse>>> getCheckins(
            @PathVariable Long programId) {
        return ResponseEntity.ok(ApiResponse.ok(mentorshipService.getProgramCheckins(programId)));
    }

    @PostMapping("/programs/{programId}/checkins")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechMentorshipCheckinResponse>> createCheckin(
            @PathVariable Long programId,
            @Valid @RequestBody CreateTechCheckinRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechMentorshipCheckinResponse created = mentorshipService.createCheckin(programId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Ghi nhận buổi trao đổi kèm cặp thành công"));
    }

    @GetMapping("/smart-suggestions")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechSmartMentorSuggestionResponse>> getSmartSuggestions(
            @RequestParam Long menteeId,
            @RequestParam(required = false) Long skillId) {
        return ResponseEntity.ok(ApiResponse.ok(mentorshipService.getSmartMentorSuggestions(menteeId, skillId)));
    }
}

