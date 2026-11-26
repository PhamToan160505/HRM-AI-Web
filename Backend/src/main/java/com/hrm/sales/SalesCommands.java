package com.hrm.sales;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class SalesCommands {
    private SalesCommands() {}

    public record Customer(@NotBlank @Size(max=200) String name,
            @Size(max=30) String taxCode, @Email @Size(max=150) String email,
            @Size(max=30) String phone, @Size(max=500) String address,
            @Size(max=150) String source, @Size(max=10000) String notes,
            @NotNull Long ownerId, @NotNull Boolean active, @NotNull Long version) {}

    public record Contact(@NotBlank @Size(max=150) String name,
            @Size(max=150) String jobTitle, @Email @Size(max=150) String email,
            @Size(max=30) String phone) {}

    public record Opportunity(@NotNull Long customerId, @NotBlank @Size(max=200) String title,
            @NotBlank @Size(max=10000) String requirements,
            @NotNull @DecimalMin("0") @Digits(integer=15, fraction=2) BigDecimal expectedValue,
            @NotNull LocalDate expectedClose, @NotNull Long version) {}

    public record Transition(@NotBlank String action, @Size(max=1000) String note, @NotNull Long version) {}

    public record Activity(@NotNull Long customerId, Long opportunityId,
            @NotBlank @Size(max=200) String subject, @Size(max=10000) String notes,
            @NotNull LocalDateTime dueAt) {}

    public record Product(@NotBlank @Size(max=200) String name, @NotBlank @Size(max=50) String unit,
            @NotNull @DecimalMin("0") @Digits(integer=15, fraction=2) BigDecimal unitPrice,
            @NotNull Boolean active, @NotNull Long version,
            @NotNull @DecimalMin("0") @Digits(integer=15, fraction=2) BigDecimal floorPrice,
            boolean standardPackage, @NotBlank @Size(max=500) String standardScope) {
        public Product(String name,String unit,BigDecimal price,Boolean active,Long version) {
            this(name,unit,price,active,version,price,false,name);
        }
    }

    public record QuoteLine(@NotNull Long productId, @NotBlank @Size(max=500) String description,
            @NotNull @DecimalMin("0.01") @Digits(integer=8, fraction=2) BigDecimal quantity,
            @NotNull @DecimalMin("0") @Digits(integer=15, fraction=2) BigDecimal unitPrice) {}

    public record Quotation(@NotNull Long opportunityId, @NotNull LocalDate validUntil,
            @NotNull @DecimalMin("0") @Digits(integer=15, fraction=2) BigDecimal discountAmount,
            @NotBlank @Size(max=10000) String terms,
            @NotEmpty @Size(max=100) List<@Valid QuoteLine> lines,
            boolean customScope, boolean newTechnology, boolean resourceException,
            boolean exclusiveRights, boolean strategicException,
            @Size(max=2000) String exceptionNote, Long technicalDepartmentId) {
        public Quotation(Long opportunityId,LocalDate validUntil,BigDecimal discount,String terms,List<QuoteLine> lines) {
            this(opportunityId,validUntil,discount,terms,lines,false,false,false,false,false,null,null);
        }
    }

    public record PricingPolicy(@NotNull Long version, boolean enabled,
            @NotNull @DecimalMin("0") @Digits(integer=15,fraction=2) BigDecimal standardMax,
            @NotNull @DecimalMin("0") @Digits(integer=15,fraction=2) BigDecimal managerMax,
            @NotNull @DecimalMin("0") @Digits(integer=15,fraction=2) BigDecimal directorMax,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) BigDecimal managerDiscount,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) BigDecimal directorDiscount,
            @Size(max=10000) String standardTerms, Long ceoDelegateId,
            @NotBlank @Size(max=1000) String changeReason) {}

    public record TechnicalReview(@NotNull Long version, boolean approved,
            @NotNull @DecimalMin("0.01") @Digits(integer=8,fraction=2) BigDecimal effortDays,
            @NotBlank @Size(max=1000) String feasibility,
            @NotBlank @Size(max=2000) String deliveryPlan,
            @NotBlank @Size(max=2000) String resourceNeeds, boolean requiresExecutive) {}

    public record ContractDraft(@NotNull Long quotationId, @NotNull LocalDate endDate,
            @NotBlank @Size(max=150) String signer, @Size(max=5000) String implementationNotes,
            @NotNull Long version) {}

    public record SignedContract(@NotNull Long version, @NotNull LocalDate signedDate,
            @NotBlank @Size(max=150) String customerSigner, @NotBlank @Size(max=150) String companySigner,
            @NotBlank @Size(max=1000) String fileUrl) {}

    public record ContractTransition(@NotBlank String action, @NotNull Long version,
            @Size(max=1000) String note, boolean matchesApprovedContent,
            boolean signerAuthorityConfirmed, boolean signedCopyVerified) {}

    public record Handover(@NotNull Long recipientDepartmentId) {}
}
