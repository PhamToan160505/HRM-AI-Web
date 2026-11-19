package com.hrm.tech.controller;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.TechProjectDocumentType;
import com.hrm.tech.service.TechMilestoneDodService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/tech/projects/{projectId}")
@RequiredArgsConstructor
public class TechMilestoneDodController {

    private final TechMilestoneDodService dodService;

    // --- DoD Items ---

    @GetMapping("/milestones/{milestoneId}/dod")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechDodItemResponse>>> getDodItems(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId) {
        return ResponseEntity.ok(ApiResponse.ok(dodService.getDodItems(milestoneId)));
    }

    @PostMapping("/milestones/{milestoneId}/dod")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechDodItemResponse>> createDodItem(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId,
            @Valid @RequestBody CreateTechDodItemRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechDodItemResponse created = dodService.createDodItem(milestoneId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Thêm tiêu chí DoD thành công"));
    }

    @PutMapping("/milestones/{milestoneId}/dod/{itemId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechDodItemResponse>> updateDodItem(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId,
            @PathVariable Long itemId,
            @RequestBody UpdateTechDodItemRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechDodItemResponse updated = dodService.updateDodItem(itemId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật tiêu chí DoD thành công"));
    }

    @PatchMapping("/milestones/{milestoneId}/dod/{itemId}/toggle")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechDodItemResponse>> toggleDodItem(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId,
            @PathVariable Long itemId,
            @RequestParam(required = false) Boolean completed,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechDodItemResponse toggled = dodService.toggleDodItem(itemId, completed, notes, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(toggled, "Cập nhật trạng thái nghiệm thu tiêu chí"));
    }

    @DeleteMapping("/milestones/{milestoneId}/dod/{itemId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteDodItem(
            @PathVariable Long projectId,
            @PathVariable Long milestoneId,
            @PathVariable Long itemId) {
        dodService.deleteDodItem(itemId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa tiêu chí DoD"));
    }

    // --- Architecture Documents ---

    @GetMapping("/documents")
    @PreAuthorize("hasAnyRole('CEO', 'GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TechProjectDocumentResponse>>> getDocuments(
            @PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.ok(dodService.getProjectDocuments(projectId)));
    }

    @PostMapping("/documents")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectDocumentResponse>> createDocument(
            @PathVariable Long projectId,
            @Valid @RequestBody CreateTechProjectDocumentRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechProjectDocumentResponse created = dodService.createProjectDocument(projectId, request, userDetails.getUserId());
        return ResponseEntity.ok(ApiResponse.ok(created, "Thêm tài liệu kiến trúc dự án thành công"));
    }

    @PostMapping(value = "/documents/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectDocumentResponse>> uploadDocument(
            @PathVariable Long projectId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "docType", required = false) TechProjectDocumentType docType,
            @RequestParam(value = "description", required = false) String description,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechProjectDocumentResponse created = dodService.uploadProjectDocument(
                projectId, file, title, docType, description, userDetails.getUserId()
        );
        return ResponseEntity.ok(ApiResponse.ok(created, "Tải lên và đính kèm tài liệu thành công"));
    }

    @PutMapping("/documents/{docId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectDocumentResponse>> updateDocument(
            @PathVariable Long projectId,
            @PathVariable Long docId,
            @Valid @RequestBody UpdateTechProjectDocumentRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechProjectDocumentResponse updated = dodService.updateProjectDocument(
                projectId, docId, request, userDetails.getUserId()
        );
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật tài liệu dự án thành công"));
    }

    @PostMapping(value = "/documents/{docId}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'NHAN_VIEN', 'ADMIN')")
    public ResponseEntity<ApiResponse<TechProjectDocumentResponse>> updateDocumentWithFile(
            @PathVariable Long projectId,
            @PathVariable Long docId,
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "docType", required = false) TechProjectDocumentType docType,
            @RequestParam(value = "description", required = false) String description,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        TechProjectDocumentResponse updated = dodService.updateProjectDocumentWithFile(
                projectId, docId, file, title, docType, description, userDetails.getUserId()
        );
        return ResponseEntity.ok(ApiResponse.ok(updated, "Cập nhật tài liệu dự án thành công"));
    }

    @DeleteMapping("/documents/{docId}")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'TRUONG_PHONG', 'ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(
            @PathVariable Long projectId,
            @PathVariable Long docId) {
        dodService.deleteProjectDocument(projectId, docId);
        return ResponseEntity.ok(ApiResponse.ok(null, "Đã xóa tài liệu dự án"));
    }
}

