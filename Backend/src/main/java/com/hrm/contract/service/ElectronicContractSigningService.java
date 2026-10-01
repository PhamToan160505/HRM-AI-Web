package com.hrm.contract.service;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.email.service.EmailService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.service.CloudinaryService;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ElectronicContractSigningService {

    private static final String CONSENT_VERSION = "v1.0";
    private static final String CONSENT_TEXT = "Tôi đã đọc, hiểu và đồng ý ký hợp đồng điện tử này; "
            + "tôi xác nhận chữ ký được tạo là của mình và thông tin cung cấp là chính xác.";
    private static final int MAX_FILE_BYTES = 8 * 1024 * 1024;

    private final JdbcTemplate jdbcTemplate;
    private final ContractSigningTokenService tokenService;
    private final EmailService emailService;
    private final CloudinaryService cloudinaryService;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final NotificationService notificationService;

    @Value("${app.public-web-base-url:${APP_PUBLIC_WEB_BASE_URL:http://localhost:5173}}")
    private String publicWebBaseUrl;

    @Transactional
    public SendResult sendToCandidate(Long contractId, LocalDateTime expiresAt, Long actorId,
                                      String idempotencyKey) {
        requireEditor(actorId);
        ContractSigningRow contract = lockContract(contractId);
        if (!List.of("COMPANY_SIGNED", "SENT_TO_CANDIDATE", "CANDIDATE_VIEWED").contains(contract.status())) {
            throw AppException.conflict("Phải có bản hợp đồng phía công ty đã ký trước khi gửi ứng viên");
        }
        LocalDateTime deadline = expiresAt == null ? LocalDateTime.now().plusDays(7) : expiresAt;
        if (!deadline.isAfter(LocalDateTime.now().plusMinutes(15))) {
            throw AppException.badRequest("Hạn ký phải sau thời điểm hiện tại ít nhất 15 phút");
        }
        if (contract.email() == null || contract.email().isBlank()) {
            throw AppException.badRequest("Ứng viên chưa có email để nhận link ký");
        }

        jdbcTemplate.update("""
                UPDATE contract_signing_sessions SET status = 'REVOKED'
                WHERE contract_id = ? AND status IN ('ACTIVE','OTP_VERIFIED')
                """, contractId);
        String token = tokenService.newToken();
        jdbcTemplate.update("""
                INSERT INTO contract_signing_sessions
                    (contract_id, token_hash, status, expires_at, provider, created_by)
                VALUES (?, ?, 'ACTIVE', ?, 'INTERNAL_OTP', ?)
                """, contractId, tokenService.hash(token), deadline, actorId);
        String from = contract.status();
        jdbcTemplate.update("""
                UPDATE employment_contracts SET status = 'SENT_TO_CANDIDATE', row_version = row_version + 1
                WHERE id = ?
                """, contractId);
        appendEvent(contractId, "SIGNING_INVITATION_SENT", from, "SENT_TO_CANDIDATE", actorId,
                "Hạn ký " + deadline, idempotencyKey);

        String url = publicWebBaseUrl.replaceAll("/+$", "") + "/contract-sign/" + token;
        emailService.sendContractSigningInvitation(contract.email(), contract.candidateName(),
                contract.contractNumber(), format(deadline), url);
        return new SendResult(deadline, maskEmail(contract.email()));
    }

    @Transactional
    public PublicSigningView publicView(String rawToken) {
        SigningSession session = requireSession(rawToken, true);
        if (session.viewedAt() == null) {
            jdbcTemplate.update("UPDATE contract_signing_sessions SET viewed_at = NOW(6) WHERE id = ?", session.id());
            if ("SENT_TO_CANDIDATE".equals(session.contractStatus())) {
                jdbcTemplate.update("UPDATE employment_contracts SET status = 'CANDIDATE_VIEWED', row_version = row_version + 1 WHERE id = ?", session.contractId());
                appendEvent(session.contractId(), "CANDIDATE_VIEWED", "SENT_TO_CANDIDATE",
                        "CANDIDATE_VIEWED", null, null, "viewed:" + session.id());
            }
            session = requireSession(rawToken, true);
        }
        return toPublicView(session);
    }

    @Transactional
    public OtpResult sendOtp(String rawToken) {
        SigningSession session = requireSession(rawToken, false);
        if (!List.of("ACTIVE", "OTP_VERIFIED").contains(session.sessionStatus())) {
            throw AppException.conflict("Phiên ký không còn nhận OTP");
        }
        if (session.lastOtpSentAt() != null && session.lastOtpSentAt().plusSeconds(60).isAfter(LocalDateTime.now())) {
            throw AppException.conflict("Vui lòng chờ 60 giây trước khi yêu cầu mã OTP mới");
        }
        String otp = tokenService.newOtp();
        jdbcTemplate.update("""
                UPDATE contract_signing_sessions
                SET otp_hash = ?, otp_expires_at = DATE_ADD(NOW(6), INTERVAL 10 MINUTE),
                    otp_attempts = 0, last_otp_sent_at = NOW(6), status = 'ACTIVE',
                    verification_proof_hash = NULL, verification_expires_at = NULL
                WHERE id = ?
                """, tokenService.hash(rawToken + ":" + otp), session.id());
        emailService.sendContractSigningOtp(session.email(), session.candidateName(), otp);
        return new OtpResult(maskEmail(session.email()), 600);
    }

    @Transactional
    public VerificationResult verifyOtp(String rawToken, String otp) {
        SigningSession session = requireSession(rawToken, false);
        if (session.otpHash() == null || session.otpExpiresAt() == null
                || session.otpExpiresAt().isBefore(LocalDateTime.now())) {
            throw AppException.badRequest("Mã OTP đã hết hạn; vui lòng yêu cầu mã mới");
        }
        if (session.otpAttempts() >= 5) {
            throw AppException.forbidden("Bạn đã nhập sai OTP quá 5 lần; vui lòng yêu cầu mã mới");
        }
        if (!tokenService.matches(rawToken + ":" + otp, session.otpHash())) {
            jdbcTemplate.update("UPDATE contract_signing_sessions SET otp_attempts = otp_attempts + 1 WHERE id = ?", session.id());
            throw AppException.badRequest("Mã OTP không chính xác");
        }
        String proof = tokenService.newVerificationProof();
        jdbcTemplate.update("""
                UPDATE contract_signing_sessions
                SET status = 'OTP_VERIFIED', otp_verified_at = NOW(6), otp_hash = NULL,
                    verification_proof_hash = ?, verification_expires_at = DATE_ADD(NOW(6), INTERVAL 30 MINUTE)
                WHERE id = ?
                """, tokenService.hash(rawToken + ":" + proof), session.id());
        appendEvent(session.contractId(), "CANDIDATE_OTP_VERIFIED", session.contractStatus(),
                session.contractStatus(), null, null, "otp-verified:" + session.id());
        return new VerificationResult(proof, 1800);
    }

    @Transactional
    public PublicSigningView sign(String rawToken, SignCommand command, String ipAddress, String userAgent) {
        SigningSession session = requireVerified(rawToken, command.verificationProof());
        int claimed = jdbcTemplate.update("""
                UPDATE contract_signing_sessions SET status = 'SIGNED'
                WHERE id = ? AND status = 'OTP_VERIFIED' AND verification_proof_hash = ?
                """, session.id(), tokenService.hash(rawToken + ":" + command.verificationProof()));
        if (claimed != 1) throw AppException.conflict("Phiên ký đã được xử lý ở một yêu cầu khác");
        if (!command.consentAccepted()) throw AppException.badRequest("Bạn phải xác nhận đồng ý ký hợp đồng");
        String signerName = required(command.signerName(), "Họ tên người ký");
        String method = required(command.method(), "Phương thức ký").toUpperCase();
        if (!List.of("DRAWN", "TYPED", "UPLOADED").contains(method)) {
            throw AppException.badRequest("Phương thức ký không hợp lệ");
        }
        String signatureData = required(command.signatureData(), "Dữ liệu chữ ký");
        if (signatureData.length() > 1_500_000) throw AppException.badRequest("Ảnh chữ ký quá lớn");

        try {
            byte[] source = companyPdfBytes(session.contractId(), session.companyFileUrl());
            LocalDateTime signedAt = LocalDateTime.now();
            byte[] completed = appendSignatureEvidence(source, signerName, method, signatureData,
                    signedAt, ipAddress, session.contractNumber());
            String sha = sha256(completed);
            String fileName = session.contractNumber() + "-fully-signed.pdf";
            String url = cloudinaryService.uploadFileBytes(completed, fileName, "contracts/completed");
            String signatureHash = sha256(signatureData.getBytes(StandardCharsets.UTF_8));

            jdbcTemplate.update("""
                    INSERT INTO contract_artifacts
                        (contract_id, artifact_type, version_number, file_url, file_name, sha256, file_bytes, immutable_artifact)
                    VALUES (?, 'FULLY_SIGNED', 1, ?, ?, ?, ?, b'1')
                    """, session.contractId(), url, fileName, sha, completed);
            jdbcTemplate.update("""
                    UPDATE contract_signing_sessions
                    SET status = 'SIGNED', signer_name = ?, sign_method = ?, signature_data_hash = ?,
                        consent_version = ?, consent_text = ?, signed_at = ?, ip_address = ?, user_agent = ?,
                        verification_proof_hash = NULL, verification_expires_at = NULL
                    WHERE id = ?
                    """, signerName, method, signatureHash, CONSENT_VERSION, CONSENT_TEXT, signedAt,
                    trimTo(ipAddress, 100), trimTo(userAgent, 500), session.id());
            jdbcTemplate.update("""
                    UPDATE employment_contracts
                    SET status = 'CANDIDATE_SIGNED', candidate_signed_at = ?, candidate_signer_name = ?,
                        candidate_sign_method = ?, final_file_url = ?, final_file_sha256 = ?,
                        row_version = row_version + 1
                    WHERE id = ?
                    """, signedAt, signerName, method, url, sha, session.contractId());
            appendEvent(session.contractId(), "CANDIDATE_SIGNED", session.contractStatus(),
                    "CANDIDATE_SIGNED", null, "OTP + " + method, "candidate-signed:" + session.id());
            notifyContractOwner(session.contractId(), "Ứng viên đã ký hợp đồng",
                    session.candidateName() + " đã hoàn tất ký hợp đồng " + session.contractNumber() + ".");
            emailService.sendContractSignedConfirmation(session.email(), session.candidateName(),
                    session.contractNumber(), publicWebBaseUrl.replaceAll("/+$", "") + "/contract-sign/" + rawToken);
            return toPublicView(requireSession(rawToken, false));
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể tạo bản hợp đồng hoàn tất", exception);
        }
    }

    @Transactional
    public PublicSigningView decline(String rawToken, DeclineCommand command, String ipAddress, String userAgent) {
        SigningSession session = requireVerified(rawToken, command.verificationProof());
        String reason = required(command.reason(), "Lý do từ chối ký");
        int claimed = jdbcTemplate.update("""
                UPDATE contract_signing_sessions SET status = 'DECLINED', declined_at = NOW(6),
                    decline_reason = ?, ip_address = ?, user_agent = ?, verification_proof_hash = NULL
                WHERE id = ? AND status = 'OTP_VERIFIED'
                """, reason, trimTo(ipAddress, 100), trimTo(userAgent, 500), session.id());
        if (claimed != 1) throw AppException.conflict("Phiên ký đã được xử lý ở một yêu cầu khác");
        jdbcTemplate.update("UPDATE employment_contracts SET status = 'DECLINED', row_version = row_version + 1 WHERE id = ?",
                session.contractId());
        appendEvent(session.contractId(), "CANDIDATE_DECLINED_SIGNATURE", session.contractStatus(),
                "DECLINED", null, reason, "candidate-declined:" + session.id());
        notifyContractOwner(session.contractId(), "Ứng viên từ chối ký hợp đồng",
                session.candidateName() + " đã từ chối ký hợp đồng " + session.contractNumber()
                        + ". Lý do: " + reason);
        return toPublicView(requireSession(rawToken, false));
    }

    @Transactional
    public void activate(Long contractId, Long actorId, String idempotencyKey) {
        requireEditor(actorId);
        ContractSigningRow contract = lockContract(contractId);
        if ("ACTIVE".equals(contract.status())) return;
        if (!"CANDIDATE_SIGNED".equals(contract.status())) {
            throw AppException.conflict("Chỉ kích hoạt hợp đồng sau khi ứng viên đã ký");
        }
        List<Map<String, Object>> seats = jdbcTemplate.queryForList("""
                SELECT hs.id AS seat_id, hs.requisition_id
                FROM hiring_seats hs
                WHERE hs.application_id = ? AND hs.offer_id = ? AND hs.status = 'ACCEPTED'
                ORDER BY hs.id DESC LIMIT 1
                """, contract.applicationId(), contract.offerId());
        if (seats.isEmpty()) throw AppException.conflict("Không tìm thấy suất tuyển dụng đã được ứng viên chấp nhận");
        Map<String, Object> seat = seats.get(0);
        jdbcTemplate.update("""
                UPDATE employment_contracts SET status = 'ACTIVE', activated_by = ?, activated_at = NOW(6),
                    row_version = row_version + 1 WHERE id = ?
                """, actorId, contractId);
        appendEvent(contractId, "CONTRACT_ACTIVATED", "CANDIDATE_SIGNED", "ACTIVE", actorId,
                null, idempotencyKey);
        String payload = """
                {"conversion_key":"%s","application_id":%d,"accepted_offer_id":%d,"seat_id":%d,"contract_id":%d}
                """.formatted(contract.applicationId() + ":" + contract.offerId(), contract.applicationId(),
                contract.offerId(), ((Number) seat.get("seat_id")).longValue(), contractId).trim();
        jdbcTemplate.update("""
                INSERT INTO outbox_events
                    (event_id, event_type, schema_version, correlation_id, producer,
                     aggregate_type, aggregate_id, payload, status, attempt_count, next_attempt_at)
                VALUES (?, 'CONTRACT_ACTIVATED', 1, ?, 'contract-signing',
                        'CONTRACT', ?, CAST(? AS JSON), 'PENDING', 0, NOW(6))
                """, UUID.randomUUID().toString(), UUID.randomUUID().toString(),
                String.valueOf(contractId), payload);
    }

    @Transactional(readOnly = true)
    public DocumentDownload finalDocument(String rawToken) {
        SigningSession session = requireSession(rawToken, true);
        if (!"SIGNED".equals(session.sessionStatus())
                && !List.of("CANDIDATE_SIGNED", "ACTIVE").contains(session.contractStatus())) {
            throw AppException.forbidden("Hợp đồng chưa hoàn tất chữ ký hai bên");
        }
        List<DocumentDownload> rows = jdbcTemplate.query("""
                SELECT file_name, file_bytes FROM contract_artifacts
                WHERE contract_id = ? AND artifact_type = 'FULLY_SIGNED'
                ORDER BY version_number DESC LIMIT 1
                """, (rs, row) -> new DocumentDownload(rs.getString("file_name"), rs.getBytes("file_bytes")),
                session.contractId());
        if (rows.isEmpty() || rows.get(0).bytes() == null) {
            throw AppException.notFound("Không tìm thấy bản hợp đồng hoàn tất");
        }
        return rows.get(0);
    }

    private SigningSession requireVerified(String rawToken, String proof) {
        SigningSession session = requireSession(rawToken, false);
        if (!"OTP_VERIFIED".equals(session.sessionStatus()) || session.verificationExpiresAt() == null
                || session.verificationExpiresAt().isBefore(LocalDateTime.now())
                || !tokenService.matches(rawToken + ":" + proof, session.verificationProofHash())) {
            throw AppException.forbidden("Phiên xác thực OTP không hợp lệ hoặc đã hết hạn");
        }
        return session;
    }

    private SigningSession requireSession(String rawToken, boolean allowCompleted) {
        if (rawToken == null || rawToken.isBlank()) throw AppException.badRequest("Link ký không hợp lệ");
        List<SigningSession> rows = jdbcTemplate.query("""
                SELECT s.id, s.contract_id, s.status AS session_status, s.expires_at, s.viewed_at,
                       s.otp_hash, s.otp_expires_at, s.otp_attempts, s.last_otp_sent_at,
                       s.verification_proof_hash, s.verification_expires_at,
                       c.status AS contract_status, c.contract_number, c.generated_html,
                       c.signed_file_url AS company_file_url, c.final_file_url,
                       c.candidate_signed_at, a.full_name, a.email, jp.title AS job_title
                FROM contract_signing_sessions s
                JOIN employment_contracts c ON c.id = s.contract_id
                JOIN applications a ON a.id = c.application_id
                JOIN job_postings jp ON jp.id = a.job_posting_id
                WHERE s.token_hash = ?
                """, (rs, row) -> new SigningSession(
                rs.getLong("id"), rs.getLong("contract_id"), rs.getString("session_status"),
                rs.getObject("expires_at", LocalDateTime.class), rs.getObject("viewed_at", LocalDateTime.class),
                rs.getString("otp_hash"), rs.getObject("otp_expires_at", LocalDateTime.class),
                rs.getInt("otp_attempts"), rs.getObject("last_otp_sent_at", LocalDateTime.class),
                rs.getString("verification_proof_hash"), rs.getObject("verification_expires_at", LocalDateTime.class),
                rs.getString("contract_status"), rs.getString("contract_number"), rs.getString("generated_html"),
                rs.getString("company_file_url"), rs.getString("final_file_url"),
                rs.getObject("candidate_signed_at", LocalDateTime.class), rs.getString("full_name"),
                rs.getString("email"), rs.getString("job_title")), tokenService.hash(rawToken));
        if (rows.isEmpty()) throw AppException.notFound("Liên kết ký không tồn tại hoặc đã bị thu hồi");
        SigningSession session = rows.get(0);
        if (session.expiresAt().isBefore(LocalDateTime.now()) && List.of("ACTIVE", "OTP_VERIFIED").contains(session.sessionStatus())) {
            jdbcTemplate.update("UPDATE contract_signing_sessions SET status = 'EXPIRED' WHERE id = ?", session.id());
            jdbcTemplate.update("UPDATE employment_contracts SET status = 'SIGNING_EXPIRED' WHERE id = ?", session.contractId());
            throw AppException.conflict("Liên kết ký hợp đồng đã hết hạn");
        }
        if (!allowCompleted && List.of("DECLINED", "EXPIRED", "REVOKED").contains(session.sessionStatus())) {
            throw AppException.conflict("Phiên ký không còn hiệu lực");
        }
        return session;
    }

    private PublicSigningView toPublicView(SigningSession session) {
        return new PublicSigningView(session.contractNumber(), session.candidateName(), session.jobTitle(),
                session.generatedHtml(), session.companyFileUrl(), session.finalFileUrl(), session.sessionStatus(),
                session.contractStatus(), session.expiresAt(), session.viewedAt(), session.candidateSignedAt(),
                maskEmail(session.email()), CONSENT_VERSION, CONSENT_TEXT);
    }

    private ContractSigningRow lockContract(Long contractId) {
        List<ContractSigningRow> rows = jdbcTemplate.query("""
                SELECT c.id, c.application_id, c.offer_id, c.status, c.contract_number,
                       a.full_name, a.email
                FROM employment_contracts c JOIN applications a ON a.id = c.application_id
                WHERE c.id = ? FOR UPDATE
                """, (rs, row) -> new ContractSigningRow(rs.getLong("id"), rs.getLong("application_id"),
                rs.getLong("offer_id"), rs.getString("status"), rs.getString("contract_number"),
                rs.getString("full_name"), rs.getString("email")), contractId);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy hợp đồng");
        return rows.get(0);
    }

    private byte[] companyPdfBytes(Long contractId, String fallbackUrl) throws Exception {
        List<byte[]> stored = jdbcTemplate.query("""
                SELECT file_bytes FROM contract_artifacts
                WHERE contract_id = ? AND artifact_type = 'COMPANY_SIGNED'
                ORDER BY version_number DESC LIMIT 1
                """, (rs, row) -> rs.getBytes(1), contractId);
        if (!stored.isEmpty() && stored.get(0) != null) return stored.get(0);
        if (fallbackUrl == null || fallbackUrl.isBlank()) throw AppException.conflict("Không tìm thấy PDF phía công ty đã ký");
        HttpResponse<InputStream> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(fallbackUrl)).GET().build(),
                HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw AppException.conflict("Không thể đọc PDF phía công ty đã ký");
        }
        try (InputStream input = response.body()) {
            byte[] bytes = input.readNBytes(MAX_FILE_BYTES + 1);
            if (bytes.length > MAX_FILE_BYTES) throw AppException.badRequest("PDF hợp đồng vượt giới hạn xử lý");
            return bytes;
        }
    }

    private byte[] appendSignatureEvidence(byte[] source, String signerName, String method,
                                           String signatureData, LocalDateTime signedAt,
                                           String ipAddress, String contractNumber) throws Exception {
        try (PDDocument document = PDDocument.load(source); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            try (PDPageContentStream canvas = new PDPageContentStream(document, page)) {
                write(canvas, 54, 780, 17, "ELECTRONIC SIGNATURE AUDIT");
                write(canvas, 54, 748, 11, "Contract: " + ascii(contractNumber));
                write(canvas, 54, 728, 11, "Candidate: " + ascii(signerName));
                write(canvas, 54, 708, 11, "Method: " + method + " + EMAIL OTP");
                write(canvas, 54, 688, 11, "Signed at: " + signedAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) + " Asia/Ho_Chi_Minh");
                write(canvas, 54, 668, 11, "IP evidence: " + ascii(ipAddress));
                write(canvas, 54, 638, 10, "Consent version: " + CONSENT_VERSION);
                write(canvas, 54, 620, 9, ascii(CONSENT_TEXT));
                if ("TYPED".equals(method)) {
                    write(canvas, 70, 500, 24, ascii(signatureData));
                } else {
                    byte[] image = decodeDataUrl(signatureData);
                    PDImageXObject signature = PDImageXObject.createFromByteArray(document, image, "candidate-signature");
                    float width = 260;
                    float height = Math.min(120, width * signature.getHeight() / signature.getWidth());
                    canvas.drawImage(signature, 70, 470, width, height);
                }
                write(canvas, 54, 420, 9, "Document hash is stored in the HRM audit ledger after this page is appended.");
            }
            document.getDocumentInformation().setCustomMetadataValue("HRM-Signature-Method", method);
            document.getDocumentInformation().setCustomMetadataValue("HRM-Signed-At", signedAt.toString());
            document.save(output);
            return output.toByteArray();
        }
    }

    private void write(PDPageContentStream canvas, float x, float y, float size, String text) throws Exception {
        canvas.beginText();
        canvas.setFont(size >= 16 ? PDType1Font.HELVETICA_BOLD : PDType1Font.HELVETICA, size);
        canvas.newLineAtOffset(x, y);
        canvas.showText(text == null ? "" : text.substring(0, Math.min(text.length(), 110)));
        canvas.endText();
    }

    private byte[] decodeDataUrl(String value) {
        String encoded = value.contains(",") ? value.substring(value.indexOf(',') + 1) : value;
        try { return Base64.getDecoder().decode(encoded); }
        catch (Exception exception) { throw AppException.badRequest("Ảnh chữ ký không hợp lệ"); }
    }

    private void appendEvent(Long contractId, String type, String from, String to, Long actorId,
                             String comment, String idempotencyKey) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO contract_events
                    (contract_id, event_type, from_status, to_status, actor_id, comment, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, contractId, type, from, to, actorId, comment,
                idempotencyKey == null || idempotencyKey.isBlank() ? UUID.randomUUID().toString() : idempotencyKey);
    }

    private void notifyContractOwner(Long contractId, String title, String body) {
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT created_by, application_id FROM employment_contracts WHERE id = ?", contractId);
        notificationService.createNotification(((Number) row.get("created_by")).longValue(),
                "CONTRACT_SIGNATURE", title, body, "cao",
                "/recruitment/applications/" + row.get("application_id"));
    }

    private void requireEditor(Long actorId) {
        User user = userRepository.findById(actorId).filter(value -> Boolean.TRUE.equals(value.getActive()))
                .orElseThrow(() -> AppException.forbidden("Tài khoản không hợp lệ"));
        if (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN || isDepartment(user, "nhân sự")) return;
        throw AppException.forbidden("Chỉ HR, CEO hoặc Admin được quản lý ký hợp đồng");
    }

    private boolean isDepartment(User user, String expected) {
        if (user.getDepartmentId() == null) return false;
        String name = departmentRepository.findById(user.getDepartmentId()).map(Department::getTenPhong).orElse("");
        return ascii(name).toLowerCase().contains(ascii(expected).toLowerCase());
    }

    private String ascii(String value) {
        return java.text.Normalizer.normalize(value == null ? "" : value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D')
                .replaceAll("[^\\x20-\\x7E]", "");
    }

    private String sha256(byte[] value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    }

    private String required(String value, String label) {
        if (value == null || value.isBlank()) throw AppException.badRequest(label + " là bắt buộc");
        return value.trim();
    }

    private String maskEmail(String email) {
        int at = email == null ? -1 : email.indexOf('@');
        if (at <= 1) return "***";
        return email.substring(0, 2) + "***" + email.substring(at);
    }

    private String format(LocalDateTime value) {
        return value.format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy"));
    }

    private String trimTo(String value, int max) {
        if (value == null) return null;
        return value.substring(0, Math.min(value.length(), max));
    }

    private record ContractSigningRow(Long id, Long applicationId, Long offerId, String status,
                                      String contractNumber, String candidateName, String email) {}
    private record SigningSession(Long id, Long contractId, String sessionStatus, LocalDateTime expiresAt,
                                  LocalDateTime viewedAt, String otpHash, LocalDateTime otpExpiresAt,
                                  int otpAttempts, LocalDateTime lastOtpSentAt, String verificationProofHash,
                                  LocalDateTime verificationExpiresAt, String contractStatus, String contractNumber,
                                  String generatedHtml, String companyFileUrl, String finalFileUrl,
                                  LocalDateTime candidateSignedAt, String candidateName, String email,
                                  String jobTitle) {}

    public record SendCommand(LocalDateTime expiresAt) {}
    public record SendResult(LocalDateTime expiresAt, String candidateEmailMasked) {}
    public record VerifyOtpCommand(String otp) {}
    public record VerificationResult(String verificationProof, int expiresInSeconds) {}
    public record OtpResult(String destination, int expiresInSeconds) {}
    public record SignCommand(String verificationProof, String signerName, String method,
                              String signatureData, boolean consentAccepted) {}
    public record DeclineCommand(String verificationProof, String reason) {}
    public record DocumentDownload(String fileName, byte[] bytes) {}
    public record PublicSigningView(String contractNumber, String candidateName, String jobTitle,
                                    String generatedHtml, String companyFileUrl, String finalFileUrl,
                                    String signingStatus, String contractStatus, LocalDateTime expiresAt,
                                    LocalDateTime viewedAt, LocalDateTime candidateSignedAt,
                                    String candidateEmailMasked, String consentVersion, String consentText) {}
}
