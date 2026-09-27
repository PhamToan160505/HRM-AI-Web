package com.hrm.recruitment.service;

import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class RecruitmentStateMachine {

    private static final Map<ApplicationStatus, Map<RecruitmentAction, ApplicationStatus>> APPLICATION_RULES = Map.ofEntries(
            Map.entry(ApplicationStatus.PENDING_HR_CV_REVIEW, Map.of(
                    RecruitmentAction.APPROVE_HR_CV, ApplicationStatus.PENDING_TECH_CV_REVIEW,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.PENDING_TECH_CV_REVIEW, Map.of(
                    RecruitmentAction.APPROVE_TECH_CV, ApplicationStatus.PENDING_INTERVIEW_1,
                    RecruitmentAction.RETURN_TO_HR, ApplicationStatus.PENDING_HR_CV_REVIEW,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.PENDING_INTERVIEW_1, Map.of(
                    RecruitmentAction.PASS_INTERVIEW_1, ApplicationStatus.PENDING_INTERVIEW_2,
                    RecruitmentAction.RETURN_TO_HR, ApplicationStatus.PENDING_HR_CV_REVIEW,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.PENDING_INTERVIEW_2, Map.of(
                    RecruitmentAction.PASS_INTERVIEW_2, ApplicationStatus.PENDING_HR_OFFER,
                    RecruitmentAction.RETURN_TO_INTERVIEW_1, ApplicationStatus.PENDING_INTERVIEW_1,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.PENDING_HR_OFFER, Map.of(
                    RecruitmentAction.SUBMIT_OFFER, ApplicationStatus.PENDING_OFFER_APPROVAL,
                    RecruitmentAction.RETURN_TO_INTERVIEW_2, ApplicationStatus.PENDING_INTERVIEW_2,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.PENDING_OFFER_APPROVAL, Map.of(
                    RecruitmentAction.APPROVE_OFFER, ApplicationStatus.OFFER_INTERNALLY_APPROVED,
                    RecruitmentAction.RETURN_OFFER, ApplicationStatus.PENDING_HR_OFFER,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.OFFER_INTERNALLY_APPROVED, Map.of(
                    RecruitmentAction.SEND_OFFER, ApplicationStatus.OFFER_SENT,
                    RecruitmentAction.RETURN_OFFER, ApplicationStatus.PENDING_HR_OFFER,
                    RecruitmentAction.REJECT_APPLICATION, ApplicationStatus.REJECTED,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.OFFER_SENT, Map.of(
                    RecruitmentAction.ACCEPT_OFFER, ApplicationStatus.OFFER_ACCEPTED,
                    RecruitmentAction.DECLINE_OFFER, ApplicationStatus.OFFER_DECLINED,
                    RecruitmentAction.NEGOTIATE_OFFER, ApplicationStatus.PENDING_HR_OFFER,
                    RecruitmentAction.EXPIRE_OFFER, ApplicationStatus.OFFER_EXPIRED,
                    RecruitmentAction.REVOKE_OFFER, ApplicationStatus.OFFER_REVOKED,
                    RecruitmentAction.WITHDRAW_APPLICATION, ApplicationStatus.WITHDRAWN)),
            Map.entry(ApplicationStatus.REJECTED, Map.of(
                    RecruitmentAction.REOPEN_APPLICATION, ApplicationStatus.PENDING_HR_CV_REVIEW)),
            Map.entry(ApplicationStatus.TALENT_POOL, Map.of(
                    RecruitmentAction.ACTIVATE_FROM_TALENT_POOL, ApplicationStatus.PENDING_HR_CV_REVIEW)),
            Map.entry(ApplicationStatus.OFFER_DECLINED, Map.of(
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL)),
            Map.entry(ApplicationStatus.OFFER_EXPIRED, Map.of(
                    RecruitmentAction.RESEND_OFFER, ApplicationStatus.OFFER_SENT,
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL)),
            Map.entry(ApplicationStatus.OFFER_REVOKED, Map.of(
                    RecruitmentAction.MOVE_TO_TALENT_POOL, ApplicationStatus.TALENT_POOL))
    );

    private static final Map<JobRequisitionStatus, Map<RecruitmentAction, JobRequisitionStatus>> REQUISITION_RULES = Map.ofEntries(
            Map.entry(JobRequisitionStatus.DRAFT, Map.of(
                    RecruitmentAction.SUBMIT_REQUISITION, JobRequisitionStatus.PENDING_APPROVAL,
                    RecruitmentAction.CANCEL_REQUISITION, JobRequisitionStatus.CANCELLED)),
            Map.entry(JobRequisitionStatus.PENDING_APPROVAL, Map.of(
                    RecruitmentAction.APPROVE_REQUISITION, JobRequisitionStatus.APPROVED,
                    RecruitmentAction.RETURN_REQUISITION, JobRequisitionStatus.REVISION_REQUIRED,
                    RecruitmentAction.REJECT_REQUISITION, JobRequisitionStatus.REJECTED,
                    RecruitmentAction.WITHDRAW_REQUISITION, JobRequisitionStatus.DRAFT)),
            Map.entry(JobRequisitionStatus.REVISION_REQUIRED, Map.of(
                    RecruitmentAction.SUBMIT_REQUISITION, JobRequisitionStatus.PENDING_APPROVAL,
                    RecruitmentAction.CANCEL_REQUISITION, JobRequisitionStatus.CANCELLED)),
            Map.entry(JobRequisitionStatus.APPROVED, Map.of(
                    RecruitmentAction.FULFILL_REQUISITION, JobRequisitionStatus.FULFILLED,
                    RecruitmentAction.CANCEL_REQUISITION, JobRequisitionStatus.CANCELLED)),
            Map.entry(JobRequisitionStatus.FULFILLED, Map.of(
                    RecruitmentAction.REOPEN_REQUISITION, JobRequisitionStatus.APPROVED))
    );

    private static final Map<JobPostingStatus, Map<RecruitmentAction, JobPostingStatus>> POSTING_RULES = Map.ofEntries(
            Map.entry(JobPostingStatus.DRAFT, Map.of(
                    RecruitmentAction.OPEN_POSTING, JobPostingStatus.OPEN)),
            Map.entry(JobPostingStatus.OPEN, Map.of(
                    RecruitmentAction.PAUSE_POSTING, JobPostingStatus.PAUSED,
                    RecruitmentAction.EXPIRE_POSTING, JobPostingStatus.EXPIRED,
                    RecruitmentAction.CANCEL_POSTING, JobPostingStatus.CANCELLED,
                    RecruitmentAction.FILL_POSTING, JobPostingStatus.FILLED)),
            Map.entry(JobPostingStatus.PAUSED, Map.of(
                    RecruitmentAction.RESUME_POSTING, JobPostingStatus.OPEN,
                    RecruitmentAction.EXPIRE_POSTING, JobPostingStatus.EXPIRED,
                    RecruitmentAction.CANCEL_POSTING, JobPostingStatus.CANCELLED)),
            Map.entry(JobPostingStatus.EXPIRED, Map.of(
                    RecruitmentAction.EXTEND_POSTING, JobPostingStatus.OPEN)),
            Map.entry(JobPostingStatus.FILLED, Map.of(
                    RecruitmentAction.REOPEN_POSTING, JobPostingStatus.OPEN))
    );

    public ApplicationStatus next(ApplicationStatus current, RecruitmentAction action) {
        return next(APPLICATION_RULES, current, action, "hồ sơ ứng viên");
    }

    public JobRequisitionStatus next(JobRequisitionStatus current, RecruitmentAction action) {
        return next(REQUISITION_RULES, current, action, "yêu cầu tuyển dụng");
    }

    public JobPostingStatus next(JobPostingStatus current, RecruitmentAction action) {
        return next(POSTING_RULES, current, action, "chiến dịch tuyển dụng");
    }

    private <S extends Enum<S>> S next(
            Map<S, Map<RecruitmentAction, S>> rules,
            S current,
            RecruitmentAction action,
            String entityLabel) {
        S target = rules.getOrDefault(current, Map.of()).get(action);
        if (target == null) {
            throw AppException.conflict(
                    "Không thể thực hiện " + action + " khi " + entityLabel + " đang ở trạng thái " + current);
        }
        return target;
    }
}
