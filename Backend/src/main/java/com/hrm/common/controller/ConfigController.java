package com.hrm.common.controller;

import com.hrm.common.entity.Role;
import com.hrm.request.entity.RequestType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/config")
public class ConfigController {

    @GetMapping("/roles")
    public ResponseEntity<?> getRoles() {
        List<Map<String, String>> roles = new ArrayList<>();
        
        for (Role role : Role.values()) {
            Map<String, String> r = new HashMap<>();
            r.put("id", role.name());
            
            String name = switch (role) {
                case ADMIN -> "Quản trị hệ thống";
                case CEO -> "Tổng giám đốc (CEO)";
                case GIAM_DOC_PHONG_BAN -> "Giám đốc phòng ban";
                case TRUONG_PHONG -> "Trưởng phòng";
                case NHAN_VIEN -> "Nhân viên";
            };
            
            r.put("name", name);
            roles.add(r);
        }
        
        return ResponseEntity.ok(Map.of("success", true, "data", roles));
    }

    @GetMapping("/request-types")
    public ResponseEntity<?> getRequestTypes() {
        List<Map<String, String>> requestTypes = new ArrayList<>();
        
        for (RequestType type : RequestType.values()) {
            Map<String, String> t = new HashMap<>();
            t.put("id", type.name());
            
            String name = switch (type) {
                case NORMAL_LEAVE -> "Nghỉ phép thường";
                case HALF_DAY_LEAVE -> "Nghỉ nửa ngày";
                case SPECIAL_WFH_LEAVE -> "Làm việc từ xa (WFH)";
                case UNPAID_LEAVE -> "Nghỉ không lương";
                case OVERTIME -> "Làm thêm giờ";
            };
            
            t.put("name", name);
            requestTypes.add(t);
        }
        
        return ResponseEntity.ok(Map.of("success", true, "data", requestTypes));
    }
}
