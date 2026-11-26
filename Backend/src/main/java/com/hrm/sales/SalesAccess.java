package com.hrm.sales;

import com.hrm.common.entity.Role;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.text.Normalizer;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SalesAccess {
    private final JdbcTemplate jdbc;

    public record Actor(long id, Role role, Long departmentId, String departmentKind) {
        public boolean ceo() { return role == Role.CEO; }
        public boolean manager() { return ceo() || role == Role.TRUONG_PHONG || role == Role.GIAM_DOC_PHONG_BAN; }
        public boolean sales() { return ceo() || "SALES".equals(departmentKind); }
        public boolean director() { return ceo() || role == Role.GIAM_DOC_PHONG_BAN; }
        public boolean technicalReviewer() { return "TECHNICAL".equals(departmentKind) && manager(); }
        public int approvalRank() { return ceo() ? 3 : !sales() ? 0 : role == Role.GIAM_DOC_PHONG_BAN ? 2 : role == Role.TRUONG_PHONG ? 1 : 0; }
    }

    public Actor actor(long id) {
        List<Map<String,Object>> rows = jdbc.queryForList("""
                SELECT u.id, u.role, u.department_id, d.ten_phong
                FROM users u LEFT JOIN departments d ON d.id = u.department_id
                WHERE u.id = ? AND u.active = b'1'
                """, id);
        if (rows.isEmpty()) throw AppException.forbidden("Tài khoản không còn hoạt động");
        var row = rows.get(0);
        Role role = Role.valueOf(String.valueOf(row.get("role")));
        if (role == Role.ADMIN) throw AppException.forbidden("Tài khoản quản trị không có quyền nghiệp vụ Kinh doanh");
        return new Actor(id, role, row.get("department_id") == null ? null : ((Number)row.get("department_id")).longValue(),
                kind(String.valueOf(row.get("ten_phong"))));
    }

    public static String kind(String name) {
        String text = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(java.util.Locale.ROOT).trim();
        if (text.equals("kinh doanh") || text.equals("phong kinh doanh")) return "SALES";
        if (text.equals("ke toan") || text.equals("phong ke toan")) return "ACCOUNTING";
        if (text.equals("ky thuat") || text.equals("phong ky thuat")) return "TECHNICAL";
        return "OTHER";
    }

    public void requireSales(Actor actor) {
        if (!actor.sales()) throw AppException.forbidden("Chức năng dành cho phòng Kinh doanh");
    }

    public void requireManager(Actor actor) {
        requireSales(actor);
        if (!actor.manager()) throw AppException.forbidden("Cần quyền quản lý Kinh doanh");
    }

    public void requireDirector(Actor actor) {
        requireSales(actor);
        if (!actor.director()) throw AppException.forbidden("Cần Giám đốc Kinh doanh hoặc CEO quản lý bảng giá");
    }

    public void requireCustomer(Actor actor, Map<String,Object> customer) {
        requireSales(actor);
        if (actor.ceo()) return;
        if (!java.util.Objects.equals(actor.departmentId(), ((Number)customer.get("department_id")).longValue())
                || (!actor.manager() && actor.id() != ((Number)customer.get("owner_id")).longValue())) {
            throw AppException.forbidden("Khách hàng nằm ngoài phạm vi được phân công");
        }
    }
}
