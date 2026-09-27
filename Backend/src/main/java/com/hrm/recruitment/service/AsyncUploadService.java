package com.hrm.recruitment.service;

import com.hrm.ai.service.AiAnalysisService;
import com.hrm.ai.service.AiCvPipelineService;
import com.hrm.ai.service.CvFileSafetyService;
import com.hrm.ai.service.CvParserService;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AsyncUploadService {

    private final CloudinaryService cloudinaryService;
    private final ApplicationRepository applicationRepository;
    private final CvParserService cvParserService;
    private final ConfigurationService configurationService;
    private final AiCvPipelineService pipelineService;
    private final AiAnalysisService analysisService;
    private final JdbcTemplate jdbcTemplate;

    @Async
    public void uploadAndAnalyze(Long applicationId, CvFileSafetyService.ValidatedCv validated, Long aiRunId) {
        try {
            Application application = applicationRepository.findById(applicationId)
                    .orElseThrow(() -> new IllegalStateException("Không tìm thấy hồ sơ: " + applicationId));
            String extension = validated.detectedType() == CvFileSafetyService.DetectedType.PDF ? ".pdf" : ".docx";
            String serverFilename = UUID.randomUUID() + extension;
            String cvUrl = cloudinaryService.uploadFileBytes(validated.bytes(), serverFilename, "cvs");

            CvFileSafetyService.ValidatedCv extracted = validated;
            int minChars = configurationService.requireInteger("ai.extraction.min_chars");
            if (validated.detectedType() == CvFileSafetyService.DetectedType.PDF
                    && validated.visibleText().trim().length() < minChars) {
                String ocrText = cvParserService.parseCvFile(validated.bytes(), serverFilename);
                if (ocrText != null && !ocrText.isBlank()) extracted = validated.withOcrText(ocrText.trim());
            }

            application.setCvUrl(cvUrl);
            application.setCccdUrl(null);
            application.setRawCvText(extracted.visibleText());
            applicationRepository.save(application);
            saveDocumentMetadata(applicationId, extracted, cvUrl);

            if (aiRunId != null) pipelineService.process(applicationId, aiRunId, extracted);
        } catch (Exception exception) {
            log.error("Upload/analysis failed for application {}", applicationId, exception);
            if (aiRunId != null) {
                try { analysisService.fail(aiRunId, exception); }
                catch (Exception finalizationError) {
                    log.error("Cannot finalize failed AI run {}", aiRunId, finalizationError);
                }
            }
        }
    }

    private void saveDocumentMetadata(Long applicationId, CvFileSafetyService.ValidatedCv document, String url) {
        int charCount = document.visibleText() == null ? 0 : document.visibleText().length();
        int minChars = configurationService.requireInteger("ai.extraction.min_chars");
        String quality = charCount >= minChars ? "OK" : "UNREADABLE";
        jdbcTemplate.update("""
                INSERT INTO application_documents
                  (application_id, document_type, original_filename, detected_type, file_size_bytes,
                   page_count, storage_url, extraction_method, extraction_quality,
                   extracted_char_count, hidden_text_removed_chars)
                VALUES (?, 'CV', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE storage_url = VALUES(storage_url),
                  original_filename = VALUES(original_filename), detected_type = VALUES(detected_type),
                  file_size_bytes = VALUES(file_size_bytes), page_count = VALUES(page_count),
                  extraction_method = VALUES(extraction_method), extraction_quality = VALUES(extraction_quality),
                  extracted_char_count = VALUES(extracted_char_count),
                  hidden_text_removed_chars = VALUES(hidden_text_removed_chars), updated_at = CURRENT_TIMESTAMP(6)
                """, applicationId, document.originalFilename(), document.detectedType().name(),
                document.bytes().length, document.pageCount(), url, document.extractionMethod().name(),
                quality, charCount, document.hiddenTextRemovedChars());
    }
}
