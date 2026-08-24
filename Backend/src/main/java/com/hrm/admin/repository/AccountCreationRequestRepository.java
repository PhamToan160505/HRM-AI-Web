package com.hrm.admin.repository;

import com.hrm.admin.entity.AccountCreationRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AccountCreationRequestRepository extends JpaRepository<AccountCreationRequest, Long> {
    List<AccountCreationRequest> findByStatus(AccountCreationRequest.RequestStatus status);
}
