package com.hrm.sales;

import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import static com.hrm.sales.SalesCommands.*;
import static com.hrm.sales.SalesWorkspaceService.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class SalesTechnicalService {
    private final JdbcTemplate jdbc;
    private final SalesAccess access;
    private final SalesWorkspaceService workspace;

    /** Technical reviewers receive the assigned scope only, without customer contacts or commercial prices. */
    public List<Map<String,Object>> queue(long actorId) {
        var actor = access.actor(actorId);
        if (!actor.technicalReviewer()) throw AppException.forbidden("Cần Trưởng phòng hoặc Giám đốc Phòng Công nghệ thẩm định");
        var rows = jdbc.queryForList("""
                SELECT q.id,q.revision,q.opportunity_title,q.valid_until,q.terms,q.exception_note,q.version,q.status,
                    q.custom_scope,q.new_technology,q.resource_exception,q.routing_reasons
                FROM sales_quotations q WHERE q.technical_department_id=? AND q.status='PENDING_TECHNICAL' ORDER BY q.id
                """,actor.departmentId());
        rows.forEach(row -> row.put("lines",jdbc.queryForList(
                "SELECT id,description,quantity,unit FROM sales_quotation_lines WHERE quotation_id=? ORDER BY id",number(row,"id"))));
        return rows;
    }

    @Transactional
    public void review(long actorId,long id,TechnicalReview command) {
        var actor = access.actor(actorId);
        if (!actor.technicalReviewer()) throw AppException.forbidden("Cần Trưởng phòng hoặc Giám đốc Phòng Công nghệ thẩm định");
        var initial = workspace.row("""
                SELECT q.*,o.customer_id FROM sales_quotations q JOIN sales_opportunities o ON o.id=q.opportunity_id WHERE q.id=?
                """,id);
        if (!Objects.equals(actor.departmentId(),initial.get("technical_department_id"))) throw AppException.forbidden("Báo giá chưa được giao cho Phòng Công nghệ của bạn");
        // Match the commercial lock order without granting technical staff access to customer records.
        workspace.row("SELECT id FROM sales_customers WHERE id=? FOR UPDATE",number(initial,"customer_id"));
        var opportunity = workspace.row("SELECT * FROM sales_opportunities WHERE id=? FOR UPDATE",number(initial,"opportunity_id"));
        var quote = workspace.row("SELECT * FROM sales_quotations WHERE id=? FOR UPDATE",id);
        version(quote,command.version());
        requireOpen(opportunity);
        if (!"PENDING_TECHNICAL".equals(text(quote,"status"))) throw AppException.conflict("Báo giá không còn chờ Phòng Công nghệ thẩm định");
        if (number(quote,"created_by")==actorId) throw AppException.forbidden("Người lập không được tự thẩm định báo giá");
        if (SalesCommercialService.date(quote,"valid_until").isBefore(LocalDate.now())) throw AppException.conflict("Báo giá đã hết hạn. Cần phiên bản mới.");
        workspace.insert("""
                INSERT INTO sales_technical_reviews(quotation_id,approved,effort_days,feasibility,delivery_plan,resource_needs,requires_executive,reviewed_by)
                VALUES (?,?,?,?,?,?,?,?)
                """,id,command.approved(),command.effortDays(),command.feasibility().trim(),command.deliveryPlan().trim(),command.resourceNeeds().trim(),command.requiresExecutive(),actorId);
        String reasons = text(quote,"routing_reasons");
        if (command.requiresExecutive()) reasons += ". Phòng Công nghệ xác nhận cần chi phí/nguồn lực ngoài thẩm quyền: " + command.resourceNeeds().trim();
        jdbc.update("""
                UPDATE sales_quotations SET status=?,technical_status=?,approval_level=CASE WHEN ?=TRUE THEN 'CEO' ELSE approval_level END,
                    routing_reasons=?,version=version+1 WHERE id=?
                """,command.approved() ? "PENDING_APPROVAL" : "RETURNED",command.approved() ? "APPROVED" : "RETURNED",command.requiresExecutive(),reasons,id);
        workspace.event(number(initial,"customer_id"),"QUOTATION",id,command.approved() ? "TECHNICAL_APPROVED" : "TECHNICAL_RETURNED",actorId,command.feasibility());
    }
}
