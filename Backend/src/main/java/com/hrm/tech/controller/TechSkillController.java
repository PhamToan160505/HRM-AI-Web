package com.hrm.tech.controller;

import com.hrm.common.entity.Role;
import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.*;
import com.hrm.tech.service.TechSkillService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/tech/skills")
@RequiredArgsConstructor
public class TechSkillController {

    private final TechSkillService techSkillService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TechSkillResponse>>> getAllSkills() {
        return ResponseEntity.ok(ApiResponse.ok(techSkillService.getAllSkills()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechSkillResponse>> createSkill(
            @Valid @RequestBody CreateTechSkillRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(techSkillService.createSkill(req), "Thêm kỹ năng vào danh mục thành công"));
    }

    @GetMapping("/matrix")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechProfileResponse>>> getSkillsMatrix(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long deptId = (userDetails.getRole() == Role.CEO || userDetails.getRole() == Role.ADMIN)
                ? null
                : userDetails.getDepartmentId();
        return ResponseEntity.ok(ApiResponse.ok(techSkillService.getSkillsMatrix(deptId)));
    }

    @GetMapping("/my-profile")
    public ResponseEntity<ApiResponse<TechProfileResponse>> getMyProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(techSkillService.getMyProfile(userDetails.getUserId())));
    }

    @GetMapping("/profile/{userId}")
    public ResponseEntity<ApiResponse<TechProfileResponse>> getUserProfile(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.ok(techSkillService.getUserProfile(userId)));
    }

    @PostMapping("/my-skills")
    public ResponseEntity<ApiResponse<UserSkillResponse>> addMySkill(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody AddUserSkillRequest req) {
        UserSkillResponse res = techSkillService.addUserSkill(userDetails.getUserId(), req);
        return ResponseEntity.ok(ApiResponse.ok(res, "Khai báo kỹ năng thành công"));
    }

    @PutMapping("/my-skills/{id}")
    public ResponseEntity<ApiResponse<UserSkillResponse>> updateMySkill(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserSkillRequest req) {
        UserSkillResponse res = techSkillService.updateUserSkill(userDetails.getUserId(), id, req);
        return ResponseEntity.ok(ApiResponse.ok(res, "Cập nhật kỹ năng thành công"));
    }

    @DeleteMapping("/my-skills/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMySkill(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        techSkillService.deleteUserSkill(userDetails.getUserId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa kỹ năng khỏi hồ sơ"));
    }

    @PutMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<UserSkillResponse>> verifySkill(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        UserSkillResponse res = techSkillService.verifyUserSkill(id, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(res, "Xác thực kỹ năng thành công"));
    }

    @PostMapping("/match")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<SkillMatchCandidateResponse>>> matchSkills(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody SkillMatchRequest req) {
        Long deptId = (userDetails.getRole() == Role.CEO || userDetails.getRole() == Role.ADMIN)
                ? null
                : userDetails.getDepartmentId();
        return ResponseEntity.ok(ApiResponse.ok(techSkillService.matchSkills(req, deptId)));
    }

    @PostMapping("/certificates")
    public ResponseEntity<ApiResponse<CertificateResponse>> addCertificate(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody AddCertificateRequest req) {
        CertificateResponse res = techSkillService.addCertificate(userDetails.getUserId(), req);
        return ResponseEntity.ok(ApiResponse.ok(res, "Thêm chứng chỉ thành công"));
    }

    @PutMapping("/certificates/{id}")
    public ResponseEntity<ApiResponse<CertificateResponse>> updateCertificate(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody UpdateCertificateRequest req) {
        CertificateResponse res = techSkillService.updateCertificate(userDetails.getUserId(), id, req);
        return ResponseEntity.ok(ApiResponse.ok(res, "Cập nhật chứng chỉ thành công"));
    }

    @DeleteMapping("/certificates/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCertificate(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        techSkillService.deleteCertificate(userDetails.getUserId(), id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa chứng chỉ"));
    }
}
