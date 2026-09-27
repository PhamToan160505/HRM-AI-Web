package com.hrm.recruitment.service;

import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RecruitmentStateMachineTest {

    private RecruitmentStateMachine stateMachine;

    @BeforeEach
    void setUp() {
        stateMachine = new RecruitmentStateMachine();
    }

    @Test
    void applicationHappyPathMatchesSpecification() {
        ApplicationStatus status = ApplicationStatus.PENDING_HR_CV_REVIEW;
        status = stateMachine.next(status, RecruitmentAction.APPROVE_HR_CV);
        status = stateMachine.next(status, RecruitmentAction.APPROVE_TECH_CV);
        status = stateMachine.next(status, RecruitmentAction.PASS_INTERVIEW_1);
        status = stateMachine.next(status, RecruitmentAction.PASS_INTERVIEW_2);
        status = stateMachine.next(status, RecruitmentAction.SUBMIT_OFFER);
        status = stateMachine.next(status, RecruitmentAction.APPROVE_OFFER);
        status = stateMachine.next(status, RecruitmentAction.SEND_OFFER);
        status = stateMachine.next(status, RecruitmentAction.ACCEPT_OFFER);

        assertEquals(ApplicationStatus.OFFER_ACCEPTED, status);
    }

    @Test
    void applicationRejectsSkippedApprovalStep() {
        assertThrows(AppException.class, () -> stateMachine.next(
                ApplicationStatus.PENDING_HR_CV_REVIEW,
                RecruitmentAction.PASS_INTERVIEW_1));
    }

    @Test
    void internallyApprovedOfferIsNotCandidateAcceptance() {
        assertEquals(
                ApplicationStatus.OFFER_INTERNALLY_APPROVED,
                stateMachine.next(ApplicationStatus.PENDING_OFFER_APPROVAL, RecruitmentAction.APPROVE_OFFER));
    }

    @Test
    void offerSentCannotUseGenericRejection() {
        assertThrows(AppException.class, () -> stateMachine.next(
                ApplicationStatus.OFFER_SENT,
                RecruitmentAction.REJECT_APPLICATION));
    }

    @Test
    void requisitionSupportsReturnAndResubmission() {
        JobRequisitionStatus status = stateMachine.next(
                JobRequisitionStatus.PENDING_APPROVAL,
                RecruitmentAction.RETURN_REQUISITION);
        assertEquals(JobRequisitionStatus.REVISION_REQUIRED, status);
        assertEquals(
                JobRequisitionStatus.PENDING_APPROVAL,
                stateMachine.next(status, RecruitmentAction.SUBMIT_REQUISITION));
    }

    @Test
    void postingSupportsPauseAndResumeButNotArbitraryJump() {
        assertEquals(
                JobPostingStatus.PAUSED,
                stateMachine.next(JobPostingStatus.OPEN, RecruitmentAction.PAUSE_POSTING));
        assertEquals(
                JobPostingStatus.OPEN,
                stateMachine.next(JobPostingStatus.PAUSED, RecruitmentAction.RESUME_POSTING));
        assertThrows(AppException.class, () -> stateMachine.next(
                JobPostingStatus.DRAFT,
                RecruitmentAction.FILL_POSTING));
    }
}
