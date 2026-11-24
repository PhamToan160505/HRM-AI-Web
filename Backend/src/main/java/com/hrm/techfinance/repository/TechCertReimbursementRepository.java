package com.hrm.techfinance.repository;

import com.hrm.techfinance.entity.TechCertReimbursement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface TechCertReimbursementRepository extends JpaRepository<TechCertReimbursement, Long> {
    List<TechCertReimbursement> findAllByOrderByCreatedAtDesc();
    List<TechCertReimbursement> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);
    List<TechCertReimbursement> findByDepartmentIdOrderByCreatedAtDesc(Long departmentId);
    List<TechCertReimbursement> findByStatusInOrderByCreatedAtDesc(Collection<String> statuses);
    boolean existsByCertificateIdAndStatusIn(Long certificateId, Collection<String> statuses);
    List<TechCertReimbursement> findByPayoutMethodAndPayoutPayrollMonthAndStatusIn(
            String payoutMethod, String payoutPayrollMonth, Collection<String> statuses);
}
