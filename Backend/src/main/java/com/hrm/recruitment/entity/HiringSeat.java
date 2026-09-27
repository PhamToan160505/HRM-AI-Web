package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "hiring_seats")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class HiringSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requisition_id", nullable = false)
    private Long requisitionId;

    @Column(name = "seat_number", nullable = false)
    private Integer seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HiringSeatKind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private HiringSeatStatus status;

    @Column(name = "application_id")
    private Long applicationId;

    @Column(name = "offer_id")
    private Long offerId;

    @Column(name = "overbook_confirmed_by")
    private Long overbookConfirmedBy;

    @Column(name = "overbook_confirmed_at")
    private LocalDateTime overbookConfirmedAt;

    @Column(name = "overbook_reason", length = 1000)
    private String overbookReason;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static HiringSeat standard(Long requisitionId, int seatNumber) {
        HiringSeat seat = new HiringSeat();
        seat.requisitionId = requisitionId;
        seat.seatNumber = seatNumber;
        seat.kind = HiringSeatKind.STANDARD;
        seat.status = HiringSeatStatus.AVAILABLE;
        return seat;
    }

    public static HiringSeat overbook(Long requisitionId, int seatNumber, Long actorId, String reason) {
        HiringSeat seat = new HiringSeat();
        seat.requisitionId = requisitionId;
        seat.seatNumber = seatNumber;
        seat.kind = HiringSeatKind.OVERBOOK;
        seat.status = HiringSeatStatus.AVAILABLE;
        seat.overbookConfirmedBy = actorId;
        seat.overbookConfirmedAt = LocalDateTime.now();
        seat.overbookReason = reason;
        return seat;
    }

    public void reserve(Long applicationId, Long offerId) {
        if (status != HiringSeatStatus.AVAILABLE) {
            throw new IllegalStateException("Seat không còn AVAILABLE");
        }
        this.status = HiringSeatStatus.RESERVED;
        this.applicationId = applicationId;
        this.offerId = offerId;
    }

    public void transferReservation(Long applicationId, Long newOfferId) {
        if (status != HiringSeatStatus.RESERVED || !applicationId.equals(this.applicationId)) {
            throw new IllegalStateException("Seat không được giữ cho hồ sơ này");
        }
        this.offerId = newOfferId;
    }

    public void accept(Long applicationId, Long offerId) {
        if (status != HiringSeatStatus.RESERVED
                || !applicationId.equals(this.applicationId)
                || !offerId.equals(this.offerId)) {
            throw new IllegalStateException("Seat không được giữ cho offer này");
        }
        status = HiringSeatStatus.ACCEPTED;
    }

    public void join(Long applicationId) {
        if (status != HiringSeatStatus.ACCEPTED || !applicationId.equals(this.applicationId)) {
            throw new IllegalStateException("Seat không ở trạng thái ACCEPTED của hồ sơ này");
        }
        status = HiringSeatStatus.JOINED;
    }

    public void release() {
        if (status != HiringSeatStatus.RESERVED && status != HiringSeatStatus.ACCEPTED) {
            throw new IllegalStateException("Seat không thể nhả từ trạng thái " + status);
        }
        if (kind == HiringSeatKind.OVERBOOK) {
            status = HiringSeatStatus.CLOSED;
        } else {
            status = HiringSeatStatus.AVAILABLE;
            applicationId = null;
            offerId = null;
        }
    }
}
