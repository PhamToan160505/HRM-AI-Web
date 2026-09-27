package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.Offer;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OfferRepository extends JpaRepository<Offer, Long> {
    List<Offer> findByApplicationIdOrderByVersionNumberDesc(Long applicationId);
    Optional<Offer> findFirstByApplicationIdOrderByVersionNumberDesc(Long applicationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Offer o where o.id = :id")
    Optional<Offer> lockById(@Param("id") Long id);
}
