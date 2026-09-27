package com.hrm.recruitment.service;

import com.hrm.approval.entity.ApprovalDecision;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.approval.entity.ApprovalRequestStatus;
import com.hrm.approval.service.ApprovalPolicyResolver;
import com.hrm.approval.service.ApprovalService;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.recruitment.controller.JobRequisitionController.RequisitionRequest;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class JobRequisitionService {

    private final JobRequisitionRepository jobRequisitionRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final RecruitmentTransitionService recruitmentTransitionService;
    private final ApprovalService approvalService;
    private final HiringSeatService hiringSeatService;

    private void enrichRequisition(JobRequisition req) {
        userRepository.findById(req.getRequesterId()).ifPresent(user -> {
            req.setRequesterName(user.getHoTen());
            String roleName = switch (user.getRole()) {
                case NHAN_VIEN -> "Nhân viên";
                case TRUONG_PHONG -> "Trưởng phòng";
                case GIAM_DOC_PHONG_BAN -> "Giám đốc";
                case CEO -> "Tổng giám đốc";
                case ADMIN -> "Quản trị viên";
            };
            if (user.getDepartmentId() != null) {
                departmentRepository.findById(user.getDepartmentId()).ifPresent(dept -> {
                    req.setRequesterPosition(roleName + " " + dept.getTenPhong());
                });
            } else {
                req.setRequesterPosition(roleName);
            }
        });
    }

    public List<JobRequisition> getAllRequisitions(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        final String tenPhong = (user.getDepartmentId() != null) ?
                departmentRepository.findById(user.getDepartmentId())
                        .map(dept -> dept.getTenPhong()).orElse(null) : null;

        List<JobRequisition> reqs = jobRequisitionRepository.findAll();
        reqs.forEach(this::enrichRequisition);
        
        return reqs.stream().filter(req -> {
            boolean isCreator = req.getRequesterId().equals(userId);
            boolean isCEO = (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN);
            boolean isHRManager = (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN) 
                                  && "Nhân sự".equals(tenPhong);
            
            if (isCreator || isCEO) return true;
            if (req.getStatus() == JobRequisitionStatus.APPROVED && isHRManager) return true;
            
            return false;
        }).toList();
    }

    public org.springframework.data.domain.Page<JobRequisition> getAllRequisitionsPaginated(Long userId, Long departmentId, Role targetRole, JobRequisitionStatus status, Long filterRequesterId, int page, int size) {
        User user = userRepository.findById(userId).orElseThrow();
        final String tenPhong = (user.getDepartmentId() != null) ?
                departmentRepository.findById(user.getDepartmentId())
                        .map(dept -> dept.getTenPhong()).orElse(null) : null;

        boolean isCEO = (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN);
        boolean isHRManager = (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN) 
                              && "Nhân sự".equals(tenPhong);

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        
        org.springframework.data.domain.Page<JobRequisition> reqPage = jobRequisitionRepository.findWithFiltersAndPermissions(
                departmentId, targetRole, status, filterRequesterId, userId, isCEO, isHRManager, pageable);
                
        reqPage.getContent().forEach(this::enrichRequisition);
        return reqPage;
    }

    public List<JobRequisition> getRequisitionsByDepartment(Long departmentId) {
        List<JobRequisition> reqs = jobRequisitionRepository.findByDepartmentId(departmentId);
        reqs.forEach(this::enrichRequisition);
        return reqs;
    }
    
    public List<JobRequisition> getRequisitionsByRequester(Long requesterId) {
        List<JobRequisition> reqs = jobRequisitionRepository.findByRequesterId(requesterId);
        reqs.forEach(this::enrichRequisition);
        return reqs;
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition createRequisition(
            Long requesterId,
            RequisitionRequest request,
            String requestId,
            String idempotencyKey) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người yêu cầu"));

        validateRequisitionContent(request);

        validateRequesterAuthority(requester, request.targetRole());

        JobRequisition req = JobRequisition.builder()
                .title(request.title())
                .targetRole(request.targetRole())
                .departmentId(request.departmentId())
                .soLuong(request.soLuong())
                .reason(request.reason())
                .requirements(request.requirements())
                .description(request.description())
                .budget(request.budget())
                .capBac(request.capBac())
                .hinhThucLamViec(request.hinhThucLamViec())
                .status(JobRequisitionStatus.DRAFT)
                .requesterId(requesterId)
                .build();

        JobRequisition saved = jobRequisitionRepository.save(req);
        recruitmentTransitionService.recordCreation(
                RecruitmentEntityType.JOB_REQUISITION,
                saved.getId(),
                requesterId,
                requester.getRole(),
                JobRequisitionStatus.DRAFT.name(),
                requestId,
                idempotencyKey == null ? null : idempotencyKey + ":create");
        JobRequisition pending = recruitmentTransitionService.transitionRequisition(
                saved,
                RecruitmentAction.SUBMIT_REQUISITION,
                requesterId,
                requester.getRole(),
                "Gửi yêu cầu tuyển dụng để duyệt",
                requestId,
                idempotencyKey == null ? null : idempotencyKey + ":submit");
        jobRequisitionRepository.flush();
        approvalService.openRequest(
                ApprovalEntityType.JOB_REQUISITION,
                pending.getId(),
                pending.getVersion(),
                requesterId,
                ApprovalPolicyResolver.ApprovalContext.forRequisition(
                        requesterId, pending.getDepartmentId(), pending.getTargetRole()),
                idempotencyKey == null ? null : idempotencyKey + ":approval");
        return pending;
    }

    public JobRequisition getRequisition(Long id, Long userId) {
        JobRequisition requisition = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy yêu cầu tuyển dụng"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy người dùng"));
        boolean isPrivileged = user.getRole() == Role.CEO || user.getRole() == Role.ADMIN;
        if (!requisition.getRequesterId().equals(userId) && !isPrivileged) {
            throw com.hrm.exception.AppException.forbidden("Bạn không có quyền xem yêu cầu tuyển dụng này");
        }
        enrichRequisition(requisition);
        return requisition;
    }

    private void validateRequisitionContent(RequisitionRequest request) {
        if (request.soLuong() == null || request.soLuong() <= 0) {
            throw new RuntimeException("Số lượng tuyển phải lớn hơn 0");
        }

        String description = request.description();
        long descriptionCharacterCount = description == null || description.isBlank()
                ? 0
                : java.text.Normalizer.normalize(description, java.text.Normalizer.Form.NFC)
                        .codePoints()
                        .filter(character -> !Character.isWhitespace(character))
                        .count();
        if (descriptionCharacterCount < 10) {
            throw new RuntimeException("Mô tả công việc (JD) phải có ít nhất 10 ký tự");
        }

        String budget = request.budget();
        if (budget == null || budget.isBlank()) {
            return;
        }

        try {
            String normalizedBudget = budget.replace("VNĐ", "").replace(".", "").trim();
            String[] range = normalizedBudget.split("\\s*-\\s*");
            if (range.length != 2) {
                throw new NumberFormatException("Invalid budget range");
            }

            long budgetMin = Long.parseLong(range[0]);
            long budgetMax = Long.parseLong(range[1]);
            if (budgetMin <= 0 || budgetMax <= 0) {
                throw new RuntimeException("Ngân sách dự kiến phải là số lớn hơn 0");
            }
            if (budgetMin > budgetMax) {
                throw new RuntimeException("Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu");
            }
        } catch (NumberFormatException exception) {
            throw new RuntimeException("Ngân sách dự kiến không hợp lệ");
        }
    }

    private void validateRequesterAuthority(User requester, Role targetRole) {
        if (targetRole == null) {
            throw com.hrm.exception.AppException.badRequest("Chức vụ cần tuyển là bắt buộc");
        }
        if (targetRole == Role.NHAN_VIEN && requester.getRole() == Role.NHAN_VIEN) {
            throw com.hrm.exception.AppException.forbidden("Chỉ Trưởng phòng trở lên mới được yêu cầu tuyển Nhân viên");
        }
        if (targetRole == Role.TRUONG_PHONG
                && (requester.getRole() == Role.NHAN_VIEN || requester.getRole() == Role.TRUONG_PHONG)) {
            throw com.hrm.exception.AppException.forbidden("Chỉ Giám đốc phòng ban trở lên mới được yêu cầu tuyển Trưởng phòng");
        }
        if (targetRole == Role.GIAM_DOC_PHONG_BAN
                && requester.getRole() != Role.CEO
                && requester.getRole() != Role.ADMIN) {
            throw com.hrm.exception.AppException.forbidden("Chỉ Tổng Giám đốc mới được yêu cầu tuyển Giám đốc phòng ban");
        }
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition updateRequisition(Long id, Long requesterId, RequisitionRequest request) {
        JobRequisition requisition = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy yêu cầu tuyển dụng"));
        if (!requisition.getRequesterId().equals(requesterId)) {
            throw com.hrm.exception.AppException.forbidden("Chỉ người tạo mới được sửa yêu cầu tuyển dụng");
        }
        if (requisition.getStatus() != JobRequisitionStatus.DRAFT
                && requisition.getStatus() != JobRequisitionStatus.REVISION_REQUIRED) {
            throw com.hrm.exception.AppException.conflict(
                    "Chỉ được sửa yêu cầu ở trạng thái DRAFT hoặc REVISION_REQUIRED");
        }
        validateRequisitionContent(request);
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy người yêu cầu"));
        validateRequesterAuthority(requester, request.targetRole());

        requisition.setTitle(request.title());
        requisition.setTargetRole(request.targetRole());
        requisition.setDepartmentId(request.departmentId());
        requisition.setSoLuong(request.soLuong());
        requisition.setReason(request.reason());
        requisition.setRequirements(request.requirements());
        requisition.setDescription(request.description());
        requisition.setBudget(request.budget());
        requisition.setCapBac(request.capBac());
        requisition.setHinhThucLamViec(request.hinhThucLamViec());
        return jobRequisitionRepository.save(requisition);
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition submitRequisition(
            Long id,
            Long requesterId,
            String requestId,
            String idempotencyKey) {
        JobRequisition requisition = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy yêu cầu tuyển dụng"));
        if (!requisition.getRequesterId().equals(requesterId)) {
            throw com.hrm.exception.AppException.forbidden("Chỉ người tạo mới được gửi lại yêu cầu tuyển dụng");
        }
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy người yêu cầu"));
        requisition.setApproverId(null);
        requisition.setRejectionReason(null);
        JobRequisition pending = recruitmentTransitionService.transitionRequisition(
                requisition,
                RecruitmentAction.SUBMIT_REQUISITION,
                requesterId,
                requester.getRole(),
                "Gửi lại yêu cầu sau khi chỉnh sửa",
                requestId,
                idempotencyKey);
        jobRequisitionRepository.flush();
        approvalService.openRequest(
                ApprovalEntityType.JOB_REQUISITION,
                pending.getId(),
                pending.getVersion(),
                requesterId,
                ApprovalPolicyResolver.ApprovalContext.forRequisition(
                        requesterId, pending.getDepartmentId(), pending.getTargetRole()),
                idempotencyKey == null ? null : idempotencyKey + ":approval");
        return pending;
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition returnRequisition(
            Long id,
            Long approverId,
            String comment,
            String requestId,
            String idempotencyKey) {
        JobRequisition requisition = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy yêu cầu tuyển dụng"));
        User approver = requireRequisitionApprover(approverId);
        ApprovalService.ApprovalOutcome outcome = approvalService.decide(
                ApprovalEntityType.JOB_REQUISITION,
                requisition.getId(),
                requisition.getVersion(),
                approverId,
                ApprovalDecision.RETURN,
                comment,
                idempotencyKey);
        if (outcome.idempotentReplay()) {
            return requisition;
        }
        requisition.setApproverId(approverId);
        requisition.setRejectionReason(comment);
        return recruitmentTransitionService.transitionRequisition(
                requisition,
                RecruitmentAction.RETURN_REQUISITION,
                approverId,
                approver.getRole(),
                comment,
                requestId,
                idempotencyKey);
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition withdrawRequisition(
            Long id,
            Long requesterId,
            String requestId,
            String idempotencyKey) {
        JobRequisition requisition = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy yêu cầu tuyển dụng"));
        if (!requisition.getRequesterId().equals(requesterId)) {
            throw com.hrm.exception.AppException.forbidden("Chỉ người tạo mới được thu hồi yêu cầu tuyển dụng");
        }
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy người yêu cầu"));
        approvalService.cancelOpenRequest(
                ApprovalEntityType.JOB_REQUISITION,
                requisition.getId(),
                requesterId,
                "Người tạo thu hồi yêu cầu");
        return recruitmentTransitionService.transitionRequisition(
                requisition,
                RecruitmentAction.WITHDRAW_REQUISITION,
                requesterId,
                requester.getRole(),
                "Người tạo thu hồi yêu cầu",
                requestId,
                idempotencyKey);
    }

    private User requireRequisitionApprover(Long approverId) {
        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy người duyệt"));
        if (!Boolean.TRUE.equals(approver.getActive())) {
            throw com.hrm.exception.AppException.forbidden("Tài khoản người duyệt đã bị vô hiệu hóa");
        }
        return approver;
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition approveRequisition(
            Long id,
            Long approverId,
            String requestId,
            String idempotencyKey) {
        JobRequisition req = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu"));
        
        User approver = requireRequisitionApprover(approverId);
        ApprovalService.ApprovalOutcome outcome = approvalService.decide(
                ApprovalEntityType.JOB_REQUISITION,
                req.getId(),
                req.getVersion(),
                approverId,
                ApprovalDecision.APPROVE,
                null,
                idempotencyKey);
        if (outcome.idempotentReplay()) {
            return req;
        }
        if (!outcome.requestFinalized() || outcome.requestStatus() != ApprovalRequestStatus.APPROVED) {
            return req;
        }

        req.setApproverId(approverId);
        JobRequisition approved = recruitmentTransitionService.transitionRequisition(
                req,
                RecruitmentAction.APPROVE_REQUISITION,
                approverId,
                approver.getRole(),
                null,
                requestId,
                idempotencyKey);
        hiringSeatService.initializeStandardSeats(
                approved, approverId,
                idempotencyKey == null ? null : idempotencyKey + ":seat-init");
        return approved;
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition rejectRequisition(
            Long id,
            Long approverId,
            String reason,
            String requestId,
            String idempotencyKey) {
        JobRequisition req = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu"));
        
        User approver = requireRequisitionApprover(approverId);
        ApprovalService.ApprovalOutcome outcome = approvalService.decide(
                ApprovalEntityType.JOB_REQUISITION,
                req.getId(),
                req.getVersion(),
                approverId,
                ApprovalDecision.REJECT,
                reason,
                idempotencyKey);
        if (outcome.idempotentReplay()) {
            return req;
        }

        req.setApproverId(approverId);
        req.setRejectionReason(reason);
        return recruitmentTransitionService.transitionRequisition(
                req,
                RecruitmentAction.REJECT_REQUISITION,
                approverId,
                approver.getRole(),
                reason,
                requestId,
                idempotencyKey);
    }
}
