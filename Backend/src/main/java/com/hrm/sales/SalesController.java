package com.hrm.sales;

import com.hrm.exception.ApiResponse;
import com.hrm.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import static com.hrm.sales.SalesCommands.*;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesController {
    private final SalesWorkspaceService workspace;
    private final SalesCommercialService commercial;
    private final SalesQuotationPdf pdf;
    private final SalesPricingService pricing;
    private final SalesTechnicalService technical;
    private final SalesContractService contracts;

    @GetMapping("/pricing-policy")
    public ApiResponse<?> policy(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(pricing.policy(user.getUserId())); }
    @GetMapping("/pricing-delegates")
    public ApiResponse<?> delegates(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(pricing.delegates(user.getUserId())); }
    @PostMapping("/pricing-policy")
    public ApiResponse<?> publishPolicy(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody PricingPolicy command) {
        return ApiResponse.ok(pricing.publish(user.getUserId(),command));
    }
    @GetMapping("/technical-reviews")
    public ApiResponse<?> technicalQueue(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(technical.queue(user.getUserId())); }
    @PostMapping("/quotations/{id}/technical-review")
    public ApiResponse<?> technicalReview(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody TechnicalReview command) {
        technical.review(user.getUserId(),id,command); return ApiResponse.ok(null,"Đã ghi nhận thẩm định từ Phòng Công nghệ");
    }

    @GetMapping("/context")
    public ApiResponse<?> context(@AuthenticationPrincipal CustomUserDetails user) {
        return ApiResponse.ok(workspace.context(user.getUserId()));
    }
    @GetMapping("/customers")
    public ApiResponse<?> customers(@AuthenticationPrincipal CustomUserDetails user,@RequestParam(defaultValue="") String search) {
        return ApiResponse.ok(workspace.customers(user.getUserId(),search));
    }
    @GetMapping("/customers/{id}")
    public ApiResponse<?> customer(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id) {
        return ApiResponse.ok(workspace.customerDetail(user.getUserId(),id));
    }
    @PostMapping("/customers")
    public ApiResponse<?> createCustomer(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody Customer command) {
        return ApiResponse.ok(workspace.saveCustomer(user.getUserId(),null,command));
    }
    @PutMapping("/customers/{id}")
    public ApiResponse<?> updateCustomer(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Customer command) {
        return ApiResponse.ok(workspace.saveCustomer(user.getUserId(),id,command));
    }
    @PostMapping("/customers/{id}/contacts")
    public ApiResponse<?> addContact(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Contact command) {
        return ApiResponse.ok(workspace.addContact(user.getUserId(),id,command));
    }
    @PutMapping("/customers/{id}/contacts/{contactId}")
    public ApiResponse<?> updateContact(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@PathVariable long contactId,@Valid @RequestBody Contact command) {
        workspace.updateContact(user.getUserId(),id,contactId,command);
        return ApiResponse.ok(null,"Đã cập nhật người liên hệ");
    }
    @GetMapping("/opportunities")
    public ApiResponse<?> opportunities(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(workspace.opportunities(user.getUserId())); }
    @PostMapping("/opportunities")
    public ApiResponse<?> createOpportunity(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody Opportunity command) {
        return ApiResponse.ok(workspace.saveOpportunity(user.getUserId(),null,command));
    }
    @PutMapping("/opportunities/{id}")
    public ApiResponse<?> updateOpportunity(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Opportunity command) {
        return ApiResponse.ok(workspace.saveOpportunity(user.getUserId(),id,command));
    }
    @PostMapping("/opportunities/{id}/transition")
    public ApiResponse<?> transitionOpportunity(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Transition command) {
        workspace.changeOpportunity(user.getUserId(),id,command);
        return ApiResponse.ok(null,"Đã chuyển giai đoạn");
    }
    @GetMapping("/activities")
    public ApiResponse<?> activities(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(workspace.activities(user.getUserId())); }
    @PostMapping("/activities")
    public ApiResponse<?> activity(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody Activity command) {
        return ApiResponse.ok(workspace.addActivity(user.getUserId(),command));
    }
    @PostMapping("/activities/{id}/complete")
    public ApiResponse<?> complete(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id) {
        workspace.completeActivity(user.getUserId(),id); return ApiResponse.ok(null,"Đã hoàn tất công việc");
    }
    @GetMapping("/products")
    public ApiResponse<?> products(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(workspace.products(user.getUserId())); }
    @PostMapping("/products")
    public ApiResponse<?> product(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody Product command) {
        return ApiResponse.ok(workspace.saveProduct(user.getUserId(),null,command));
    }
    @PutMapping("/products/{id}")
    public ApiResponse<?> updateProduct(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Product command) {
        return ApiResponse.ok(workspace.saveProduct(user.getUserId(),id,command));
    }
    @GetMapping("/quotations")
    public ApiResponse<?> quotations(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(commercial.quotations(user.getUserId())); }
    @GetMapping("/quotations/{id}")
    public ApiResponse<?> quotation(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id) { return ApiResponse.ok(commercial.quotationDetail(user.getUserId(),id)); }
    @PostMapping("/quotations")
    public ApiResponse<?> createQuotation(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody Quotation command) {
        return ApiResponse.ok(commercial.createQuotation(user.getUserId(),command));
    }
    @PostMapping("/quotations/{id}/transition")
    public ApiResponse<?> transitionQuotation(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Transition command) {
        commercial.transitionQuotation(user.getUserId(),id,command); return ApiResponse.ok(null,"Đã cập nhật báo giá");
    }
    @GetMapping("/quotations/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id) throws java.io.IOException {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=quotation-"+id+".pdf")
                .body(pdf.generate(user.getUserId(),id));
    }
    @GetMapping("/contracts")
    public ApiResponse<?> contracts(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(contracts.list(user.getUserId())); }
    @GetMapping("/contracts/{id}")
    public ApiResponse<?> contractDetail(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id) {
        return ApiResponse.ok(contracts.detail(user.getUserId(),id));
    }
    @PostMapping("/contracts")
    public ApiResponse<?> contract(@AuthenticationPrincipal CustomUserDetails user,@Valid @RequestBody ContractDraft command) {
        return ApiResponse.ok(contracts.create(user.getUserId(),command));
    }
    @PutMapping("/contracts/{id}")
    public ApiResponse<?> updateContract(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody ContractDraft command) {
        contracts.update(user.getUserId(),id,command); return ApiResponse.ok(null,"Đã cập nhật nháp hợp đồng");
    }
    @PostMapping("/contracts/{id}/signed-copy")
    public ApiResponse<?> signedContract(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody SignedContract command) {
        contracts.submitSigned(user.getUserId(),id,command); return ApiResponse.ok(null,"Đã nộp bản ký, chờ đối chiếu");
    }
    @PostMapping("/contracts/{id}/transition")
    public ApiResponse<?> transitionContract(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody ContractTransition command) {
        contracts.transition(user.getUserId(),id,command); return ApiResponse.ok(null,"Đã cập nhật trạng thái hợp đồng");
    }
    @GetMapping("/handovers")
    public ApiResponse<?> handovers(@AuthenticationPrincipal CustomUserDetails user) { return ApiResponse.ok(commercial.handovers(user.getUserId())); }
    @PostMapping("/contracts/{id}/handovers")
    public ApiResponse<?> handover(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Handover command) {
        return ApiResponse.ok(commercial.sendHandover(user.getUserId(),id,command));
    }
    @PostMapping("/handovers/{id}/transition")
    public ApiResponse<?> respond(@AuthenticationPrincipal CustomUserDetails user,@PathVariable long id,@Valid @RequestBody Transition command) {
        commercial.respondHandover(user.getUserId(),id,command); return ApiResponse.ok(null,"Đã cập nhật bàn giao");
    }
}
