package com.hrm.tech.service;

import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.recruitment.service.CloudinaryService;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.TechMilestoneDodItem;
import com.hrm.tech.entity.TechProject;
import com.hrm.tech.entity.TechProjectDocument;
import com.hrm.tech.entity.TechProjectDocumentType;
import com.hrm.tech.entity.TechProjectMilestone;
import com.hrm.tech.repository.TechMilestoneDodItemRepository;
import com.hrm.tech.repository.TechProjectDocumentRepository;
import com.hrm.tech.repository.TechProjectMilestoneRepository;
import com.hrm.tech.repository.TechProjectRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
public class TechMilestoneDodService {

    public static final long MAX_FILE_SIZE = 20 * 1024 * 1024L; // 20 MB

    public static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "docx", "doc", "xlsx", "xls", "csv", "pptx", "ppt",
            "md", "json", "yaml", "yml", "sql",
            "png", "jpg", "jpeg", "svg", "drawio", "vsdx", "zip"
    );

    public static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "sh", "dll", "msi", "jar", "jsp", "php", "war", "py", "com", "vbs"
    );

    private final TechMilestoneDodItemRepository dodItemRepository;
    private final TechProjectMilestoneRepository milestoneRepository;
    private final TechProjectDocumentRepository documentRepository;
    private final TechProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;

    @Autowired
    public TechMilestoneDodService(
            TechMilestoneDodItemRepository dodItemRepository,
            TechProjectMilestoneRepository milestoneRepository,
            TechProjectDocumentRepository documentRepository,
            TechProjectRepository projectRepository,
            UserRepository userRepository,
            CloudinaryService cloudinaryService) {
        this.dodItemRepository = dodItemRepository;
        this.milestoneRepository = milestoneRepository;
        this.documentRepository = documentRepository;
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.cloudinaryService = cloudinaryService;
    }

    // Overloaded constructor for unit test backwards compatibility
    public TechMilestoneDodService(
            TechMilestoneDodItemRepository dodItemRepository,
            TechProjectMilestoneRepository milestoneRepository,
            TechProjectDocumentRepository documentRepository,
            TechProjectRepository projectRepository,
            UserRepository userRepository) {
        this(dodItemRepository, milestoneRepository, documentRepository, projectRepository, userRepository, null);
    }

    @Transactional(readOnly = true)
    public List<TechDodItemResponse> getDodItems(Long milestoneId) {
        TechProjectMilestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy mốc tiến độ với ID: " + milestoneId));

        return dodItemRepository.findByMilestoneIdOrderByCreatedAtAsc(milestone.getId())
                .stream()
                .map(this::mapDodToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechDodItemResponse createDodItem(Long milestoneId, CreateTechDodItemRequest req, Long actorId) {
        TechProjectMilestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy mốc tiến độ với ID: " + milestoneId));

        TechMilestoneDodItem item = TechMilestoneDodItem.builder()
                .milestone(milestone)
                .title(req.getTitle().trim())
                .description(req.getDescription() != null ? req.getDescription().trim() : null)
                .isRequired(req.getIsRequired() != null ? req.getIsRequired() : true)
                .isCompleted(false)
                .build();

        TechMilestoneDodItem saved = dodItemRepository.save(item);
        log.info("[Tech] Đã tạo tiêu chí DoD '{}' cho mốc ID {}", saved.getTitle(), milestoneId);
        return mapDodToResponse(saved);
    }

    @Transactional
    public TechDodItemResponse updateDodItem(Long itemId, UpdateTechDodItemRequest req, Long actorId) {
        TechMilestoneDodItem item = dodItemRepository.findById(itemId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tiêu chí DoD với ID: " + itemId));

        if (req.getTitle() != null && !req.getTitle().trim().isEmpty()) {
            item.setTitle(req.getTitle().trim());
        }
        if (req.getDescription() != null) {
            item.setDescription(req.getDescription().trim());
        }
        if (req.getIsRequired() != null) {
            item.setIsRequired(req.getIsRequired());
        }
        if (req.getNotes() != null) {
            item.setNotes(req.getNotes().trim());
        }

        if (req.getIsCompleted() != null) {
            boolean wasCompleted = Boolean.TRUE.equals(item.getIsCompleted());
            boolean nowCompleted = req.getIsCompleted();
            item.setIsCompleted(nowCompleted);
            if (!wasCompleted && nowCompleted) {
                item.setCompletedBy(actorId);
                item.setCompletedAt(LocalDateTime.now());
            } else if (wasCompleted && !nowCompleted) {
                item.setCompletedBy(null);
                item.setCompletedAt(null);
            }
        }

        TechMilestoneDodItem updated = dodItemRepository.save(item);
        return mapDodToResponse(updated);
    }

    @Transactional
    public TechDodItemResponse toggleDodItem(Long itemId, Boolean completed, String notes, Long actorId) {
        TechMilestoneDodItem item = dodItemRepository.findById(itemId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tiêu chí DoD với ID: " + itemId));

        boolean targetStatus = completed != null ? completed : !Boolean.TRUE.equals(item.getIsCompleted());
        item.setIsCompleted(targetStatus);
        if (notes != null) {
            item.setNotes(notes.trim());
        }

        if (targetStatus) {
            item.setCompletedBy(actorId);
            item.setCompletedAt(LocalDateTime.now());
        } else {
            item.setCompletedBy(null);
            item.setCompletedAt(null);
        }

        TechMilestoneDodItem updated = dodItemRepository.save(item);
        log.info("[Tech] Người dùng {} đã toggle tiêu chí DoD ID {} thành {}", actorId, itemId, targetStatus);
        return mapDodToResponse(updated);
    }

    @Transactional
    public void deleteDodItem(Long itemId) {
        TechMilestoneDodItem item = dodItemRepository.findById(itemId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tiêu chí DoD với ID: " + itemId));
        dodItemRepository.delete(item);
        log.info("[Tech] Đã xóa tiêu chí DoD ID {}", itemId);
    }

    // --- Architecture Documents Management ---

    @Transactional(readOnly = true)
    public List<TechProjectDocumentResponse> getProjectDocuments(Long projectId) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        return documentRepository.findByProjectIdOrderByCreatedAtDesc(project.getId())
                .stream()
                .map(this::mapDocToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechProjectDocumentResponse createProjectDocument(Long projectId, CreateTechProjectDocumentRequest req, Long actorId) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        TechProjectDocument doc = TechProjectDocument.builder()
                .project(project)
                .docType(req.getDocType())
                .title(req.getTitle().trim())
                .url(req.getUrl().trim())
                .description(req.getDescription() != null ? req.getDescription().trim() : null)
                .createdBy(actorId)
                .build();

        TechProjectDocument saved = documentRepository.save(doc);
        log.info("[Tech] Đã đính kèm tài liệu '{}' ({}) cho dự án {}", saved.getTitle(), saved.getDocType(), project.getProjectCode());
        return mapDocToResponse(saved);
    }

    @Transactional
    public void deleteProjectDocument(Long projectId, Long docId) {
        TechProjectDocument doc = documentRepository.findById(docId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài liệu dự án với ID: " + docId));
        if (!doc.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Tài liệu không thuộc dự án này!");
        }
        documentRepository.delete(doc);
        log.info("[Tech] Đã xóa tài liệu ID {} khỏi dự án {}", docId, projectId);
    }

    @Transactional
    public TechProjectDocumentResponse updateProjectDocument(
            Long projectId,
            Long docId,
            UpdateTechProjectDocumentRequest req,
            Long actorId) {
        TechProjectDocument doc = documentRepository.findById(docId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài liệu dự án với ID: " + docId));

        if (!doc.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Tài liệu không thuộc dự án này!");
        }

        if (req.getDocType() != null) {
            doc.setDocType(req.getDocType());
        }
        if (req.getTitle() != null && !req.getTitle().trim().isEmpty()) {
            doc.setTitle(req.getTitle().trim());
        }
        if (req.getUrl() != null && !req.getUrl().trim().isEmpty()) {
            doc.setUrl(req.getUrl().trim());
        }
        if (req.getDescription() != null) {
            doc.setDescription(req.getDescription().trim().isEmpty() ? null : req.getDescription().trim());
        }

        TechProjectDocument saved = documentRepository.save(doc);
        log.info("[Tech] Đã cập nhật thông tin tài liệu '{}' (ID: {}) của dự án ID {}", saved.getTitle(), docId, projectId);
        return mapDocToResponse(saved);
    }

    @Transactional
    public TechProjectDocumentResponse updateProjectDocumentWithFile(
            Long projectId,
            Long docId,
            MultipartFile file,
            String title,
            TechProjectDocumentType docType,
            String description,
            Long actorId) {
        TechProjectDocument doc = documentRepository.findById(docId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài liệu dự án với ID: " + docId));

        if (!doc.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Tài liệu không thuộc dự án này!");
        }

        if (docType != null) {
            doc.setDocType(docType);
        }
        if (title != null && !title.trim().isEmpty()) {
            doc.setTitle(title.trim());
        }
        if (description != null) {
            doc.setDescription(description.trim().isEmpty() ? null : description.trim());
        }

        if (file != null && !file.isEmpty()) {
            if (file.getSize() > MAX_FILE_SIZE) {
                throw AppException.badRequest("Dung lượng tệp vượt quá giới hạn 20MB cho phép!");
            }

            String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
            String ext = "";
            int dotIndex = originalFilename.lastIndexOf('.');
            if (dotIndex > 0 && dotIndex < originalFilename.length() - 1) {
                ext = originalFilename.substring(dotIndex + 1).toLowerCase();
            }

            if (BLOCKED_EXTENSIONS.contains(ext)) {
                throw AppException.badRequest("Định dạng tệp ." + ext + " bị cấm tải lên vì lý do an toàn hệ thống!");
            }

            if (!ALLOWED_EXTENSIONS.contains(ext)) {
                throw AppException.badRequest("Định dạng tệp ." + ext + " không được hỗ trợ! Vui lòng chọn tệp tài liệu kỹ thuật hợp lệ.");
            }

            String fileUrl = null;
            try {
                if (cloudinaryService != null) {
                    fileUrl = cloudinaryService.uploadFile(file, "tech-documents");
                }
            } catch (Exception e) {
                log.warn("[Tech Docs] Cloudinary upload thất bại ({}), fallback sang lưu cục bộ: {}", e.getMessage(), originalFilename);
            }

            if (fileUrl == null || fileUrl.isBlank()) {
                try {
                    fileUrl = saveFileLocally(file, "tech-documents");
                } catch (IOException ioException) {
                    log.error("[Tech Docs] Lưu tệp cục bộ thất bại: ", ioException);
                    throw new AppException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu trữ tệp tin trên máy chủ!");
                }
            }

            doc.setUrl(fileUrl);
        }

        TechProjectDocument saved = documentRepository.save(doc);
        log.info("[Tech] Đã cập nhật tài liệu kèm tệp mới '{}' (ID: {}) của dự án ID {}", saved.getTitle(), docId, projectId);
        return mapDocToResponse(saved);
    }

    @Transactional
    public TechProjectDocumentResponse uploadProjectDocument(
            Long projectId,
            MultipartFile file,
            String title,
            TechProjectDocumentType docType,
            String description,
            Long actorId) {

        if (file == null || file.isEmpty()) {
            throw AppException.badRequest("Vui lòng chọn tệp tin cần tải lên!");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw AppException.badRequest("Dung lượng tệp vượt quá giới hạn 20MB cho phép!");
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        String ext = "";
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < originalFilename.length() - 1) {
            ext = originalFilename.substring(dotIndex + 1).toLowerCase();
        }

        if (BLOCKED_EXTENSIONS.contains(ext)) {
            throw AppException.badRequest("Định dạng tệp ." + ext + " bị cấm tải lên vì lý do an toàn hệ thống!");
        }

        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw AppException.badRequest("Định dạng tệp ." + ext + " không được hỗ trợ! Vui lòng chọn tệp tài liệu kỹ thuật hợp lệ.");
        }

        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        String finalTitle = (title != null && !title.trim().isEmpty())
                ? title.trim()
                : prettifyFileName(originalFilename);

        TechProjectDocumentType finalDocType = docType != null ? docType : inferDocTypeFromExtension(ext);

        String fileUrl = null;
        try {
            if (cloudinaryService != null) {
                fileUrl = cloudinaryService.uploadFile(file, "tech-documents");
            }
        } catch (Exception e) {
            log.warn("[Tech Docs] Cloudinary upload thất bại ({}), fallback sang lưu cục bộ: {}", e.getMessage(), originalFilename);
        }

        if (fileUrl == null || fileUrl.isBlank()) {
            try {
                fileUrl = saveFileLocally(file, "tech-documents");
            } catch (IOException ioException) {
                log.error("[Tech Docs] Lưu tệp cục bộ thất bại: ", ioException);
                throw new AppException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu trữ tệp tin trên máy chủ!");
            }
        }

        TechProjectDocument doc = TechProjectDocument.builder()
                .project(project)
                .docType(finalDocType)
                .title(finalTitle)
                .url(fileUrl)
                .description(description != null ? description.trim() : null)
                .createdBy(actorId)
                .build();

        TechProjectDocument saved = documentRepository.save(doc);
        log.info("[Tech] Đã tải lên và đính kèm tài liệu '{}' ({}) cho dự án {}", saved.getTitle(), saved.getUrl(), project.getProjectCode());
        return mapDocToResponse(saved);
    }

    private TechProjectDocumentType inferDocTypeFromExtension(String ext) {
        if ("sql".equalsIgnoreCase(ext)) return TechProjectDocumentType.DATABASE_ERD;
        if ("json".equalsIgnoreCase(ext) || "yaml".equalsIgnoreCase(ext) || "yml".equalsIgnoreCase(ext)) return TechProjectDocumentType.API_SWAGGER;
        if ("md".equalsIgnoreCase(ext)) return TechProjectDocumentType.RUNBOOK_GUIDE;
        return TechProjectDocumentType.ARCHITECTURE_SPEC;
    }

    private String prettifyFileName(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        String base = dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
        return base.replace('_', ' ').replace('-', ' ').trim();
    }

    private String saveFileLocally(MultipartFile file, String folder) throws IOException {
        Path uploadPath = Paths.get("uploads", folder);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        String cleanName = originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
        String fileName = System.currentTimeMillis() + "_" + cleanName;
        Path filePath = uploadPath.resolve(fileName);
        Files.write(filePath, file.getBytes());
        return "/uploads/" + folder + "/" + fileName;
    }

    private TechDodItemResponse mapDodToResponse(TechMilestoneDodItem item) {
        String completerName = item.getCompletedBy() != null
                ? userRepository.findById(item.getCompletedBy()).map(User::getHoTen).orElse(null)
                : null;

        return TechDodItemResponse.builder()
                .id(item.getId())
                .milestoneId(item.getMilestone().getId())
                .title(item.getTitle())
                .description(item.getDescription())
                .isRequired(item.getIsRequired())
                .isCompleted(item.getIsCompleted())
                .completedBy(item.getCompletedBy())
                .completedByName(completerName)
                .completedAt(item.getCompletedAt())
                .notes(item.getNotes())
                .createdAt(item.getCreatedAt())
                .build();
    }

    private TechProjectDocumentResponse mapDocToResponse(TechProjectDocument doc) {
        String creatorName = doc.getCreatedBy() != null
                ? userRepository.findById(doc.getCreatedBy()).map(User::getHoTen).orElse(null)
                : null;

        return TechProjectDocumentResponse.builder()
                .id(doc.getId())
                .projectId(doc.getProject().getId())
                .docType(doc.getDocType())
                .title(doc.getTitle())
                .url(doc.getUrl())
                .description(doc.getDescription())
                .createdBy(doc.getCreatedBy())
                .createdByName(creatorName)
                .createdAt(doc.getCreatedAt())
                .build();
    }
}

