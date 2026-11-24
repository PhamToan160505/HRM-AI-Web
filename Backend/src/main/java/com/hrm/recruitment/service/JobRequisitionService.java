package com.hrm.recruitment.service;

import com.hrm.approval.entity.ApprovalDecision;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.approval.entity.ApprovalRequestStatus;
import com.hrm.approval.entity.ApprovalStep;
import com.hrm.approval.entity.ApprovalStepStatus;
import com.hrm.approval.service.ApprovalPolicyResolver;
import com.hrm.approval.service.ApprovalService;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.service.FinanceAccess;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.controller.JobRequisitionController.RequisitionRequest;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobRequisitionService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final BigDecimal EMPLOYER_INSURANCE_MULTIPLIER = new BigDecimal("1.215"); // ~21.5% BHXH/BHYT/BHTN DN

    private final JobRequisitionRepository jobRequisitionRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final RecruitmentTransitionService recruitmentTransitionService;
    private final ApprovalService approvalService;
    private final HiringSeatService hiringSeatService;

    @Autowired(required = false)
    private com.hrm.tech.repository.TechProjectRepository techProjectRepository;

    @Autowired(required = false)
    private com.hrm.recruitment.repository.JobPostingRepository jobPostingRepository;

    @Autowired(required = false)
    private FinanceAccess financeAccess;

    @Autowired(required = false)
    private NotificationService notificationService;

    private boolean isFinanceApprover(User user) {
        if (user == null || user.getDepartmentId() == null) return false;
        if (user.getRole() != Role.TRUONG_PHONG && user.getRole() != Role.GIAM_DOC_PHONG_BAN) return false;
        if (financeAccess != null) {
            return financeAccess.financeDepartmentId().map(id -> id.equals(user.getDepartmentId())).orElse(false);
        }
        String tenPhong = departmentRepository.findById(user.getDepartmentId())
                .map(d -> d.getTenPhong() != null ? d.getTenPhong().toLowerCase() : "")
                .orElse("");
        return tenPhong.contains("tài chính") || tenPhong.contains("kế toán");
    }

    private BigDecimal computeEstimatedAnnualCost(String budget, Integer soLuong) {
        if (budget == null || budget.isBlank() || soLuong == null || soLuong <= 0) {
            return null;
        }
        try {
            String normalizedBudget = budget.replace("VNĐ", "").replace("VND", "").replace(".", "").replace(",", "").trim();
            String[] range = normalizedBudget.split("\\s*-\\s*");
            long monthlyMax = range.length >= 2
                    ? Long.parseLong(range[1].replaceAll("\\D", ""))
                    : Long.parseLong(range[0].replaceAll("\\D", ""));
            if (monthlyMax <= 0) return null;
            return BigDecimal.valueOf(monthlyMax)
                    .multiply(BigDecimal.valueOf(soLuong))
                    .multiply(BigDecimal.valueOf(12))
                    .multiply(EMPLOYER_INSURANCE_MULTIPLIER)
                    .setScale(0, RoundingMode.HALF_UP);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void enrichRequisition(JobRequisition req) {
        enrichRequisition(req, null);
    }

    private void enrichRequisition(JobRequisition req, User viewer) {
        if (req.getEstimatedAnnualCost() == null) {
            req.setEstimatedAnnualCost(computeEstimatedAnnualCost(req.getBudget(), req.getSoLuong()));
        }
        if (req.getTechProjectId() != null && techProjectRepository != null) {
            techProjectRepository.findById(req.getTechProjectId()).ifPresent(tp -> {
                req.setTechProjectCode(tp.getProjectCode());
                req.setTechProjectName(tp.getProjectName());
            });
        }
        if (req.getId() != null && jobPostingRepository != null) {
            jobPostingRepository.findByJobRequisitionIdOrderByCreatedAtDesc(req.getId()).stream()
                    .filter(jp -> jp.getStatus() != com.hrm.recruitment.entity.JobPostingStatus.CANCELLED
                            && jp.getStatus() != com.hrm.recruitment.entity.JobPostingStatus.EXPIRED)
                    .findFirst()
                    .ifPresent(active -> {
                        req.setHasActiveCampaign(true);
                        req.setActivePostingId(active.getId());
                        req.setActivePostingStatus(active.getStatus() != null ? active.getStatus().name() : null);
                    });
        }
        if (req.getFinanceReviewedBy() != null) {
            userRepository.findById(req.getFinanceReviewedBy())
                    .ifPresent(u -> req.setFinanceReviewerName(u.getHoTen()));
        }
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

        // Enrich multi-step approval state
        if (req.getId() != null) {
            approvalService.getLatestRequestView(ApprovalEntityType.JOB_REQUISITION, req.getId())
                    .ifPresent(view -> {
                        List<JobRequisition.ApprovalStepSummary> summaries = view.steps().stream()
                                .map(s -> JobRequisition.ApprovalStepSummary.builder()
                                        .stepOrder(s.stepOrder())
                                        .stepScope(s.stepScope())
                                        .stepLabel(s.stepLabel() != null ? s.stepLabel() : defaultStepLabel(s.stepScope(), s.approverRole()))
                                        .approverRole(s.approverRole() != null ? s.approverRole().name() : null)
                                        .status(s.status() != null ? s.status().name() : null)
                                        .decidedByName(s.decidedByName())
                                        .decidedAt(s.decidedAt())
                                        .comment(s.comment())
                                        .build())
                                .toList();
                        req.setApprovalSteps(summaries);
                    });

            ApprovalStep pendingStep = approvalService
                    .getCurrentPendingStep(ApprovalEntityType.JOB_REQUISITION, req.getId())
                    .orElse(null);
            if (pendingStep != null && req.getStatus() == JobRequisitionStatus.PENDING_APPROVAL) {
                req.setCurrentStepOrder(pendingStep.getStepOrder());
                req.setCurrentStepScope(pendingStep.getStepScope());
                req.setCurrentStepLabel(pendingStep.getStepLabel() != null
                        ? pendingStep.getStepLabel()
                        : defaultStepLabel(pendingStep.getStepScope(), pendingStep.getApproverRole()));
                if (viewer != null && !req.getRequesterId().equals(viewer.getId())) {
                    req.setCanCurrentUserApprove(approvalService.canActorDecideStep(pendingStep, viewer.getId()));
                } else {
                    req.setCanCurrentUserApprove(false);
                }
            } else {
                req.setCurrentStepOrder(null);
                req.setCurrentStepScope(null);
                req.setCurrentStepLabel(null);
                req.setCanCurrentUserApprove(false);
            }
        }
    }

    private String defaultStepLabel(String scope, Role role) {
        if ("FINANCE_DEPARTMENT".equals(scope)) return "Tài chính - Kế toán thẩm định ngân sách";
        if ("ENTITY_DEPARTMENT".equals(scope) && role == Role.GIAM_DOC_PHONG_BAN) return "Giám đốc Phòng ban duyệt chuyên môn";
        if (role == Role.CEO) return "Tổng Giám đốc phê duyệt cuối";
        return role != null ? role.name() : "Phê duyệt";
    }

    public List<JobRequisition> getAllRequisitions(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        final String tenPhong = (user.getDepartmentId() != null)
                ? departmentRepository.findById(user.getDepartmentId()).map(dept -> dept.getTenPhong()).orElse(null)
                : null;

        boolean isCEO = (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN);
        boolean isHRManager = (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && "Nhân sự".equals(tenPhong);
        boolean isDeptDirector = user.getRole() == Role.GIAM_DOC_PHONG_BAN;
        boolean isFinanceApp = isFinanceApprover(user);

        List<JobRequisition> reqs = jobRequisitionRepository.findAll();
        return reqs.stream()
                .filter(req -> {
                    if (req.getRequesterId().equals(userId) || isCEO) return true;
                    if (req.getStatus() == JobRequisitionStatus.APPROVED && isHRManager) return true;
                    if (isDeptDirector && user.getDepartmentId() != null && user.getDepartmentId().equals(req.getDepartmentId())) {
                        return true;
                    }
                    if (isFinanceApp && req.getStatus() != JobRequisitionStatus.DRAFT) {
                        return true;
                    }
                    return false;
                })
                .peek(req -> enrichRequisition(req, user))
                .toList();
    }

    public org.springframework.data.domain.Page<JobRequisition> getAllRequisitionsPaginated(
            Long userId,
            Long departmentId,
            Role targetRole,
            JobRequisitionStatus status,
            Long filterRequesterId,
            int page,
            int size) {
        User user = userRepository.findById(userId).orElseThrow();
        final String tenPhong = (user.getDepartmentId() != null)
                ? departmentRepository.findById(user.getDepartmentId()).map(dept -> dept.getTenPhong()).orElse(null)
                : null;

        boolean isCEO = (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN);
        boolean isHRManager = (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && "Nhân sự".equals(tenPhong);
        boolean isDeptDirector = user.getRole() == Role.GIAM_DOC_PHONG_BAN;
        boolean isFinanceApp = isFinanceApprover(user);

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(
                page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));

        org.springframework.data.domain.Page<JobRequisition> reqPage = jobRequisitionRepository.findWithFiltersAndPermissions(
                departmentId, targetRole, status, filterRequesterId, userId,
                isCEO, isHRManager, isDeptDirector, user.getDepartmentId(), isFinanceApp, pageable);

        reqPage.getContent().forEach(req -> enrichRequisition(req, user));
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
        return createRequisitionWithTechContext(requesterId, request, null, null, null, requestId, idempotencyKey);
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition createRequisitionWithTechContext(
            Long requesterId,
            RequisitionRequest request,
            Long techProjectId,
            String requiredTechSkillsJson,
            String urgencyLevel,
            String requestId,
            String idempotencyKey) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người yêu cầu"));

        validateRequisitionContent(request);
        validateDepartment(request.departmentId());
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
                .estimatedAnnualCost(computeEstimatedAnnualCost(request.budget(), request.soLuong()))
                .capBac(request.capBac())
                .hinhThucLamViec(request.hinhThucLamViec())
                .techProjectId(techProjectId)
                .requiredTechSkillsJson(requiredTechSkillsJson)
                .urgencyLevel(urgencyLevel != null && !urgencyLevel.isBlank() ? urgencyLevel : "NORMAL")
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

        notifyNextPendingApprover(pending, requester.getHoTen());
        broadcastRequisitionSync("CREATED", pending.getId());
        enrichRequisition(pending, requester);
        return pending;
    }

    public JobRequisition getRequisition(Long id, Long userId) {
        JobRequisition requisition = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy yêu cầu tuyển dụng"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> com.hrm.exception.AppException.notFound("Không tìm thấy người dùng"));
        boolean isPrivileged = user.getRole() == Role.CEO || user.getRole() == Role.ADMIN;
        boolean isDeptDirector = user.getRole() == Role.GIAM_DOC_PHONG_BAN
                && user.getDepartmentId() != null && user.getDepartmentId().equals(requisition.getDepartmentId());
        boolean isFinanceApp = isFinanceApprover(user);
        boolean isHrApproved = requisition.getStatus() == JobRequisitionStatus.APPROVED
                && user.getDepartmentId() != null
                && departmentRepository.findById(user.getDepartmentId())
                        .map(d -> "Nhân sự".equals(d.getTenPhong())).orElse(false);

        if (!requisition.getRequesterId().equals(userId) && !isPrivileged && !isDeptDirector && !isFinanceApp && !isHrApproved) {
            throw com.hrm.exception.AppException.forbidden("Bạn không có quyền xem yêu cầu tuyển dụng này");
        }
        enrichRequisition(requisition, user);
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

    private void validateDepartment(Long departmentId) {
        if (departmentId == null) {
            throw com.hrm.exception.AppException.badRequest("Phòng ban tuyển dụng là bắt buộc");
        }
        com.hrm.common.entity.Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> com.hrm.exception.AppException.badRequest("Phòng ban tuyển dụng không tồn tại"));
        if (Boolean.TRUE.equals(department.getIsLock())) {
            throw com.hrm.exception.AppException.badRequest("Phòng ban tuyển dụng đã bị khóa");
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
        validateDepartment(request.departmentId());
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
        requisition.setEstimatedAnnualCost(computeEstimatedAnnualCost(request.budget(), request.soLuong()));
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
        requisition.setFinanceBudgetNote(null);
        requisition.setFinanceReviewedBy(null);
        requisition.setFinanceReviewedAt(null);
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

        notifyNextPendingApprover(pending, requester.getHoTen());
        broadcastRequisitionSync("RESUBMITTED", pending.getId());
        enrichRequisition(pending, requester);
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
            enrichRequisition(requisition, approver);
            return requisition;
        }
        requisition.setApproverId(approverId);
        requisition.setRejectionReason(comment);
        if ("FINANCE_DEPARTMENT".equals(outcome.stepScope())) {
            requisition.setFinanceBudgetNote(comment);
            requisition.setFinanceReviewedBy(approverId);
            requisition.setFinanceReviewedAt(LocalDateTime.now(VN_ZONE));
        }
        JobRequisition returned = recruitmentTransitionService.transitionRequisition(
                requisition,
                RecruitmentAction.RETURN_REQUISITION,
                approverId,
                approver.getRole(),
                comment,
                requestId,
                idempotencyKey);

        safeNotify(requisition.getRequesterId(), "RECRUITMENT_REQUISITION",
                "Yêu cầu tuyển dụng bị trả về chỉnh sửa: " + requisition.getTitle(),
                approver.getHoTen() + " yêu cầu chỉnh sửa: " + comment,
                "CANH_BAO", "/manager/recruitment/requisitions");
        broadcastRequisitionSync("RETURNED", returned.getId());
        enrichRequisition(returned, approver);
        return returned;
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
        JobRequisition withdrawn = recruitmentTransitionService.transitionRequisition(
                requisition,
                RecruitmentAction.WITHDRAW_REQUISITION,
                requesterId,
                requester.getRole(),
                "Người tạo thu hồi yêu cầu",
                requestId,
                idempotencyKey);
        broadcastRequisitionSync("WITHDRAWN", withdrawn.getId());
        enrichRequisition(withdrawn, requester);
        return withdrawn;
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
        return approveRequisition(id, approverId, null, requestId, idempotencyKey);
    }

    @org.springframework.transaction.annotation.Transactional
    public JobRequisition approveRequisition(
            Long id,
            Long approverId,
            String comment,
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
                comment,
                idempotencyKey);
        if (outcome.idempotentReplay()) {
            enrichRequisition(req, approver);
            return req;
        }

        if ("FINANCE_DEPARTMENT".equals(outcome.stepScope())) {
            req.setFinanceReviewedBy(approverId);
            req.setFinanceReviewedAt(LocalDateTime.now(VN_ZONE));
            if (comment != null && !comment.isBlank()) {
                req.setFinanceBudgetNote(comment.trim());
            } else if (req.getFinanceBudgetNote() == null) {
                req.setFinanceBudgetNote("Đã thẩm định đạt định mức quỹ lương.");
            }
            req = jobRequisitionRepository.saveAndFlush(req);
            if (!outcome.requestFinalized()) {
                approvalService.syncOpenRequestEntityVersion(
                        ApprovalEntityType.JOB_REQUISITION, req.getId(), req.getVersion());
            }
        }

        if (!outcome.requestFinalized() || outcome.requestStatus() != ApprovalRequestStatus.APPROVED) {
            // Intermediate step approved -> notify next step approver!
            notifyNextPendingApprover(req, approver.getHoTen());
            safeNotify(req.getRequesterId(), "RECRUITMENT_REQUISITION",
                    "Yêu cầu tuyển dụng đã qua bước duyệt: " + req.getTitle(),
                    approver.getHoTen() + " đã duyệt bước " + outcome.stepOrder() + ". Đang chuyển cấp tiếp theo.",
                    "THONG_TIN", "/manager/recruitment/requisitions");
            broadcastRequisitionSync("STEP_APPROVED", req.getId());
            enrichRequisition(req, approver);
            return req;
        }

        req.setApproverId(approverId);
        JobRequisition approved = recruitmentTransitionService.transitionRequisition(
                req,
                RecruitmentAction.APPROVE_REQUISITION,
                approverId,
                approver.getRole(),
                comment,
                requestId,
                idempotencyKey);
        hiringSeatService.initializeStandardSeats(
                approved, approverId,
                idempotencyKey == null ? null : idempotencyKey + ":seat-init");

        safeNotify(approved.getRequesterId(), "RECRUITMENT_REQUISITION",
                "Yêu cầu tuyển dụng đã được CEO phê duyệt: " + approved.getTitle(),
                "Yêu cầu đã hoàn tất quy trình duyệt và chuyển sang Phòng Nhân sự mở chiến dịch.",
                "THONG_TIN", "/manager/recruitment/requisitions");
        notifyHrManagersApproved(approved);
        broadcastRequisitionSync("APPROVED", approved.getId());
        enrichRequisition(approved, approver);
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
            enrichRequisition(req, approver);
            return req;
        }

        req.setApproverId(approverId);
        req.setRejectionReason(reason);
        if ("FINANCE_DEPARTMENT".equals(outcome.stepScope())) {
            req.setFinanceBudgetNote(reason);
            req.setFinanceReviewedBy(approverId);
            req.setFinanceReviewedAt(LocalDateTime.now(VN_ZONE));
        }
        JobRequisition rejected = recruitmentTransitionService.transitionRequisition(
                req,
                RecruitmentAction.REJECT_REQUISITION,
                approverId,
                approver.getRole(),
                reason,
                requestId,
                idempotencyKey);

        safeNotify(req.getRequesterId(), "RECRUITMENT_REQUISITION",
                "Yêu cầu tuyển dụng bị từ chối: " + req.getTitle(),
                approver.getHoTen() + " đã từ chối yêu cầu. Lý do: " + reason,
                "CANH_BAO", "/manager/recruitment/requisitions");
        broadcastRequisitionSync("REJECTED", rejected.getId());
        enrichRequisition(rejected, approver);
        return rejected;
    }

    private void notifyNextPendingApprover(JobRequisition req, String actorName) {
        if (notificationService == null || req.getId() == null) return;
        approvalService.getCurrentPendingStep(ApprovalEntityType.JOB_REQUISITION, req.getId()).ifPresent(step -> {
            String stepLabel = step.getStepLabel() != null
                    ? step.getStepLabel()
                    : defaultStepLabel(step.getStepScope(), step.getApproverRole());
            if ("FINANCE_DEPARTMENT".equals(step.getStepScope()) && financeAccess != null) {
                for (User chief : financeAccess.chiefAccountants()) {
                    if (!chief.getId().equals(req.getRequesterId())) {
                        String path = chief.getRole() == Role.GIAM_DOC_PHONG_BAN
                                ? "/director/recruitment/requisitions" : "/manager/recruitment/requisitions";
                        safeNotify(chief.getId(), "FINANCE_REQUISITION_BUDGET",
                                "Thẩm định ngân sách tuyển dụng: " + req.getTitle(),
                                actorName + " vừa chuyển yêu cầu tuyển " + req.getSoLuong() + " vị trí '" + req.getTitle()
                                        + "' (Ngân sách: " + (req.getBudget() != null ? req.getBudget() : "Chưa nêu") + ") chờ Phòng Tài chính thẩm định.",
                                "HIGH".equals(req.getUrgencyLevel()) || "CRITICAL".equals(req.getUrgencyLevel()) ? "CANH_BAO" : "THONG_TIN",
                                path);
                    }
                }
            } else if ("ENTITY_DEPARTMENT".equals(step.getStepScope()) && step.getResolvedApproverId() != null) {
                safeNotify(step.getResolvedApproverId(), "RECRUITMENT_REQUISITION",
                        "Chờ duyệt chuyên môn tuyển dụng: " + req.getTitle(),
                        actorName + " vừa gửi yêu cầu tuyển " + req.getSoLuong() + " vị trí '" + req.getTitle()
                                + "' chờ Giám đốc Phòng ban thẩm định chuyên môn & Bench.",
                        "THONG_TIN", "/director/recruitment/requisitions");
            } else if (step.getApproverRole() == Role.CEO) {
                for (User ceo : userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.CEO)) {
                    safeNotify(ceo.getId(), "RECRUITMENT_REQUISITION",
                            "Chờ CEO chốt tuyển dụng: " + req.getTitle(),
                            "Yêu cầu tuyển '" + req.getTitle() + "' (" + req.getSoLuong() + " vị trí) đã qua bước thẩm định chuyên môn & ngân sách — " + stepLabel,
                            "THONG_TIN", "/ceo/recruitment/requisitions");
                }
            }
        });
    }

    private void notifyHrManagersApproved(JobRequisition req) {
        if (notificationService == null) return;
        departmentRepository.findByTenPhong("Nhân sự").ifPresent(hrDept -> {
            userRepository.findByDepartmentId(hrDept.getId()).stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                    .forEach(hr -> safeNotify(
                            hr.getId(),
                            "RECRUITMENT_REQUISITION",
                            "Yêu cầu tuyển dụng mới đã được duyệt: " + req.getTitle(),
                            "CEO đã chốt tuyển " + req.getSoLuong() + " vị trí '" + req.getTitle() + "'. Vui lòng mở chiến dịch tuyển dụng.",
                            "THONG_TIN",
                            hr.getRole() == Role.GIAM_DOC_PHONG_BAN
                                    ? "/director/recruitment/requisitions"
                                    : "/manager/recruitment/requisitions"));
        });
    }

    private void safeNotify(Long userId, String type, String title, String content, String level, String link) {
        if (notificationService == null || userId == null) return;
        try {
            notificationService.createNotification(userId, type, title, content, level, link);
        } catch (Exception e) {
            log.warn("[JobRequisition] Không thể gửi thông báo tới user {}: {}", userId, e.getMessage());
        }
    }

    private void broadcastRequisitionSync(String action, Long reqId) {
        if (notificationService == null) return;
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("domain", "REQUISITION");
            payload.put("action", action);
            payload.put("requisitionId", reqId);
            notificationService.broadcastTopic("/topic/recruitment-updates", payload);
        } catch (Exception e) {
            log.warn("[JobRequisition] Không thể broadcast sync: {}", e.getMessage());
        }
    }
}
