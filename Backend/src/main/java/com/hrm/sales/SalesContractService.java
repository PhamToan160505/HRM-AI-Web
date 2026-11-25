package com.hrm.sales;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;
import static com.hrm.sales.SalesCommands.*;
import static com.hrm.sales.SalesWorkspaceService.*;
import static com.hrm.sales.SalesCommercialService.date;

@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class SalesContractService {
    private final JdbcTemplate jdbc;
    private final SalesWorkspaceService workspace;
    private final SalesAccess access;
    private final NotificationService notifications;
    private static final ObjectMapper JSON = new ObjectMapper();

    public List<Map<String,Object>> list(long actorId) {
        var actor=access.actor(actorId);
        var rows=workspace.scoped(actorId,"""
                SELECT k.*,q.total_amount,q.revision,q.approval_level,q.policy_snapshot,o.title opportunity_title,o.customer_id,
                    c.name customer_name,c.owner_id,u.ho_ten owner_name,s.submitted_by,
                    s.customer_signer submitted_customer_signer,s.company_signer,s.file_url submitted_file_url,s.signed_date submitted_signed_date
                FROM sales_contracts k JOIN sales_quotations q ON q.id=k.quotation_id
                JOIN sales_opportunities o ON o.id=q.opportunity_id JOIN sales_customers c ON c.id=o.customer_id
                JOIN users u ON u.id=c.owner_id LEFT JOIN sales_contract_signatures s ON s.id=k.current_signature_id
                """," ORDER BY k.id DESC");
        rows.forEach(row -> capabilities(actor,row));
        return rows;
    }

    public Map<String,Object> detail(long actorId,long id) {
        var contract=locked(actorId,id,false);
        var quote=workspace.row("SELECT * FROM sales_quotations WHERE id=?",number(contract,"quotation_id"));
        var enriched=new LinkedHashMap<>(contract);
        enriched.put("approval_level",quote.get("approval_level")); enriched.put("policy_snapshot",quote.get("policy_snapshot"));
        enriched.put("total_amount",quote.get("total_amount"));
        var signatures=jdbc.queryForList("SELECT s.*,u.ho_ten submitter_name FROM sales_contract_signatures s JOIN users u ON u.id=s.submitted_by WHERE s.contract_id=? ORDER BY s.id DESC",id);
        if (!signatures.isEmpty()) enriched.put("submitted_by",signatures.get(0).get("submitted_by"));
        capabilities(access.actor(actorId),enriched);
        return Map.of("contract",enriched,"quotation",quote,"signatures",signatures,
                "lines",jdbc.queryForList("SELECT * FROM sales_quotation_lines WHERE quotation_id=? ORDER BY id",number(contract,"quotation_id")),
                "history",jdbc.queryForList("SELECT h.*,u.ho_ten actor_name FROM sales_contract_history h JOIN users u ON u.id=h.actor_id WHERE contract_id=? ORDER BY h.version DESC",id));
    }

    @Transactional
    public long create(long actorId,ContractDraft command) {
        var initial=workspace.row("SELECT * FROM sales_quotations WHERE id=?",command.quotationId());
        var opportunity=workspace.opportunity(actorId,number(initial,"opportunity_id"),true);
        var quote=workspace.row("SELECT * FROM sales_quotations WHERE id=? FOR UPDATE",command.quotationId());
        var existing=jdbc.queryForList("SELECT * FROM sales_contracts WHERE quotation_id=? FOR UPDATE",command.quotationId());
        if (!existing.isEmpty()) return number(existing.get(0),"id");
        requireOpen(opportunity);
        workspace.requireActive(number(opportunity,"customer_id"));
        if (!"ACCEPTED".equals(text(quote,"status"))) throw AppException.conflict("Chỉ lập hợp đồng từ báo giá đã được khách hàng chấp thuận");
        validateDraft(command);
        if (command.version()!=0L) throw AppException.conflict("Bản nháp mới phải có phiên bản 0");
        var lines=jdbc.queryForList("SELECT * FROM sales_quotation_lines WHERE quotation_id=? ORDER BY id",command.quotationId());
        String scope=String.join("\n",lines.stream().map(line -> text(line,"description")+" · "+line.get("quantity")+" "+line.get("unit")).toList());
        var technical=jdbc.queryForList("SELECT delivery_plan FROM sales_technical_reviews WHERE quotation_id=? AND approved=TRUE",command.quotationId());
        String milestones=technical.isEmpty() ? text(quote,"terms") : text(technical.get(0),"delivery_plan");
        long id=workspace.insert("""
                INSERT INTO sales_contracts(quotation_id,contract_number,end_date,signer,scope,milestones,payment_terms,
                    implementation_notes,created_by,last_edited_by,status,legacy_record)
                VALUES (?,?,?,?,?,?,?,?,?,?,'DRAFT',FALSE)
                """,command.quotationId(),nextNumber(),command.endDate(),command.signer().trim(),scope,milestones,text(quote,"terms"),
                clean(command.implementationNotes()),actorId,actorId);
        history(id,"DRAFT_CREATED",actorId,null);
        workspace.event(number(opportunity,"customer_id"),"CONTRACT",id,"DRAFT_CREATED",actorId,"Từ báo giá #"+command.quotationId());
        return id;
    }

    @Transactional
    public void update(long actorId,long id,ContractDraft command) {
        var contract=locked(actorId,id,true);
        version(contract,command.version());
        if (!Set.of("DRAFT","RETURNED").contains(text(contract,"status"))) throw AppException.conflict("Chỉ sửa thông tin bổ sung khi hợp đồng là nháp hoặc được trả về");
        if (number(contract,"quotation_id")!=command.quotationId()) throw AppException.badRequest("Không đổi báo giá nguồn; cần lập hồ sơ từ báo giá mới");
        validateDraft(command);
        requireProcessable(actorId,contract);
        jdbc.update("UPDATE sales_contracts SET signer=?,end_date=?,implementation_notes=?,last_edited_by=?,reviewed_by=NULL,version=version+1 WHERE id=?",
                command.signer().trim(),command.endDate(),clean(command.implementationNotes()),actorId,id);
        history(id,"DRAFT_UPDATED",actorId,null);
        event(contract,id,"DRAFT_UPDATED",actorId,null);
    }

    @Transactional
    public void submitSigned(long actorId,long id,SignedContract command) {
        var contract=locked(actorId,id,true);
        version(contract,command.version());
        if (!Set.of("READY_TO_SIGN","SIGNED_RETURNED").contains(text(contract,"status"))) throw AppException.conflict("Hợp đồng phải được rà soát trước khi nộp bản đã ký");
        var quote=requireProcessable(actorId,contract);
        if (command.signedDate().isAfter(LocalDate.now()) || command.signedDate().isAfter(date(quote,"valid_until"))
                || command.signedDate().isAfter(date(contract,"end_date"))) throw AppException.badRequest("Ngày ký không ở tương lai, phải trong hạn báo giá và không sau ngày kết thúc");
        SalesCommercialService.requireHttps(command.fileUrl());
        long signature=workspace.insert("""
                INSERT INTO sales_contract_signatures(contract_id,signed_date,customer_signer,company_signer,file_url,submitted_by)
                VALUES (?,?,?,?,?,?)
                """,id,command.signedDate(),command.customerSigner().trim(),command.companySigner().trim(),command.fileUrl().trim(),actorId);
        jdbc.update("UPDATE sales_contracts SET status='SIGNED_PENDING_CONFIRMATION',current_signature_id=?,decision_note=NULL,version=version+1 WHERE id=?",signature,id);
        history(id,"SIGNED_COPY_SUBMITTED",actorId,null);
        event(contract,id,"SIGNED_COPY_SUBMITTED",actorId,null);
        notifyReviewers(contract,quote,actorId,"Hợp đồng chờ đối chiếu bản ký");
    }

    @Transactional
    public void transition(long actorId,long id,ContractTransition command) {
        var contract=locked(actorId,id,true);
        version(contract,command.version());
        var quote=requireProcessable(actorId,contract);
        String current=text(contract,"status"), action=command.action(), target;
        var actor=access.actor(actorId);
        if ("REQUEST_QUOTE_REVISION".equals(action)) {
            if (!Set.of("DRAFT","RETURNED","PENDING_REVIEW","READY_TO_SIGN").contains(current) || contract.get("current_signature_id")!=null) {
                throw AppException.conflict("Chỉ quay lại báo giá trước khi nộp bản ký. Hồ sơ có bản ký cần được quản lý xử lý riêng.");
            }
            requireNote(command.note());
            target="CANCELLED";
            jdbc.update("UPDATE sales_quotations SET status='SUPERSEDED',version=version+1 WHERE id=?",number(contract,"quotation_id"));
            event(contract,id,"QUOTATION_REVISION_REQUIRED",actorId,command.note());
            workspace.event(number(quote,"customer_id"),"QUOTATION",number(quote,"id"),"SUPERSEDED",actorId,command.note());
        } else if (Set.of("DRAFT","RETURNED").contains(current) && "SUBMIT".equals(action)) {
            if (date(contract,"end_date").isBefore(LocalDate.now())) throw AppException.badRequest("Ngày kết thúc dự kiến đã qua");
            target="PENDING_REVIEW";
        } else if ("PENDING_REVIEW".equals(current) && Set.of("APPROVE","RETURN").contains(action)) {
            requireIndependentReviewer(actor,contract,quote,false);
            target="APPROVE".equals(action) ? "READY_TO_SIGN" : "RETURNED";
            if (target.equals("RETURNED")) requireNote(command.note());
        } else if ("SIGNED_PENDING_CONFIRMATION".equals(current) && Set.of("CONFIRM","RETURN_SIGNED").contains(action)) {
            var signature=workspace.row("SELECT * FROM sales_contract_signatures WHERE id=?",number(contract,"current_signature_id"));
            contract.put("submitted_by",signature.get("submitted_by"));
            requireIndependentReviewer(actor,contract,quote,true);
            target="CONFIRM".equals(action) ? "CONFIRMED" : "SIGNED_RETURNED";
            if (target.equals("CONFIRMED")) {
                if (!command.matchesApprovedContent() || !command.signerAuthorityConfirmed() || !command.signedCopyVerified()) {
                    throw AppException.badRequest("Cần xác nhận nội dung khớp bản duyệt, thẩm quyền người ký và bản ký đầy đủ");
                }
                jdbc.update("UPDATE sales_contracts SET signed_date=?,file_url=?,signer=?,confirmed_by=?,confirmed_at=NOW(6) WHERE id=?",
                        signature.get("signed_date"),signature.get("file_url"),signature.get("customer_signer"),actorId,id);
                jdbc.update("UPDATE sales_opportunities SET stage='WON',version=version+1 WHERE id=?",number(quote,"opportunity_id"));
                workspace.event(number(quote,"customer_id"),"OPPORTUNITY",number(quote,"opportunity_id"),"WON",actorId,"Hợp đồng đã đối chiếu #"+id);
            } else requireNote(command.note());
        } else throw AppException.conflict("Thao tác không hợp lệ ở trạng thái hợp đồng hiện tại");
        jdbc.update("""
                UPDATE sales_contracts SET status=?,decision_note=?,reviewed_by=CASE WHEN ?='READY_TO_SIGN' THEN ? ELSE reviewed_by END,
                    version=version+1 WHERE id=?
                """,target,clean(command.note()),target,actorId,id);
        history(id,current+"_TO_"+target,actorId,command.note());
        event(contract,id,current+"_TO_"+target,actorId,command.note());
        if ("PENDING_REVIEW".equals(target)) notifyReviewers(contract,quote,actorId,"Hợp đồng chờ rà soát");
        else notifications.createNotification(number(contract,"created_by"),"SALES_CONTRACT","Hợp đồng đã cập nhật",text(contract,"contract_number")+": "+target,"binh_thuong","/sales?tab=contracts");
    }

    private Map<String,Object> locked(long actorId,long id,boolean lock) {
        var initial=workspace.row("SELECT k.*,o.customer_id FROM sales_contracts k JOIN sales_quotations q ON q.id=k.quotation_id JOIN sales_opportunities o ON o.id=q.opportunity_id WHERE k.id=?",id);
        var quote=workspace.row("SELECT * FROM sales_quotations WHERE id=?",number(initial,"quotation_id"));
        workspace.opportunity(actorId,number(quote,"opportunity_id"),lock);
        if (!lock) return initial;
        workspace.row("SELECT * FROM sales_quotations WHERE id=? FOR UPDATE",number(initial,"quotation_id"));
        var result=workspace.row("SELECT * FROM sales_contracts WHERE id=? FOR UPDATE",id);
        result.put("customer_id",initial.get("customer_id"));
        return result;
    }

    private Map<String,Object> requireProcessable(long actorId,Map<String,Object> contract) {
        var quote=workspace.row("SELECT q.*,o.customer_id FROM sales_quotations q JOIN sales_opportunities o ON o.id=q.opportunity_id WHERE q.id=? FOR UPDATE",number(contract,"quotation_id"));
        requireOpen(workspace.opportunity(actorId,number(quote,"opportunity_id"),true));
        workspace.requireActive(number(quote,"customer_id"));
        if (!"ACCEPTED".equals(text(quote,"status"))) throw AppException.conflict("Báo giá nguồn không còn được chấp thuận");
        return quote;
    }

    private static boolean independent(SalesAccess.Actor actor,Map<String,Object> contract,Map<String,Object> quote,boolean signed) {
        if (Objects.equals(contract.get("last_edited_by"),actor.id()) || signed && Objects.equals(contract.get("submitted_by"),actor.id())) return false;
        var authority=new HashMap<>(quote);
        authority.put("created_by",contract.get("created_by"));
        return SalesPricingService.canApprove(actor,authority);
    }
    private static void requireIndependentReviewer(SalesAccess.Actor actor,Map<String,Object> contract,Map<String,Object> quote,boolean signed) {
        if (!independent(actor,contract,quote,signed)) throw AppException.forbidden("Cần người quản lý khác đủ cấp; người lập, người sửa cuối và người nộp bản ký không tự xác nhận hồ sơ của mình");
    }
    private void capabilities(SalesAccess.Actor actor,Map<String,Object> row) {
        String status=text(row,"status");
        row.put("can_edit",Set.of("DRAFT","RETURNED").contains(status));
        row.put("can_review","PENDING_REVIEW".equals(status) && independent(actor,row,row,false));
        row.put("can_confirm","SIGNED_PENDING_CONFIRMATION".equals(status) && independent(actor,row,row,true));
        row.put("can_submit_signed",Set.of("READY_TO_SIGN","SIGNED_RETURNED").contains(status));
        row.put("can_revise_quote",Set.of("DRAFT","RETURNED","PENDING_REVIEW","READY_TO_SIGN").contains(status) && row.get("current_signature_id")==null);
    }
    private String nextNumber() {
        int year=LocalDate.now().getYear();
        jdbc.update("INSERT INTO sales_contract_sequences(period,next_value) VALUES (?,1) ON DUPLICATE KEY UPDATE period=period",year);
        long next=number(workspace.row("SELECT next_value FROM sales_contract_sequences WHERE period=? FOR UPDATE",year),"next_value");
        String candidate;
        do { candidate=String.format(Locale.ROOT,"KD-%d-%06d",year,next++); }
        while (!jdbc.queryForList("SELECT id FROM sales_contracts WHERE contract_number=? FOR UPDATE",candidate).isEmpty());
        jdbc.update("UPDATE sales_contract_sequences SET next_value=? WHERE period=?",next,year);
        return candidate;
    }
    private static void validateDraft(ContractDraft command) {
        if (command.endDate().isBefore(LocalDate.now())) throw AppException.badRequest("Ngày kết thúc dự kiến phải từ hôm nay trở đi");
    }
    private static void requireNote(String note) {
        if (clean(note)==null) throw AppException.badRequest("Cần nhập lý do / nội dung yêu cầu bổ sung");
    }
    private void history(long id,String action,long actorId,String note) {
        var snapshot=new LinkedHashMap<>(workspace.row("SELECT * FROM sales_contracts WHERE id=?",id));
        snapshot.replaceAll((key,value) -> value instanceof java.util.Date || value instanceof java.time.temporal.TemporalAccessor ? value.toString() : value);
        try {
            workspace.insert("INSERT INTO sales_contract_history(contract_id,version,action,note,snapshot,actor_id) VALUES (?,?,?,?,?,?)",
                    id,number(snapshot,"version"),action,clean(note),JSON.writeValueAsString(snapshot),actorId);
        } catch (JsonProcessingException exception) { throw new IllegalStateException(exception); }
    }
    private void event(Map<String,Object> contract,long id,String action,long actorId,String note) {
        workspace.event(number(contract,"customer_id"),"CONTRACT",id,action,actorId,note);
    }
    private void notifyReviewers(Map<String,Object> contract,Map<String,Object> quote,long sender,String title) {
        var customer=workspace.row("SELECT * FROM sales_customers WHERE id=?",number(contract,"customer_id"));
        jdbc.queryForList("SELECT id FROM users WHERE active=b'1' AND (role='CEO' OR (department_id=? AND role IN ('TRUONG_PHONG','GIAM_DOC_PHONG_BAN')))",Long.class,number(customer,"department_id"))
                .stream().filter(id -> id!=sender).filter(id -> independent(access.actor(id),contract,quote,contract.get("current_signature_id")!=null))
                .forEach(id -> notifications.createNotification(id,"SALES_CONTRACT",title,text(contract,"contract_number"),"binh_thuong","/sales?tab=contracts"));
    }
}
