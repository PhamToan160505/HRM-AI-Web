package com.hrm.admin.controller;

import com.hrm.admin.dto.UpdateSettingRequest;
import com.hrm.admin.service.SystemSettingService;
import com.hrm.common.entity.SystemSetting;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/settings")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@RequiredArgsConstructor
public class SystemSettingController {

    private final SystemSettingService systemSettingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<SystemSetting>>> getAllSettings() {
        return ResponseEntity.ok(ApiResponse.ok(systemSettingService.getAllSettings(), "Lấy danh sách cấu hình thành công"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SystemSetting>> updateSetting(@RequestBody UpdateSettingRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(systemSettingService.updateSetting(request), "Cập nhật cấu hình thành công"));
    }
}
