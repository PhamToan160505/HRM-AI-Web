package com.hrm.recruitment.repository;

import com.hrm.recruitment.entity.SeatEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeatEventRepository extends JpaRepository<SeatEvent, Long> {
    List<SeatEvent> findBySeatIdOrderByOccurredAtAscIdAsc(Long seatId);
    boolean existsByIdempotencyKey(String idempotencyKey);
}
