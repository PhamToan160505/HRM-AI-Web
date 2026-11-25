package com.hrm.sales;

import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Statement;
import java.util.*;
import static com.hrm.sales.SalesCommands.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SalesWorkspaceService {
    private final JdbcTemplate jdbc;
    private final SalesAccess access;

    public Map<String,Object> context(long actorId) {
        var actor = access.actor(actorId);
        List<Map<String,Object>> departments = jdbc.queryForList("SELECT id, ten_phong FROM departments ORDER BY ten_phong");
        var recipients = departments.stream().filter(d -> Set.of("ACCOUNTING", "TECHNICAL")
                .contains(SalesAccess.kind(String.valueOf(d.get("ten_phong"))))).toList();
        List<Map<String,Object>> owners = actor.sales() ? jdbc.queryForList("""
                SELECT u.id, u.ho_ten, u.department_id, d.ten_phong
                FROM users u JOIN departments d ON d.id = u.department_id
                WHERE u.active = b'1' AND u.role IN ('NHAN_VIEN','TRUONG_PHONG','GIAM_DOC_PHONG_BAN')
                ORDER BY u.ho_ten
                """).stream().filter(u -> "SALES".equals(SalesAccess.kind(String.valueOf(u.get("ten_phong")))))
                .filter(u -> actor.ceo() || Objects.equals(actor.departmentId(), number(u, "department_id")))
                .filter(u -> actor.manager() || actor.id() == number(u, "id")).toList() : List.of();
        boolean inbox = actor.ceo() || Set.of("ACCOUNTING", "TECHNICAL").contains(actor.departmentKind());
        if (!actor.sales() && !inbox) throw AppException.forbidden("Bạn không có quyền truy cập Kinh doanh");
        return Map.of("sales", actor.sales(), "manager", actor.sales() && actor.manager(),
                "director", actor.sales() && actor.director(), "ceo", actor.ceo(), "technicalReviewer", actor.technicalReviewer(),
                "inbox", inbox, "owners", owners, "recipients", recipients,
                "technicalDepartments", departments.stream().filter(d -> "TECHNICAL".equals(SalesAccess.kind(text(d,"ten_phong")))).toList());
    }

    public List<Map<String,Object>> customers(long actorId, String search) {
        var actor = access.actor(actorId);
        access.requireSales(actor);
        return jdbc.queryForList("""
                SELECT c.*, u.ho_ten owner_name FROM sales_customers c JOIN users u ON u.id = c.owner_id
                WHERE (? = TRUE OR (c.department_id = ? AND (? = TRUE OR c.owner_id = ?)))
                AND (c.name LIKE ? OR COALESCE(c.tax_code,'') LIKE ? OR COALESCE(c.email,'') LIKE ?)
                ORDER BY c.updated_at DESC, c.id DESC
                """, actor.ceo(), actor.departmentId(), actor.manager(), actor.id(),
                pattern(search), pattern(search), pattern(search));
    }

    public Map<String,Object> customerDetail(long actorId, long id) {
        var customer = customer(actorId, id, false);
        return Map.of("customer", customer,
                "contacts", jdbc.queryForList("SELECT * FROM sales_contacts WHERE customer_id = ? ORDER BY id", id),
                "events", jdbc.queryForList("""
                        SELECT e.*, u.ho_ten actor_name FROM sales_events e JOIN users u ON u.id = e.actor_id
                        WHERE e.customer_id = ? ORDER BY e.id DESC LIMIT 100
                        """, id));
    }

    @Transactional
    public long saveCustomer(long actorId, Long id, Customer command) {
        var actor = access.actor(actorId);
        access.requireSales(actor);
        Map<String,Object> previous = id == null ? null : customer(actorId, id, true);
        if (previous != null) version(previous, command.version());
        if (!actor.manager() && (actor.id() != command.ownerId()
                || previous != null && actor.id() != number(previous,"owner_id"))) {
            throw AppException.forbidden("Chỉ quản lý được phân công khách hàng cho người khác");
        }
        var owner = access.actor(command.ownerId());
        access.requireSales(owner);
        if (owner.ceo() || owner.departmentId() == null) throw AppException.badRequest("Chọn nhân viên thuộc phòng Kinh doanh");
        if (!actor.ceo() && !Objects.equals(owner.departmentId(), actor.departmentId())) {
            throw AppException.forbidden("Người phụ trách phải thuộc cùng phòng Kinh doanh");
        }
        if (previous != null && !Objects.equals(number(previous,"department_id"), owner.departmentId())) {
            throw AppException.badRequest("Không chuyển khách hàng sang phòng ban khác");
        }
        String email = clean(command.email());
        String phone = clean(command.phone());
        Long duplicates = jdbc.queryForObject("""
                SELECT COUNT(*) FROM sales_customers WHERE id <> ?
                AND (LOWER(TRIM(name)) = LOWER(?) OR (? IS NOT NULL AND LOWER(email) = LOWER(?))
                     OR (? IS NOT NULL AND phone = ?))
                """, Long.class, id == null ? 0 : id, command.name().trim(), email, email, phone, phone);
        if (duplicates != null && duplicates > 0) throw AppException.conflict("Tên, email hoặc điện thoại khách hàng đã tồn tại. Hãy kiểm tra hồ sơ cũ với quản lý.");
        long customerId;
        if (id == null) {
            customerId = insert("""
                    INSERT INTO sales_customers(department_id, owner_id, name, tax_code, email, phone, address, source, notes, active)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                    """, owner.departmentId(), command.ownerId(), command.name().trim(), clean(command.taxCode()),
                    email, phone, clean(command.address()), clean(command.source()), clean(command.notes()), command.active());
        } else {
            customerId = id;
            jdbc.update("""
                    UPDATE sales_customers SET owner_id=?, name=?, tax_code=?, email=?, phone=?, address=?, source=?, notes=?,
                    active=?, version=version+1, updated_at=NOW(6) WHERE id=?
                    """, command.ownerId(), command.name().trim(), clean(command.taxCode()), email, phone,
                    clean(command.address()), clean(command.source()), clean(command.notes()), command.active(), id);
        }
        event(customerId, "CUSTOMER", customerId, previous == null ? "CREATED" : "UPDATED", actorId,
                "Người phụ trách #" + command.ownerId() + (command.active() ? " · Hoạt động" : " · Ngừng hoạt động"));
        return customerId;
    }

    @Transactional
    public long addContact(long actorId, long customerId, Contact command) {
        customer(actorId, customerId, true);
        long id = insert("INSERT INTO sales_contacts(customer_id,name,job_title,email,phone) VALUES (?,?,?,?,?)",
                customerId, command.name().trim(), clean(command.jobTitle()), clean(command.email()), clean(command.phone()));
        event(customerId,"CONTACT",id,"CREATED",actorId,command.name());
        return id;
    }

    @Transactional
    public void updateContact(long actorId, long customerId, long contactId, Contact command) {
        customer(actorId, customerId, true);
        if (jdbc.update("UPDATE sales_contacts SET name=?,job_title=?,email=?,phone=? WHERE id=? AND customer_id=?",
                command.name().trim(), clean(command.jobTitle()), clean(command.email()), clean(command.phone()), contactId, customerId) != 1) {
            throw AppException.notFound("Không tìm thấy người liên hệ");
        }
        event(customerId,"CONTACT",contactId,"UPDATED",actorId,command.name());
    }

    public List<Map<String,Object>> opportunities(long actorId) {
        return scoped(actorId, """
                SELECT o.*, c.name customer_name, c.owner_id, u.ho_ten owner_name
                FROM sales_opportunities o JOIN sales_customers c ON c.id=o.customer_id JOIN users u ON u.id=c.owner_id
                """, " ORDER BY o.id DESC");
    }

    @Transactional
    public long saveOpportunity(long actorId, Long id, Opportunity command) {
        customer(actorId, command.customerId(), true);
        requireActive(command.customerId());
        if (id == null) {
            long newId = insert("""
                    INSERT INTO sales_opportunities(customer_id,title,requirements,expected_value,expected_close)
                    VALUES (?,?,?,?,?)
                    """, command.customerId(), command.title().trim(), command.requirements().trim(), command.expectedValue(), command.expectedClose());
            event(command.customerId(),"OPPORTUNITY",newId,"CREATED",actorId,command.title());
            return newId;
        }
        var opportunity = opportunity(actorId, id, true);
        version(opportunity, command.version());
        if (number(opportunity,"customer_id") != command.customerId()) throw AppException.badRequest("Không thay khách hàng của cơ hội");
        requireOpen(opportunity);
        jdbc.update("UPDATE sales_opportunities SET title=?,requirements=?,expected_value=?,expected_close=?,version=version+1 WHERE id=?",
                command.title().trim(), command.requirements().trim(), command.expectedValue(), command.expectedClose(), id);
        event(command.customerId(),"OPPORTUNITY",id,"UPDATED",actorId,command.title());
        return id;
    }

    @Transactional
    public void changeOpportunity(long actorId, long id, Transition command) {
        var opportunity = opportunity(actorId, id, true);
        version(opportunity,command.version());
        requireOpen(opportunity);
        String current = text(opportunity,"stage");
        var next = Map.of("NEW","QUALIFIED", "QUALIFIED","PROPOSAL", "PROPOSAL","NEGOTIATION");
        if (!command.action().equals("LOST") && !command.action().equals(next.get(current))) {
            throw AppException.conflict("Chuyển giai đoạn không hợp lệ. Chốt thành công sau khi quản lý xác nhận bản ký hợp đồng.");
        }
        if (command.action().equals("LOST") && clean(command.note()) == null) throw AppException.badRequest("Nhập lý do mất cơ hội");
        jdbc.update("UPDATE sales_opportunities SET stage=?,loss_reason=?,version=version+1 WHERE id=?",
                command.action(), clean(command.note()), id);
        event(number(opportunity,"customer_id"),"OPPORTUNITY",id,current + "_TO_" + command.action(),actorId,command.note());
    }

    public List<Map<String,Object>> activities(long actorId) {
        return scoped(actorId,"""
                SELECT a.*, c.name customer_name, u.ho_ten owner_name FROM sales_activities a
                JOIN sales_customers c ON c.id=a.customer_id JOIN users u ON u.id=c.owner_id
                """, " ORDER BY a.completed_at IS NOT NULL, a.due_at, a.id");
    }

    @Transactional
    public long addActivity(long actorId, Activity command) {
        customer(actorId, command.customerId(), true);
        requireActive(command.customerId());
        if (command.opportunityId() != null && number(opportunity(actorId,command.opportunityId(),false),"customer_id") != command.customerId()) {
            throw AppException.badRequest("Cơ hội không thuộc khách hàng đã chọn");
        }
        long id = insert("INSERT INTO sales_activities(customer_id,opportunity_id,subject,notes,due_at,created_by) VALUES (?,?,?,?,?,?)",
                command.customerId(), command.opportunityId(),command.subject().trim(),clean(command.notes()),command.dueAt(),actorId);
        event(command.customerId(),"ACTIVITY",id,"CREATED",actorId,command.subject());
        return id;
    }

    @Transactional
    public void completeActivity(long actorId, long id) {
        var activity = row("SELECT * FROM sales_activities WHERE id=?",id);
        customer(actorId,number(activity,"customer_id"),true);
        if (jdbc.update("UPDATE sales_activities SET completed_at=NOW(6) WHERE id=? AND completed_at IS NULL",id) == 1) {
            event(number(activity,"customer_id"),"ACTIVITY",id,"COMPLETED",actorId,null);
        }
    }

    public List<Map<String,Object>> products(long actorId) {
        access.requireSales(access.actor(actorId));
        return jdbc.queryForList("SELECT * FROM sales_products ORDER BY active DESC, name");
    }

    @Transactional
    public long saveProduct(long actorId, Long id, Product command) {
        access.requireDirector(access.actor(actorId));
        if (command.floorPrice().compareTo(command.unitPrice()) > 0) throw AppException.badRequest("Giá sàn không được cao hơn giá niêm yết");
        if (id == null) {
            long result = insert("INSERT INTO sales_products(name,unit,unit_price,active,floor_price,standard_package,standard_scope) VALUES (?,?,?,?,?,?,?)",
                    command.name().trim(),command.unit().trim(),command.unitPrice(),command.active(),command.floorPrice(),command.standardPackage(),command.standardScope().trim());
            event(null,"PRODUCT",result,"CREATED",actorId,command.name());
            return result;
        }
        version(row("SELECT * FROM sales_products WHERE id=? FOR UPDATE",id),command.version());
        jdbc.update("UPDATE sales_products SET name=?,unit=?,unit_price=?,active=?,floor_price=?,standard_package=?,standard_scope=?,version=version+1 WHERE id=?",
                command.name().trim(),command.unit().trim(),command.unitPrice(),command.active(),command.floorPrice(),command.standardPackage(),command.standardScope().trim(),id);
        event(null,"PRODUCT",id,"UPDATED",actorId,command.name());
        return id;
    }

    Map<String,Object> customer(long actorId,long id,boolean lock) {
        var actor = access.actor(actorId);
        var customer = row("SELECT * FROM sales_customers WHERE id=?" + (lock ? " FOR UPDATE" : ""),id);
        access.requireCustomer(actor,customer);
        return customer;
    }

    Map<String,Object> opportunity(long actorId,long id,boolean lock) {
        var initial = row("SELECT * FROM sales_opportunities WHERE id=?",id);
        customer(actorId,number(initial,"customer_id"),lock);
        return lock ? row("SELECT * FROM sales_opportunities WHERE id=? FOR UPDATE",id) : initial;
    }

    List<Map<String,Object>> scoped(long actorId,String select,String order) {
        var actor = access.actor(actorId);
        access.requireSales(actor);
        return jdbc.queryForList(select + " WHERE (? = TRUE OR (c.department_id=? AND (? = TRUE OR c.owner_id=?)))" + order,
                actor.ceo(),actor.departmentId(),actor.manager(),actor.id());
    }

    Map<String,Object> row(String sql,Object... params) {
        var rows = jdbc.queryForList(sql,params);
        if (rows.isEmpty()) throw AppException.notFound("Không tìm thấy bản ghi Kinh doanh");
        return rows.get(0);
    }

    @Transactional
    long insert(String sql,Object... params) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i=0; i<params.length; i++) statement.setObject(i+1,params[i]);
            return statement;
        },keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }

    @Transactional
    void event(Long customerId,String entity,long id,String action,long actorId,String details) {
        jdbc.update("INSERT INTO sales_events(customer_id,entity_type,entity_id,action,actor_id,details) VALUES (?,?,?,?,?,?)",
                customerId,entity,id,action,actorId,clean(details));
    }

    void requireActive(long customerId) {
        if (!Boolean.TRUE.equals(jdbc.queryForObject("SELECT active FROM sales_customers WHERE id=?",Boolean.class,customerId))) {
            throw AppException.conflict("Khách hàng đã ngừng hoạt động");
        }
    }

    static void requireOpen(Map<String,Object> opportunity) {
        if (Set.of("WON","LOST").contains(text(opportunity,"stage"))) throw AppException.conflict("Cơ hội đã kết thúc");
    }

    static void version(Map<String,Object> row,Long expected) {
        if (expected == null || number(row,"version") != expected) throw AppException.conflict("Dữ liệu vừa thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    static long number(Map<String,Object> row,String key) { return ((Number)row.get(key)).longValue(); }
    static String text(Map<String,Object> row,String key) { return String.valueOf(row.get(key)); }
    static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static String pattern(String value) { return "%" + (value == null ? "" : value.trim()) + "%"; }
}
