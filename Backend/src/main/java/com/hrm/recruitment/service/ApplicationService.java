package com.hrm.recruitment.service;

import com.hrm.ai.entity.AiDecisionLog;
import com.hrm.ai.entity.AiAnalysis;
import com.hrm.ai.repository.AiDecisionLogRepository;
import com.hrm.ai.service.AiAnalysisService;
import com.hrm.ai.service.CvExtractionService;
import com.hrm.ai.service.CvParserService;
import com.hrm.ai.service.FraudDetectionService;
import com.hrm.ai.service.SemanticFitScoreService;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import com.hrm.notification.service.NotificationService;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.email.service.EmailService;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final JobPostingService jobPostingService;
    private final CloudinaryService cloudinaryService;
    private final CvExtractionService cvExtractionService;
    private final SemanticFitScoreService semanticFitScoreService;
    private final FraudDetectionService fraudDetectionService;
    private final AiDecisionLogRepository aiDecisionLogRepository;
    private final CvParserService cvParserService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final AsyncUploadService asyncUploadService;
    private final com.hrm.common.repository.DepartmentRepository departmentRepository;
    private final RecruitmentTransitionService recruitmentTransitionService;
    private final AiAnalysisService aiAnalysisService;
    private final com.hrm.ai.service.AiConsentService aiConsentService;
    private final com.hrm.ai.service.AiCvPipelineService aiCvPipelineService;
    private final com.hrm.ai.service.CvFileSafetyService cvFileSafetyService;
    private final com.hrm.configuration.service.ConfigurationService configurationService;
    private final InterviewService interviewService;

    public Application getApplicationById(Long id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));
    }

    @Transactional
    public Application viewApplication(Long id, Long viewerId) {
        Application application = getApplicationById(id);
        if (application.getFirstViewedAt() == null) {
            application.setFirstViewedAt(java.time.LocalDateTime.now());
            application.setViewedBy(viewerId);
        }
        return application;
    }

    public List<AiDecisionLog> getAiLogsForApplication(Long applicationId) {
        return aiDecisionLogRepository.findByApplicationId(applicationId);
    }

    public List<Application> getApplicationsByJobPosting(Long jobId, com.hrm.security.CustomUserDetails currentUser) {
        if (!jobPostingService.hasAccessToJob(jobId, currentUser)) {
            return java.util.Collections.emptyList();
        }
        return applicationRepository.findByJobPostingId(jobId);
    }

    public List<Application> getAllApplications() {
        return applicationRepository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
    }

    public org.springframework.data.domain.Page<Application> getApplicationsPaginated(Long jobPostingId, String status, String search, int page, int size, com.hrm.security.CustomUserDetails currentUser) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        
        org.springframework.data.jpa.domain.Specification<Application> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            
            if (jobPostingId != null) {
                predicates.add(cb.equal(root.get("jobPosting").get("id"), jobPostingId));
            }
            if (!jobPostingService.isSpecialRole(currentUser)) {
                jakarta.persistence.criteria.Subquery<Long> subquery = query.subquery(Long.class);
                jakarta.persistence.criteria.Root<com.hrm.recruitment.entity.JobRequisition> reqRoot = subquery.from(com.hrm.recruitment.entity.JobRequisition.class);
                subquery.select(reqRoot.get("id")).where(cb.equal(reqRoot.get("requesterId"), currentUser.getUserId()));
                
                predicates.add(root.get("jobPosting").get("jobRequisitionId").in(subquery));
            }
            if (status != null && !status.isEmpty() && !"ALL".equals(status)) {
                if ("NEEDS_VERIFICATION".equals(status)) {
                    predicates.add(cb.equal(root.get("approvalStatus"), ApplicationStatus.PENDING_HR_CV_REVIEW));
                    predicates.add(cb.isTrue(root.get("needsVerification")));
                } else if ("PENDING_HR_CV_REVIEW".equals(status)) {
                    predicates.add(cb.equal(root.get("approvalStatus"), ApplicationStatus.PENDING_HR_CV_REVIEW));
                    predicates.add(cb.isFalse(root.get("needsVerification")));
                } else {
                    predicates.add(cb.equal(root.get("approvalStatus"), ApplicationStatus.valueOf(status)));
                }
            }
            if (search != null && !search.isEmpty()) {
                String searchPattern = "%" + search.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("fullName")), searchPattern),
                        cb.like(cb.lower(root.get("email")), searchPattern)
                ));
            }
            
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        
        return applicationRepository.findAll(spec, pageable);
    }

    private String getReviewerString(com.hrm.security.CustomUserDetails userDetails) {
        String departmentName = "";
        if (userDetails.getDepartmentId() != null) {
            com.hrm.common.entity.Department dept = departmentRepository.findById(userDetails.getDepartmentId()).orElse(null);
            if (dept != null) {
                departmentName = dept.getTenPhong();
            }
        }

        String roleName = "";
        if (userDetails.getRole() != null) {
            switch (userDetails.getRole()) {
                case TRUONG_PHONG: roleName = "Trưởng phòng"; break;
                case GIAM_DOC_PHONG_BAN: roleName = "Giám đốc"; break;
                case CEO: roleName = "Tổng Giám đốc (CEO)"; break;
                case ADMIN: roleName = "Admin"; break;
                default: roleName = "Nhân viên"; break;
            }
        }

        String chucDanh = roleName + (departmentName.isEmpty() ? "" : " " + departmentName);
        return userDetails.getHoTen() + " - " + chucDanh;
    }

    @Transactional
    public Application approveApplication(
            Long id,
            com.hrm.security.CustomUserDetails userDetails,
            String feedback,
            String requestId,
            String idempotencyKey) {
        Application app = getApplicationById(id);
        Role targetRole = app.getJobPosting().getTargetRole();
        if (targetRole == null) {
            targetRole = Role.NHAN_VIEN; // fallback
        }
        
        // --- BẢO MẬT: Phân quyền duyệt chuyên môn Nhân viên ---
        if (targetRole == Role.NHAN_VIEN && userDetails.getRole() == Role.TRUONG_PHONG) {
            if (app.getApprovalStatus() == ApplicationStatus.PENDING_TECH_CV_REVIEW ||
                app.getApprovalStatus() == ApplicationStatus.PENDING_INTERVIEW_1 ||
                app.getApprovalStatus() == ApplicationStatus.PENDING_INTERVIEW_2) {
                
                if (userDetails.getDepartmentId() == null || 
                    !userDetails.getDepartmentId().equals(app.getJobPosting().getDepartmentId())) {
                    throw new RuntimeException("Bạn không có quyền duyệt hồ sơ chuyên môn của phòng ban khác");
                }
            }
        }
        
        RecruitmentAction action;
        switch (app.getApprovalStatus()) {
            case PENDING_HR_CV_REVIEW:
                requireFeedback(feedback, "Nhận xét HR");
                app.setHrReviewFeedback(feedback);
                app.setHrReviewer(getReviewerString(userDetails));
                action = RecruitmentAction.APPROVE_HR_CV;
                break;
            case PENDING_TECH_CV_REVIEW:
                requireFeedback(feedback, "Nhận xét chuyên môn");
                app.setTechReviewFeedback(feedback);
                app.setTechReviewer(getReviewerString(userDetails));
                action = RecruitmentAction.APPROVE_TECH_CV;
                break;
            case PENDING_INTERVIEW_1:
                requireFeedback(feedback, "Kết luận phỏng vấn vòng 1");
                interviewService.requireReadyToPass(id, 1);
                app.setInterview1Feedback(feedback);
                app.setInterview1Reviewer(getReviewerString(userDetails));
                action = RecruitmentAction.PASS_INTERVIEW_1;
                break;
            case PENDING_INTERVIEW_2:
                requireFeedback(feedback, "Kết luận phỏng vấn vòng 2 và đàm phán");
                interviewService.requireReadyToPass(id, 2);
                app.setInterview2Feedback(feedback);
                app.setInterview2Reviewer(getReviewerString(userDetails));
                action = RecruitmentAction.PASS_INTERVIEW_2;
                break;
            case PENDING_HR_OFFER:
            case PENDING_OFFER_APPROVAL:
                throw com.hrm.exception.AppException.conflict(
                        "Offer phải được xử lý qua API offer versioned, không dùng endpoint duyệt hồ sơ chung");
            default:
                throw com.hrm.exception.AppException.conflict(
                        "Trạng thái hiện tại không cho phép duyệt: " + app.getApprovalStatus());
        }
        return recruitmentTransitionService.transitionApplication(
                app,
                action,
                userDetails.getUserId(),
                userDetails.getRole(),
                feedback,
                requestId,
                idempotencyKey);
    }

    @Transactional
    public Application rejectApplication(
            Long id,
            com.hrm.security.CustomUserDetails userDetails,
            String reason,
            String requestId,
            String idempotencyKey) {
        Application app = getApplicationById(id);

        if (app.getApprovalStatus() == ApplicationStatus.PENDING_OFFER_APPROVAL
                || app.getApprovalStatus() == ApplicationStatus.OFFER_INTERNALLY_APPROVED) {
            throw com.hrm.exception.AppException.conflict(
                    "Hồ sơ ở giai đoạn offer phải được xử lý qua API offer versioned");
        }
        if (app.getApprovalStatus() == ApplicationStatus.PENDING_HR_OFFER) {
            boolean isHrDirector = userDetails.getRole() == Role.GIAM_DOC_PHONG_BAN
                    && userDetails.getDepartmentId() != null
                    && departmentRepository.findById(userDetails.getDepartmentId())
                    .map(department -> "Nhân sự".equalsIgnoreCase(department.getTenPhong().trim()))
                    .orElse(false);
            if (userDetails.getRole() != Role.CEO && !isHrDirector) {
                throw com.hrm.exception.AppException.forbidden(
                        "Từ giai đoạn offer, chỉ HR Head hoặc CEO được từ chối hồ sơ");
            }
        }

        Role targetRole = app.getJobPosting().getTargetRole();
        if (targetRole == null) targetRole = Role.NHAN_VIEN;

        // --- BẢO MẬT: Phân quyền từ chối chuyên môn Nhân viên ---
        if (targetRole == Role.NHAN_VIEN && userDetails.getRole() == Role.TRUONG_PHONG) {
            if (app.getApprovalStatus() == ApplicationStatus.PENDING_TECH_CV_REVIEW ||
                app.getApprovalStatus() == ApplicationStatus.PENDING_INTERVIEW_1 ||
                app.getApprovalStatus() == ApplicationStatus.PENDING_INTERVIEW_2) {
                
                boolean isSameDepartment = userDetails.getDepartmentId() != null && 
                    userDetails.getDepartmentId().equals(app.getJobPosting().getDepartmentId());
                
                boolean isHR = false;
                if (userDetails.getDepartmentId() != null) {
                    com.hrm.common.entity.Department dept = departmentRepository.findById(userDetails.getDepartmentId()).orElse(null);
                    if (dept != null && "Nhân sự".equals(dept.getTenPhong())) {
                        isHR = true;
                    }
                }
                
                if (!isSameDepartment && !isHR) {
                    throw new RuntimeException("Bạn không có quyền từ chối hồ sơ chuyên môn của phòng ban khác");
                }
            }
        }
        app.setRejectionReason(reason);
        app.setRejectorName(getReviewerString(userDetails));
        
        // Ghi Log AI Decision cho việc từ chối thủ công
        String rejecterName = userDetails.getHoTen() != null ? userDetails.getHoTen() : "Người duyệt";
        AiDecisionLog logEntry = AiDecisionLog.builder()
                .applicationId(app.getId())
                .actionType("MANUAL_REJECTION")
                .rawRequest(rejecterName + " từ chối")
                .decisionReason(reason)
                .isSuccess(true)
                .build();
        aiDecisionLogRepository.save(logEntry);
        
        Application savedApp = recruitmentTransitionService.transitionApplication(
                app,
                RecruitmentAction.REJECT_APPLICATION,
                userDetails.getUserId(),
                userDetails.getRole(),
                reason,
                requestId,
                idempotencyKey);

        // Force optimistic-lock/constraint checks before the external email side effect.
        applicationRepository.flush();
        
        // Gửi email cảm ơn
        emailService.sendRejectionEmail(savedApp.getEmail(), savedApp.getFullName(), savedApp.getJobPosting().getTitle());
        
        return savedApp;
    }

    public void deleteApplication(Long id) {
        Application app = getApplicationById(id);
        // Should optionally delete files from Cloudinary here if needed, but for now just delete DB record
        applicationRepository.delete(app);
    }

    /**
     * Nộp hồ sơ công khai — CHỈ lưu DB, KHÔNG gọi AI.
     * AI sẽ được chạy thủ công bởi Trưởng phòng qua endpoint riêng.
     * Lý do: tránh lãng phí token AI khi ứng viên spam hồ sơ.
     */
    @Transactional
    public Application submitApplication(String slug, String fullName, String email, String phone,
                                         MultipartFile cvFile, MultipartFile cccdFile,
                                         String rawCvTextFrontend, String extractedData,
                                         boolean aiConsent) throws IOException {
        JobPosting job = jobPostingService.getJobBySlug(slug);

        if (job.getStatus() != JobPostingStatus.OPEN) {
            throw new RuntimeException("Tin tuyển dụng này đã đóng");
        }
        
        if (job.getHanNopHoSo() != null && java.time.LocalDateTime.now().isAfter(job.getHanNopHoSo())) {
            throw new RuntimeException("Đợt tuyển dụng này đã hết hạn nộp hồ sơ (" + job.getHanNopHoSo().toLocalDate() + ")");
        }
        


        // Chống nộp trùng (Double-submit prevention)
        java.time.LocalDateTime fiveMinutesAgo = java.time.LocalDateTime.now().minusMinutes(5);
        if (applicationRepository.existsByEmailAndJobPostingIdAndCreatedAtAfter(email, job.getId(), fiveMinutesAgo)) {
            throw new RuntimeException("Bạn vừa nộp hồ sơ cho vị trí này gần đây. Vui lòng thử lại sau 5 phút nếu có lỗi.");
        }

        // 1. Đọc text thật từ file PDF: Sẽ được chạy ngầm trong AsyncUploadService để tránh treo UI.
        if (cccdFile != null && !cccdFile.isEmpty()) {
            throw com.hrm.exception.AppException.badRequest(
                    "Không thu thập CCCD ở bước ứng tuyển; giấy tờ định danh chỉ dùng khi pre-boarding");
        }
        if (cvFile == null || cvFile.isEmpty()) {
            throw com.hrm.exception.AppException.badRequest("CV là bắt buộc");
        }
        com.hrm.ai.service.CvFileSafetyService.ValidatedCv validated =
                cvFileSafetyService.validateAndExtract(cvFile.getBytes(), cvFile.getOriginalFilename());

        // Lưu hồ sơ với rawCvText tạm thời, AsyncUploadService sẽ cập nhật lại sau

        Application application = Application.builder()
                .jobPosting(job)
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .cvUrl("UPLOADING")
                .cccdUrl(null)
                .rawCvText("Đang trích xuất văn bản (chạy ngầm)...") // Lưu tạm thời, AsyncUploadService sẽ cập nhật
                .extractedData(extractedData)     // Lưu thông tin người dùng đã xác nhận từ frontend
                .rawCvText(null)
                .approvalStatus(com.hrm.recruitment.entity.ApplicationStatus.PENDING_HR_CV_REVIEW)
                .needsVerification(false)
                .isPriority(false)
                .fraudFlagged(false)
                .fitScore(0)
                .build();

        Application savedApp = applicationRepository.saveAndFlush(application);
        
        // Kích hoạt tiến trình upload file ngầm lên Cloudinary
        aiConsentService.record(savedApp.getId(), aiConsent);
        boolean aiEnabled = "ON".equalsIgnoreCase(configurationService.requireString("ai.mode"));
        AiAnalysis run = aiAnalysisService.createRun(savedApp, aiConsent && aiEnabled);
        Long queuedRunId = run.getStatus() == com.hrm.ai.entity.AiAnalysisStatus.QUEUED ? run.getId() : null;
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override public void afterCommit() {
                        asyncUploadService.uploadAndAnalyze(savedApp.getId(), validated, queuedRunId);
                    }
                });
        

        
        return savedApp;
    }

    /**
     * Chạy AI đánh giá thủ công — chỉ Trưởng phòng / Giám đốc mới gọi được.
     * Gọi qua POST /api/recruitment/applications/{id}/run-ai
     */
    public Application triggerAiReview(Long id) {
        Application app = getApplicationById(id);
        if (id != null) {
            if (!aiConsentService.isGranted(id)) {
                throw com.hrm.exception.AppException.conflict(
                        "Ứng viên chưa đồng ý phân tích CV bằng AI; không được gửi CV cho nhà cung cấp AI");
            }
            aiCvPipelineService.queueFromStoredText(id);
            return applicationRepository.findById(id).orElse(app);
        }

        String rawCvText = app.getRawCvText();
        JobPosting jd = app.getJobPosting();

        AiAnalysis analysisRun = aiAnalysisService.start(app);
        try {
            processAiPipeline(app, jd, rawCvText);
        } catch (Exception e) {
            aiAnalysisService.fail(analysisRun, e);
            System.err.println("CRITICAL AI ERROR:");
            e.printStackTrace();
            log.error("Manual AI trigger failed for application {}.", app.getId(), e);
            throw new RuntimeException("AI đánh giá thất bại: " + e.getMessage());
        }

        Application refreshed = applicationRepository.findById(id).orElse(app);
        aiAnalysisService.complete(analysisRun, refreshed);
        return refreshed;
    }

    /**
     * Chạy luồng AI sau khi lưu application
     */
    private void processAiPipeline(Application app, JobPosting jd, String rawCvText) {
        if (rawCvText == null || rawCvText.trim().isEmpty()) {
            app.setNeedsVerification(true);
            applicationRepository.save(app);
            return;
        }

        // BƯỚC 0: Xác minh danh tính (KHÔNG tốn token - so sánh chuỗi thuần)
        // Kiểm tra tên và email ứng viên nhập vào có xuất hiện trong text CV không
        String cvTextLower = rawCvText.toLowerCase();
        String submittedName = app.getFullName() != null ? app.getFullName().toLowerCase() : "";
        String submittedEmail = app.getEmail() != null ? app.getEmail().toLowerCase() : "";

        boolean nameInCv = !submittedName.isEmpty() && cvTextLower.contains(submittedName);
        boolean emailInCv = !submittedEmail.isEmpty() && cvTextLower.contains(submittedEmail);

        // Nếu CẢ HAI tên lẫn email đều không có trong CV → CV giả/nộp nhầm CV người khác
        if (!nameInCv && !emailInCv) {
            log.warn("[Pipeline] Identity mismatch! Name='{}' and email='{}' not found in CV. Flagging as fraud.", app.getFullName(), app.getEmail());
            app.setFraudFlagged(true);
            app.setNeedsVerification(true);
            // Ghi log qua repository trực tiếp
            AiDecisionLog identityLog = AiDecisionLog.builder()
                    .applicationId(app.getId())
                    .actionType("FRAUD_DETECTION")
                    .rawRequest("Identity check (no AI token used)")
                    .rawResponse(null)
                    .decisionReason("Gian lận danh tính: Tên '" + app.getFullName() + "' và email '" + app.getEmail() + "' không khớp với nội dung CV. Ứng viên có thể đã nộp CV của người khác.")
                    .isSuccess(true)
                    .build();
            aiDecisionLogRepository.save(identityLog);
            applicationRepository.save(app);
            return;
        }

        // 1. Chấm Fit Score ĐẦU TIÊN (Để tiết kiệm token)
        String capBacStr = jd.getCapBac() != null ? jd.getCapBac() : null;
        String combinedJd = jd.getDescription() + "\n" + (jd.getRequirements() != null ? jd.getRequirements() : "");
        SemanticFitScoreService.FitScoreResult fitScoreResult = semanticFitScoreService.calculateFitScore(app.getId(), rawCvText, combinedJd, capBacStr);
        app.setFitScore(fitScoreResult.score());

        // 2. Chống thao túng. Kết quả chỉ gắn cờ để con người kiểm tra,
        // không được tự động từ chối hoặc chặn hồ sơ đi tiếp.
        FraudDetectionService.FraudResult fraudResult = fraudDetectionService.detectFraud(app.getId(), rawCvText);
        app.setFraudFlagged(fraudResult.isFraud());

        if (fraudResult.isFraud()) {
            app.setNeedsVerification(true);
            applicationRepository.save(app);
            // Có dấu hiệu gian lận -> Dừng lại, không cần tạo câu hỏi phỏng vấn nữa
            return;
        }

        // 3. Trích xuất thông tin & Tạo câu hỏi phỏng vấn (Chỉ chạy khi CV Tốt và Không gian lận)
        String extractedJson = cvExtractionService.extractCvData(app.getId(), jd.getTitle(), rawCvText);
        
        // Giữ lại các trường thông tin ứng viên đã nhập thủ công (Dân tộc, Tôn giáo...)
        String oldExtracted = app.getExtractedData();
        if (oldExtracted != null && !oldExtracted.trim().isEmpty()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                com.fasterxml.jackson.databind.node.ObjectNode oldNode = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(oldExtracted);
                com.fasterxml.jackson.databind.node.ObjectNode newNode = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(extractedJson);
                
                java.util.Iterator<String> fieldNames = oldNode.fieldNames();
                while(fieldNames.hasNext()) {
                    String fieldName = fieldNames.next();
                    if (!newNode.has(fieldName) || newNode.get(fieldName).isNull()) {
                        newNode.set(fieldName, oldNode.get(fieldName));
                    }
                }
                extractedJson = mapper.writeValueAsString(newNode);
            } catch (Exception e) {
                log.warn("Không thể merge extractedData: " + e.getMessage());
            }
        }
        // Đánh giá hoàn tất thành công
        app.setExtractedData(extractedJson);
        applicationRepository.save(app);
    }

    private void requireFeedback(String feedback, String fieldName) {
        if (feedback == null || feedback.isBlank()) {
            throw com.hrm.exception.AppException.badRequest(fieldName + " là bắt buộc");
        }
    }
}
