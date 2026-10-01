package com.hrm.contract.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.service.CloudinaryService;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ContractService {

    private static final Set<String> EDITABLE_STATUSES = Set.of("DRAFT", "LEGAL_CHANGES_REQUESTED");
    private static final List<String> REQUIRED_PATHS = List.of(
            "/employee/fullName", "/employee/identityNumber", "/employee/address",
            "/job/title", "/job/workLocation", "/job/contractType",
            "/employment/startDate", "/employer/representativeName",
            "/employer/representativeTitle", "/compensation/baseSalary");

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final CloudinaryService cloudinaryService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<ClauseView> listClauses(Long actorId, boolean includeInactive) {
        requireViewer(actorId);
        String sql = """
                SELECT id, clause_code, title, category, content, required_clause, active,
                       version_number, created_by, created_at, updated_at
                FROM contract_clauses
                """ + (includeInactive ? "" : " WHERE active = b'1'")
                + " ORDER BY required_clause DESC, category, clause_code, version_number DESC";
        return jdbcTemplate.query(sql, (rs, row) -> new ClauseView(
                rs.getLong("id"), rs.getString("clause_code"), rs.getString("title"),
                rs.getString("category"), rs.getString("content"), rs.getBoolean("required_clause"),
                rs.getBoolean("active"), rs.getInt("version_number"),
                (Long) rs.getObject("created_by"), rs.getObject("created_at", LocalDateTime.class),
                rs.getObject("updated_at", LocalDateTime.class)));
    }

    @Transactional
    public ClauseView createClause(ClauseCommand command, Long actorId) {
        requireEditor(actorId);
        String code = required(command.code(), "Mã điều khoản").toUpperCase().replaceAll("[^A-Z0-9_]+", "_");
        String title = required(command.title(), "Tên điều khoản");
        String category = required(command.category(), "Nhóm điều khoản");
        String content = required(command.content(), "Nội dung điều khoản");
        Integer latest = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(version_number), 0) FROM contract_clauses WHERE clause_code = ?",
                Integer.class, code);
        int version = (latest == null ? 0 : latest) + 1;
        jdbcTemplate.update("UPDATE contract_clauses SET active = b'0' WHERE clause_code = ?", code);
        KeyHolder key = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO contract_clauses
                        (clause_code, title, category, content, required_clause, active, version_number, created_by)
                    VALUES (?, ?, ?, ?, ?, b'1', ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, code);
            ps.setString(2, title);
            ps.setString(3, category);
            ps.setString(4, content);
            ps.setBoolean(5, command.requiredClause());
            ps.setInt(6, version);
            ps.setLong(7, actorId);
            return ps;
        }, key);
        return findClause(key.getKey().longValue());
    }

    @Transactional
    public ContractView createFromAcceptedOffer(Long applicationId, Long actorId, String idempotencyKey) {
        requireEditor(actorId);
        List<ContractView> existing = findByApplication(applicationId);
        if (!existing.isEmpty()) return existing.get(0);

        List<Map<String, Object>> sources = jdbcTemplate.queryForList("""
                SELECT a.id AS application_id, a.full_name, a.email, a.phone, a.extracted_data,
                       o.id AS offer_id, o.base_salary, o.allowances_json, o.probation_months,
                       o.probation_salary_rate, o.expected_start_date, o.contract_terms,
                       o.offer_details_json, jp.title AS job_title, d.ten_phong AS department_name,
                       (SELECT e.id FROM employees e WHERE e.application_id = a.id ORDER BY e.id DESC LIMIT 1) AS employee_id
                FROM applications a
                JOIN offers o ON o.application_id = a.id AND o.status = 'ACCEPTED'
                JOIN job_postings jp ON jp.id = a.job_posting_id
                LEFT JOIN departments d ON d.id = jp.department_id
                WHERE a.id = ? AND a.approval_status = 'OFFER_ACCEPTED'
                ORDER BY o.version_number DESC LIMIT 1
                """, applicationId);
        if (sources.isEmpty()) {
            throw AppException.conflict("Chỉ tạo hợp đồng khi ứng viên đã chấp nhận offer");
        }
        Map<String, Object> source = sources.get(0);

        JsonNode offerDetails = parseJson(source.get("offer_details_json"));
        JsonNode extracted = parseJson(source.get("extracted_data"));
        ObjectNode data = objectMapper.createObjectNode();
        ObjectNode employee = data.putObject("employee");
        employee.put("fullName", text(source.get("full_name")));
        employee.put("email", text(source.get("email")));
        employee.put("phone", text(source.get("phone")));
        employee.put("identityNumber", firstText(extracted, "/cccd", "/identityNumber", "/personal/identityNumber"));
        employee.put("address", firstText(extracted, "/address", "/diaChi", "/personal/address"));
        employee.put("identityIssuedDate", firstText(extracted, "/identityIssuedDate", "/personal/identityIssuedDate"));
        employee.put("identityIssuedPlace", firstText(extracted, "/identityIssuedPlace", "/personal/identityIssuedPlace"));

        ObjectNode job = data.putObject("job");
        job.put("title", text(source.get("job_title")));
        job.put("department", text(source.get("department_name")));
        job.put("workLocation", offerDetails.at("/job/workLocation").asText(""));
        job.put("contractType", offerDetails.at("/job/contractType").asText("FIXED_TERM"));
        if (offerDetails.at("/job/contractDurationMonths").isNumber()) {
            job.put("contractDurationMonths", offerDetails.at("/job/contractDurationMonths").asInt());
        }

        ObjectNode employment = data.putObject("employment");
        employment.put("startDate", text(source.get("expected_start_date")));
        employment.put("endDate", "");
        employment.put("probationMonths", ((Number) source.get("probation_months")).intValue());
        employment.put("probationSalaryRate", ((Number) source.get("probation_salary_rate")).doubleValue());

        ObjectNode compensation = data.putObject("compensation");
        compensation.put("baseSalary", ((BigDecimal) source.get("base_salary")));
        compensation.set("allowances", parseJson(source.get("allowances_json")));
        compensation.put("payDay", offerDetails.at("/compensation/payDay").asText(""));

        ObjectNode employer = data.putObject("employer");
        employer.put("companyName", "CÔNG TY HRM AI");
        employer.put("representativeName", "");
        employer.put("representativeTitle", "");
        employer.put("address", "");
        data.put("additionalTerms", text(source.get("contract_terms")));

        KeyHolder key = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO employment_contracts
                        (application_id, offer_id, employee_id, version_number, status,
                         contract_data_json, created_by)
                    VALUES (?, ?, ?, 1, 'DRAFT', CAST(? AS JSON), ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, applicationId);
            ps.setLong(2, ((Number) source.get("offer_id")).longValue());
            if (source.get("employee_id") == null) ps.setNull(3, java.sql.Types.BIGINT);
            else ps.setLong(3, ((Number) source.get("employee_id")).longValue());
            ps.setString(4, canonical(data));
            ps.setLong(5, actorId);
            return ps;
        }, key);
        long contractId = key.getKey().longValue();
        snapshotClauses(contractId, List.of());
        regenerateHtml(contractId, data);
        appendEvent(contractId, "CREATED_FROM_ACCEPTED_OFFER", null, "DRAFT", actorId,
                "Khởi tạo từ offer đã chấp nhận", key(idempotencyKey));
        return get(contractId, actorId);
    }

    @Transactional(readOnly = true)
    public List<ContractView> getByApplication(Long applicationId, Long actorId) {
        requireViewer(actorId);
        return findByApplication(applicationId);
    }

    @Transactional(readOnly = true)
    public List<ContractView> listContracts(String status, Long actorId) {
        requireViewer(actorId);
        String normalized = trim(status);
        if (normalized == null) {
            return jdbcTemplate.query(baseContractSql() + " ORDER BY c.updated_at DESC LIMIT 200",
                    (rs, row) -> mapContract(resultMap(rs)));
        }
        return jdbcTemplate.query(baseContractSql() + " WHERE c.status = ? ORDER BY c.updated_at DESC LIMIT 200",
                (rs, row) -> mapContract(resultMap(rs)), normalized.toUpperCase());
    }

    @Transactional
    public ContractView generate(Long contractId, GenerateCommand command, Long actorId, String idempotencyKey) {
        requireEditor(actorId);
        ContractRow row = lock(contractId);
        if (!EDITABLE_STATUSES.contains(row.status())) {
            throw AppException.conflict("Chỉ hợp đồng nháp hoặc bị trả sửa mới được cập nhật");
        }
        if (command.contractData() == null || !command.contractData().isObject()) {
            throw AppException.badRequest("Dữ liệu hợp đồng không hợp lệ");
        }
        snapshotClauses(contractId, command.clauseIds() == null ? List.of() : command.clauseIds());
        String canonical = canonical(command.contractData());
        jdbcTemplate.update("""
                UPDATE employment_contracts
                SET contract_data_json = CAST(? AS JSON), legal_comment = NULL, row_version = row_version + 1
                WHERE id = ?
                """, canonical, contractId);
        regenerateHtml(contractId, command.contractData());
        appendEvent(contractId, "GENERATED", row.status(), row.status(), actorId,
                "Sinh lại nội dung hợp đồng", key(idempotencyKey));
        return get(contractId, actorId);
    }

    @Transactional
    public ContractView submitLegal(Long contractId, Long actorId, String idempotencyKey) {
        requireEditor(actorId);
        ContractRow row = lock(contractId);
        if (!EDITABLE_STATUSES.contains(row.status())) {
            throw AppException.conflict("Hợp đồng không ở trạng thái có thể gửi pháp chế");
        }
        JsonNode data = objectMapper.valueToTree(row.contractData());
        List<String> missing = missingFields(data);
        if (!missing.isEmpty()) {
            throw AppException.badRequest("Hợp đồng còn thiếu dữ liệu bắt buộc: " + String.join(", ", missing));
        }
        if (row.generatedHtml() == null || row.generatedHtml().isBlank()) {
            throw AppException.badRequest("Phải sinh nội dung hợp đồng trước khi gửi pháp chế");
        }
        jdbcTemplate.update("""
                UPDATE employment_contracts SET status = 'PENDING_LEGAL_REVIEW', row_version = row_version + 1
                WHERE id = ?
                """, contractId);
        appendEvent(contractId, "SUBMITTED_LEGAL", row.status(), "PENDING_LEGAL_REVIEW", actorId,
                null, key(idempotencyKey));
        notifyLegalReviewers(row, contractId);
        return get(contractId, actorId);
    }

    @Transactional
    public ContractView legalDecision(Long contractId, LegalDecisionCommand command, Long actorId,
                                      String idempotencyKey) {
        requireLegalReviewer(actorId);
        ContractRow row = lock(contractId);
        if (!"PENDING_LEGAL_REVIEW".equals(row.status())) {
            throw AppException.conflict("Hợp đồng không chờ pháp chế rà soát");
        }
        String decision = required(command.decision(), "Quyết định pháp chế").toUpperCase();
        String target;
        String event;
        if ("APPROVE".equals(decision)) {
            target = "LEGAL_APPROVED";
            event = "LEGAL_APPROVED";
        } else if ("RETURN".equals(decision)) {
            if (command.comment() == null || command.comment().isBlank()) {
                throw AppException.badRequest("Pháp chế phải nhập nội dung cần chỉnh sửa");
            }
            target = "LEGAL_CHANGES_REQUESTED";
            event = "LEGAL_RETURNED";
        } else {
            throw AppException.badRequest("Quyết định chỉ hỗ trợ APPROVE hoặc RETURN");
        }
        jdbcTemplate.update("""
                UPDATE employment_contracts
                SET status = ?, legal_reviewer_id = ?, legal_comment = ?, legal_reviewed_at = NOW(6),
                    row_version = row_version + 1
                WHERE id = ?
                """, target, actorId, trim(command.comment()), contractId);
        appendEvent(contractId, event, row.status(), target, actorId, trim(command.comment()), key(idempotencyKey));
        notifyContractCreator(row, target, trim(command.comment()), actorId);
        return get(contractId, actorId);
    }

    @Transactional
    public ContractView issue(Long contractId, Long actorId, String idempotencyKey) {
        requireEditor(actorId);
        ContractRow row = lock(contractId);
        if (!"LEGAL_APPROVED".equals(row.status())) {
            throw AppException.conflict("Chỉ hợp đồng đã được pháp chế duyệt mới được phát hành");
        }
        String number = "HDLD-" + LocalDate.now().getYear() + "-" + String.format("%06d", contractId);
        jdbcTemplate.update("""
                UPDATE employment_contracts
                SET status = 'ISSUED', contract_number = ?, issued_by = ?, issued_at = NOW(6),
                    row_version = row_version + 1
                WHERE id = ?
                """, number, actorId, contractId);
        appendEvent(contractId, "ISSUED", row.status(), "ISSUED", actorId, number, key(idempotencyKey));
        return get(contractId, actorId);
    }

    @Transactional
    public ContractView uploadSigned(Long contractId, MultipartFile file, Long actorId, String idempotencyKey) {
        requireEditor(actorId);
        ContractRow row = lock(contractId);
        if (!"ISSUED".equals(row.status())) {
            throw AppException.conflict("Chỉ upload bản phía công ty đã ký sau khi hợp đồng được phát hành");
        }
        if (file == null || file.isEmpty()) throw AppException.badRequest("Vui lòng chọn bản hợp đồng đã ký");
        String name = file.getOriginalFilename() == null ? "signed-contract.pdf" : file.getOriginalFilename();
        String contentType = file.getContentType();
        if (!name.toLowerCase().endsWith(".pdf")
                || !("application/pdf".equalsIgnoreCase(contentType)
                || "application/octet-stream".equalsIgnoreCase(contentType))) {
            throw AppException.badRequest("Bản hợp đồng đã ký phải là file PDF");
        }
        if (file.getSize() > 5L * 1024 * 1024) {
            throw AppException.badRequest("File hợp đồng đã ký không được vượt quá 5MB");
        }
        try {
            byte[] bytes = file.getBytes();
            try (PDDocument ignored = PDDocument.load(bytes)) {
                if (ignored.getNumberOfPages() < 1) throw AppException.badRequest("PDF hợp đồng không có trang nội dung");
            }
            String url = cloudinaryService.uploadFileBytes(bytes, name, "contracts/signed");
            String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            jdbcTemplate.update("""
                    UPDATE employment_contracts
                    SET status = 'COMPANY_SIGNED', signed_file_url = ?, signed_file_name = ?,
                        signed_file_sha256 = ?, signed_uploaded_by = ?, signed_uploaded_at = NOW(6),
                        row_version = row_version + 1
                    WHERE id = ?
                    """, url, name, sha, actorId, contractId);
            jdbcTemplate.update("""
                    INSERT INTO contract_artifacts
                        (contract_id, artifact_type, version_number, file_url, file_name, sha256, file_bytes, immutable_artifact)
                    VALUES (?, 'COMPANY_SIGNED', 1, ?, ?, ?, ?, b'1')
                    """, contractId, url, name, sha, bytes);
            appendEvent(contractId, "COMPANY_SIGNED_COPY_UPLOADED", row.status(), "COMPANY_SIGNED", actorId,
                    name, key(idempotencyKey));
            return get(contractId, actorId);
        } catch (AppException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể lưu bản hợp đồng đã ký", exception);
        }
    }

    @Transactional(readOnly = true)
    public ContractView get(Long contractId, Long actorId) {
        requireViewer(actorId);
        return mapContract(jdbcTemplate.queryForMap(baseContractSql() + " WHERE c.id = ?", contractId));
    }

    private List<ContractView> findByApplication(Long applicationId) {
        return jdbcTemplate.query(baseContractSql() + " WHERE c.application_id = ? ORDER BY c.version_number DESC",
                (rs, row) -> mapContract(resultMap(rs)), applicationId);
    }

    private Map<String, Object> resultMap(java.sql.ResultSet rs) throws java.sql.SQLException {
        java.util.HashMap<String, Object> row = new java.util.HashMap<>();
        row.put("id", rs.getLong("id"));
        row.put("application_id", rs.getLong("application_id"));
        row.put("offer_id", rs.getLong("offer_id"));
        row.put("version_number", rs.getInt("version_number"));
        row.put("status", rs.getString("status"));
        row.put("contract_data_json", rs.getString("contract_data_json"));
        row.put("generated_html", rs.getString("generated_html"));
        row.put("contract_number", rs.getString("contract_number"));
        row.put("legal_comment", rs.getString("legal_comment"));
        row.put("legal_reviewer_name", rs.getString("legal_reviewer_name"));
        row.put("legal_reviewed_at", rs.getObject("legal_reviewed_at", LocalDateTime.class));
        row.put("issued_at", rs.getObject("issued_at", LocalDateTime.class));
        row.put("signed_file_url", rs.getString("signed_file_url"));
        row.put("signed_file_name", rs.getString("signed_file_name"));
        row.put("signed_file_sha256", rs.getString("signed_file_sha256"));
        row.put("signed_uploaded_at", rs.getObject("signed_uploaded_at", LocalDateTime.class));
        row.put("candidate_signed_at", rs.getObject("candidate_signed_at", LocalDateTime.class));
        row.put("candidate_signer_name", rs.getString("candidate_signer_name"));
        row.put("candidate_sign_method", rs.getString("candidate_sign_method"));
        row.put("final_file_url", rs.getString("final_file_url"));
        row.put("final_file_sha256", rs.getString("final_file_sha256"));
        row.put("activated_at", rs.getObject("activated_at", LocalDateTime.class));
        row.put("signing_expires_at", rs.getObject("signing_expires_at", LocalDateTime.class));
        row.put("candidate_viewed_at", rs.getObject("candidate_viewed_at", LocalDateTime.class));
        row.put("signing_status", rs.getString("signing_status"));
        row.put("created_at", rs.getObject("created_at", LocalDateTime.class));
        row.put("updated_at", rs.getObject("updated_at", LocalDateTime.class));
        return row;
    }

    private String baseContractSql() {
        return """
                SELECT c.id, c.application_id, c.offer_id, c.version_number, c.status,
                       c.contract_data_json, c.generated_html, c.contract_number, c.legal_comment,
                       reviewer.ho_ten AS legal_reviewer_name, c.legal_reviewed_at, c.issued_at,
                       c.signed_file_url, c.signed_file_name, c.signed_file_sha256,
                       c.signed_uploaded_at, c.candidate_signed_at, c.candidate_signer_name,
                       c.candidate_sign_method, c.final_file_url, c.final_file_sha256, c.activated_at,
                       (SELECT s.expires_at FROM contract_signing_sessions s WHERE s.contract_id = c.id ORDER BY s.id DESC LIMIT 1) AS signing_expires_at,
                       (SELECT s.viewed_at FROM contract_signing_sessions s WHERE s.contract_id = c.id ORDER BY s.id DESC LIMIT 1) AS candidate_viewed_at,
                       (SELECT s.status FROM contract_signing_sessions s WHERE s.contract_id = c.id ORDER BY s.id DESC LIMIT 1) AS signing_status,
                       c.created_at, c.updated_at
                FROM employment_contracts c
                LEFT JOIN users reviewer ON reviewer.id = c.legal_reviewer_id
                """;
    }

    private ContractView mapContract(Map<String, Object> row) {
        long id = ((Number) row.get("id")).longValue();
        List<ClauseSnapshotView> clauses = jdbcTemplate.query("""
                SELECT clause_code, clause_version, title_snapshot, content_snapshot,
                       required_clause, sort_order
                FROM contract_clause_snapshots WHERE contract_id = ? ORDER BY sort_order, id
                """, (rs, index) -> new ClauseSnapshotView(rs.getString("clause_code"),
                rs.getInt("clause_version"), rs.getString("title_snapshot"),
                rs.getString("content_snapshot"), rs.getBoolean("required_clause"),
                rs.getInt("sort_order")), id);
        List<EventView> events = jdbcTemplate.query("""
                SELECT event_type, from_status, to_status, actor_id, comment, occurred_at
                FROM contract_events WHERE contract_id = ? ORDER BY occurred_at, id
                """, (rs, index) -> new EventView(rs.getString("event_type"), rs.getString("from_status"),
                rs.getString("to_status"), (Long) rs.getObject("actor_id"), rs.getString("comment"),
                rs.getObject("occurred_at", LocalDateTime.class)), id);
        JsonNode data = parseJson(row.get("contract_data_json"));
        return new ContractView(id, ((Number) row.get("application_id")).longValue(),
                ((Number) row.get("offer_id")).longValue(), ((Number) row.get("version_number")).intValue(),
                text(row.get("status")), nullableText(row.get("contract_number")), data,
                nullableText(row.get("generated_html")), missingFields(data), clauses, events,
                nullableText(row.get("legal_comment")), nullableText(row.get("legal_reviewer_name")),
                asDateTime(row.get("legal_reviewed_at")), asDateTime(row.get("issued_at")),
                nullableText(row.get("signed_file_url")), nullableText(row.get("signed_file_name")),
                nullableText(row.get("signed_file_sha256")), asDateTime(row.get("signed_uploaded_at")),
                asDateTime(row.get("candidate_signed_at")), nullableText(row.get("candidate_signer_name")),
                nullableText(row.get("candidate_sign_method")), nullableText(row.get("final_file_url")),
                nullableText(row.get("final_file_sha256")), asDateTime(row.get("activated_at")),
                asDateTime(row.get("signing_expires_at")), asDateTime(row.get("candidate_viewed_at")),
                nullableText(row.get("signing_status")),
                asDateTime(row.get("created_at")), asDateTime(row.get("updated_at")));
    }

    private void snapshotClauses(long contractId, List<Long> requestedIds) {
        List<Map<String, Object>> required = jdbcTemplate.queryForList("""
                SELECT * FROM contract_clauses WHERE active = b'1' AND required_clause = b'1'
                ORDER BY category, clause_code
                """);
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        required.forEach(row -> ids.add(((Number) row.get("id")).longValue()));
        ids.addAll(requestedIds);
        if (ids.isEmpty()) throw AppException.badRequest("Hợp đồng phải có ít nhất một điều khoản");
        String placeholders = String.join(",", ids.stream().map(id -> "?").toList());
        List<Map<String, Object>> clauses = jdbcTemplate.queryForList(
                "SELECT * FROM contract_clauses WHERE active = b'1' AND id IN (" + placeholders + ")",
                ids.toArray());
        Map<Long, Map<String, Object>> byId = clauses.stream().collect(java.util.stream.Collectors.toMap(
                row -> ((Number) row.get("id")).longValue(), row -> row));
        jdbcTemplate.update("DELETE FROM contract_clause_snapshots WHERE contract_id = ?", contractId);
        int order = 1;
        for (Long id : ids) {
            Map<String, Object> clause = byId.get(id);
            if (clause == null) continue;
            jdbcTemplate.update("""
                    INSERT INTO contract_clause_snapshots
                        (contract_id, clause_id, clause_code, clause_version, title_snapshot,
                         content_snapshot, required_clause, sort_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, contractId, id, clause.get("clause_code"), clause.get("version_number"),
                    clause.get("title"), clause.get("content"), clause.get("required_clause"), order++);
        }
    }

    private void regenerateHtml(long contractId, JsonNode data) {
        List<Map<String, Object>> clauses = jdbcTemplate.queryForList("""
                SELECT title_snapshot, content_snapshot FROM contract_clause_snapshots
                WHERE contract_id = ? ORDER BY sort_order, id
                """, contractId);
        String html = renderContract(data, clauses);
        jdbcTemplate.update("""
                UPDATE employment_contracts SET generated_html = ?, generated_at = NOW(6) WHERE id = ?
                """, html, contractId);
    }

    private String renderContract(JsonNode d, List<Map<String, Object>> clauses) {
        StringBuilder body = new StringBuilder();
        int index = 1;
        for (Map<String, Object> clause : clauses) {
            body.append("<section><h3>Điều ").append(index++).append(". ")
                    .append(esc(text(clause.get("title_snapshot")))).append("</h3><p>")
                    .append(esc(text(clause.get("content_snapshot"))).replace("\n", "<br/>"))
                    .append("</p></section>");
        }
        String additional = d.path("additionalTerms").asText("");
        if (!additional.isBlank()) {
            body.append("<section><h3>Điều khoản bổ sung</h3><p>")
                    .append(esc(additional).replace("\n", "<br/>"))
                    .append("</p></section>");
        }
        return """
                <!doctype html><html><head><meta charset="UTF-8"><style>
                body{font-family:Arial,sans-serif;color:#172033;line-height:1.65;margin:42px auto;max-width:820px;padding:0 34px}
                h1,h2{text-align:center}h1{font-size:24px;margin-bottom:4px}h2{font-size:15px;font-weight:500;margin-top:0}
                .meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin:28px 0;padding:20px;background:#f8fafc}
                section{margin:20px 0}h3{font-size:16px;margin-bottom:6px}p{margin:4px 0}.sign{display:grid;grid-template-columns:1fr 1fr;text-align:center;margin-top:55px;gap:60px}
                </style></head><body>
                <h1>HỢP ĐỒNG LAO ĐỘNG</h1><h2>Employment Contract</h2>
                <div class="meta">
                  <div><b>Người sử dụng lao động</b><br/>%s<br/>Đại diện: %s – %s</div>
                  <div><b>Người lao động</b><br/>%s<br/>CCCD: %s<br/>Địa chỉ: %s</div>
                  <div><b>Chức danh</b><br/>%s – %s</div>
                  <div><b>Loại hợp đồng</b><br/>%s<br/>Từ ngày: %s đến %s</div>
                  <div><b>Địa điểm làm việc</b><br/>%s</div>
                  <div><b>Lương cơ bản</b><br/>%s VNĐ/tháng</div>
                </div>
                %s
                <div class="sign"><div><b>NGƯỜI SỬ DỤNG LAO ĐỘNG</b><br/><br/><br/><br/>%s</div><div><b>NGƯỜI LAO ĐỘNG</b><br/><br/><br/><br/>%s</div></div>
                </body></html>
                """.formatted(
                esc(d.at("/employer/companyName").asText("")),
                esc(d.at("/employer/representativeName").asText("")),
                esc(d.at("/employer/representativeTitle").asText("")),
                esc(d.at("/employee/fullName").asText("")), esc(d.at("/employee/identityNumber").asText("")),
                esc(d.at("/employee/address").asText("")), esc(d.at("/job/title").asText("")),
                esc(d.at("/job/department").asText("")), esc(d.at("/job/contractType").asText("")),
                esc(d.at("/employment/startDate").asText("")), esc(d.at("/employment/endDate").asText("Không xác định")),
                esc(d.at("/job/workLocation").asText("")), formatMoney(d.at("/compensation/baseSalary")), body,
                esc(d.at("/employer/representativeName").asText("")), esc(d.at("/employee/fullName").asText("")));
    }

    private List<String> missingFields(JsonNode data) {
        List<String> missing = new ArrayList<>();
        for (String path : REQUIRED_PATHS) {
            JsonNode value = data.at(path);
            if (value.isMissingNode() || value.isNull() || (value.isTextual() && value.asText().isBlank())) {
                missing.add(path);
            }
        }
        return missing;
    }

    private ContractRow lock(long id) {
        List<ContractRow> rows = jdbcTemplate.query("""
                SELECT id, application_id, created_by, status, contract_data_json, generated_html
                FROM employment_contracts WHERE id = ? FOR UPDATE
                """, (rs, row) -> new ContractRow(rs.getLong("id"), rs.getLong("application_id"),
                rs.getLong("created_by"), rs.getString("status"),
                parseJson(rs.getString("contract_data_json")), rs.getString("generated_html")), id);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy hợp đồng");
        return rows.get(0);
    }

    private ClauseView findClause(long id) {
        return jdbcTemplate.queryForObject("""
                SELECT id, clause_code, title, category, content, required_clause, active,
                       version_number, created_by, created_at, updated_at
                FROM contract_clauses WHERE id = ?
                """, (rs, row) -> new ClauseView(rs.getLong("id"), rs.getString("clause_code"),
                rs.getString("title"), rs.getString("category"), rs.getString("content"),
                rs.getBoolean("required_clause"), rs.getBoolean("active"), rs.getInt("version_number"),
                (Long) rs.getObject("created_by"), rs.getObject("created_at", LocalDateTime.class),
                rs.getObject("updated_at", LocalDateTime.class)), id);
    }

    private void appendEvent(long contractId, String type, String from, String to, Long actorId,
                             String comment, String idempotencyKey) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO contract_events
                    (contract_id, event_type, from_status, to_status, actor_id, comment, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, contractId, type, from, to, actorId, comment, idempotencyKey);
    }

    private void notifyLegalReviewers(ContractRow contract, long contractId) {
        LinkedHashSet<Long> recipients = new LinkedHashSet<>();
        departmentRepository.findAll().stream()
                .filter(department -> normalize(department.getTenPhong()).contains("phap che"))
                .flatMap(department -> userRepository.findByDepartmentId(department.getId()).stream())
                .filter(user -> Boolean.TRUE.equals(user.getActive()))
                .filter(user -> user.getRole() == Role.TRUONG_PHONG
                        || user.getRole() == Role.GIAM_DOC_PHONG_BAN)
                .map(User::getId)
                .forEach(recipients::add);
        userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.CEO).stream().map(User::getId)
                .forEach(recipients::add);
        userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.ADMIN).stream().map(User::getId)
                .forEach(recipients::add);

        String employeeName = contract.contractData().at("/employee/fullName").asText("ứng viên");
        String jobTitle = contract.contractData().at("/job/title").asText("chưa xác định");
        String link = "/recruitment/applications/" + contract.applicationId();
        for (Long userId : recipients) {
            notificationService.createNotification(userId, "CONTRACT_LEGAL_REVIEW",
                    "Hợp đồng chờ rà soát pháp chế",
                    "Hợp đồng #" + contractId + " của " + employeeName
                            + " (" + jobTitle + ") đang chờ phê duyệt hoặc trả chỉnh sửa.",
                    "cao", link);
        }
    }

    private void notifyContractCreator(ContractRow contract, String target, String comment, Long reviewerId) {
        if (contract.createdBy() == null) return;
        String reviewer = userRepository.findById(reviewerId).map(User::getHoTen).orElse("Pháp chế");
        boolean approved = "LEGAL_APPROVED".equals(target);
        String title = approved ? "Hợp đồng đã được pháp chế duyệt" : "Hợp đồng cần chỉnh sửa theo pháp chế";
        String body = "Hợp đồng #" + contract.id() + " đã được " + reviewer
                + (approved ? " phê duyệt." : " trả lại để chỉnh sửa.");
        if (comment != null) body += " Ý kiến: " + comment;
        notificationService.createNotification(contract.createdBy(), "CONTRACT_LEGAL_DECISION",
                title, body, approved ? "binh_thuong" : "cao",
                "/recruitment/applications/" + contract.applicationId());
    }

    private String normalize(String value) {
        return java.text.Normalizer.normalize(value == null ? "" : value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase();
    }

    private void requireViewer(Long actorId) { requireInternal(actorId); }

    private void requireEditor(Long actorId) {
        User user = requireInternal(actorId);
        if (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN || isDepartment(user, "nhân sự")) return;
        throw AppException.forbidden("Chỉ HR, CEO hoặc Admin được quản lý hợp đồng");
    }

    private void requireLegalReviewer(Long actorId) {
        User user = requireInternal(actorId);
        if (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN || isDepartment(user, "pháp chế")) return;
        throw AppException.forbidden("Chỉ Pháp chế, CEO hoặc Admin được rà soát hợp đồng");
    }

    private User requireInternal(Long actorId) {
        if (actorId == null) throw AppException.forbidden("Yêu cầu đăng nhập");
        return userRepository.findById(actorId).filter(user -> Boolean.TRUE.equals(user.getActive()))
                .orElseThrow(() -> AppException.forbidden("Tài khoản không hợp lệ"));
    }

    private boolean isDepartment(User user, String expected) {
        if (user.getDepartmentId() == null) return false;
        String name = departmentRepository.findById(user.getDepartmentId()).map(Department::getTenPhong).orElse("");
        String normalized = normalize(name);
        String expectedNormalized = normalize(expected);
        return normalized.contains(expectedNormalized);
    }

    private JsonNode parseJson(Object value) {
        try {
            if (value == null) return objectMapper.createObjectNode();
            return value instanceof JsonNode node ? node : objectMapper.readTree(String.valueOf(value));
        } catch (Exception exception) {
            return objectMapper.createObjectNode();
        }
    }

    private String canonical(JsonNode value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception exception) { throw AppException.badRequest("JSON hợp đồng không hợp lệ"); }
    }

    private String firstText(JsonNode node, String... paths) {
        for (String path : paths) {
            String value = node.at(path).asText("");
            if (!value.isBlank()) return value;
        }
        return "";
    }

    private String formatMoney(JsonNode value) {
        try { return String.format("%,.0f", value.decimalValue()).replace(',', '.'); }
        catch (Exception exception) { return "0"; }
    }

    private String required(String value, String label) {
        String result = trim(value);
        if (result == null) throw AppException.badRequest(label + " là bắt buộc");
        return result;
    }

    private String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String esc(String value) { return HtmlUtils.htmlEscape(value == null ? "" : value); }
    private String text(Object value) { return value == null ? "" : String.valueOf(value); }
    private String nullableText(Object value) { return value == null ? null : String.valueOf(value); }
    private LocalDateTime asDateTime(Object value) { return value instanceof LocalDateTime dt ? dt : null; }
    private String key(String value) { return value == null || value.isBlank() ? UUID.randomUUID().toString() : value; }

    private record ContractRow(Long id, Long applicationId, Long createdBy, String status,
                               JsonNode contractData, String generatedHtml) {}

    public record ClauseCommand(String code, String title, String category, String content, boolean requiredClause) {}
    public record GenerateCommand(JsonNode contractData, List<Long> clauseIds) {}
    public record LegalDecisionCommand(String decision, String comment) {}
    public record ClauseView(Long id, String code, String title, String category, String content,
                             boolean requiredClause, boolean active, int versionNumber, Long createdBy,
                             LocalDateTime createdAt, LocalDateTime updatedAt) {}
    public record ClauseSnapshotView(String code, int versionNumber, String title, String content,
                                     boolean requiredClause, int sortOrder) {}
    public record EventView(String eventType, String fromStatus, String toStatus, Long actorId,
                            String comment, LocalDateTime occurredAt) {}
    public record ContractView(Long id, Long applicationId, Long offerId, int versionNumber, String status,
                               String contractNumber, JsonNode contractData, String generatedHtml,
                               List<String> missingFields, List<ClauseSnapshotView> clauses,
                               List<EventView> events, String legalComment, String legalReviewerName,
                               LocalDateTime legalReviewedAt, LocalDateTime issuedAt, String signedFileUrl,
                               String signedFileName, String signedFileSha256, LocalDateTime signedUploadedAt,
                               LocalDateTime candidateSignedAt, String candidateSignerName,
                               String candidateSignMethod, String finalFileUrl, String finalFileSha256,
                               LocalDateTime activatedAt, LocalDateTime signingExpiresAt,
                               LocalDateTime candidateViewedAt, String signingStatus,
                               LocalDateTime createdAt, LocalDateTime updatedAt) {}
}
