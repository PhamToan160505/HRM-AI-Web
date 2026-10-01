package com.hrm.contract.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.ai.service.GeminiClientService;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContractLifecycleService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final GeminiClientService geminiClientService;

    @Transactional(readOnly = true)
    public Dashboard dashboard(Long actorId) {
        requireViewer(actorId);
        int sent = count("SELECT COUNT(*) FROM offer_dispatches");
        int accepted = count("SELECT COUNT(*) FROM offer_dispatches WHERE status = 'ACCEPTED'");
        int declined = count("SELECT COUNT(*) FROM offer_dispatches WHERE status = 'DECLINED'");
        int totalContracts = count("SELECT COUNT(*) FROM employment_contracts");
        int active = count("SELECT COUNT(*) FROM employment_contracts WHERE status = 'ACTIVE'");
        int pendingSignatures = count("SELECT COUNT(*) FROM employment_contracts WHERE status IN ('COMPANY_SIGNED','SENT_TO_CANDIDATE','CANDIDATE_VIEWED')");
        int candidateSigned = count("SELECT COUNT(*) FROM employment_contracts WHERE status = 'CANDIDATE_SIGNED'");
        int terminated = count("SELECT COUNT(*) FROM employment_contracts WHERE status IN ('TERMINATED','EXPIRED')");
        int expiring = count("""
                SELECT COUNT(*) FROM employment_contracts
                WHERE status = 'ACTIVE'
                  AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(contract_data_json, '$.employment.endDate')), '') IS NOT NULL
                  AND STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(contract_data_json, '$.employment.endDate')), '%Y-%m-%d')
                      BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 60 DAY)
                """);
        int pendingAmendments = count("SELECT COUNT(*) FROM contract_amendments WHERE status = 'PENDING_APPROVAL'");
        int pendingTerminations = count("SELECT COUNT(*) FROM contract_terminations WHERE status IN ('PENDING_APPROVAL','APPROVED')");
        double rate = sent == 0 ? 0 : Math.round(accepted * 1000.0 / sent) / 10.0;
        return new Dashboard(sent, accepted, declined, rate, totalContracts, active, pendingSignatures,
                candidateSigned, terminated, expiring, pendingAmendments, pendingTerminations);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> amendments(Long contractId, Long actorId) {
        requireViewer(actorId);
        requireContract(contractId);
        return jdbcTemplate.queryForList("""
                SELECT a.*, creator.ho_ten creator_name, approver.ho_ten approver_name
                FROM contract_amendments a
                JOIN users creator ON creator.id = a.created_by
                LEFT JOIN users approver ON approver.id = a.approved_by
                WHERE a.contract_id = ? ORDER BY a.created_at DESC
                """, contractId);
    }

    @Transactional
    public Map<String, Object> createAmendment(Long contractId, AmendmentCommand command, Long actorId) {
        requireEditor(actorId);
        ContractRef contract = requireContract(contractId);
        if (!"ACTIVE".equals(contract.status())) throw AppException.conflict("Chỉ hợp đồng đang hiệu lực mới được lập phụ lục");
        String type = enumValue(command.type(), List.of("GENERAL", "RENEWAL", "SALARY", "POSITION"), "Loại phụ lục");
        if (command.effectiveDate() == null) throw AppException.badRequest("Ngày hiệu lực là bắt buộc");
        if ("RENEWAL".equals(type) && command.newEndDate() == null) throw AppException.badRequest("Gia hạn cần ngày kết thúc mới");
        if ("RENEWAL".equals(type) && command.newEndDate().isBefore(command.effectiveDate())) throw AppException.badRequest("Ngày kết thúc mới phải sau ngày hiệu lực");
        int sequence = count("SELECT COUNT(*) FROM contract_amendments WHERE contract_id = " + contractId) + 1;
        String number = "PLHD-" + (contract.number() == null ? contractId : contract.number()) + "-" + String.format("%02d", sequence);
        String changes = json(command.changes() == null ? objectMapper.createObjectNode() : command.changes());
        KeyHolder key = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO contract_amendments
                      (contract_id, amendment_number, amendment_type, title, reason, effective_date,
                       new_end_date, change_data_json, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, contractId); ps.setString(2, number); ps.setString(3, type);
            ps.setString(4, required(command.title(), "Tên phụ lục"));
            ps.setString(5, required(command.reason(), "Lý do")); ps.setObject(6, command.effectiveDate());
            ps.setObject(7, command.newEndDate()); ps.setString(8, changes); ps.setLong(9, actorId);
            return ps;
        }, key);
        event(contractId, "AMENDMENT_CREATED", contract.status(), contract.status(), actorId, number);
        return amendment(key.getKey().longValue());
    }

    @Transactional
    public Map<String, Object> submitAmendment(Long id, Long actorId) {
        requireEditor(actorId);
        updateState("contract_amendments", id, "DRAFT", "PENDING_APPROVAL");
        Map<String, Object> result = amendment(id);
        event(longValue(result.get("contract_id")), "AMENDMENT_SUBMITTED", "ACTIVE", "ACTIVE", actorId, String.valueOf(result.get("amendment_number")));
        return result;
    }

    @Transactional
    public Map<String, Object> decideAmendment(Long id, DecisionCommand command, Long actorId) {
        requireApprover(actorId);
        String target = "APPROVE".equalsIgnoreCase(command.decision()) ? "APPROVED" : "REJECTED";
        int changed = jdbcTemplate.update("""
                UPDATE contract_amendments SET status = ?, approved_by = ?, approval_comment = ?, approved_at = NOW(6)
                WHERE id = ? AND status = 'PENDING_APPROVAL'
                """, target, actorId, command.comment(), id);
        if (changed == 0) throw AppException.conflict("Phụ lục không ở trạng thái chờ duyệt");
        Map<String, Object> result = amendment(id);
        event(longValue(result.get("contract_id")), "AMENDMENT_" + target, "ACTIVE", "ACTIVE", actorId, command.comment());
        return result;
    }

    @Transactional
    public Map<String, Object> activateAmendment(Long id, Long actorId) {
        requireEditor(actorId);
        Map<String, Object> current = amendment(id);
        if (!"APPROVED".equals(String.valueOf(current.get("status")))) throw AppException.conflict("Phụ lục phải được duyệt trước khi áp dụng");
        Long contractId = longValue(current.get("contract_id"));
        ContractRef contract = requireContract(contractId);
        if (!"ACTIVE".equals(contract.status())) throw AppException.conflict("Hợp đồng không còn hiệu lực");
        jdbcTemplate.update("UPDATE contract_amendments SET status = 'EFFECTIVE', effective_at = NOW(6) WHERE id = ?", id);
        applyOperationalChanges(contractId, String.valueOf(current.get("amendment_type")),
                asLocalDate(current.get("new_end_date")), parseJson(current.get("change_data_json")));
        event(contractId, "AMENDMENT_EFFECTIVE", "ACTIVE", "ACTIVE", actorId, String.valueOf(current.get("amendment_number")));
        return amendment(id);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> terminations(Long contractId, Long actorId) {
        requireViewer(actorId); requireContract(contractId);
        return jdbcTemplate.queryForList("""
                SELECT t.*, creator.ho_ten creator_name, approver.ho_ten approver_name
                FROM contract_terminations t JOIN users creator ON creator.id = t.created_by
                LEFT JOIN users approver ON approver.id = t.approved_by
                WHERE t.contract_id = ? ORDER BY t.created_at DESC
                """, contractId);
    }

    @Transactional
    public Map<String, Object> createTermination(Long contractId, TerminationCommand command, Long actorId) {
        requireEditor(actorId);
        ContractRef contract = requireContract(contractId);
        if (!"ACTIVE".equals(contract.status())) throw AppException.conflict("Chỉ hợp đồng đang hiệu lực mới được đề xuất chấm dứt");
        int open = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM contract_terminations WHERE contract_id = ? AND status IN ('DRAFT','PENDING_APPROVAL','APPROVED')", Integer.class, contractId);
        if (open > 0) throw AppException.conflict("Hợp đồng đã có một đề xuất chấm dứt đang xử lý");
        String type = enumValue(command.type(), List.of("MUTUAL", "RESIGNATION", "DISMISSAL", "EXPIRY", "OTHER"), "Loại chấm dứt");
        if (command.effectiveDate() == null) throw AppException.badRequest("Ngày chấm dứt là bắt buộc");
        KeyHolder key = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO contract_terminations
                      (contract_id, termination_type, requested_date, effective_date, reason, settlement_notes, created_by)
                    VALUES (?, ?, CURRENT_DATE, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, contractId); ps.setString(2, type); ps.setObject(3, command.effectiveDate());
            ps.setString(4, required(command.reason(), "Lý do")); ps.setString(5, command.settlementNotes()); ps.setLong(6, actorId);
            return ps;
        }, key);
        event(contractId, "TERMINATION_CREATED", "ACTIVE", "ACTIVE", actorId, command.reason());
        return termination(key.getKey().longValue());
    }

    @Transactional
    public Map<String, Object> submitTermination(Long id, Long actorId) {
        requireEditor(actorId);
        updateState("contract_terminations", id, "DRAFT", "PENDING_APPROVAL");
        Map<String, Object> result = termination(id);
        Long contractId = longValue(result.get("contract_id"));
        jdbcTemplate.update("UPDATE employment_contracts SET status = 'TERMINATION_PENDING' WHERE id = ? AND status = 'ACTIVE'", contractId);
        event(contractId, "TERMINATION_SUBMITTED", "ACTIVE", "TERMINATION_PENDING", actorId, String.valueOf(result.get("reason")));
        return result;
    }

    @Transactional
    public Map<String, Object> decideTermination(Long id, DecisionCommand command, Long actorId) {
        requireApprover(actorId);
        String target = "APPROVE".equalsIgnoreCase(command.decision()) ? "APPROVED" : "REJECTED";
        int changed = jdbcTemplate.update("""
                UPDATE contract_terminations SET status = ?, approved_by = ?, approval_comment = ?, approved_at = NOW(6)
                WHERE id = ? AND status = 'PENDING_APPROVAL'
                """, target, actorId, command.comment(), id);
        if (changed == 0) throw AppException.conflict("Đề xuất chấm dứt không ở trạng thái chờ duyệt");
        Map<String, Object> result = termination(id);
        Long contractId = longValue(result.get("contract_id"));
        if ("REJECTED".equals(target)) jdbcTemplate.update("UPDATE employment_contracts SET status = 'ACTIVE' WHERE id = ? AND status = 'TERMINATION_PENDING'", contractId);
        event(contractId, "TERMINATION_" + target, "TERMINATION_PENDING", "REJECTED".equals(target) ? "ACTIVE" : "TERMINATION_PENDING", actorId, command.comment());
        return result;
    }

    @Transactional
    public Map<String, Object> activateTermination(Long id, Long actorId) {
        requireEditor(actorId);
        Map<String, Object> result = termination(id);
        if (!"APPROVED".equals(String.valueOf(result.get("status")))) throw AppException.conflict("Đề xuất phải được duyệt trước khi chấm dứt");
        LocalDate date = asLocalDate(result.get("effective_date"));
        if (date.isAfter(LocalDate.now())) throw AppException.conflict("Chưa đến ngày chấm dứt hợp đồng");
        Long contractId = longValue(result.get("contract_id"));
        jdbcTemplate.update("UPDATE contract_terminations SET status = 'EFFECTIVE', effective_at = NOW(6) WHERE id = ?", id);
        jdbcTemplate.update("UPDATE employment_contracts SET status = 'TERMINATED' WHERE id = ? AND status = 'TERMINATION_PENDING'", contractId);
        event(contractId, "CONTRACT_TERMINATED", "TERMINATION_PENDING", "TERMINATED", actorId, String.valueOf(result.get("reason")));
        return termination(id);
    }

    @Transactional(readOnly = true)
    public AssistantResult assistant(Long actorId) {
        Dashboard d = dashboard(actorId);
        String fallback = "Tỷ lệ ứng viên chấp nhận offer là " + d.acceptanceRate() + "%. Có " + d.pendingSignatures()
                + " hợp đồng đang chờ ký, " + d.pendingAmendments() + " phụ lục chờ duyệt, "
                + d.pendingTerminations() + " hồ sơ chấm dứt đang xử lý và " + d.expiringWithin60Days()
                + " hợp đồng hết hạn trong 60 ngày. Ưu tiên xử lý hồ sơ chờ ký và hợp đồng sắp hết hạn.";
        try {
            String prompt = "Bạn là trợ lý quản trị hợp đồng HR. Tóm tắt 3-4 câu tiếng Việt, nêu rủi ro và 2 ưu tiên hành động. Không tự bịa dữ liệu. Dữ liệu: " + json(objectMapper.valueToTree(d));
            String raw = geminiClientService.callGemini(prompt, 20, 0).block();
            String text = geminiClientService.extractTextFromGeminiResponse(raw);
            return new AssistantResult(text == null || text.isBlank() ? fallback : text, "GEMINI", LocalDateTime.now());
        } catch (Exception exception) {
            log.warn("AI contract assistant fallback: {}", exception.getMessage());
            return new AssistantResult(fallback, "RULE_BASED_FALLBACK", LocalDateTime.now());
        }
    }

    private void applyOperationalChanges(Long contractId, String type, LocalDate newEndDate, JsonNode changes) {
        if ("RENEWAL".equals(type) && newEndDate != null) {
            jdbcTemplate.update("UPDATE employment_contracts SET contract_data_json = JSON_SET(contract_data_json, '$.employment.endDate', ?) WHERE id = ?", newEndDate.toString(), contractId);
        }
        if ("SALARY".equals(type) && changes.hasNonNull("baseSalary")) {
            jdbcTemplate.update("UPDATE employment_contracts SET contract_data_json = JSON_SET(contract_data_json, '$.compensation.baseSalary', CAST(? AS DECIMAL(19,2))) WHERE id = ?", changes.get("baseSalary").asText(), contractId);
        }
        if ("POSITION".equals(type)) {
            if (changes.hasNonNull("title")) jdbcTemplate.update("UPDATE employment_contracts SET contract_data_json = JSON_SET(contract_data_json, '$.job.title', ?) WHERE id = ?", changes.get("title").asText(), contractId);
            if (changes.hasNonNull("department")) jdbcTemplate.update("UPDATE employment_contracts SET contract_data_json = JSON_SET(contract_data_json, '$.job.department', ?) WHERE id = ?", changes.get("department").asText(), contractId);
        }
    }

    private void updateState(String table, Long id, String from, String to) {
        if (!List.of("contract_amendments", "contract_terminations").contains(table)) throw AppException.badRequest("Bảng không hợp lệ");
        int changed = jdbcTemplate.update("UPDATE " + table + " SET status = ? WHERE id = ? AND status = ?", to, id, from);
        if (changed == 0) throw AppException.conflict("Trạng thái dữ liệu đã thay đổi, vui lòng tải lại");
    }

    private Map<String, Object> amendment(Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT * FROM contract_amendments WHERE id = ?", id);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy phụ lục");
        return rows.get(0);
    }

    private Map<String, Object> termination(Long id) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT * FROM contract_terminations WHERE id = ?", id);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy đề xuất chấm dứt");
        return rows.get(0);
    }

    private ContractRef requireContract(Long id) {
        List<ContractRef> rows = jdbcTemplate.query("SELECT id, status, contract_number FROM employment_contracts WHERE id = ?",
                (rs, n) -> new ContractRef(rs.getLong("id"), rs.getString("status"), rs.getString("contract_number")), id);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy hợp đồng");
        return rows.get(0);
    }

    private void event(Long contractId, String type, String from, String to, Long actor, String comment) {
        jdbcTemplate.update("""
                INSERT INTO contract_events (contract_id, event_type, from_status, to_status, actor_id, comment, idempotency_key)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, contractId, type, from, to, actor, comment, "phase4:" + UUID.randomUUID());
    }

    private int count(String sql) { Integer value = jdbcTemplate.queryForObject(sql, Integer.class); return value == null ? 0 : value; }
    private long longValue(Object value) { return ((Number) value).longValue(); }
    private LocalDate asLocalDate(Object value) {
        if (value instanceof LocalDate date) return date;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        return value == null ? null : LocalDate.parse(String.valueOf(value));
    }
    private JsonNode parseJson(Object value) { try { return objectMapper.readTree(String.valueOf(value)); } catch (Exception e) { return objectMapper.createObjectNode(); } }
    private String json(JsonNode value) { try { return objectMapper.writeValueAsString(value); } catch (Exception e) { throw AppException.badRequest("JSON không hợp lệ"); } }
    private String required(String value, String label) { if (value == null || value.isBlank()) throw AppException.badRequest(label + " là bắt buộc"); return value.trim(); }
    private String enumValue(String value, List<String> values, String label) { String normalized = value == null ? "" : value.trim().toUpperCase(); if (!values.contains(normalized)) throw AppException.badRequest(label + " không hợp lệ"); return normalized; }

    private User requireViewer(Long actorId) {
        if (actorId == null) throw AppException.forbidden("Yêu cầu đăng nhập");
        return userRepository.findById(actorId).filter(user -> Boolean.TRUE.equals(user.getActive()))
                .orElseThrow(() -> AppException.forbidden("Tài khoản không hợp lệ"));
    }

    private void requireEditor(Long actorId) {
        User user = requireViewer(actorId);
        if (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN || department(user).contains("nhan su")) return;
        throw AppException.forbidden("Chỉ HR, CEO hoặc Admin được quản lý vòng đời hợp đồng");
    }

    private void requireApprover(Long actorId) {
        User user = requireViewer(actorId);
        if (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN || department(user).contains("phap che")) return;
        throw AppException.forbidden("Chỉ Pháp chế, CEO hoặc Admin được phê duyệt");
    }

    private String department(User user) {
        if (user.getDepartmentId() == null) return "";
        String value = departmentRepository.findById(user.getDepartmentId()).map(Department::getTenPhong).orElse("");
        return java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase();
    }

    private record ContractRef(Long id, String status, String number) {}
    public record AmendmentCommand(String type, String title, String reason, LocalDate effectiveDate, LocalDate newEndDate, JsonNode changes) {}
    public record TerminationCommand(String type, LocalDate effectiveDate, String reason, String settlementNotes) {}
    public record DecisionCommand(String decision, String comment) {}
    public record Dashboard(int sentOffers, int acceptedOffers, int declinedOffers, double acceptanceRate,
                            int totalContracts, int activeContracts, int pendingSignatures, int candidateSigned,
                            int terminatedContracts, int expiringWithin60Days, int pendingAmendments,
                            int pendingTerminations) {}
    public record AssistantResult(String summary, String generatedBy, LocalDateTime generatedAt) {}
}
