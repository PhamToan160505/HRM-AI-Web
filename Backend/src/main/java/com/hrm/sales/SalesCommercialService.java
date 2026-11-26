package com.hrm.sales;

import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import static com.hrm.sales.SalesCommands.*;
import static com.hrm.sales.SalesWorkspaceService.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SalesCommercialService {
    private final SalesWorkspaceService workspace;
    private final SalesAccess access;
    private final NotificationService notifications;
    private final JdbcTemplate jdbc;
    private final SalesPricingService pricing;

    public List<Map<String,Object>> quotations(long actorId) {
        var actor = access.actor(actorId);
        var rows = workspace.scoped(actorId,"""
                SELECT q.*, o.title opportunity_title, o.customer_id, c.name customer_name, c.owner_id,
                       u.ho_ten owner_name
                FROM sales_quotations q JOIN sales_opportunities o ON o.id=q.opportunity_id
                JOIN sales_customers c ON c.id=o.customer_id JOIN users u ON u.id=c.owner_id
                """," ORDER BY q.id DESC");
        rows.forEach(row -> row.put("can_approve",SalesPricingService.canApprove(actor,row)));
        return rows;
    }

    public Map<String,Object> quotationDetail(long actorId,long id) {
        var quote = quotation(actorId,id,false);
        quote.put("can_approve",SalesPricingService.canApprove(access.actor(actorId),quote));
        return Map.of("quotation",quote,"lines",jdbc.queryForList(
                "SELECT * FROM sales_quotation_lines WHERE quotation_id=? ORDER BY id",id),
                "reviews",jdbc.queryForList("SELECT r.*,u.ho_ten reviewer_name FROM sales_technical_reviews r JOIN users u ON u.id=r.reviewed_by WHERE r.quotation_id=?",id));
    }

    @Transactional
    public long createQuotation(long actorId,Quotation command) {
        var opportunity = workspace.opportunity(actorId,command.opportunityId(),true);
        var customer = workspace.customer(actorId,number(opportunity,"customer_id"),true);
        requireOpen(opportunity);
        workspace.requireActive(number(opportunity,"customer_id"));
        if (command.validUntil().isBefore(LocalDate.now())) throw AppException.badRequest("Hạn báo giá phải từ hôm nay trở đi");
        var accepted = jdbc.queryForList("SELECT id FROM sales_quotations WHERE opportunity_id=? AND status='ACCEPTED' FOR UPDATE",command.opportunityId());
        if (!accepted.isEmpty()) throw AppException.conflict("Cơ hội đã có báo giá được khách hàng chấp thuận");
        BigDecimal total = quotationTotal(command.lines(),command.discountAmount());
        if (total.precision() - total.scale() > 17) throw AppException.badRequest("Tổng báo giá vượt giới hạn lưu trữ");
        var revisions = jdbc.queryForList("SELECT revision FROM sales_quotations WHERE opportunity_id=? ORDER BY revision DESC LIMIT 1 FOR UPDATE",command.opportunityId());
        int revision = revisions.isEmpty() ? 1 : ((Number)revisions.get(0).get("revision")).intValue() + 1;
        if ((command.customScope() || command.newTechnology() || command.resourceException() || command.exclusiveRights() || command.strategicException())
                && clean(command.exceptionNote()) == null) throw AppException.badRequest("Cần giải trình yêu cầu khác chuẩn / ngoại lệ");
        if (command.technicalDepartmentId()!=null) {
            var department = workspace.row("SELECT * FROM departments WHERE id=?",command.technicalDepartmentId());
            if (!"TECHNICAL".equals(SalesAccess.kind(text(department,"ten_phong")))) throw AppException.badRequest("Chọn Phòng Công nghệ thẩm định");
        }
        // Lock catalog entries in a stable order and capture their version and price floor.
        var products = new TreeMap<Long,Map<String,Object>>();
        for (Long productId : command.lines().stream().map(QuoteLine::productId).distinct().sorted().toList()) {
            products.put(productId,workspace.row("SELECT * FROM sales_products WHERE id=? AND active=TRUE FOR UPDATE",productId));
        }
        long id = workspace.insert("""
                INSERT INTO sales_quotations(opportunity_id,customer_name,customer_address,customer_tax_code,opportunity_title,
                        revision,valid_until,discount_amount,total_amount,terms,created_by,custom_scope,new_technology,
                        resource_exception,exclusive_rights,strategic_exception,exception_note,technical_department_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,command.opportunityId(),customer.get("name"),customer.get("address"),customer.get("tax_code"),opportunity.get("title"),
                revision,command.validUntil(),command.discountAmount(),total,command.terms().trim(),actorId,command.customScope(),command.newTechnology(),
                command.resourceException(),command.exclusiveRights(),command.strategicException(),clean(command.exceptionNote()),command.technicalDepartmentId());
        for (var line: command.lines()) {
            var product = products.get(line.productId());
            jdbc.update("""
                    INSERT INTO sales_quotation_lines(quotation_id,product_id,description,unit,quantity,unit_price,
                        catalog_price,floor_price,product_version,standard_package,standard_scope)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                    """,id,line.productId(),line.description().trim(),product.get("unit"),line.quantity(),line.unitPrice(),
                    product.get("unit_price"),product.get("floor_price"),product.get("version"),product.get("standard_package"),product.get("standard_scope"));
        }
        workspace.event(number(opportunity,"customer_id"),"QUOTATION",id,"DRAFT_CREATED",actorId,"Phiên bản " + revision);
        return id;
    }

    public static BigDecimal quotationTotal(List<QuoteLine> lines,BigDecimal discount) {
        if (lines == null || lines.isEmpty() || discount == null || discount.signum() < 0) {
            throw AppException.badRequest("Báo giá cần hạng mục và mức giảm hợp lệ");
        }
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var line: lines) {
            if (line.quantity() == null || line.quantity().signum() <= 0 || line.unitPrice() == null || line.unitPrice().signum() < 0) {
                throw AppException.badRequest("Số lượng phải dương và đơn giá không âm");
            }
            subtotal = subtotal.add(line.quantity().multiply(line.unitPrice()).setScale(2,RoundingMode.HALF_UP));
        }
        if (discount.compareTo(subtotal) > 0) throw AppException.badRequest("Giảm giá vượt tổng giá trị hạng mục");
        return subtotal.subtract(discount).setScale(2,RoundingMode.HALF_UP);
    }

    @Transactional
    public void transitionQuotation(long actorId,long id,Transition command) {
        var quote = quotation(actorId,id,true);
        version(quote,command.version());
        var opportunity = workspace.opportunity(actorId,number(quote,"opportunity_id"),true);
        requireOpen(opportunity);
        String current = text(quote,"status");
        String target;
        if ("DRAFT".equals(current) && Set.of("SUBMIT","SEND").contains(command.action())) {
            if (date(quote,"valid_until").isBefore(LocalDate.now())) throw AppException.conflict("Báo giá đã hết hạn. Hãy lập phiên bản mới.");
            var policy = pricing.latest(true);
            var lines = jdbc.queryForList("SELECT * FROM sales_quotation_lines WHERE quotation_id=? ORDER BY product_id,id",id);
            for (var line : lines) {
                var product = workspace.row("SELECT * FROM sales_products WHERE id=? FOR UPDATE",number(line,"product_id"));
                if (line.get("product_version")==null || number(line,"product_version")!=number(product,"version") || !SalesPricingService.flag(product,"active")) {
                    throw AppException.conflict("Khung giá đã thay đổi hoặc bản nháp cũ chưa có khung giá. Hãy tạo phiên bản mới.");
                }
            }
            var decision = SalesPricingService.evaluate(policy,quote,lines);
            if (command.action().equals("SEND") && !decision.level().equals("STANDARD")) throw AppException.conflict("Báo giá cần thẩm định/phê duyệt. Chọn Xác định tuyến duyệt để chuyển đúng cấp.");
            if (decision.technical() && quote.get("technical_department_id")==null) throw AppException.badRequest("Báo giá cần thẩm định từ Phòng Công nghệ. Hãy tạo phiên bản có Phòng Công nghệ được chỉ định.");
            target = decision.technical() ? "PENDING_TECHNICAL" : decision.level().equals("STANDARD") ? (command.action().equals("SEND") ? "SENT" : "APPROVED") : "PENDING_APPROVAL";
            jdbc.update("""
                    UPDATE sales_quotations SET pricing_policy_id=?,policy_snapshot=?,approval_level=?,routing_reasons=?,technical_status=? WHERE id=?
                    """,number(policy,"id"),SalesPricingService.snapshot(policy),decision.level(),decision.reasons(),decision.technical() ? "PENDING" : "NOT_REQUIRED",id);
            workspace.event(number(opportunity,"customer_id"),"QUOTATION",id,"POLICY_EVALUATED",actorId,"Chính sách #"+policy.get("id")+" · "+decision.level()+" · "+decision.reasons());
        } else {
            if ("RETURNED".equals(current)) throw AppException.conflict("Tạo phiên bản mới để bổ sung báo giá và giữ nguyên lịch sử phiên bản bị trả về");
            target = quoteTarget(current,command.action());
        }
        boolean humanDecision = "PENDING_APPROVAL".equals(current) && Set.of("APPROVED","RETURNED").contains(target);
        if (humanDecision && !SalesPricingService.canApprove(access.actor(actorId),quote)) {
            throw AppException.forbidden("Bạn chưa đủ thẩm quyền hoặc là người lập báo giá. Cần người duyệt khác đủ cấp hoặc người được CEO ủy quyền.");
        }
        if (target.equals("RETURNED") && clean(command.note()) == null) throw AppException.badRequest("Nhập lý do trả về");
        if (Set.of("SENT","ACCEPTED").contains(target) && date(quote,"valid_until").isBefore(LocalDate.now())) {
            throw AppException.conflict("Báo giá đã hết hạn. Hãy lập phiên bản mới.");
        }
        if (target.equals("ACCEPTED")) {
            if (clean(command.note()) == null) throw AppException.badRequest("Ghi nhận căn cứ khách hàng chấp thuận");
            var existing = jdbc.queryForList("SELECT id FROM sales_quotations WHERE opportunity_id=? AND status='ACCEPTED' FOR UPDATE",number(quote,"opportunity_id"));
            if (!existing.isEmpty()) throw AppException.conflict("Cơ hội đã có một báo giá được chấp thuận");
        }
        jdbc.update("""
                UPDATE sales_quotations SET status=?, approved_by=CASE WHEN ?=TRUE AND ?='APPROVED' THEN ? ELSE approved_by END,
                decision_note=?,version=version+1 WHERE id=?
                """,target,humanDecision,target,actorId,clean(command.note()),id);
        workspace.event(number(opportunity,"customer_id"),"QUOTATION",id,current+"_TO_"+target,actorId,command.note());
    }

    static String quoteTarget(String current,String action) {
        String result = switch (current) {
            case "DRAFT", "RETURNED" -> "SUBMIT".equals(action) ? "PENDING_APPROVAL" : null;
            case "PENDING_APPROVAL" -> switch (action) { case "APPROVE" -> "APPROVED"; case "RETURN" -> "RETURNED"; default -> null; };
            case "APPROVED" -> "SEND".equals(action) ? "SENT" : null;
            case "SENT" -> switch (action) { case "ACCEPT" -> "ACCEPTED"; case "DECLINE" -> "DECLINED"; default -> null; };
            default -> null;
        };
        if (result == null) throw AppException.conflict("Thao tác không hợp lệ ở trạng thái báo giá hiện tại");
        return result;
    }

    @Transactional
    public long sendHandover(long actorId,long contractId,Handover command) {
        var contract = contract(actorId,contractId);
        workspace.customer(actorId,number(contract,"customer_id"),true);
        contract = contract(actorId,contractId);
        if (!"CONFIRMED".equals(text(contract,"status"))) throw AppException.conflict("Chỉ bàn giao hợp đồng đã được quản lý xác nhận bản ký");
        var recipient = workspace.row("SELECT * FROM departments WHERE id=?",command.recipientDepartmentId());
        if (!Set.of("ACCOUNTING","TECHNICAL").contains(SalesAccess.kind(text(recipient,"ten_phong")))) {
            throw AppException.badRequest("Chỉ bàn giao cho Phòng Tài chính - Kế toán hoặc Phòng Công nghệ");
        }
        var existing = jdbc.queryForList("SELECT * FROM sales_handovers WHERE contract_id=? AND recipient_department_id=? FOR UPDATE",
                contractId,command.recipientDepartmentId());
        if (!existing.isEmpty()) return number(existing.get(0),"id");
        long id = workspace.insert("INSERT INTO sales_handovers(contract_id,recipient_department_id,sent_by) VALUES (?,?,?)",
                contractId,command.recipientDepartmentId(),actorId);
        notifyDepartment(command.recipientDepartmentId(),"Phiếu bàn giao mới", "Hợp đồng " + contract.get("contract_number") + " đang chờ tiếp nhận.");
        workspace.event(number(contract,"customer_id"),"HANDOVER",id,"SENT",actorId,text(recipient,"ten_phong"));
        return id;
    }

    public List<Map<String,Object>> handovers(long actorId) {
        var actor = access.actor(actorId);
        if (!actor.sales() && !Set.of("ACCOUNTING","TECHNICAL").contains(actor.departmentKind())) {
            throw AppException.forbidden("Bạn không có quyền xem bàn giao");
        }
        return jdbc.queryForList("""
                SELECT h.*, k.contract_number, k.signed_date, k.end_date, k.scope, k.milestones, k.payment_terms,
                       k.file_url, k.signer, q.total_amount, c.name customer_name, c.email customer_email,
                       c.phone customer_phone, d.ten_phong recipient_name, u.ho_ten sender_name
                FROM sales_handovers h JOIN sales_contracts k ON k.id=h.contract_id
                JOIN sales_quotations q ON q.id=k.quotation_id JOIN sales_opportunities o ON o.id=q.opportunity_id
                JOIN sales_customers c ON c.id=o.customer_id JOIN departments d ON d.id=h.recipient_department_id
                JOIN users u ON u.id=h.sent_by
                WHERE ?=TRUE OR (?=TRUE AND c.department_id=? AND (?=TRUE OR c.owner_id=?))
                      OR (?=FALSE AND h.recipient_department_id=?)
                ORDER BY h.id DESC
                """,actor.ceo(),actor.sales(),actor.departmentId(),actor.manager(),actor.id(),actor.sales(),actor.departmentId());
    }

    @Transactional
    public void respondHandover(long actorId,long id,Transition command) {
        var actor = access.actor(actorId);
        var handover = workspace.row("SELECT * FROM sales_handovers WHERE id=? FOR UPDATE",id);
        version(handover,command.version());
        var contract = workspace.row("""
                SELECT k.*, o.customer_id FROM sales_contracts k JOIN sales_quotations q ON q.id=k.quotation_id
                JOIN sales_opportunities o ON o.id=q.opportunity_id WHERE k.id=?
                """,number(handover,"contract_id"));
        if ("RESUBMIT".equals(command.action())) {
            workspace.customer(actorId,number(contract,"customer_id"),false);
            if (!"RETURNED".equals(text(handover,"status"))) throw AppException.conflict("Chỉ gửi lại phiếu đã trả về");
            if (clean(command.note()) == null) throw AppException.badRequest("Ghi nội dung giải trình khi gửi lại");
            jdbc.update("UPDATE sales_handovers SET status='PENDING',response_note=?,received_by=NULL,responded_at=NULL,version=version+1 WHERE id=?",
                    command.note(),id);
            notifyDepartment(number(handover,"recipient_department_id"),"Phiếu bàn giao gửi lại",command.note());
        } else {
            if (!Objects.equals(actor.departmentId(),number(handover,"recipient_department_id"))
                    || !Set.of("ACCOUNTING","TECHNICAL").contains(actor.departmentKind())) {
                throw AppException.forbidden("Chỉ phòng nhận được phản hồi bàn giao");
            }
            if (!"PENDING".equals(text(handover,"status"))) throw AppException.conflict("Phiếu đã được phản hồi");
            if (!Set.of("ACCEPT","RETURN").contains(command.action())) throw AppException.badRequest("Chọn tiếp nhận hoặc trả về");
            if (command.action().equals("RETURN") && clean(command.note()) == null) throw AppException.badRequest("Nhập nội dung cần bổ sung");
            jdbc.update("UPDATE sales_handovers SET status=?,response_note=?,received_by=?,responded_at=NOW(6),version=version+1 WHERE id=?",
                    command.action().equals("ACCEPT") ? "ACCEPTED" : "RETURNED",clean(command.note()),actorId,id);
            notifications.createNotification(number(handover,"sent_by"),"SALES_HANDOVER","Bàn giao đã có phản hồi",
                    "Hợp đồng " + contract.get("contract_number") + ": " + (command.action().equals("ACCEPT") ? "Đã tiếp nhận" : "Cần bổ sung"),
                    "binh_thuong", "/sales");
        }
        workspace.event(number(contract,"customer_id"),"HANDOVER",id,command.action(),actorId,command.note());
    }

    private void notifyDepartment(long departmentId,String title,String body) {
        jdbc.queryForList("SELECT id FROM users WHERE department_id=? AND active=b'1'",Long.class,departmentId)
                .forEach(id -> notifications.createNotification(id,"SALES_HANDOVER",title,body,"binh_thuong","/sales"));
    }

    private Map<String,Object> quotation(long actorId,long id,boolean lock) {
        var initial = workspace.row("SELECT * FROM sales_quotations WHERE id=?",id);
        workspace.opportunity(actorId,number(initial,"opportunity_id"),lock);
        return lock ? workspace.row("SELECT * FROM sales_quotations WHERE id=? FOR UPDATE",id) : initial;
    }

    private Map<String,Object> contract(long actorId,long id) {
        var contract = workspace.row("""
                SELECT k.*, o.customer_id FROM sales_contracts k JOIN sales_quotations q ON q.id=k.quotation_id
                JOIN sales_opportunities o ON o.id=q.opportunity_id WHERE k.id=?
                """,id);
        workspace.customer(actorId,number(contract,"customer_id"),false);
        return contract;
    }

    static LocalDate date(Map<String,Object> row,String key) {
        return row.get(key) instanceof java.sql.Date value ? value.toLocalDate() : LocalDate.parse(text(row,key));
    }

    static void requireHttps(String url) {
        try {
            var uri = java.net.URI.create(url.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw AppException.badRequest("Tệp hợp đồng phải là liên kết HTTPS hợp lệ");
        }
    }
}
