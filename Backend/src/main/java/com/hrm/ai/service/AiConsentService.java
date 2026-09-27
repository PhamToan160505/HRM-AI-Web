package com.hrm.ai.service;

import com.hrm.configuration.service.ConfigurationService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AiConsentService {

    private final JdbcTemplate jdbcTemplate;
    private final ConfigurationService configurationService;

    public ConsentNotice notice() {
        return new ConsentNotice(
                configurationService.requireString("ai.consent_terms_version"),
                configurationService.requireString("ai.consent_purpose"),
                configurationService.requireString("ai.external_provider_disclosure"));
    }

    @Transactional
    public void record(Long applicationId, boolean granted) {
        ConsentNotice notice = notice();
        jdbcTemplate.update("""
                INSERT INTO candidate_consents
                    (application_id, consent_type, granted, terms_version, purpose,
                     external_provider_disclosed, consented_at, withdrawn_at)
                VALUES (?, 'AI_CV_ANALYSIS', ?, ?, ?, b'1', ?, ?)
                ON DUPLICATE KEY UPDATE
                    granted = VALUES(granted), terms_version = VALUES(terms_version),
                    purpose = VALUES(purpose), external_provider_disclosed = b'1',
                    consented_at = VALUES(consented_at), withdrawn_at = VALUES(withdrawn_at)
                """, applicationId, granted, notice.termsVersion(), notice.purpose(),
                LocalDateTime.now(), granted ? null : LocalDateTime.now());
    }

    public boolean isGranted(Long applicationId) {
        return jdbcTemplate.query("""
                SELECT granted FROM candidate_consents
                WHERE application_id = ? AND consent_type = 'AI_CV_ANALYSIS'
                """, rs -> rs.next() && rs.getBoolean(1), applicationId);
    }

    public record ConsentNotice(String termsVersion, String purpose, String providerDisclosure) {}
}
