package com.hrm.recruitment.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.hrm.approval.entity.ApprovalDecision;
import com.hrm.exception.ApiResponse;
import com.hrm.recruitment.entity.CandidateOfferAction;
import com.hrm.recruitment.entity.Offer;
import com.hrm.recruitment.entity.HiringSeat;
import com.hrm.recruitment.service.OfferService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class OfferController {

    private final OfferService offerService;

    @PostMapping("/api/recruitment/applications/{applicationId}/offers")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<Offer>> createDraft(
            @PathVariable Long applicationId,
            @RequestBody OfferService.CreateOfferCommand command,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.createDraft(applicationId, user.getUserId(), command),
                "Đã tạo offer draft"));
    }

    @GetMapping("/api/recruitment/applications/{applicationId}/offers")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<List<Offer>>> list(
            @PathVariable Long applicationId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.getApplicationOffers(applicationId, user.getUserId()),
                "Lấy lịch sử offer thành công"));
    }

    @GetMapping("/api/recruitment/applications/{applicationId}/offer-activity")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<List<OfferService.OfferActivityView>>> activity(
            @PathVariable Long applicationId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.getApplicationOfferActivity(applicationId, user.getUserId()),
                "Lấy lịch sử gửi và phản hồi offer thành công"));
    }

    @GetMapping("/api/recruitment/requisitions/{requisitionId}/seats")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<List<HiringSeat>>> seats(
            @PathVariable Long requisitionId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.getRequisitionSeats(requisitionId, user.getUserId()),
                "Lấy seat ledger thành công"));
    }

    @GetMapping("/api/recruitment/seats/{seatId}/events")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<List<OfferService.SeatEventView>>> seatEvents(
            @PathVariable Long seatId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.getSeatTimeline(seatId, user.getUserId()),
                "Lấy lịch sử seat thành công"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/submit")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<Offer>> submit(
            @PathVariable Long offerId,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.submitForApproval(offerId, user.getUserId(), requestId, idempotencyKey),
                "Đã gửi offer để duyệt"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/withdraw-approval")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<Offer>> withdrawApproval(
            @PathVariable Long offerId,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.withdrawApproval(offerId, user.getUserId(), requestId, idempotencyKey),
                "Đã thu hồi yêu cầu duyệt offer"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/decision")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO','ADMIN')")
    public ResponseEntity<ApiResponse<Offer>> decide(
            @PathVariable Long offerId,
            @RequestBody DecisionRequest body,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.decide(offerId, user.getUserId(), body.decision(), body.comment(),
                        requestId, idempotencyKey),
                "Đã ghi nhận quyết định offer"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/send")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<OfferService.DispatchResult>> send(
            @PathVariable Long offerId,
            @RequestBody SendRequest body,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.send(offerId, user.getUserId(), body.responseDeadline(),
                        body.overbookConfirmed(), body.overbookReason(), requestId, idempotencyKey),
                "Đã gửi offer và giữ suất"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/cancel-before-send")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<Offer>> cancelBeforeSend(
            @PathVariable Long offerId,
            @RequestBody RevokeRequest body,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.cancelBeforeSend(offerId, user.getUserId(), body.reason(), requestId, idempotencyKey),
                "Đã hủy offer trước khi gửi"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/extend")
    @PreAuthorize("hasAnyRole('TRUONG_PHONG','GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<OfferService.DispatchResult>> extend(
            @PathVariable Long offerId,
            @RequestBody ExtendRequest body,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.extend(offerId, user.getUserId(), body.responseDeadline(), requestId, idempotencyKey),
                "Đã gia hạn offer bằng dispatch mới"));
    }

    @PostMapping("/api/recruitment/offers/{offerId}/revoke")
    @PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN','CEO')")
    public ResponseEntity<ApiResponse<com.hrm.recruitment.entity.OfferDispatch>> revoke(
            @PathVariable Long offerId,
            @RequestBody RevokeRequest body,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.revoke(offerId, user.getUserId(), body.reason(), requestId, idempotencyKey),
                "Đã thu hồi offer và nhả suất"));
    }

    @GetMapping("/public/offers/{token}")
    public ResponseEntity<ApiResponse<OfferService.PublicOfferView>> publicView(@PathVariable String token) {
        return ResponseEntity.ok(ApiResponse.ok(offerService.viewByToken(token), "Lấy offer thành công"));
    }

    @PostMapping("/public/offers/{token}/respond")
    public ResponseEntity<ApiResponse<OfferService.PublicOfferView>> respond(
            @PathVariable String token,
            @RequestBody CandidateResponse body,
            @RequestHeader(name = "X-Request-ID", required = false) String requestId,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey) {
        return ResponseEntity.ok(ApiResponse.ok(
                offerService.respond(token, body.action(), body.comment(), body.responseDetails(), requestId, idempotencyKey),
                "Đã ghi nhận phản hồi offer"));
    }

    public record DecisionRequest(ApprovalDecision decision, String comment) {}
    public record SendRequest(LocalDateTime responseDeadline, boolean overbookConfirmed, String overbookReason) {}
    public record ExtendRequest(LocalDateTime responseDeadline) {}
    public record RevokeRequest(String reason) {}
    public record CandidateResponse(CandidateOfferAction action, String comment, JsonNode responseDetails) {}
}
