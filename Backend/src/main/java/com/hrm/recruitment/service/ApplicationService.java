package com.hrm.recruitment.service;

import com.hrm.ai.entity.AiDecisionLog;
import com.hrm.ai.repository.AiDecisionLogRepository;
import com.hrm.ai.service.CvExtractionService;
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

    public Application updateDecisionStatus(Long id, String status) {
        Application app = getApplicationById(id);
        app.setDecisionStatus(status);
        return applicationRepository.save(app);
    }

    /**
     * Nộp hồ sơ công khai — CHỈ lưu DB, KHÔNG gọi AI.
     * AI sẽ được chạy thủ công bởi Trưởng phòng qua endpoint riêng.
     * Lý do: tránh lãng phí token AI khi ứng viên spam hồ sơ.
     */
    public Application submitApplication(String slug, String fullName, String email, String phone, MultipartFile cvFile, MultipartFile cccdFile, String rawCvText) throws IOException {
        JobPosting job = jobPostingService.getJobBySlug(slug);

        if (!"OPEN".equals(job.getStatus())) {
            throw new RuntimeException("Tin tuyển dụng này đã đóng");
        }

        // Upload files
        String cvUrl = cloudinaryService.uploadFile(cvFile, "cvs");
        String cccdUrl = cloudinaryService.uploadFile(cccdFile, "cccds");

        // Lưu hồ sơ với rawCvText để AI dùng sau
        Application application = Application.builder()
                .jobPosting(job)
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .cvUrl(cvUrl)
                .cccdUrl(cccdUrl)
                .rawCvText(rawCvText)          // Lưu lại để Trưởng phòng trigger AI sau
                .decisionStatus("PENDING_AI_REVIEW") // Chờ Trưởng phòng bấm nút đánh giá
                .fraudFlagged(false)
                .fitScore(0)
                .build();

        return applicationRepository.save(application);
    }

    /**
     * Chạy AI đánh giá thủ công — chỉ Trưởng phòng / Giám đốc mới gọi được.
     * Gọi qua POST /api/recruitment/applications/{id}/run-ai
     */
    public Application triggerAiReview(Long id) {
        Application app = getApplicationById(id);

        String rawCvText = app.getRawCvText();
        String jd = app.getJobPosting().getDescription();

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
    private void processAiPipeline(Application app, String jd, String rawCvText) {
        if (rawCvText == null || rawCvText.trim().isEmpty()) {
            app.setDecisionStatus("NEEDS_VERIFICATION");
            applicationRepository.save(app);
            return;
        }

        // 1. Trích xuất CV JSON
        String extractedJson = cvExtractionService.extractCvData(app.getId(), rawCvText);
        app.setExtractedData(extractedJson);

        // 2. Chấm Fit Score
        String capBacStr = app.getJobPosting().getCapBac() != null ? app.getJobPosting().getCapBac().name() : null;
        SemanticFitScoreService.FitScoreResult fitScoreResult = semanticFitScoreService.calculateFitScore(app.getId(), rawCvText, jd, capBacStr);
        app.setFitScore(fitScoreResult.score());

        // 3. Chống gian lận
        FraudDetectionService.FraudResult fraudResult = fraudDetectionService.detectFraud(app.getId(), rawCvText);
        app.setFraudFlagged(fraudResult.isFraud());

        // 4. Quyết định tự động sơ bộ (Dưới 40 điểm tự động reject, hoặc cờ gian lận thì NEEDS_VERIFICATION)
        if (fraudResult.isFraud()) {
            app.setDecisionStatus("NEEDS_VERIFICATION");
        } else if (fitScoreResult.score() < 40) {
            app.setDecisionStatus("REJECTED");
        } else {
            app.setDecisionStatus("PENDING"); // Đợi HR duyệt
        }

        applicationRepository.save(app);
    }
}
