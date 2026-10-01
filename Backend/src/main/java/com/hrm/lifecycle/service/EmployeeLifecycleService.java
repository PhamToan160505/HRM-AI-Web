package com.hrm.lifecycle.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.HiringSeat;
import com.hrm.recruitment.entity.HiringSeatStatus;
import com.hrm.recruitment.entity.Offer;
import com.hrm.recruitment.entity.OfferStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.HiringSeatRepository;
import com.hrm.recruitment.repository.OfferRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeLifecycleService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final ApplicationRepository applicationRepository;
    private final OfferRepository offerRepository;
    private final HiringSeatRepository seatRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    @Transactional
    public Long consumeContractActivated(String eventId, String eventType, int schemaVersion, String payloadJson) {
        if (schemaVersion != 1 || !"CONTRACT_ACTIVATED".equals(eventType)) {
            throw AppException.badRequest("Envelope CONTRACT_ACTIVATED không được hỗ trợ");
        }
        JsonNode payload = parse(payloadJson);
        String conversionKey = requiredText(payload, "conversion_key");
        long applicationId = requiredLong(payload, "application_id");
        long offerId = requiredLong(payload, "accepted_offer_id");
        long seatId = requiredLong(payload, "seat_id");
        long contractId = requiredLong(payload, "contract_id");

        int claimed = jdbcTemplate.update("""
                INSERT IGNORE INTO inbox_events(event_id, event_type, schema_version)
                VALUES (?, ?, ?)
                """, eventId, eventType, schemaVersion);
        if (claimed == 0) {
            return existingInboxResult(eventId);
        }

        List<Long> existing = jdbcTemplate.query(
                "SELECT id FROM employees WHERE conversion_key = ?", (rs, row) -> rs.getLong(1), conversionKey);
        if (!existing.isEmpty()) {
            jdbcTemplate.update("UPDATE employment_contracts SET employee_id = ? WHERE id = ?",
                    existing.get(0), contractId);
            finishInbox(eventId, existing.get(0));
            return existing.get(0);
        }

        Integer activeContract = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM employment_contracts
                WHERE id = ? AND application_id = ? AND offer_id = ? AND status = 'ACTIVE'
                """, Integer.class, contractId, applicationId, offerId);
        if (activeContract == null || activeContract != 1) {
            throw AppException.conflict("Hợp đồng chưa hoàn tất hoặc không khớp offer đã chấp nhận");
        }

        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy application của sự kiện"));
        Offer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy accepted offer"));
        HiringSeat seat = seatRepository.findById(seatId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy accepted seat"));
        if (!offer.getApplicationId().equals(applicationId) || offer.getStatus() != OfferStatus.ACCEPTED
                || !seat.getApplicationId().equals(applicationId) || !seat.getOfferId().equals(offerId)
                || seat.getStatus() != HiringSeatStatus.ACCEPTED) {
            throw AppException.conflict("Dữ liệu application, offer và seat không nhất quán");
        }

        List<Map<String, Object>> possibleMatches = jdbcTemplate.queryForList("""
                SELECT id,
                       CASE WHEN LOWER(email) = LOWER(?) THEN 'EMAIL' ELSE 'PHONE' END AS matched_on
                FROM persons
                WHERE LOWER(email) = LOWER(?) OR (phone IS NOT NULL AND phone <> '' AND phone = ?)
                """, application.getEmail(), application.getEmail(), application.getPhone());

        long personId = insertAndReturnId("""
                INSERT INTO persons(status, full_name, email, phone, created_from_application_id)
                VALUES ('PROVISIONAL', ?, ?, ?, ?)
                """, application.getFullName(), application.getEmail(), application.getPhone(), applicationId);

        for (Map<String, Object> match : possibleMatches) {
            jdbcTemplate.update("""
                    INSERT IGNORE INTO identity_reviews(new_person_id, candidate_person_id, matched_on, status)
                    VALUES (?, ?, ?, 'OPEN')
                    """, personId, ((Number) match.get("id")).longValue(), match.get("matched_on"));
        }

        String provisionalCode = "PB" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        String probationStatus = offer.getProbationMonths() > 0 ? "PLANNED" : "NOT_APPLICABLE";
        long employeeId = insertAndReturnId("""
                INSERT INTO employees(person_id, application_id, offer_id, contract_id, seat_id, conversion_key,
                                      employee_code, status, start_date_planned, probation_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PRE_BOARDING', ?, ?)
                """, personId, applicationId, offerId, contractId, seatId, conversionKey, provisionalCode,
                Date.valueOf(offer.getExpectedStartDate()), probationStatus);
        jdbcTemplate.update("UPDATE employees SET employee_code = ? WHERE id = ?",
                "NV" + String.format("%08d", employeeId), employeeId);
        jdbcTemplate.update("UPDATE employment_contracts SET employee_id = ? WHERE id = ?", employeeId, contractId);

        jdbcTemplate.update("""
                INSERT INTO employment_records(employee_id, department_id, position_title, level_name,
                                               effective_from, record_status)
                VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
                """, employeeId, application.getJobPosting().getDepartmentId(),
                application.getJobPosting().getTitle(), application.getJobPosting().getCapBac(),
                Date.valueOf(offer.getExpectedStartDate()));

        boolean hasProbation = offer.getProbationMonths() > 0;
        BigDecimal initialSalary = hasProbation
                ? offer.getBaseSalary().multiply(offer.getProbationSalaryRate())
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP)
                : offer.getBaseSalary();
        jdbcTemplate.update("""
                INSERT INTO compensation_records(employee_id, salary_type, base_salary, allowances_json,
                                                 effective_from, record_status)
                VALUES (?, ?, ?, CAST(? AS JSON), ?, 'SCHEDULED')
                """, employeeId, hasProbation ? "PROBATION" : "OFFICIAL", initialSalary,
                offer.getAllowancesJson(), Date.valueOf(offer.getExpectedStartDate()));

        long checklistId = insertAndReturnId(
                "INSERT INTO preboarding_checklists(employee_id, status) VALUES (?, 'OPEN')", employeeId);
        insertChecklistItem(checklistId, "PERSONNEL_DOCUMENTS", "Hoàn tất hồ sơ nhân sự", offer.getExpectedStartDate().minusDays(3));
        insertChecklistItem(checklistId, "BANK_INFORMATION", "Cung cấp thông tin tài khoản ngân hàng", offer.getExpectedStartDate().minusDays(2));
        insertChecklistItem(checklistId, "WORK_EQUIPMENT", "Chuẩn bị thiết bị làm việc", offer.getExpectedStartDate().minusDays(1));

        jdbcTemplate.update("""
                INSERT INTO account_creation_requests
                    (application_id, employee_id, ho_ten, email, department_id, chuc_vu,
                     mode, status, retry_count, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'PREPARE_ONLY', 'PENDING_ADMIN', 0, NOW(6))
                """, applicationId, employeeId, application.getFullName(), application.getEmail(),
                application.getJobPosting().getDepartmentId(), application.getJobPosting().getTitle());

        appendLifecycle(employeeId, "EMPLOYEE_CREATED", null, "OFFER", offerId,
                "Tạo nhân viên PRE_BOARDING từ hợp đồng hai bên đã ký và được kích hoạt",
                eventId + ":employee-created");
        appendOutbox("PREBOARDING_CREATED", "lifecycle", "EMPLOYEE", employeeId,
                Map.of("employee_id", employeeId, "application_id", applicationId));
        finishInbox(eventId, employeeId);
        return employeeId;
    }

    @Transactional(readOnly = true)
    public List<EmployeeView> list(String status, Long actorId) {
        requireHr(actorId);
        String sql = baseViewSql() + (status == null || status.isBlank() ? "" : " WHERE e.status = ?")
                + " ORDER BY e.created_at DESC";
        return status == null || status.isBlank()
                ? jdbcTemplate.query(sql, this::mapEmployee)
                : jdbcTemplate.query(sql, this::mapEmployee, status);
    }

    @Transactional(readOnly = true)
    public EmployeeDetail detail(Long employeeId, Long actorId) {
        requireHr(actorId);
        EmployeeView employee = findView(employeeId);
        List<ChecklistItemView> items = jdbcTemplate.query("""
                SELECT pi.id, pi.item_code, pi.label, pi.required_item, pi.status, pi.due_date,
                       pi.completed_at, pi.exception_reason
                FROM preboarding_items pi
                JOIN preboarding_checklists pc ON pc.id = pi.checklist_id
                WHERE pc.employee_id = ? ORDER BY pi.id
                """, (rs, row) -> new ChecklistItemView(rs.getLong("id"), rs.getString("item_code"),
                rs.getString("label"), rs.getBoolean("required_item"), rs.getString("status"),
                rs.getObject("due_date", LocalDate.class),
                rs.getObject("completed_at", LocalDateTime.class), rs.getString("exception_reason")), employeeId);
        List<LifecycleEventView> events = jdbcTemplate.query("""
                SELECT id, event_type, event_date, actor_id, ref_type, ref_id, summary
                FROM lifecycle_events WHERE subject_type = 'EMPLOYEE' AND subject_id = ?
                ORDER BY event_date, id
                """, (rs, row) -> new LifecycleEventView(rs.getLong("id"), rs.getString("event_type"),
                rs.getObject("event_date", LocalDateTime.class), (Long) rs.getObject("actor_id"),
                rs.getString("ref_type"), (Long) rs.getObject("ref_id"), rs.getString("summary")), employeeId);
        return new EmployeeDetail(employee, items, events);
    }

    @Transactional
    public EmployeeView completeChecklistItem(Long employeeId, Long itemId, Long actorId) {
        requireHr(actorId);
        int updated = jdbcTemplate.update("""
                UPDATE preboarding_items pi
                JOIN preboarding_checklists pc ON pc.id = pi.checklist_id
                JOIN employees e ON e.id = pc.employee_id
                SET pi.status = 'COMPLETED', pi.completed_by = ?, pi.completed_at = NOW(6)
                WHERE pi.id = ? AND e.id = ? AND e.status = 'PRE_BOARDING' AND pi.status = 'PENDING'
                """, actorId, itemId, employeeId);
        if (updated == 0) throw AppException.conflict("Mục checklist không thể hoàn tất");
        jdbcTemplate.update("""
                UPDATE preboarding_checklists pc
                SET pc.status = 'COMPLETED', pc.completed_at = NOW(6)
                WHERE pc.employee_id = ? AND NOT EXISTS (
                    SELECT 1 FROM preboarding_items pi
                    WHERE pi.checklist_id = pc.id AND pi.required_item = b'1' AND pi.status = 'PENDING')
                """, employeeId);
        appendLifecycle(employeeId, "CHECKLIST_ITEM_COMPLETED", actorId, "CHECKLIST_ITEM", itemId,
                "Hoàn tất một mục pre-boarding", UUID.randomUUID() + ":checklist");
        return findView(employeeId);
    }

    @Transactional
    public EmployeeView confirmJoined(Long employeeId, LocalDate joinDate, String checklistOverrideReason,
                                      String earlyJoinReason, Long actorId, String idempotencyKey) {
        requireHr(actorId);
        Map<String, Object> employee = lockEmployee(employeeId);
        if ("EMPLOYED".equals(employee.get("status"))) return findView(employeeId);
        if (!"PRE_BOARDING".equals(employee.get("status"))) {
            throw AppException.conflict("Chỉ nhân viên PRE_BOARDING mới có thể xác nhận nhận việc");
        }
        if (employee.get("contract_id") != null) {
            Integer activeContract = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM employment_contracts WHERE id = ? AND status = 'ACTIVE'",
                    Integer.class, ((Number) employee.get("contract_id")).longValue());
            if (activeContract == null || activeContract != 1) {
                throw AppException.conflict("Hợp đồng chưa hoàn tất nên chưa thể xác nhận nhận việc");
            }
        }
        LocalDate planned = ((Date) employee.get("start_date_planned")).toLocalDate();
        LocalDate actualJoinDate = joinDate == null ? LocalDate.now() : joinDate;
        if (actualJoinDate.isBefore(planned) && blank(earlyJoinReason)) {
            throw AppException.badRequest("Nhận việc sớm hơn kế hoạch bắt buộc có lý do ngoại lệ");
        }
        Integer incomplete = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM preboarding_items pi
                JOIN preboarding_checklists pc ON pc.id = pi.checklist_id
                WHERE pc.employee_id = ? AND pi.required_item = b'1' AND pi.status = 'PENDING'
                """, Integer.class, employeeId);
        if (incomplete != null && incomplete > 0 && blank(checklistOverrideReason)) {
            throw AppException.conflict("Checklist bắt buộc chưa hoàn tất; cần nhập lý do ngoại lệ");
        }
        if (incomplete != null && incomplete > 0) {
            jdbcTemplate.update("""
                    UPDATE preboarding_checklists SET status = 'OVERRIDDEN', override_reason = ?,
                        overridden_by = ?, completed_at = NOW(6) WHERE employee_id = ?
                    """, checklistOverrideReason.trim(), actorId, employeeId);
        }
        jdbcTemplate.update("""
                UPDATE employees SET status = 'EMPLOYED', join_date = ?, row_version = row_version + 1
                WHERE id = ?
                """, Date.valueOf(actualJoinDate), employeeId);
        jdbcTemplate.update("UPDATE employment_records SET record_status = 'CURRENT' WHERE employee_id = ? AND record_status = 'SCHEDULED'", employeeId);
        jdbcTemplate.update("UPDATE compensation_records SET record_status = 'CURRENT' WHERE employee_id = ? AND record_status = 'SCHEDULED'", employeeId);
        jdbcTemplate.update("UPDATE account_creation_requests SET mode = 'ENSURE_ACTIVE' WHERE employee_id = ?", employeeId);

        String key = normalizedKey(idempotencyKey, "joined:" + employeeId);
        appendLifecycle(employeeId, "JOINED", actorId, "EMPLOYEE", employeeId,
                "Xác nhận nhân viên đã đi làm" + (blank(earlyJoinReason) ? "" : ": " + earlyJoinReason.trim()), key);
        appendOutbox("EMPLOYEE_JOINED", "lifecycle", "EMPLOYEE", employeeId, Map.of(
                "employee_id", employeeId,
                "application_id", ((Number) employee.get("application_id")).longValue(),
                "seat_id", ((Number) employee.get("seat_id")).longValue(),
                "join_date", actualJoinDate.toString()));
        appendOutbox("ENSURE_ACCOUNT_ACTIVE", "lifecycle", "EMPLOYEE", employeeId,
                Map.of("employee_id", employeeId));
        return findView(employeeId);
    }

    @Transactional
    public EmployeeView cancelOnboarding(Long employeeId, String reasonCode, Long actorId, String idempotencyKey) {
        requireHr(actorId);
        if (blank(reasonCode)) throw AppException.badRequest("Hủy nhận việc bắt buộc có lý do");
        Map<String, Object> employee = lockEmployee(employeeId);
        if ("ONBOARD_CANCELLED".equals(employee.get("status"))) return findView(employeeId);
        if (!"PRE_BOARDING".equals(employee.get("status"))) {
            throw AppException.conflict("Chỉ nhân viên PRE_BOARDING mới có thể hủy nhận việc");
        }
        jdbcTemplate.update("UPDATE employees SET status = 'ONBOARD_CANCELLED', probation_status = 'CANCELLED', row_version = row_version + 1 WHERE id = ?", employeeId);
        jdbcTemplate.update("UPDATE employment_records SET record_status = 'CANCELLED' WHERE employee_id = ? AND record_status = 'SCHEDULED'", employeeId);
        jdbcTemplate.update("UPDATE compensation_records SET record_status = 'CANCELLED' WHERE employee_id = ? AND record_status = 'SCHEDULED'", employeeId);
        jdbcTemplate.update("UPDATE preboarding_checklists SET status = 'CANCELLED' WHERE employee_id = ?", employeeId);
        jdbcTemplate.update("UPDATE preboarding_items pi JOIN preboarding_checklists pc ON pc.id = pi.checklist_id SET pi.status = 'CANCELLED' WHERE pc.employee_id = ? AND pi.status = 'PENDING'", employeeId);
        jdbcTemplate.update("UPDATE account_creation_requests SET status = 'CANCELLED' WHERE employee_id = ?", employeeId);
        jdbcTemplate.update("""
                UPDATE users u JOIN account_creation_requests acr ON acr.user_id = u.id
                SET u.active = b'0' WHERE acr.employee_id = ?
                """, employeeId);

        String key = normalizedKey(idempotencyKey, "onboard-cancelled:" + employeeId);
        appendLifecycle(employeeId, "ONBOARD_CANCELLED", actorId, "EMPLOYEE", employeeId,
                "Hủy nhận việc: " + reasonCode.trim(), key);
        appendOutbox("ONBOARD_CANCELLED", "lifecycle", "EMPLOYEE", employeeId, Map.of(
                "employee_id", employeeId,
                "application_id", ((Number) employee.get("application_id")).longValue(),
                "seat_id", ((Number) employee.get("seat_id")).longValue(),
                "reason_code", reasonCode.trim()));
        return findView(employeeId);
    }

    private String baseViewSql() {
        return """
                SELECT e.id, e.employee_code, e.status, e.probation_status, e.start_date_planned,
                       e.join_date, e.person_id, p.status AS person_status, p.full_name, p.email, p.phone,
                       er.position_title, er.department_id, COALESCE(acr.status, 'NOT_CREATED') AS account_status,
                       (SELECT COUNT(*) FROM preboarding_items pi JOIN preboarding_checklists pc ON pc.id = pi.checklist_id WHERE pc.employee_id = e.id AND pi.status = 'COMPLETED') AS checklist_completed,
                       (SELECT COUNT(*) FROM preboarding_items pi JOIN preboarding_checklists pc ON pc.id = pi.checklist_id WHERE pc.employee_id = e.id) AS checklist_total,
                       e.created_at
                FROM employees e
                JOIN persons p ON p.id = e.person_id
                JOIN employment_records er ON er.employee_id = e.id
                LEFT JOIN account_creation_requests acr ON acr.employee_id = e.id
                """;
    }

    private EmployeeView findView(Long employeeId) {
        List<EmployeeView> rows = jdbcTemplate.query(baseViewSql() + " WHERE e.id = ?", this::mapEmployee, employeeId);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy nhân viên vòng đời");
        return rows.get(0);
    }

    private EmployeeView mapEmployee(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new EmployeeView(rs.getLong("id"), rs.getString("employee_code"), rs.getString("status"),
                rs.getString("probation_status"), rs.getObject("start_date_planned", LocalDate.class),
                rs.getObject("join_date", LocalDate.class), rs.getLong("person_id"), rs.getString("person_status"),
                rs.getString("full_name"), rs.getString("email"), rs.getString("phone"),
                rs.getString("position_title"), (Long) rs.getObject("department_id"),
                rs.getString("account_status"), rs.getInt("checklist_completed"), rs.getInt("checklist_total"),
                rs.getObject("created_at", LocalDateTime.class));
    }

    private Map<String, Object> lockEmployee(Long employeeId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, application_id, offer_id, contract_id, seat_id, status, start_date_planned FROM employees WHERE id = ? FOR UPDATE",
                employeeId);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy nhân viên vòng đời");
        return rows.get(0);
    }

    private void requireHr(Long actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người thao tác"));
        if (actor.getRole() == Role.CEO) return;
        boolean hr = (actor.getRole() == Role.TRUONG_PHONG || actor.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && actor.getDepartmentId() != null
                && departmentRepository.findById(actor.getDepartmentId())
                    .map(d -> "Nhân sự".equalsIgnoreCase(d.getTenPhong().trim())).orElse(false);
        if (!hr) throw AppException.forbidden("Chỉ HR hoặc CEO được thao tác vòng đời nhân viên");
    }

    private void insertChecklistItem(long checklistId, String code, String label, LocalDate dueDate) {
        jdbcTemplate.update("""
                INSERT INTO preboarding_items(checklist_id, item_code, label, required_item, status, due_date)
                VALUES (?, ?, ?, b'1', 'PENDING', ?)
                """, checklistId, code, label, Date.valueOf(dueDate));
    }

    private long insertAndReturnId(String sql, Object... values) {
        KeyHolder key = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement;
        }, key);
        if (key.getKey() == null) throw new IllegalStateException("Không lấy được ID vừa tạo");
        return key.getKey().longValue();
    }

    private void appendLifecycle(long employeeId, String eventType, Long actorId, String refType,
                                 Long refId, String summary, String key) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO lifecycle_events(subject_type, subject_id, event_type, actor_id,
                                                    ref_type, ref_id, summary, idempotency_key)
                VALUES ('EMPLOYEE', ?, ?, ?, ?, ?, ?, ?)
                """, employeeId, eventType, actorId, refType, refId, summary, truncate(key, 140));
    }

    private void appendOutbox(String eventType, String producer, String aggregateType,
                              long aggregateId, Map<String, Object> payload) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO outbox_events(event_id, event_type, schema_version, correlation_id, producer,
                                              aggregate_type, aggregate_id, payload, status, attempt_count, next_attempt_at)
                    VALUES (?, ?, 1, ?, ?, ?, ?, CAST(? AS JSON), 'PENDING', 0, NOW(6))
                    """, UUID.randomUUID().toString(), eventType, UUID.randomUUID().toString(), producer,
                    aggregateType, String.valueOf(aggregateId), objectMapper.writeValueAsString(payload));
        } catch (Exception exception) {
            throw new IllegalStateException("Không thể ghi outbox", exception);
        }
    }

    private JsonNode parse(String json) {
        try { return objectMapper.readTree(json); }
        catch (Exception exception) { throw AppException.badRequest("Payload sự kiện không phải JSON hợp lệ"); }
    }

    private long requiredLong(JsonNode payload, String field) {
        JsonNode value = payload.get(field);
        if (value == null || !value.canConvertToLong()) throw AppException.badRequest("Thiếu " + field);
        return value.asLong();
    }

    private String requiredText(JsonNode payload, String field) {
        JsonNode value = payload.get(field);
        if (value == null || value.asText().isBlank()) throw AppException.badRequest("Thiếu " + field);
        return value.asText();
    }

    private Long existingInboxResult(String eventId) {
        List<String> refs = jdbcTemplate.query("SELECT result_ref FROM inbox_events WHERE event_id = ?",
                (rs, row) -> rs.getString(1), eventId);
        if (refs.isEmpty() || refs.get(0) == null) throw AppException.conflict("Sự kiện đang được consumer khác xử lý");
        return Long.valueOf(refs.get(0).replace("EMPLOYEE:", ""));
    }

    private void finishInbox(String eventId, long employeeId) {
        jdbcTemplate.update("UPDATE inbox_events SET processed_at = NOW(6), result_ref = ? WHERE event_id = ?",
                "EMPLOYEE:" + employeeId, eventId);
    }

    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String normalizedKey(String value, String fallback) { return blank(value) ? fallback : value.trim(); }
    private String truncate(String value, int length) { return value.length() <= length ? value : value.substring(0, length); }

    public record EmployeeView(Long id, String employeeCode, String status, String probationStatus,
                               LocalDate startDatePlanned, LocalDate joinDate, Long personId,
                               String personStatus, String fullName, String email, String phone,
                               String positionTitle, Long departmentId, String accountStatus,
                               Integer checklistCompleted, Integer checklistTotal, LocalDateTime createdAt) {}
    public record ChecklistItemView(Long id, String code, String label, boolean required, String status,
                                    LocalDate dueDate, LocalDateTime completedAt, String exceptionReason) {}
    public record LifecycleEventView(Long id, String eventType, LocalDateTime eventDate, Long actorId,
                                     String refType, Long refId, String summary) {}
    public record EmployeeDetail(EmployeeView employee, List<ChecklistItemView> checklist,
                                 List<LifecycleEventView> events) {}
}
