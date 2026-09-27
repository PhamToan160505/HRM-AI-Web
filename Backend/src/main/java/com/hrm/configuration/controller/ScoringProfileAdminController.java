package com.hrm.configuration.controller;

import com.hrm.configuration.service.ScoringProfileService;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/scoring-profiles")
@PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
@RequiredArgsConstructor
public class ScoringProfileAdminController {

    private final ScoringProfileService scoringProfileService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ScoringProfileService.ScoringProfileView>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(
                scoringProfileService.listProfiles(),
                "Lấy danh sách scoring profile thành công"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ScoringProfileService.ScoringProfileView>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(
                scoringProfileService.getProfile(id),
                "Lấy scoring profile thành công"));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<ScoringProfileService.ScoringProfileView>> activate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(
                scoringProfileService.activate(id),
                "Kích hoạt scoring profile thành công"));
    }
}
