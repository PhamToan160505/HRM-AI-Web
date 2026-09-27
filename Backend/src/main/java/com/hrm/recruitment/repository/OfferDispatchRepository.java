package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.OfferDispatch;
import com.hrm.recruitment.entity.OfferDispatchStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OfferDispatchRepository extends JpaRepository<OfferDispatch, Long> {
    Optional<OfferDispatch> findByResponseTokenHash(String responseTokenHash);
    Optional<OfferDispatch> findByDispatchKey(String dispatchKey);
    Optional<OfferDispatch> findFirstByOfferIdAndStatus(Long offerId, OfferDispatchStatus status);
    List<OfferDispatch> findByOfferIdOrderBySentAtDesc(Long offerId);
    List<OfferDispatch> findTop100ByStatusAndResponseDeadlineBeforeOrderByResponseDeadline(
            OfferDispatchStatus status, LocalDateTime deadline);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from OfferDispatch d where d.responseTokenHash = :hash")
    Optional<OfferDispatch> lockByTokenHash(@Param("hash") String hash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from OfferDispatch d where d.offerId = :offerId and d.status = 'ACTIVE'")
    Optional<OfferDispatch> lockActiveByOfferId(@Param("offerId") Long offerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from OfferDispatch d where d.id = :id")
    Optional<OfferDispatch> lockById(@Param("id") Long id);
}
