package com.hrm.approval.service;

import com.hrm.approval.entity.ApprovalDecision;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.approval.entity.ApprovalRequest;
import com.hrm.approval.repository.ApprovalRequestRepository;
import com.hrm.approval.repository.ApprovalStepRepository;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApprovalServiceTest {

    private ApprovalRequestRepository requestRepository;
    private ApprovalStepRepository stepRepository;
    private ApprovalService approvalService;

    @BeforeEach
    void setUp() {
        requestRepository = mock(ApprovalRequestRepository.class);
        stepRepository = mock(ApprovalStepRepository.class);
        approvalService = new ApprovalService(requestRepository, stepRepository, mock(ApprovalPolicyResolver.class));
        when(stepRepository.findByDecisionKey(anyString())).thenReturn(Optional.empty());
    }

    @Test
    void rejectsDecisionWhenEntityVersionIsStale() {
        ApprovalRequest request = mock(ApprovalRequest.class);
        when(request.getEntityVersion()).thenReturn(3L);
        when(requestRepository.lockOpenRequest(ApprovalEntityType.JOB_REQUISITION, 9L))
                .thenReturn(Optional.of(request));

        assertThrows(AppException.class, () -> approvalService.decide(
                ApprovalEntityType.JOB_REQUISITION,
                9L,
                4L,
                5L,
                ApprovalDecision.APPROVE,
                null,
                "decision-1"));
    }

    @Test
    void rejectsSelfApprovalEvenWithMatchingVersion() {
        ApprovalRequest request = mock(ApprovalRequest.class);
        when(request.getEntityVersion()).thenReturn(3L);
        when(request.getRequestedBy()).thenReturn(5L);
        when(requestRepository.lockOpenRequest(ApprovalEntityType.JOB_REQUISITION, 9L))
                .thenReturn(Optional.of(request));

        assertThrows(AppException.class, () -> approvalService.decide(
                ApprovalEntityType.JOB_REQUISITION,
                9L,
                3L,
                5L,
                ApprovalDecision.APPROVE,
                null,
                "decision-2"));
    }
}
