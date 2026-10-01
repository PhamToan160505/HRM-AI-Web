package com.hrm.recruitment.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "offers")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Offer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_id", nullable = false)
    private Long applicationId;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "previous_offer_id")
    private Long previousOfferId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private OfferStatus status;

    @Column(name = "base_salary", nullable = false, precision = 19, scale = 2)
    private BigDecimal baseSalary;

    @Column(name = "allowances_json", nullable = false, columnDefinition = "JSON")
    private String allowancesJson;

    @Column(name = "probation_months", nullable = false)
    private Integer probationMonths;

    @Column(name = "probation_salary_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal probationSalaryRate;

    @Column(name = "expected_start_date", nullable = false)
    private LocalDate expectedStartDate;

    @Column(name = "contract_terms", nullable = false, columnDefinition = "TEXT")
    private String contractTerms;

    /**
     * Snapshot có cấu trúc của offer tại thời điểm tạo version. Các trường
     * cốt lõi (lương, thử việc, ngày bắt đầu) vẫn được giữ ở cột riêng
     * để không làm thay đổi luồng cũ.
     */
    @Column(name = "offer_details_json", columnDefinition = "JSON")
    private String offerDetailsJson;

    @Column(name = "file_url", length = 500)
    private String fileUrl;

    @Column(name = "salary_out_of_range", nullable = false)
    private boolean salaryOutOfRange;

    @Column(name = "out_of_range_reason", length = 1000)
    private String outOfRangeReason;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static Offer draft(Long applicationId, int versionNumber, Long previousOfferId,
                              BigDecimal baseSalary, String allowancesJson, int probationMonths,
                              BigDecimal probationSalaryRate, LocalDate expectedStartDate,
                              String contractTerms, String offerDetailsJson, String fileUrl, boolean salaryOutOfRange,
                              String outOfRangeReason, Long createdBy) {
        Offer offer = new Offer();
        offer.applicationId = applicationId;
        offer.versionNumber = versionNumber;
        offer.previousOfferId = previousOfferId;
        offer.status = OfferStatus.DRAFT;
        offer.baseSalary = baseSalary;
        offer.allowancesJson = allowancesJson;
        offer.probationMonths = probationMonths;
        offer.probationSalaryRate = probationSalaryRate;
        offer.expectedStartDate = expectedStartDate;
        offer.contractTerms = contractTerms;
        offer.offerDetailsJson = offerDetailsJson;
        offer.fileUrl = fileUrl;
        offer.salaryOutOfRange = salaryOutOfRange;
        offer.outOfRangeReason = outOfRangeReason;
        offer.createdBy = createdBy;
        return offer;
    }

    public void submit() { require(OfferStatus.DRAFT); status = OfferStatus.PENDING_APPROVAL; }
    public void approve() { require(OfferStatus.PENDING_APPROVAL); status = OfferStatus.APPROVED; }
    public void supersede() {
        if (status != OfferStatus.PENDING_APPROVAL && status != OfferStatus.APPROVED) {
            throw new IllegalStateException("Offer không thể chuyển SUPERSEDED từ " + status);
        }
        status = OfferStatus.SUPERSEDED;
    }
    public void cancel() {
        if (status != OfferStatus.DRAFT && status != OfferStatus.PENDING_APPROVAL
                && status != OfferStatus.APPROVED) {
            throw new IllegalStateException("Offer không thể hủy từ " + status);
        }
        status = OfferStatus.CANCELLED;
    }
    public void accept() { require(OfferStatus.APPROVED); status = OfferStatus.ACCEPTED; }

    private void require(OfferStatus expected) {
        if (status != expected) {
            throw new IllegalStateException("Offer phải ở trạng thái " + expected + ", hiện tại: " + status);
        }
    }
}
