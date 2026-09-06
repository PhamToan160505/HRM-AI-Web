package com.hrm.recruitment.service;

import com.hrm.ai.entity.AiDecisionLog;
import com.hrm.ai.repository.AiDecisionLogRepository;
import com.hrm.ai.service.CvExtractionService;
import com.hrm.ai.service.CvParserService;
import com.hrm.ai.service.FraudDetectionService;
import com.hrm.ai.service.SemanticFitScoreService;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPosting;
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
import com.hrm.admin.entity.AccountCreationRequest;
import com.hrm.admin.repository.AccountCreationRequestRepository;
import java.util.List;

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
    private final AccountCreationRequestRepository accountCreationRequestRepository;
    private final com.hrm.recruitment.repository.JobPostingRepository jobPostingRepository;
    private final com.hrm.common.repository.DepartmentRepository departmentRepository;

    public Application getApplicationById(Long id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));
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
                    predicates.add(cb.equal(root.get("approvalStatus"), ApplicationStatus.NEW));
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

    public Application approveApplication(Long id, com.hrm.security.CustomUserDetails userDetails, String feedback) {
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
        
        // State Machine Logic
        switch (app.getApprovalStatus()) {
            case PENDING_HR_CV_REVIEW:
                // HR Duyệt CV
                app.setHrReviewFeedback(feedback);
                app.setHrReviewer(getReviewerString(userDetails));
                app.setApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
                break;
            case PENDING_TECH_CV_REVIEW:
                // Trưởng phòng / GĐ Duyệt CV
                app.setTechReviewFeedback(feedback);
                app.setTechReviewer(getReviewerString(userDetails));
                app.setApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_1);
                break;
            case PENDING_INTERVIEW_1:
                // Pass Phỏng vấn vòng 1
                app.setInterview1Feedback(feedback);
                app.setInterview1Reviewer(getReviewerString(userDetails));
                if (targetRole == Role.TRUONG_PHONG) {
                    app.setApprovalStatus(ApplicationStatus.PENDING_CEO_EVALUATION);
                } else {
                    app.setApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
                }
                break;
            case PENDING_CEO_EVALUATION:
                // TGĐ đánh giá PV 1 của Trưởng phòng
                app.setApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
                break;
            case PENDING_INTERVIEW_2:
                // Pass Phỏng vấn vòng 2 (Đàm phán)
                app.setInterview2Feedback(feedback);
                app.setInterview2Reviewer(getReviewerString(userDetails));
                app.setApprovalStatus(ApplicationStatus.PENDING_HR_OFFER);
                break;
            case PENDING_HR_OFFER:
                // HR lên Bảng Offer trình CEO
                app.setOfferDetails(feedback);
                app.setApprovalStatus(ApplicationStatus.PENDING_OFFER_APPROVAL);
                break;
            case PENDING_OFFER_APPROVAL:
                // TGĐ Duyệt Offer cuối cùng (Có thể lưu lại CEO feedback nếu cần, ở đây tạm thời chỉ duyệt)
                // app.setCeoFeedback(feedback); // Nếu có
                app.setApprovalStatus(ApplicationStatus.OFFER_APPROVED);
                // Gửi Offer Letter
                emailService.sendApprovalEmail(app.getEmail(), app.getFullName(), app.getJobPosting().getTitle()); // Tạm dùng Approval email
                // Tạo tài khoản cho nhân viên mới
                AccountCreationRequest accountReq = AccountCreationRequest.builder()
                        .applicationId(app.getId())
                        .hoTen(app.getFullName())
                        .email(app.getEmail())
                        .chucVu(app.getJobPosting().getTitle())
                        .departmentId(app.getJobPosting().getDepartmentId())
                        .status(AccountCreationRequest.RequestStatus.PENDING)
                        .build();
                accountCreationRequestRepository.save(accountReq);

                // Tự động đóng chiến dịch nếu đã tuyển đủ số lượng
                int currentAccepted = (int) applicationRepository.countByJobPostingIdAndApprovalStatus(app.getJobPosting().getId(), ApplicationStatus.OFFER_APPROVED);
                if (currentAccepted + 1 >= app.getJobPosting().getSoLuongTuyen()) {
                    app.getJobPosting().setStatus("CLOSED");
                    jobPostingRepository.save(app.getJobPosting());
                }
                
                break;
            default:
                throw new RuntimeException("Trạng thái hiện tại không cho phép duyệt: " + app.getApprovalStatus());
        }
        return applicationRepository.save(app);
    }

    public Application rejectApplication(Long id, com.hrm.security.CustomUserDetails userDetails, String reason) {
        Application app = getApplicationById(id);
        if (app.getApprovalStatus() == ApplicationStatus.OFFER_APPROVED || app.getApprovalStatus() == ApplicationStatus.REJECTED) {
            throw new RuntimeException("Hồ sơ đã đóng, không thể từ chối");
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
        app.setApprovalStatus(ApplicationStatus.REJECTED);
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
        
        Application savedApp = applicationRepository.save(app);
        
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
    public Application submitApplication(String slug, String fullName, String email, String phone, MultipartFile cvFile, MultipartFile cccdFile, String rawCvTextFrontend, String extractedData) throws IOException {
        JobPosting job = jobPostingService.getJobBySlug(slug);

        if (!"OPEN".equals(job.getStatus())) {
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
        byte[] cvBytes = (cvFile != null && !cvFile.isEmpty()) ? cvFile.getBytes() : null;

        // Lưu hồ sơ với rawCvText tạm thời, AsyncUploadService sẽ cập nhật lại sau

        Application application = Application.builder()
                .jobPosting(job)
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .cvUrl("UPLOADING")
                .cccdUrl("UPLOADING")
                .rawCvText("Đang trích xuất văn bản (chạy ngầm)...") // Lưu tạm thời, AsyncUploadService sẽ cập nhật
                .extractedData(extractedData)     // Lưu thông tin người dùng đã xác nhận từ frontend
                .approvalStatus(com.hrm.recruitment.entity.ApplicationStatus.NEW) // Vừa mới tạo, chờ AI duyệt
                .needsVerification(false)
                .isPriority(false)
                .fraudFlagged(false)
                .fitScore(0)
                .build();

        Application savedApp = applicationRepository.save(application);
        
        // Kích hoạt tiến trình upload file ngầm lên Cloudinary
        byte[] cccdBytes = (cccdFile != null && !cccdFile.isEmpty()) ? cccdFile.getBytes() : null;
        String cvFilename = cvFile != null ? cvFile.getOriginalFilename() : null;
        String cccdFilename = cccdFile != null ? cccdFile.getOriginalFilename() : null;
        
        asyncUploadService.uploadFilesAndUpdateApplicationAsync(savedApp.getId(), cvBytes, cvFilename, cccdBytes, cccdFilename);
        

        
        return savedApp;
    }

    /**
     * Chạy AI đánh giá thủ công — chỉ Trưởng phòng / Giám đốc mới gọi được.
     * Gọi qua POST /api/recruitment/applications/{id}/run-ai
     */
    public Application triggerAiReview(Long id) {
        Application app = getApplicationById(id);

        String rawCvText = app.getRawCvText();
        JobPosting jd = app.getJobPosting();

        try {
            processAiPipeline(app, jd, rawCvText);
        } catch (Exception e) {
            System.err.println("CRITICAL AI ERROR:");
            e.printStackTrace();
            log.error("Manual AI trigger failed for application {}.", app.getId(), e);
            throw new RuntimeException("AI đánh giá thất bại: " + e.getMessage());
        }

        return applicationRepository.findById(id).orElse(app);
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

        // Nếu điểm quá thấp (< 40), chứng tỏ CV không phù hợp (mismatch)
        // -> Từ chối luôn, KHÔNG chạy kiểm tra gian lận và KHÔNG trích xuất câu hỏi phỏng vấn để tiết kiệm token.
        if (fitScoreResult.score() < 40) {
            app.setApprovalStatus(com.hrm.recruitment.entity.ApplicationStatus.REJECTED);
            applicationRepository.save(app);
            // Gửi email cảm ơn
            emailService.sendRejectionEmail(app.getEmail(), app.getFullName(), jd.getTitle());
            return;
        }

        // 2. Chống gian lận (Chỉ chạy nếu CV có tiềm năng)
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
        // AI duyệt xong, chuyển qua cho HR review CV
        app.setApprovalStatus(com.hrm.recruitment.entity.ApplicationStatus.PENDING_HR_CV_REVIEW);

        applicationRepository.save(app);
    }
}
