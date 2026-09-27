package com.hrm.admin.repository;

import com.hrm.admin.entity.AccountCreationRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AccountCreationRequestRepository extends JpaRepository<AccountCreationRequest, Long> {
    List<AccountCreationRequest> findByStatus(AccountCreationRequest.RequestStatus status);
    Optional<AccountCreationRequest> findByEmployeeId(Long employeeId);
}
