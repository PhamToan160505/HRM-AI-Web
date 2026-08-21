package com.hrm.common.controller;

import com.hrm.ai.service.CccdExtractionService;
import com.hrm.attendance.entity.FaceEmbedding;
import com.hrm.attendance.repository.FaceEmbeddingRepository;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.service.CloudinaryService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/employees/me")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class EmployeeProfileController {

    private final UserRepository userRepository;
    private final FaceEmbeddingRepository faceEmbeddingRepository;
    private final CccdExtractionService cccdExtractionService;
    private final CloudinaryService cloudinaryService;

    @GetMapping
    public ResponseEntity<ApiResponse<User>> getMyProfile(@AuthenticationPrincipal CustomUserDetails userDetails) {
        User user = userRepository.findById(userDetails.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(ApiResponse.ok(user, "Thành công"));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<User>> updateMyProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> request) {
        
        User user = userRepository.findById(userDetails.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (request.containsKey("phone")) user.setPhone(request.get("phone"));
        if (request.containsKey("email")) {
            String email = request.get("email");
            if(email != null && !email.trim().isEmpty()) {
                user.setEmail(email.trim());
            }
        }
        if (request.containsKey("cccd")) user.setCccd(request.get("cccd"));
        if (request.containsKey("queQuan")) user.setQueQuan(request.get("queQuan"));
        if (request.containsKey("diaChi")) user.setDiaChi(request.get("diaChi"));
        if (request.containsKey("ngaySinh")) {
            String dob = request.get("ngaySinh");
            if (dob != null && !dob.isEmpty()) {
                user.setNgaySinh(java.time.LocalDate.parse(dob));
            }
        }
        if (request.containsKey("soNguoiPhuThuoc")) {
            try {
                user.setSoNguoiPhuThuoc(Integer.parseInt(request.get("soNguoiPhuThuoc").toString()));
            } catch (Exception e) {}
        }
        if (request.containsKey("ngayCapCccd")) {
            String issue = request.get("ngayCapCccd");
            if (issue != null && !issue.isEmpty()) {
                user.setNgayCapCccd(java.time.LocalDate.parse(issue));
            }
        }
        if (request.containsKey("noiCapCccd")) user.setNoiCapCccd(request.get("noiCapCccd"));
        
        if (request.containsKey("cccdFrontPublicId")) user.setCccdFrontPublicId(request.get("cccdFrontPublicId"));
        if (request.containsKey("cccdBackPublicId")) user.setCccdBackPublicId(request.get("cccdBackPublicId"));

        User savedUser = userRepository.save(user);
        return ResponseEntity.ok(ApiResponse.ok(savedUser, "Cập nhật hồ sơ thành công"));
    }

    @PostMapping("/face-enroll")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<ApiResponse<FaceEmbedding>> enrollFace(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> request) {
        
        String vectorJson = request.get("embeddingVector");
        if (vectorJson == null || vectorJson.isEmpty()) {
            throw new IllegalArgumentException("Dữ liệu khuôn mặt không hợp lệ");
        }

        faceEmbeddingRepository.deleteAllByEmployeeId(userDetails.getUserId());

        FaceEmbedding newFace = FaceEmbedding.builder()
                .employeeId(userDetails.getUserId())
                .embeddingVector(vectorJson)
                .build();
        
        FaceEmbedding savedFace = faceEmbeddingRepository.save(newFace);
        return ResponseEntity.ok(ApiResponse.ok(savedFace, "Đăng ký khuôn mặt thành công"));
    }

    @GetMapping("/face-status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFaceStatus(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return faceEmbeddingRepository.findFirstByEmployeeIdOrderByIdDesc(userDetails.getUserId())
                .map(face -> {
                    String date = face.getCreatedAt() != null ? face.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) : "không xác định";
                    return ResponseEntity.ok(ApiResponse.ok(Map.<String, Object>of(
                            "hasEnrolled", true,
                            "enrolledAt", date
                    ), "Thành công"));
                })
                .orElseGet(() -> ResponseEntity.ok(ApiResponse.ok(Map.<String, Object>of("hasEnrolled", false), "Thành công")));
    }

    @PostMapping("/extract-cccd")
    public ResponseEntity<ApiResponse<String>> extractCccd(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> request) {
        
        String frontBase64 = request.get("frontBase64");
        String backBase64 = request.get("backBase64");
        
        if (frontBase64 == null || backBase64 == null) {
            throw new IllegalArgumentException("Cần cung cấp đủ 2 mặt CCCD");
        }

        try {
            // 1. Trích xuất thông tin bằng Gemini Vision
            String extractedJson = cccdExtractionService.extractCccdInfo(frontBase64, backBase64);
            
            // 2. Lưu ảnh vào Cloudinary dạng authenticated
            String frontPublicId = cloudinaryService.uploadAuthenticated(frontBase64, "cccd_front_" + userDetails.getUserId(), "bizos/cccd");
            String backPublicId = cloudinaryService.uploadAuthenticated(backBase64, "cccd_back_" + userDetails.getUserId(), "bizos/cccd");
            
            // 3. Trả về JSON bóc tách kèm 2 cái publicId để Frontend gắn vào Form lưu lại
            String finalJson = extractedJson.substring(0, extractedJson.lastIndexOf("}")) + 
                    ", \"frontPublicId\": \"" + frontPublicId + "\", \"backPublicId\": \"" + backPublicId + "\"}";
                    
            return ResponseEntity.ok(ApiResponse.ok(finalJson, "Bóc tách CCCD thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }
}
