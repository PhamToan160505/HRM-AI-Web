package com.hrm.sales;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import static com.hrm.sales.SalesCommands.*;
import static com.hrm.sales.SalesWorkspaceService.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class SalesPricingService {
    private final JdbcTemplate jdbc;
    private final SalesAccess access;
    private final SalesWorkspaceService workspace;
    private static final ObjectMapper JSON = new ObjectMapper();

    public Map<String,Object> policy(long actorId) {
        access.requireSales(access.actor(actorId));
        return latest(false);
    }

    public List<Map<String,Object>> delegates(long actorId) {
        if (!access.actor(actorId).ceo()) throw AppException.forbidden("Chỉ CEO được thiết lập ủy quyền");
        return jdbc.queryForList("""
                SELECT u.id,u.ho_ten,d.ten_phong FROM users u JOIN departments d ON d.id=u.department_id
                WHERE u.active=b'1' AND u.role='GIAM_DOC_PHONG_BAN' ORDER BY u.ho_ten
                """).stream().filter(row -> "SALES".equals(SalesAccess.kind(text(row,"ten_phong")))).toList();
    }

    @Transactional
    public long publish(long actorId,PricingPolicy command) {
        if (!access.actor(actorId).ceo()) throw AppException.forbidden("Chỉ CEO được công bố hạn mức và ủy quyền");
        var old = latest(true);
        if (number(old,"id") != command.version()) throw AppException.conflict("Chính sách đã thay đổi. Hãy tải lại.");
        if (command.standardMax().compareTo(command.managerMax()) > 0 || command.managerMax().compareTo(command.directorMax()) > 0
                || command.managerDiscount().compareTo(command.directorDiscount()) > 0) {
            throw AppException.badRequest("Hạn mức phải tăng theo cấp: gửi chuẩn ≤ Trưởng phòng ≤ Giám đốc; chiết khấu Trưởng phòng ≤ Giám đốc");
        }
        if (command.enabled() && clean(command.standardTerms()) == null) throw AppException.badRequest("Cần nội dung điều khoản chuẩn trước khi kích hoạt");
        if (command.ceoDelegateId() != null) {
            var delegate = access.actor(command.ceoDelegateId());
            if (!delegate.sales() || delegate.ceo() || !delegate.director()) throw AppException.badRequest("Người được ủy quyền phải là Giám đốc Kinh doanh đang hoạt động");
        }
        long id = workspace.insert("""
                INSERT INTO sales_pricing_policies(enabled,standard_max,manager_max,director_max,manager_discount,director_discount,
                    standard_terms,ceo_delegate_id,change_reason,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)
                """,command.enabled(),command.standardMax(),command.managerMax(),command.directorMax(),command.managerDiscount(),
                command.directorDiscount(),Objects.toString(command.standardTerms(),"").trim(),command.ceoDelegateId(),command.changeReason().trim(),actorId);
        workspace.event(null,"PRICING_POLICY",id,"PUBLISHED",actorId,command.changeReason());
        return id;
    }

    Map<String,Object> latest(boolean lock) {
        return workspace.row("SELECT * FROM sales_pricing_policies ORDER BY id DESC LIMIT 1" + (lock ? " FOR UPDATE" : ""));
    }

    public record Decision(String level,boolean technical,String reasons,BigDecimal amount,BigDecimal discountPercent) {}

    /** All inputs are server-side catalog snapshots; author role deliberately has no influence. */
    static Decision evaluate(Map<String,Object> policy,Map<String,Object> quote,List<Map<String,Object>> lines) {
        if (!flag(policy,"enabled")) throw AppException.conflict("CEO chưa kích hoạt chính sách báo giá. Vẫn có thể lưu bản nháp.");
        BigDecimal catalog = BigDecimal.ZERO, gross = BigDecimal.ZERO, floor = BigDecimal.ZERO;
        boolean standard = true, belowLineFloor = false, exactPrice = true;
        for (var line : lines) {
            if (line.get("catalog_price") == null || line.get("floor_price") == null) throw AppException.conflict("Bản nháp cũ chưa có khung giá. Hãy tạo phiên bản mới.");
            BigDecimal quantity = decimal(line,"quantity"), price = decimal(line,"unit_price"), base = decimal(line,"catalog_price");
            catalog = catalog.add(quantity.multiply(base).setScale(2,RoundingMode.HALF_UP));
            gross = gross.add(quantity.multiply(price).setScale(2,RoundingMode.HALF_UP));
            floor = floor.add(quantity.multiply(decimal(line,"floor_price")).setScale(2,RoundingMode.HALF_UP));
            belowLineFloor |= price.compareTo(decimal(line,"floor_price")) < 0;
            exactPrice &= price.compareTo(base) == 0;
            standard &= flag(line,"standard_package") && Objects.equals(clean(text(line,"description")),clean(text(line,"standard_scope")));
        }
        BigDecimal total = decimal(quote,"total_amount");
        BigDecimal discount = percent(catalog.subtract(total).max(BigDecimal.ZERO),catalog)
                .max(percent(decimal(quote,"discount_amount"),gross));
        BigDecimal amount = catalog.max(gross).max(total);
        boolean technical = !standard || flag(quote,"custom_scope") || flag(quote,"new_technology") || flag(quote,"resource_exception");
        List<String> reasons = new ArrayList<>();
        if (technical) reasons.add("Cần Kỹ thuật thẩm định phạm vi, công sức, tiến độ và nguồn lực");
        boolean exceptional = false;
        if (total.signum()==0) { exceptional = true; reasons.add("Miễn phí toàn bộ báo giá"); }
        if (belowLineFloor || total.compareTo(floor) < 0) { exceptional = true; reasons.add("Giá sau giảm dưới giá sàn"); }
        if (!Objects.equals(clean(text(quote,"terms")),clean(text(policy,"standard_terms")))) { exceptional = true; reasons.add("Điều khoản khác mẫu chuẩn"); }
        if (flag(quote,"resource_exception")) { exceptional = true; reasons.add("Nguồn lực hoặc chi phí ngoài thẩm quyền/ngân sách"); }
        if (flag(quote,"exclusive_rights")) { exceptional = true; reasons.add("Chuyển giao độc quyền nền tảng hoặc mã nguồn dùng chung"); }
        if (flag(quote,"strategic_exception")) { exceptional = true; reasons.add("Ngoại lệ chiến lược / miễn phí / bán lỗ"); }
        String level;
        if (exceptional) level = "CEO";
        else if (!technical && exactPrice && decimal(quote,"discount_amount").signum()==0 && amount.compareTo(decimal(policy,"standard_max"))<=0) {
            level="STANDARD"; reasons.add("Đúng gói, giá, phạm vi, điều khoản chuẩn và trong hạn mức gửi trực tiếp");
        } else if (amount.compareTo(decimal(policy,"manager_max"))<=0 && discount.compareTo(decimal(policy,"manager_discount"))<=0) level="MANAGER";
        else if (amount.compareTo(decimal(policy,"director_max"))<=0 && discount.compareTo(decimal(policy,"director_discount"))<=0) level="DIRECTOR";
        else { level="CEO"; reasons.add("Giá trị hoặc chiết khấu vượt hạn mức Giám đốc Kinh doanh"); }
        reasons.add("Giá trị xét hạn mức: " + amount.toPlainString() + " VND; chiết khấu hiệu dụng: " + discount.toPlainString() + "%");
        return new Decision(level,technical,String.join(". ",reasons),amount,discount);
    }

    static boolean canApprove(SalesAccess.Actor actor,Map<String,Object> quote) {
        if (actor.id()==number(quote,"created_by") || !actor.sales()) return false;
        int rank = switch (Objects.toString(quote.get("approval_level"),"MANAGER")) { case "CEO" -> 3; case "DIRECTOR" -> 2; default -> 1; };
        if (actor.approvalRank()>=rank) return true;
        if (rank==3 && actor.director() && quote.get("policy_snapshot") != null) {
            try {
                var delegated = JSON.readTree(quote.get("policy_snapshot").toString()).get("ceo_delegate_id");
                return delegated != null && !delegated.isNull() && delegated.asLong()==actor.id();
            } catch (JsonProcessingException exception) { throw new IllegalStateException("Invalid saved sales policy",exception); }
        }
        return false;
    }

    static String snapshot(Map<String,Object> policy) {
        var copy = new LinkedHashMap<>(policy);
        copy.remove("created_at");
        try { return JSON.writeValueAsString(copy); }
        catch (JsonProcessingException exception) { throw new IllegalStateException(exception); }
    }
    static boolean flag(Map<String,Object> row,String key) {
        Object value=row.get(key);
        return Boolean.TRUE.equals(value) || value instanceof Number number && number.intValue()!=0;
    }
    static BigDecimal decimal(Map<String,Object> row,String key) { return new BigDecimal(row.get(key).toString()); }
    private static BigDecimal percent(BigDecimal value,BigDecimal base) {
        return base.signum()==0 ? (value.signum()>0 ? new BigDecimal("100") : BigDecimal.ZERO) : value.multiply(new BigDecimal("100")).divide(base,6,RoundingMode.CEILING);
    }
}
