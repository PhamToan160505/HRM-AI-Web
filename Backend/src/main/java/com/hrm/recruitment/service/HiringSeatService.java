package com.hrm.recruitment.service;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.*;
import com.hrm.recruitment.repository.HiringSeatRepository;
import com.hrm.recruitment.repository.SeatEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class HiringSeatService {

    private final HiringSeatRepository seatRepository;
    private final SeatEventRepository eventRepository;
    private final ConfigurationService configurationService;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final JdbcTemplate jdbcTemplate;

    @Transactional
    public void initializeStandardSeats(JobRequisition requisition, Long actorId, String idempotencyKey) {
        List<HiringSeat> existing = seatRepository.findByRequisitionIdOrderBySeatNumber(requisition.getId());
        long standardCount = existing.stream().filter(seat -> seat.getKind() == HiringSeatKind.STANDARD).count();
        if (standardCount > requisition.getSoLuong()) {
            throw AppException.conflict("Số seat STANDARD đã lớn hơn headcount của requisition");
        }
        for (int seatNumber = (int) standardCount + 1; seatNumber <= requisition.getSoLuong(); seatNumber++) {
            HiringSeat seat = seatRepository.saveAndFlush(HiringSeat.standard(requisition.getId(), seatNumber));
            appendEvent(seat, "CREATED", null, actorId, "Sinh seat khi requisition được duyệt",
                    eventKey(idempotencyKey, "seat-created-" + seatNumber));
        }
    }

    @Transactional
    public HiringSeat reserve(Long requisitionId, Long applicationId, Long offerId,
                              Long actorId, boolean overbookConfirmed, String overbookReason,
                              String idempotencyKey) {
        // Serialize allocation and the configurable overbook-count check per requisition.
        jdbcTemplate.queryForObject(
                "SELECT id FROM job_requisitions WHERE id = ? FOR UPDATE", Long.class, requisitionId);
        HiringSeat existingReservation = seatRepository.lockReservedByApplication(applicationId).orElse(null);
        if (existingReservation != null) {
            HiringSeatStatus from = existingReservation.getStatus();
            existingReservation.transferReservation(applicationId, offerId);
            HiringSeat saved = seatRepository.save(existingReservation);
            appendEvent(saved, "RESERVATION_TRANSFERRED", from, actorId,
                    "Chuyển seat sang offer version mới", eventKey(idempotencyKey, "transfer"));
            return saved;
        }

        HiringSeat seat = seatRepository.lockFirstAvailableStandard(requisitionId).orElse(null);
        if (seat == null) {
            if (!overbookConfirmed) {
                throw AppException.conflict("Không còn suất tuyển khả dụng");
            }
            requireHrHead(actorId);
            String reason = trim(overbookReason);
            if (reason == null) {
                throw AppException.badRequest("Phải nhập lý do khi xác nhận offer dự phòng");
            }
            int maxOverbook = configurationService.requireInteger("seat.max_overbook_per_requisition");
            long activeOverbook = seatRepository.countByRequisitionIdAndKindAndStatusIn(
                    requisitionId, HiringSeatKind.OVERBOOK,
                    List.of(HiringSeatStatus.RESERVED, HiringSeatStatus.ACCEPTED, HiringSeatStatus.JOINED));
            if (activeOverbook >= maxOverbook) {
                throw AppException.conflict("Đã đạt giới hạn offer dự phòng của requisition");
            }
            int nextNumber = seatRepository.findByRequisitionIdOrderBySeatNumber(requisitionId).stream()
                    .mapToInt(HiringSeat::getSeatNumber).max().orElse(0) + 1;
            seat = seatRepository.saveAndFlush(
                    HiringSeat.overbook(requisitionId, nextNumber, actorId, reason));
            appendEvent(seat, "OVERBOOK_CREATED", null, actorId, reason,
                    eventKey(idempotencyKey, "overbook-created"));
        }

        HiringSeatStatus from = seat.getStatus();
        seat.reserve(applicationId, offerId);
        HiringSeat saved = seatRepository.save(seat);
        appendEvent(saved, "RESERVED", from, actorId,
                seat.getKind() == HiringSeatKind.OVERBOOK ? seat.getOverbookReason() : "Gửi offer",
                eventKey(idempotencyKey, "reserved"));
        return saved;
    }

    @Transactional
    public HiringSeat accept(Long seatId, Long applicationId, Long offerId, String idempotencyKey) {
        HiringSeat seat = seatRepository.lockById(seatId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy seat của offer"));
        HiringSeatStatus from = seat.getStatus();
        seat.accept(applicationId, offerId);
        HiringSeat saved = seatRepository.save(seat);
        appendEvent(saved, "ACCEPTED", from, null, "Ứng viên chấp nhận offer",
                eventKey(idempotencyKey, "accepted"));
        return saved;
    }

    @Transactional
    public HiringSeat release(Long seatId, Long actorId, String reason, String idempotencyKey) {
        HiringSeat seat = seatRepository.lockById(seatId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy seat của offer"));
        if (seat.getStatus() == HiringSeatStatus.AVAILABLE || seat.getStatus() == HiringSeatStatus.CLOSED) {
            return seat;
        }
        HiringSeatStatus from = seat.getStatus();
        Long applicationId = seat.getApplicationId();
        Long offerId = seat.getOfferId();
        seat.release();
        HiringSeat saved = seatRepository.save(seat);
        String key = eventKey(idempotencyKey, "released");
        if (!eventRepository.existsByIdempotencyKey(key)) {
            eventRepository.save(SeatEvent.of(saved, "RELEASED", from, applicationId, offerId,
                    actorId, reason, key));
        }
        return saved;
    }

    @Transactional
    public HiringSeat join(Long seatId, Long applicationId, String idempotencyKey) {
        HiringSeat seat = seatRepository.lockById(seatId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy seat của nhân viên"));
        if (seat.getStatus() == HiringSeatStatus.JOINED) return seat;
        HiringSeatStatus from = seat.getStatus();
        seat.join(applicationId);
        HiringSeat saved = seatRepository.save(seat);
        appendEvent(saved, "JOINED", from, null, "Nhân viên đã nhận việc",
                eventKey(idempotencyKey, "joined"));
        return saved;
    }

    private void appendEvent(HiringSeat seat, String type, HiringSeatStatus from,
                             Long actorId, String reason, String key) {
        if (!eventRepository.existsByIdempotencyKey(key)) {
            eventRepository.save(SeatEvent.of(seat, type, from, actorId, reason, key));
        }
    }

    private void requireHrHead(Long actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người xác nhận overbook"));
        if (actor.getRole() == Role.CEO) {
            return;
        }
        boolean isHrDirector = actor.getRole() == Role.GIAM_DOC_PHONG_BAN
                && actor.getDepartmentId() != null
                && departmentRepository.findById(actor.getDepartmentId())
                .map(department -> "Nhân sự".equalsIgnoreCase(department.getTenPhong().trim()))
                .orElse(false);
        if (!isHrDirector) {
            throw AppException.forbidden("Chỉ HR Head hoặc CEO được xác nhận offer dự phòng");
        }
    }

    private String eventKey(String supplied, String suffix) {
        String base = trim(supplied);
        String value = (base == null ? UUID.randomUUID().toString() : base) + ":" + suffix;
        return value.length() <= 140 ? value
                : UUID.nameUUIDFromBytes(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)) + ":" + suffix;
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
