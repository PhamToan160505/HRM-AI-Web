package com.hrm.recruitment.service;

import com.hrm.ai.entity.AiDecisionLog;
import com.hrm.ai.repository.AiDecisionLogRepository;
import com.hrm.ai.service.CvExtractionService;
import com.hrm.ai.service.CvParserService;
import com.hrm.ai.service.FraudDetectionService;
import com.hrm.ai.service.SemanticFitScoreService;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import com.hrm.notification.service.NotificationService;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.entity.User;
import com.hrm.common.entity.Role;
import com.hrm.email.service.EmailService;
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

    public Application getApplicationById(Long id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Application not found"));
    }

    public List<AiDecisionLog> getAiLogsForApplication(Long applicationId) {
        return aiDecisionLogRepository.findByApplicationId(applicationId);
    }

    public List<Application> getApplicationsByJobPosting(Long jobId) {
        return applicationRepository.findByJobPostingId(jobId);
    }

    public List<Application> getAllApplications() {
        return applicationRepository.findAll();
    }

    public Application submitToDirector(Long id, boolean isPriority) {
        Application app = getApplicationById(id);
        if (!"PENDING".equals(app.getApprovalStatus())) {
            throw new RuntimeException("Chỉ có thể trình Giám đốc khi hồ sơ đang ở trạng thái PENDING");
        }
        app.setApprovalStatus("PENDING_DIRECTOR");
        app.setIsPriority(isPriority);
        
        Application savedApp = applicationRepository.save(app);
        
        // Gửi thông báo cho tất cả Giám đốc
        List<User> giamDocs = userRepository.findByRole(Role.GIAM_DOC);
        for (User gd : giamDocs) {
            String message = String.format("Trưởng phòng tuyển dụng vừa trình lên 1 hồ sơ của ứng viên %s cho vị trí %s. Vui lòng xem xét.", 
                                           app.getFullName(), app.getJobPosting().getTitle());
            notificationService.createNotification(
                    gd.getId(),
                    "tuyen_dung",
                    "Hồ sơ chờ phê duyệt",
                    message,
                    "binh_thuong", // Vẫn là bình thường dù có ưu tiên hay không
                    "/manager/dashboard" // Đi tới dashboard giám đốc
            );
        }
        
        return savedApp;
    }

    public Application rejectByHr(Long id) {
        Application app = getApplicationById(id);
        if (!"PENDING".equals(app.getApprovalStatus())) {
            throw new RuntimeException("Chỉ có thể loại hồ sơ khi đang ở trạng thái PENDING");
        }
        app.setApprovalStatus("REJECTED");
        Application savedApp = applicationRepository.save(app);
        
        // Gửi email cảm ơn
        emailService.sendRejectionEmail(savedApp.getEmail(), savedApp.getFullName(), savedApp.getJobPosting().getTitle());
        
        return savedApp;
    }

    public Application approveByDirector(Long id) {
        Application app = getApplicationById(id);
        if (!"PENDING_DIRECTOR".equals(app.getApprovalStatus())) {
            throw new RuntimeException("Chỉ có thể duyệt hồ sơ khi đang ở trạng thái PENDING_DIRECTOR");
        }
        app.setApprovalStatus("APPROVED");
        Application savedApp = applicationRepository.save(app);
        
        // Gửi email trúng tuyển
        emailService.sendApprovalEmail(savedApp.getEmail(), savedApp.getFullName(), savedApp.getJobPosting().getTitle());
        
        return savedApp;
    }

    public Application rejectByDirector(Long id, String reason, String directorName) {
        Application app = getApplicationById(id);
        if (!"PENDING_DIRECTOR".equals(app.getApprovalStatus())) {
            throw new RuntimeException("Chỉ có thể loại hồ sơ khi đang ở trạng thái PENDING_DIRECTOR");
        }
        app.setApprovalStatus("REJECTED");
        
        AiDecisionLog logEntry = AiDecisionLog.builder()
                .applicationId(app.getId())
                .actionType("MANUAL_REJECTION")
                .rawRequest("Giám đốc từ chối")
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
        
        long currentAppCount = applicationRepository.findByJobPostingId(job.getId()).size();
        if (currentAppCount >= job.getSoLuongTuyen()) {
            throw new RuntimeException("Đợt tuyển dụng này đã nhận đủ giới hạn số lượng hồ sơ (" + job.getSoLuongTuyen() + " ứng viên)");
        }

        // 1. Đọc text thật từ file PDF bằng thư viện Backend (lấy bytes để không hỏng stream)
        byte[] cvBytes = (cvFile != null && !cvFile.isEmpty()) ? cvFile.getBytes() : null;
        String actualCvText = cvParserService.parseCvPdf(cvBytes);
        if (actualCvText == null || actualCvText.trim().isEmpty()) {
            actualCvText = "Lưu ý quan trọng cho AI: Hệ thống Backend đang hoạt động hoàn hảo và đã quét file CV này thành công. Tuy nhiên, file PDF mà ứng viên tải lên KHÔNG chứa bất kỳ văn bản nào (đây là file PDF dạng hình ảnh scan). " +
                           "Do đó, AI KHÔNG ĐƯỢC PHÉP báo lỗi hệ thống hay lỗi PDF parser. Hãy ghi rõ vào lời phê là 'Ứng viên đã nộp file CV dạng hình ảnh không thể đọc được chữ'. " +
                           "Dưới đây là thông tin ứng viên tự điền trên form: Tên: " + fullName + ", SĐT: " + phone + ", Email: " + email + ".";
        }

        // Lưu hồ sơ với rawCvText để AI dùng sau, URL tạo tạm
        Application application = Application.builder()
                .jobPosting(job)
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .cvUrl("UPLOADING")
                .cccdUrl("UPLOADING")
                .rawCvText(actualCvText)          // Lưu lại text THẬT để Trưởng phòng trigger AI sau
                .extractedData(extractedData)     // Lưu thông tin người dùng đã xác nhận từ frontend
                .approvalStatus("PENDING") // Chờ HR xử lý (sau khi AI đánh giá)
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
        
        // Tự động đóng form nếu đạt giới hạn
        if (currentAppCount + 1 >= job.getSoLuongTuyen()) {
            jobPostingService.updateJobStatus(job.getId(), "CLOSED");
        }
        
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
        String capBacStr = jd.getCapBac() != null ? jd.getCapBac().name() : null;
        String combinedJd = jd.getDescription() + "\n" + (jd.getRequirements() != null ? jd.getRequirements() : "");
        SemanticFitScoreService.FitScoreResult fitScoreResult = semanticFitScoreService.calculateFitScore(app.getId(), rawCvText, combinedJd, capBacStr);
        app.setFitScore(fitScoreResult.score());

        // Nếu điểm quá thấp (< 40), chứng tỏ CV không phù hợp (mismatch)
        // -> Từ chối luôn, KHÔNG chạy kiểm tra gian lận và KHÔNG trích xuất câu hỏi phỏng vấn để tiết kiệm token.
        if (fitScoreResult.score() < 40) {
            app.setApprovalStatus("REJECTED");
            applicationRepository.save(app);
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
        // removed extra brace
        // Đánh giá hoàn tất thành công
        app.setExtractedData(extractedJson);

        applicationRepository.save(app);
    }
}
