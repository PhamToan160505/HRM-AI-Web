package com.hrm.techhr.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.controller.JobRequisitionController;
import com.hrm.recruitment.entity.*;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.HiringSeatRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import com.hrm.recruitment.service.JobRequisitionService;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import com.hrm.techhr.dto.CreateTechGapRequisitionRequest;
import com.hrm.techhr.dto.ProjectHiringStatusResponse;
import com.hrm.techhr.dto.TechHrIntegrationDtos.*;
import com.hrm.techhr.entity.CrossDeptHandoffTask;
import com.hrm.techhr.entity.CrossDeptTaskPriority;
import com.hrm.techhr.entity.CrossDeptTaskStatus;
import com.hrm.techhr.entity.CrossDeptTaskType;
import com.hrm.techhr.event.TechHrDomainEvents.*;
import com.hrm.techhr.repository.CrossDeptHandoffTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechHrIntegrationService {

    private final CrossDeptHandoffService handoffService;
    private final CrossDeptHandoffTaskRepository handoffTaskRepository;
    private final JobRequisitionService jobRequisitionService;
    private final JobRequisitionRepository jobRequisitionRepository;
    private final JobPostingRepository jobPostingRepository;
    private final HiringSeatRepository hiringSeatRepository;
    private final ApplicationRepository applicationRepository;
    private final TechProjectRepository techProjectRepository;
    private final TechProjectMemberRepository techProjectMemberRepository;
    private final TechProjectMilestoneRepository techProjectMilestoneRepository;
    private final TechProjectEnvironmentRepository techProjectEnvironmentRepository;
    private final TechMentorshipProgramRepository techMentorshipProgramRepository;
    private final TechWorklogRepository techWorklogRepository;
    private final UserTechSkillRepository userTechSkillRepository;
    private final EmployeeRequestRepository employeeRequestRepository;
    private final UserRepository userRepository;
    private final EmployeeHistoryService employeeHistoryService;
    private final NotificationService notificationService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    // =========================================================================
    // MODULE 1: CẦU NỐI THIẾU HỤT NGUỒN LỰC TECH -> YÊU CẦU TUYỂN DỤNG HR
    // =========================================================================

    @Transactional
    public JobRequisition createRequisitionFromTechGap(
            CreateTechGapRequisitionRequest req, Long actorId, String idempotencyKey) {

        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài khoản người yêu cầu!"));

        if (actor.getRole() != Role.TRUONG_PHONG && actor.getRole() != Role.GIAM_DOC_PHONG_BAN && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc Công nghệ mới có quyền đề xuất tuyển dụng sang HR!");
        }

        Long deptId = actor.getDepartmentId() != null ? actor.getDepartmentId() : handoffService.findTechDepartmentId();
        if (deptId == null) {
            throw AppException.badRequest("Không xác định được phòng ban Công nghệ!");
        }

        TechProject project = null;
        if (req.getTechProjectId() != null) {
            project = techProjectRepository.findById(req.getTechProjectId())
                    .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án Công nghệ ID: " + req.getTechProjectId()));
        }

        String skillsJson = null;
        StringBuilder skillLines = new StringBuilder();
        if (req.getRequiredSkills() != null && !req.getRequiredSkills().isEmpty()) {
            try {
                skillsJson = objectMapper.writeValueAsString(req.getRequiredSkills());
            } catch (Exception e) {
                log.warn("[Tech-HR] Lỗi serialize requiredSkills: {}", e.getMessage());
            }
            for (CreateTechGapRequisitionRequest.RequiredTechSkillItem item : req.getRequiredSkills()) {
                if (item.getSkillName() != null && !item.getSkillName().isBlank()) {
                    skillLines.append("- ").append(item.getSkillName().trim());
                    if (item.getMinLevel() != null && !item.getMinLevel().isBlank()) {
                        skillLines.append(" (Tối thiểu: ").append(item.getMinLevel().trim()).append(")");
                    }
                    skillLines.append("\n");
                }
            }
        }

        StringBuilder reqText = new StringBuilder();
        if (!skillLines.isEmpty()) {
            reqText.append("Kỹ năng kỹ thuật bắt buộc (từ Ma trận Năng lực Phòng Công nghệ):\n").append(skillLines);
        }
        if (req.getAdditionalRequirements() != null && !req.getAdditionalRequirements().isBlank()) {
            reqText.append(req.getAdditionalRequirements().trim());
        }
        if (reqText.isEmpty()) {
            reqText.append("Đáp ứng tiêu chuẩn kỹ thuật chuyên môn cấp bậc ").append(req.getCapBac());
        }

        String description = req.getDescription();
        if (description == null || description.trim().length() < 12) {
            String projPart = project != null
                    ? "Tham gia phát triển dự án " + project.getProjectCode() + " - " + project.getProjectName() + ". "
                    : "Bổ sung năng lực chuyên môn cho Phòng Công nghệ. ";
            description = projPart + "Cấp bậc mục tiêu: " + req.getCapBac()
                    + ". Phối hợp với đội ngũ kỹ sư hiện tại đảm bảo tiến độ bàn giao và chất lượng mã nguồn (DoD).";
        }

        String normalizedUrgency = normalizeUrgency(req.getUrgencyLevel());
        String key = (idempotencyKey != null && !idempotencyKey.isBlank())
                ? idempotencyKey
                : "tech-gap-" + UUID.randomUUID();

        JobRequisitionController.RequisitionRequest coreReq = new JobRequisitionController.RequisitionRequest(
                req.getTitle().trim(),
                req.getTargetRole() != null ? req.getTargetRole() : Role.NHAN_VIEN,
                deptId,
                req.getSoLuong(),
                req.getReason().trim(),
                reqText.toString().trim(),
                description.trim(),
                req.getBudget() != null && !req.getBudget().isBlank() ? req.getBudget().trim() : null,
                req.getCapBac().trim(),
                req.getHinhThucLamViec() != null && !req.getHinhThucLamViec().isBlank()
                        ? req.getHinhThucLamViec().trim() : "Toàn thời gian"
        );

        JobRequisition saved = jobRequisitionService.createRequisitionWithTechContext(
                actorId,
                coreReq,
                project != null ? project.getId() : null,
                skillsJson,
                normalizedUrgency,
                null,
                key
        );

        if (project != null) {
            saved.setTechProjectCode(project.getProjectCode());
            saved.setTechProjectName(project.getProjectName());
        }

        notifyHrAboutTechRequisition(saved, actor, project);
        log.info("[Tech-HR] {} tạo JobRequisition #{} từ Tech Gap (projectId={})",
                actor.getHoTen(), saved.getId(), saved.getTechProjectId());
        return saved;
    }

    @Transactional(readOnly = true)
    public ProjectHiringStatusResponse getProjectHiringStatus(Long projectId) {
        TechProject project = techProjectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án ID: " + projectId));

        List<JobRequisition> requisitions = jobRequisitionRepository.findByTechProjectIdOrderByCreatedAtDesc(projectId);
        List<ProjectHiringStatusResponse.RequisitionSummaryItem> items = new ArrayList<>();
        int totalRequested = 0;
        int totalFilled = 0;

        for (JobRequisition jr : requisitions) {
            totalRequested += jr.getSoLuong() != null ? jr.getSoLuong() : 0;
            List<HiringSeat> seats = hiringSeatRepository.findByRequisitionIdOrderBySeatNumber(jr.getId());
            int open = 0, reserved = 0, accepted = 0, joined = 0;
            for (HiringSeat s : seats) {
                if (s.getStatus() == HiringSeatStatus.AVAILABLE) open++;
                else if (s.getStatus() == HiringSeatStatus.RESERVED) reserved++;
                else if (s.getStatus() == HiringSeatStatus.ACCEPTED) accepted++;
                else if (s.getStatus() == HiringSeatStatus.JOINED) joined++;
            }
            totalFilled += (accepted + joined);

            int activeApps = countActiveApplicationsForRequisition(jr.getId());

            items.add(ProjectHiringStatusResponse.RequisitionSummaryItem.builder()
                    .requisitionId(jr.getId())
                    .title(jr.getTitle())
                    .capBac(jr.getCapBac())
                    .soLuong(jr.getSoLuong())
                    .status(jr.getStatus().name())
                    .urgencyLevel(jr.getUrgencyLevel())
                    .requiredTechSkillsJson(jr.getRequiredTechSkillsJson())
                    .openSeats(open)
                    .reservedSeats(reserved)
                    .acceptedSeats(accepted)
                    .joinedSeats(joined)
                    .activeApplications(activeApps)
                    .createdAt(jr.getCreatedAt())
                    .build());
        }

        return ProjectHiringStatusResponse.builder()
                .projectId(project.getId())
                .projectCode(project.getProjectCode())
                .projectName(project.getProjectName())
                .totalRequisitions(requisitions.size())
                .totalRequestedHeadcount(totalRequested)
                .totalFilledSeats(totalFilled)
                .requisitions(items)
                .build();
    }

    @Transactional(readOnly = true)
    public TechHiringRequisitionDetailResponse getRequisitionHiringDetail(Long requisitionId, Long actorId) {
        JobRequisition jr = jobRequisitionRepository.findById(requisitionId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy yêu cầu tuyển dụng ID: " + requisitionId));

        User actor = actorId != null ? userRepository.findById(actorId).orElse(null) : null;
        boolean canViewBudget = actor != null && actor.getRole() != Role.NHAN_VIEN;

        TechProject project = jr.getTechProjectId() != null
                ? techProjectRepository.findById(jr.getTechProjectId()).orElse(null)
                : null;

        String requesterName = jr.getRequesterId() != null
                ? userRepository.findById(jr.getRequesterId()).map(User::getHoTen).orElse("Quản lý")
                : null;
        String approverName = jr.getApproverId() != null
                ? userRepository.findById(jr.getApproverId()).map(User::getHoTen).orElse(null)
                : null;

        // 1. Sổ ghế tuyển dụng (hiring_seats)
        List<HiringSeat> rawSeats = hiringSeatRepository.findByRequisitionIdOrderBySeatNumber(requisitionId);
        Map<Long, String> appNameCache = new HashMap<>();
        List<HiringSeatDetailItem> seatItems = new ArrayList<>();
        for (HiringSeat s : rawSeats) {
            String candName = null;
            if (s.getApplicationId() != null) {
                candName = appNameCache.computeIfAbsent(s.getApplicationId(), appId ->
                        applicationRepository.findById(appId).map(Application::getFullName).orElse(null));
            }
            seatItems.add(HiringSeatDetailItem.builder()
                    .seatId(s.getId())
                    .seatNumber(s.getSeatNumber())
                    .kind(s.getKind() != null ? s.getKind().name() : "STANDARD")
                    .status(s.getStatus() != null ? s.getStatus().name() : "AVAILABLE")
                    .applicationId(s.getApplicationId())
                    .candidateName(candName)
                    .updatedAt(s.getUpdatedAt())
                    .build());
        }

        // 2. Chiến dịch / Tin tuyển dụng HR mở từ yêu cầu này (job_postings)
        List<JobPosting> rawPostings = jobPostingRepository.findAll().stream()
                .filter(jp -> requisitionId.equals(jp.getJobRequisitionId()))
                .sorted(Comparator.comparing(JobPosting::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<JobPostingSummaryItem> postingItems = new ArrayList<>();
        List<CandidateProgressItem> candidateItems = new ArrayList<>();
        List<HiringTimelineEventItem> timeline = new ArrayList<>();

        for (JobPosting jp : rawPostings) {
            List<Application> apps = applicationRepository.findByJobPostingId(jp.getId());
            postingItems.add(JobPostingSummaryItem.builder()
                    .postingId(jp.getId())
                    .title(jp.getTitle())
                    .status(jp.getStatus() != null ? jp.getStatus().name() : "DRAFT")
                    .soLuongTuyen(jp.getSoLuongTuyen())
                    .mucLuong(canViewBudget ? jp.getMucLuong() : null)
                    .ngayBatDau(jp.getNgayBatDau())
                    .hanNopHoSo(jp.getHanNopHoSo())
                    .totalApplications(apps.size())
                    .build());

            if (jp.getCreatedAt() != null) {
                timeline.add(HiringTimelineEventItem.builder()
                        .source("POSTING")
                        .action("POSTING_CREATED")
                        .title("HR mở chiến dịch tuyển dụng: " + jp.getTitle())
                        .detail("Trạng thái chiến dịch: " + (jp.getStatus() != null ? jp.getStatus().name() : "DRAFT")
                                + " • Chỉ tiêu: " + jp.getSoLuongTuyen() + " nhân sự")
                        .actorName("Phòng Nhân sự")
                        .actorRole("HR")
                        .statusBadge(jp.getStatus() != null ? jp.getStatus().name() : "DRAFT")
                        .occurredAt(jp.getCreatedAt())
                        .build());
            }

            for (Application app : apps) {
                candidateItems.add(CandidateProgressItem.builder()
                        .applicationId(app.getId())
                        .fullName(app.getFullName())
                        .email(app.getEmail())
                        .approvalStatus(app.getApprovalStatus() != null ? app.getApprovalStatus().name() : "PENDING_HR_CV_REVIEW")
                        .fitScore(app.getFitScore())
                        .postingTitle(jp.getTitle())
                        .createdAt(app.getCreatedAt())
                        .updatedAt(app.getUpdatedAt())
                        .build());
            }
        }
        candidateItems.sort(Comparator.comparing(CandidateProgressItem::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        // 3. Lịch sử chuyển trạng thái thực tế (application_transition_logs)
        try {
            List<Map<String, Object>> transRows = jdbcTemplate.queryForList("""
                    SELECT l.action, l.from_status, l.to_status, l.comment, l.actor_role, l.occurred_at,
                           u.ho_ten AS actor_name
                    FROM application_transition_logs l
                    LEFT JOIN users u ON u.id = l.actor_id
                    WHERE l.entity_type = 'JOB_REQUISITION' AND l.entity_id = ?
                    ORDER BY l.occurred_at DESC, l.id DESC
                    """, requisitionId);
            for (Map<String, Object> r : transRows) {
                String action = r.get("action") != null ? String.valueOf(r.get("action")) : "";
                String fromSt = r.get("from_status") != null ? String.valueOf(r.get("from_status")) : null;
                String toSt = r.get("to_status") != null ? String.valueOf(r.get("to_status")) : null;
                String comment = r.get("comment") != null ? String.valueOf(r.get("comment")) : null;
                String actorRole = r.get("actor_role") != null ? String.valueOf(r.get("actor_role")) : null;
                String actorName = r.get("actor_name") != null ? String.valueOf(r.get("actor_name")) : "Hệ thống";
                LocalDateTime occurredAt = toLocalDateTime((Timestamp) r.get("occurred_at"));

                String humanTitle = switch (action) {
                    case "CREATE" -> "Khởi tạo Yêu cầu tuyển dụng";
                    case "SUBMIT_REQUISITION" -> "Gửi yêu cầu tuyển dụng lên cấp phê duyệt";
                    case "APPROVE_REQUISITION" -> "Phê duyệt Yêu cầu tuyển dụng (Chuyển HR mở tuyển)";
                    case "RETURN_REQUISITION" -> "Trả về yêu cầu để chỉnh sửa";
                    case "REJECT_REQUISITION" -> "Từ chối Yêu cầu tuyển dụng";
                    case "WITHDRAW_REQUISITION" -> "Người tạo thu hồi yêu cầu về bản nháp";
                    case "FULFILL_REQUISITION" -> "Hoàn tất tuyển đủ chỉ tiêu";
                    default -> action;
                };
                String detail = (fromSt != null && toSt != null ? fromSt + " → " + toSt : (toSt != null ? toSt : ""))
                        + (comment != null && !comment.isBlank() ? " • " + comment : "");

                timeline.add(HiringTimelineEventItem.builder()
                        .source("TRANSITION")
                        .action(action)
                        .title(humanTitle)
                        .detail(detail)
                        .actorName(actorName)
                        .actorRole(actorRole)
                        .statusBadge(toSt)
                        .occurredAt(occurredAt)
                        .build());
            }
        } catch (Exception e) {
            log.debug("[Tech-HR] Không thể đọc transition logs cho requisition #{}: {}", requisitionId, e.getMessage());
        }

        // 4. Các bước phê duyệt đang chờ (approval_steps PENDING) để người xem biết ai đang xử lý
        try {
            List<Map<String, Object>> pendingSteps = jdbcTemplate.queryForList("""
                    SELECT s.step_order, s.approver_role, s.status, s.resolution_note, r.created_at,
                           u.ho_ten AS approver_name
                    FROM approval_steps s
                    JOIN approval_requests r ON r.id = s.request_id
                    LEFT JOIN users u ON u.id = s.resolved_approver_id
                    WHERE r.entity_type = 'JOB_REQUISITION' AND r.entity_id = ? AND s.status = 'PENDING'
                    ORDER BY s.step_order ASC
                    """, requisitionId);
            for (Map<String, Object> s : pendingSteps) {
                timeline.add(HiringTimelineEventItem.builder()
                        .source("APPROVAL")
                        .action("PENDING_STEP")
                        .title("Đang chờ duyệt Bước " + s.get("step_order") + " (" + s.get("approver_role") + ")")
                        .detail("Người được phân công duyệt: " + (s.get("approver_name") != null ? s.get("approver_name") : s.get("approver_role")))
                        .actorName(s.get("approver_name") != null ? String.valueOf(s.get("approver_name")) : String.valueOf(s.get("approver_role")))
                        .actorRole(String.valueOf(s.get("approver_role")))
                        .statusBadge("PENDING")
                        .occurredAt(toLocalDateTime((Timestamp) s.get("created_at")))
                        .build());
            }
        } catch (Exception e) {
            log.debug("[Tech-HR] Không thể đọc approval_steps cho requisition #{}: {}", requisitionId, e.getMessage());
        }

        timeline.sort(Comparator.comparing(HiringTimelineEventItem::getOccurredAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        return TechHiringRequisitionDetailResponse.builder()
                .requisitionId(jr.getId())
                .title(jr.getTitle())
                .capBac(jr.getCapBac())
                .hinhThucLamViec(jr.getHinhThucLamViec())
                .soLuong(jr.getSoLuong())
                .status(jr.getStatus().name())
                .urgencyLevel(jr.getUrgencyLevel())
                .budget(canViewBudget ? jr.getBudget() : null)
                .reason(jr.getReason())
                .description(jr.getDescription())
                .requiredTechSkillsJson(jr.getRequiredTechSkillsJson())
                .techProjectId(jr.getTechProjectId())
                .techProjectCode(project != null ? project.getProjectCode() : null)
                .techProjectName(project != null ? project.getProjectName() : null)
                .requesterName(requesterName)
                .approverName(approverName)
                .rejectionReason(jr.getRejectionReason())
                .createdAt(jr.getCreatedAt())
                .seats(seatItems)
                .postings(postingItems)
                .candidates(candidateItems)
                .timeline(timeline)
                .build();
    }

    // =========================================================================
    // MODULE 2: GỢI Ý HỘI ĐỒNG PHỎNG VẤN KỸ THUẬT THÔNG MINH (HR <-> TECH)
    // =========================================================================

    @Transactional(readOnly = true)
    public List<TechInterviewerSuggestion> suggestTechnicalInterviewers(
            Long applicationId, Long departmentId, LocalDate interviewDate) {

        LocalDate targetDate = interviewDate != null ? interviewDate : LocalDate.now();
        Set<String> targetSkillNamesLower = new HashSet<>();
        Long resolvedDeptId = departmentId;

        if (applicationId != null) {
            Application app = applicationRepository.findById(applicationId).orElse(null);
            if (app != null && app.getJobPosting() != null) {
                JobPosting jp = app.getJobPosting();
                if (resolvedDeptId == null) resolvedDeptId = jp.getDepartmentId();
                extractKeywordsFromText(jp.getTitle(), targetSkillNamesLower);
                extractKeywordsFromText(jp.getRequirements(), targetSkillNamesLower);
                if (jp.getJobRequisitionId() != null) {
                    jobRequisitionRepository.findById(jp.getJobRequisitionId()).ifPresent(jr -> {
                        extractSkillsFromJson(jr.getRequiredTechSkillsJson(), targetSkillNamesLower);
                        extractKeywordsFromText(jr.getRequirements(), targetSkillNamesLower);
                    });
                }
            }
        }

        if (resolvedDeptId == null) {
            resolvedDeptId = handoffService.findTechDepartmentId();
        }
        final Long finalDeptId = resolvedDeptId;

        List<User> candidates = userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> finalDeptId == null || finalDeptId.equals(u.getDepartmentId()))
                .filter(u -> u.getRole() == Role.NHAN_VIEN || u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                .toList();

        List<TechInterviewerSuggestion> suggestions = new ArrayList<>();
        for (User u : candidates) {
            List<UserTechSkill> skills = userTechSkillRepository.findByUserId(u.getId());
            boolean hasSeniorOrExpertSkill = skills.stream()
                    .anyMatch(s -> s.getProficiencyLevel() == ProficiencyLevel.SENIOR
                            || s.getProficiencyLevel() == ProficiencyLevel.EXPERT);
            boolean isActiveTechLead = techProjectMemberRepository.findByUserIdAndIsActiveTrue(u.getId()).stream()
                    .anyMatch(pm -> pm.getProjectRole() != null
                            && ("TECH_LEAD".equalsIgnoreCase(pm.getProjectRole().name())
                                || "LEAD".equalsIgnoreCase(pm.getProjectRole().name())));
            String lowerTitle = u.getChucVu() != null ? u.getChucVu().trim().toLowerCase() : "";
            boolean hasSeniorOrLeadTitle = lowerTitle.contains("senior")
                    || lowerTitle.contains("lead")
                    || lowerTitle.contains("architect")
                    || lowerTitle.contains("principal")
                    || lowerTitle.contains("staff")
                    || lowerTitle.contains("expert")
                    || lowerTitle.contains("chuyên gia");

            // Siết tiêu chuẩn thực tế: NHAN_VIEN chỉ được vào hội đồng nếu đạt chuẩn Senior / Expert / Tech Lead
            if (u.getRole() == Role.NHAN_VIEN && !hasSeniorOrExpertSkill && !isActiveTechLead && !hasSeniorOrLeadTitle) {
                continue;
            }

            List<UserTechSkill> seniorSkills = skills.stream()
                    .filter(s -> s.getProficiencyLevel() == ProficiencyLevel.SENIOR
                            || s.getProficiencyLevel() == ProficiencyLevel.EXPERT
                            || s.getProficiencyLevel() == ProficiencyLevel.MIDDLE)
                    .toList();

            List<String> matched = new ArrayList<>();
            double score = 50.0;
            if (isActiveTechLead) score += 6.0;

            for (UserTechSkill uts : seniorSkills) {
                String sName = uts.getSkill() != null ? uts.getSkill().getSkillName() : null;
                if (sName == null) continue;
                boolean isHit = targetSkillNamesLower.isEmpty() || targetSkillNamesLower.stream()
                        .anyMatch(kw -> sName.toLowerCase().contains(kw) || kw.contains(sName.toLowerCase()));
                if (isHit) {
                    matched.add(sName + " (" + uts.getProficiencyLevel().name() + ")");
                    if (uts.getProficiencyLevel() == ProficiencyLevel.EXPERT) score += 18.0;
                    else if (uts.getProficiencyLevel() == ProficiencyLevel.SENIOR) score += 14.0;
                    else score += 6.0;
                    if (Boolean.TRUE.equals(uts.getIsVerified())) score += 4.0;
                }
            }

            if (u.getRole() == Role.TRUONG_PHONG) score += 8.0;

            Integer allocObj = techProjectMemberRepository.getTotalActiveAllocationByUserId(u.getId());
            int alloc = allocObj != null ? allocObj : 0;
            int avail = Math.max(0, 100 - alloc);

            boolean onLeave = isUserOnApprovedLeave(u.getId(), targetDate);

            // Điều chỉnh điểm ưu tiên theo công suất tải thực tế & lịch nghỉ
            if (onLeave) {
                score -= 50.0;
            } else if (alloc > 100) {
                score -= 20.0;
            } else if (alloc >= 90) {
                score -= 10.0;
            } else if (alloc <= 70) {
                score += 12.0;
            }

            String availabilityBadge = onLeave ? "ON_LEAVE"
                    : alloc > 100 ? "OVERLOADED"
                    : alloc >= 85 ? "BUSY"
                    : "OPTIMAL";

            String reason;
            if (onLeave) {
                reason = "Đang có đơn nghỉ phép đã duyệt ngày " + targetDate + " — Không khuyến nghị mời.";
            } else if (!matched.isEmpty()) {
                reason = "Khớp " + matched.size() + " kỹ năng (" + String.join(", ", matched.stream().limit(3).toList())
                        + "), tải dự án hiện tại " + alloc + "% (còn trống " + avail + "%).";
            } else {
                reason = "Cán bộ kỹ thuật phòng Công nghệ, tải dự án hiện tại " + alloc + "% (còn trống " + avail + "%).";
            }

            boolean canLeadRound2 = u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN;
            suggestions.add(TechInterviewerSuggestion.builder()
                    .userId(u.getId())
                    .hoTen(u.getHoTen())
                    .email(u.getEmail())
                    .chucVu(u.getChucVu())
                    .role(u.getRole() != null ? u.getRole().name() : null)
                    .canLeadRound1(true)
                    .canLeadRound2(canLeadRound2)
                    .totalAllocation(alloc)
                    .availableCapacity(avail)
                    .onLeaveThatDay(onLeave)
                    .matchScore(Math.max(0, Math.min(100, Math.round(score * 10.0) / 10.0)))
                    .matchedSkills(matched.stream().limit(5).toList())
                    .recommendationReason(reason)
                    .availabilityBadge(availabilityBadge)
                    .build());
        }

        suggestions.sort(Comparator
                .comparing(TechInterviewerSuggestion::isOnLeaveThatDay)
                .thenComparing(Comparator.comparingDouble(TechInterviewerSuggestion::getMatchScore).reversed())
                .thenComparingInt(TechInterviewerSuggestion::getTotalAllocation));

        return suggestions.stream().limit(8).toList();
    }

    @Transactional(readOnly = true)
    public List<MyTechInterviewItem> getMyUpcomingTechInterviews(Long userId) {
        try {
            return jdbcTemplate.query("""
                    SELECT i.id AS interview_id,
                           i.application_id,
                           a.full_name AS candidate_name,
                           jp.title AS job_title,
                           i.round_number,
                           i.status,
                           i.scheduled_start,
                           i.scheduled_end,
                           i.interview_mode,
                           i.location,
                           i.meeting_url,
                           ip.participant_role,
                           ip.invitation_status,
                           EXISTS(
                               SELECT 1 FROM interview_feedbacks f
                               WHERE f.interview_id = i.id AND f.interviewer_id = ip.user_id
                           ) AS feedback_submitted,
                           (
                               SELECT COUNT(*)
                               FROM interview_participants p_req
                               WHERE p_req.interview_id = i.id
                                 AND p_req.feedback_required = b'1'
                           ) AS required_feedback_count,
                           (
                               SELECT COUNT(*)
                               FROM interview_participants p_done
                               JOIN interview_feedbacks f_done
                                 ON f_done.interview_id = p_done.interview_id
                                AND f_done.interviewer_id = p_done.user_id
                               WHERE p_done.interview_id = i.id
                                 AND p_done.feedback_required = b'1'
                                 AND p_done.invitation_status = 'ACCEPTED'
                           ) AS submitted_feedback_count,
                           (
                               SELECT GROUP_CONCAT(u_miss.ho_ten ORDER BY p_miss.id SEPARATOR ', ')
                               FROM interview_participants p_miss
                               JOIN users u_miss ON u_miss.id = p_miss.user_id
                               LEFT JOIN interview_feedbacks f_miss
                                 ON f_miss.interview_id = p_miss.interview_id
                                AND f_miss.interviewer_id = p_miss.user_id
                               WHERE p_miss.interview_id = i.id
                                 AND p_miss.feedback_required = b'1'
                                 AND (p_miss.invitation_status <> 'ACCEPTED' OR f_miss.id IS NULL)
                           ) AS pending_feedback_names
                    FROM interview_participants ip
                    JOIN interviews i ON i.id = ip.interview_id
                    JOIN applications a ON a.id = i.application_id
                    JOIN job_postings jp ON jp.id = a.job_posting_id
                    WHERE ip.user_id = ?
                      AND i.status IN ('SCHEDULED', 'DONE', 'COMPLETED')
                    ORDER BY i.scheduled_start DESC
                    LIMIT 10
                    """, (rs, rowNum) -> {
                        int reqCount = rs.getInt("required_feedback_count");
                        int doneCount = rs.getInt("submitted_feedback_count");
                        return MyTechInterviewItem.builder()
                                .interviewId(rs.getLong("interview_id"))
                                .applicationId(rs.getLong("application_id"))
                                .candidateName(rs.getString("candidate_name"))
                                .jobTitle(rs.getString("job_title"))
                                .roundNumber(rs.getInt("round_number"))
                                .status(rs.getString("status"))
                                .scheduledStart(toLocalDateTime(rs.getTimestamp("scheduled_start")))
                                .scheduledEnd(toLocalDateTime(rs.getTimestamp("scheduled_end")))
                                .interviewMode(rs.getString("interview_mode"))
                                .location(rs.getString("location"))
                                .meetingUrl(rs.getString("meeting_url"))
                                .participantRole(rs.getString("participant_role"))
                                .invitationStatus(rs.getString("invitation_status"))
                                .feedbackSubmitted(rs.getBoolean("feedback_submitted"))
                                .requiredFeedbackCount(reqCount)
                                .submittedFeedbackCount(doneCount)
                                .allRequiredFeedbackDone(reqCount > 0 && doneCount >= reqCount)
                                .pendingFeedbackNames(rs.getString("pending_feedback_names"))
                                .build();
                    }, userId);
        } catch (Exception e) {
            log.warn("[Tech-HR] Không thể truy vấn lịch phỏng vấn của user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    // =========================================================================
    // MODULE 3: BÀN GIAO PRE-BOARDING / DAY 1 & KHÉP VÒNG THỬ VIỆC 60 NGÀY
    // =========================================================================

    @EventListener
    @Transactional
    public void onPreboardingCreated(PreboardingCreatedEvent event) {
        if (!handoffService.isTechDepartment(event.departmentId())) {
            return;
        }
        try {
            // 1. Tự động chèn 2 mục checklist kỹ thuật cho Phòng Công nghệ phối hợp
            insertTechPreboardingItemIfMissing(
                    event.checklistId(),
                    "TECH_ENV_ACCESS",
                    "Cấp tài khoản Git, Jira, VPN & Môi trường Dev (Phòng Công nghệ)",
                    event.expectedStartDate() != null ? event.expectedStartDate().minusDays(1) : LocalDate.now()
            );
            insertTechPreboardingItemIfMissing(
                    event.checklistId(),
                    "TECH_BUDDY_ASSIGNED",
                    "Phân công Buddy / Mentor 1-1 đồng hành thử việc (Phòng Công nghệ)",
                    event.expectedStartDate() != null ? event.expectedStartDate() : LocalDate.now()
            );

            // 2. Tạo Handoff Task HR -> Tech
            Long hrDeptId = handoffService.findHrDepartmentId();
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("lifecycleEmployeeId", event.lifecycleEmployeeId());
            meta.put("fullName", event.fullName());
            meta.put("email", event.email());
            meta.put("positionTitle", event.positionTitle());
            meta.put("expectedStartDate", event.expectedStartDate() != null ? event.expectedStartDate().toString() : null);
            meta.put("probationMonths", event.probationMonths());

            handoffService.createTaskIfNotOpen(
                    CrossDeptTaskType.TECH_PREBOARDING_SETUP,
                    hrDeptId,
                    event.departmentId(),
                    null,
                    event.lifecycleEmployeeId(),
                    "LIFECYCLE_EMPLOYEE",
                    event.lifecycleEmployeeId(),
                    "Chuẩn bị Onboarding Kỹ thuật: " + event.fullName() + " (" + event.positionTitle() + ")",
                    "Phòng Nhân sự vừa kích hoạt Hợp đồng cho kỹ sư mới dự kiến nhận việc ngày "
                            + event.expectedStartDate() + ". Vui lòng cấp tài khoản Git/Jira/VPN và phân công Mentor 1-1.",
                    meta,
                    CrossDeptTaskPriority.HIGH,
                    event.expectedStartDate(),
                    null
            );
            log.info("[Tech-HR] Đã tạo checklist kỹ thuật & handoff pre-boarding cho lifecycle employee #{}", event.lifecycleEmployeeId());
        } catch (Exception e) {
            log.error("[Tech-HR] Lỗi xử lý PreboardingCreatedEvent #{}: {}", event.lifecycleEmployeeId(), e.getMessage());
        }
    }

    @EventListener
    @Transactional
    public void onEmployeeJoined(EmployeeJoinedEvent event) {
        if (!handoffService.isTechDepartment(event.departmentId())) {
            return;
        }
        try {
            // Chuyển probation_status PLANNED -> IN_PROGRESS khi kỹ sư bắt đầu đi làm
            if ("PLANNED".equalsIgnoreCase(event.probationStatus())) {
                jdbcTemplate.update(
                        "UPDATE employees SET probation_status = 'IN_PROGRESS' WHERE id = ? AND probation_status = 'PLANNED'",
                        event.lifecycleEmployeeId());
            }

            // Gửi thông báo realtime cho Trưởng phòng & Giám đốc Công nghệ đón kỹ sư mới vào Bench
            List<User> techManagers = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> event.departmentId().equals(u.getDepartmentId()))
                    .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                    .toList();

            for (User mgr : techManagers) {
                String prefix = mgr.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director" : "/manager";
                notificationService.createNotification(
                        mgr.getId(),
                        "TECH_NEW_JOINER",
                        "Kỹ sư mới đã nhận việc: " + event.fullName(),
                        "Phòng Nhân sự đã xác nhận " + event.fullName() + " nhận việc ngày " + event.joinDate()
                                + ". Hãy mở tab Công suất & Bench để phân bổ dự án và khởi tạo Kèm cặp 1-1.",
                        "THONG_TIN",
                        prefix + "/tech-projects?tab=bench"
                );
            }
            log.info("[Tech-HR] Đã đồng bộ Day 1 nhận việc cho kỹ sư {} (lifecycleId={})",
                    event.fullName(), event.lifecycleEmployeeId());
        } catch (Exception e) {
            log.error("[Tech-HR] Lỗi xử lý EmployeeJoinedEvent #{}: {}", event.lifecycleEmployeeId(), e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<TechPreboardingEngineer> getPreboardingAndProbationEngineers(Long actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người dùng ID: " + actorId));

        Long techDeptId = (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN || handoffService.isHrDepartment(actor.getDepartmentId()))
                ? handoffService.findTechDepartmentId()
                : actor.getDepartmentId();

        if (techDeptId == null) {
            return Collections.emptyList();
        }

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT e.id AS lifecycle_employee_id,
                           e.employee_code,
                           p.full_name,
                           p.email,
                           er.position_title,
                           er.level_name,
                           e.status,
                           e.probation_status,
                           e.start_date_planned,
                           e.join_date,
                           acr.user_id,
                           jr.tech_project_id,
                           tp.project_code AS origin_project_code
                    FROM employees e
                    JOIN persons p ON p.id = e.person_id
                    LEFT JOIN employment_records er ON er.employee_id = e.id AND er.record_status IN ('SCHEDULED', 'CURRENT')
                    LEFT JOIN account_creation_requests acr ON acr.employee_id = e.id
                    LEFT JOIN hiring_seats hs ON hs.id = e.seat_id
                    LEFT JOIN job_requisitions jr ON jr.id = hs.requisition_id
                    LEFT JOIN tech_projects tp ON tp.id = jr.tech_project_id
                    WHERE er.department_id = ?
                      AND (e.status = 'PRE_BOARDING' OR (e.status = 'EMPLOYED' AND e.probation_status IN ('PLANNED', 'IN_PROGRESS')))
                    ORDER BY FIELD(e.status, 'PRE_BOARDING', 'EMPLOYED'), e.start_date_planned ASC
                    """, techDeptId);

            List<TechPreboardingEngineer> result = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                Long empId = ((Number) r.get("lifecycle_employee_id")).longValue();
                List<TechChecklistItem> items = jdbcTemplate.query("""
                        SELECT pi.id, pi.item_code, pi.label, pi.status, pi.due_date, pi.completed_at
                        FROM preboarding_items pi
                        JOIN preboarding_checklists pc ON pc.id = pi.checklist_id
                        WHERE pc.employee_id = ? AND pi.item_code LIKE 'TECH_%'
                        ORDER BY pi.id
                        """, (rs, idx) -> TechChecklistItem.builder()
                        .itemId(rs.getLong("id"))
                        .itemCode(rs.getString("item_code"))
                        .label(rs.getString("label"))
                        .status(rs.getString("status"))
                        .dueDate(rs.getObject("due_date", LocalDate.class))
                        .completedAt(toLocalDateTime(rs.getTimestamp("completed_at")))
                        .build(), empId);

                result.add(TechPreboardingEngineer.builder()
                        .lifecycleEmployeeId(empId)
                        .userId(r.get("user_id") != null ? ((Number) r.get("user_id")).longValue() : null)
                        .employeeCode((String) r.get("employee_code"))
                        .fullName((String) r.get("full_name"))
                        .email((String) r.get("email"))
                        .positionTitle((String) r.get("position_title"))
                        .levelName((String) r.get("level_name"))
                        .status((String) r.get("status"))
                        .probationStatus((String) r.get("probation_status"))
                        .startDatePlanned(r.get("start_date_planned") instanceof Date d ? d.toLocalDate() : null)
                        .joinDate(r.get("join_date") instanceof Date d ? d.toLocalDate() : null)
                        .originTechProjectId(r.get("tech_project_id") != null ? ((Number) r.get("tech_project_id")).longValue() : null)
                        .originTechProjectCode((String) r.get("origin_project_code"))
                        .techChecklistItems(items)
                        .build());
            }
            return result;
        } catch (Exception e) {
            log.warn("[Tech-HR] Lỗi tải danh sách Pre-boarding/Thử việc: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    @Transactional
    public void completeTechPreboardingItem(Long lifecycleEmployeeId, Long itemId, Long actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người dùng!"));
        if (actor.getRole() != Role.TRUONG_PHONG && actor.getRole() != Role.GIAM_DOC_PHONG_BAN && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc Công nghệ mới có quyền xác nhận mục checklist kỹ thuật!");
        }

        LocalDateTime nowVn = LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));
        int updated = jdbcTemplate.update("""
                UPDATE preboarding_items pi
                JOIN preboarding_checklists pc ON pc.id = pi.checklist_id
                SET pi.status = 'COMPLETED', pi.completed_by = ?, pi.completed_at = ?
                WHERE pi.id = ? AND pc.employee_id = ? AND pi.item_code LIKE 'TECH_%' AND pi.status = 'PENDING'
                """, actorId, nowVn, itemId, lifecycleEmployeeId);
        if (updated == 0) {
            throw AppException.conflict("Mục checklist kỹ thuật không tồn tại hoặc đã hoàn tất!");
        }

        // Nếu toàn bộ các mục bắt buộc đã xong -> cập nhật checklist tổng
        jdbcTemplate.update("""
                UPDATE preboarding_checklists pc
                SET pc.status = 'COMPLETED', pc.completed_at = ?
                WHERE pc.employee_id = ? AND NOT EXISTS (
                    SELECT 1 FROM preboarding_items pi
                    WHERE pi.checklist_id = pc.id AND pi.required_item = b'1' AND pi.status = 'PENDING')
                """, nowVn, lifecycleEmployeeId);

        // Nếu toàn bộ các mục TECH_* đã xong -> tự hoàn tất Handoff Task TECH_PREBOARDING_SETUP
        Integer pendingTech = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM preboarding_items pi
                JOIN preboarding_checklists pc ON pc.id = pi.checklist_id
                WHERE pc.employee_id = ? AND pi.item_code LIKE 'TECH_%' AND pi.status = 'PENDING'
                """, Integer.class, lifecycleEmployeeId);
        if (pendingTech != null && pendingTech == 0) {
            handoffTaskRepository.findFirstByTaskTypeAndReferenceTypeAndReferenceIdAndStatusIn(
                    CrossDeptTaskType.TECH_PREBOARDING_SETUP, "LIFECYCLE_EMPLOYEE", lifecycleEmployeeId,
                    List.of(CrossDeptTaskStatus.OPEN, CrossDeptTaskStatus.IN_PROGRESS)
            ).ifPresent(task -> {
                task.setStatus(CrossDeptTaskStatus.COMPLETED);
                task.setCompletedBy(actorId);
                task.setCompletedAt(nowVn);
                task.setResolutionNote("Phòng Công nghệ đã hoàn tất cấp môi trường & phân công Mentor.");
                handoffTaskRepository.save(task);
            });
        }

        try {
            notificationService.broadcastTopic("/topic/recruitment-updates", Map.of(
                    "entityType", "LIFECYCLE_CHECKLIST",
                    "entityId", lifecycleEmployeeId,
                    "action", "TECH_CHECKLIST_COMPLETED",
                    "timestamp", System.currentTimeMillis()
            ));
        } catch (Exception ignored) {
        }
    }

    @EventListener
    @Transactional
    public void onProbationReviewApproved(ProbationReviewApprovedEvent event) {
        try {
            Long lifecycleEmployeeId = findLifecycleEmployeeIdByUserOrEmail(event.employeeUserId(), event.employeeEmail());
            String newProbationStatus = event.probationPassed() ? "PASSED" : "FAILED";

            if (lifecycleEmployeeId != null) {
                jdbcTemplate.update(
                        "UPDATE employees SET probation_status = ?, row_version = row_version + 1 WHERE id = ?",
                        newProbationStatus, lifecycleEmployeeId);

                String lcEventType = event.probationPassed() ? "PROBATION_PASSED" : "PROBATION_FAILED";
                String lcSummary = (event.probationPassed() ? "Đạt thử việc Phòng Công nghệ" : "Không đạt thử việc Phòng Công nghệ")
                        + " — Điểm: " + event.finalScore() + " (" + event.finalGrade() + ")";
                jdbcTemplate.update("""
                        INSERT INTO lifecycle_events(subject_type, subject_id, event_type, actor_id, ref_type, ref_id, summary, idempotency_key)
                        VALUES ('EMPLOYEE', ?, ?, ?, 'TECH_REVIEW', ?, ?, ?)
                        """, lifecycleEmployeeId, lcEventType, event.actorId(), event.reviewId(),
                        lcSummary, "probation-review:" + event.reviewId());
            }

            employeeHistoryService.logHistory(
                    event.employeeUserId(),
                    event.probationPassed() ? "PROBATION_PASSED" : "PROBATION_FAILED",
                    "Đang thử việc",
                    event.probationPassed() ? "Đạt thử việc" : "Không đạt thử việc",
                    "Kết quả đánh giá thử việc Phòng Công nghệ (Điểm " + event.finalScore() + " - Hạng " + event.finalGrade() + "): "
                            + (event.summaryNote() != null ? event.summaryNote() : "")
            );

            Long hrDeptId = handoffService.findHrDepartmentId();
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("reviewId", event.reviewId());
            meta.put("finalScore", event.finalScore());
            meta.put("finalGrade", event.finalGrade());
            meta.put("probationPassed", event.probationPassed());
            meta.put("lifecycleEmployeeId", lifecycleEmployeeId);

            CrossDeptTaskType taskType = event.probationPassed()
                    ? CrossDeptTaskType.PROBATION_OFFICIAL_CONTRACT
                    : CrossDeptTaskType.PROBATION_TERMINATION_REVIEW;
            String title = event.probationPassed()
                    ? "Đạt thử việc — Lập Hợp đồng Chính thức: " + event.employeeName()
                    : "Không đạt thử việc — Xử lý kết thúc thử việc: " + event.employeeName();
            String summary = "Phòng Công nghệ đã duyệt phiếu Đánh giá Thử việc cho " + event.employeeName()
                    + " (Điểm: " + event.finalScore() + " — Hạng " + event.finalGrade() + "). "
                    + (event.probationPassed()
                    ? "Đề nghị Phòng Nhân sự ban hành Hợp đồng Lao động chính thức."
                    : "Đề nghị Phòng Nhân sự phối hợp xử lý thủ tục kết thúc thử việc.");

            handoffService.createTaskIfNotOpen(
                    taskType,
                    event.departmentId(),
                    hrDeptId,
                    event.employeeUserId(),
                    lifecycleEmployeeId,
                    "TECH_REVIEW",
                    event.reviewId(),
                    title,
                    summary,
                    meta,
                    event.probationPassed() ? CrossDeptTaskPriority.HIGH : CrossDeptTaskPriority.URGENT,
                    LocalDate.now().plusDays(5),
                    event.actorId()
            );
            log.info("[Tech-HR] Đã khép vòng Thử việc ({}) cho {} -> Handoff sang HR",
                    newProbationStatus, event.employeeName());
        } catch (Exception e) {
            log.error("[Tech-HR] Lỗi xử lý ProbationReviewApprovedEvent review #{}: {}", event.reviewId(), e.getMessage());
        }
    }

    // =========================================================================
    // MODULE 4: ĐỒNG BỘ THĂNG CHỨC & C&B SANG HỒ SƠ HR & PHỤ LỤC HỢP ĐỒNG
    // =========================================================================

    @EventListener
    @Transactional
    public void onCareerCompensationApproved(CareerCompensationApprovedEvent event) {
        if (!event.titleChanged() && !event.salaryChanged()) {
            return;
        }
        try {
            Long lifecycleEmployeeId = findLifecycleEmployeeIdByUserOrEmail(event.employeeUserId(), event.employeeEmail());

            // 1. Đồng bộ employment_records & compensation_records bên module HR Lifecycle (nếu có hồ sơ)
            if (lifecycleEmployeeId != null) {
                if (event.titleChanged() && event.newTitle() != null) {
                    jdbcTemplate.update(
                            "UPDATE employment_records SET record_status = 'SUPERSEDED', effective_to = CURDATE() WHERE employee_id = ? AND record_status = 'CURRENT'",
                            lifecycleEmployeeId);
                    jdbcTemplate.update("""
                            INSERT INTO employment_records(employee_id, department_id, position_title, level_name, effective_from, record_status)
                            VALUES (?, ?, ?, ?, CURDATE(), 'CURRENT')
                            """, lifecycleEmployeeId, event.departmentId(), event.newTitle(), event.newTitle());
                }
                if (event.salaryChanged() && event.newBaseSalary() != null) {
                    jdbcTemplate.update(
                            "UPDATE compensation_records SET record_status = 'SUPERSEDED', effective_to = CURDATE() WHERE employee_id = ? AND record_status = 'CURRENT'",
                            lifecycleEmployeeId);
                    String allowancesJson = "{\"allowance\":" + (event.newAllowance() != null ? event.newAllowance() : 0) + "}";
                    jdbcTemplate.update("""
                            INSERT INTO compensation_records(employee_id, salary_type, base_salary, allowances_json, effective_from, record_status)
                            VALUES (?, 'OFFICIAL', ?, CAST(? AS JSON), CURDATE(), 'CURRENT')
                            """, lifecycleEmployeeId, BigDecimal.valueOf(event.newBaseSalary()), allowancesJson);
                }
            }

            // 2. Tạo Handoff Task lập Phụ lục Hợp đồng gửi Phòng Nhân sự (tuân thủ che lương B-10 khi đọc lại)
            Long hrDeptId = handoffService.findHrDepartmentId();
            List<String> changeParts = new ArrayList<>();
            if (event.titleChanged()) {
                changeParts.add("Thăng chức danh: " + (event.oldTitle() != null ? event.oldTitle() : "Hiện tại")
                        + " → " + event.newTitle());
            }
            if (event.salaryChanged()) {
                changeParts.add("Điều chỉnh đãi ngộ C&B (chi tiết theo quy định B-10)");
            }

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("reviewId", event.reviewId());
            meta.put("periodLabel", event.periodLabel());
            meta.put("titleChanged", event.titleChanged());
            meta.put("oldTitle", event.oldTitle());
            meta.put("newTitle", event.newTitle());
            meta.put("salaryChanged", event.salaryChanged());
            if (event.salaryChanged()) {
                meta.put("oldBaseSalary", event.oldBaseSalary());
                meta.put("newBaseSalary", event.newBaseSalary());
                meta.put("oldAllowance", event.oldAllowance());
                meta.put("newAllowance", event.newAllowance());
            }

            handoffService.createTaskIfNotOpen(
                    CrossDeptTaskType.CONTRACT_ADDENDUM_REQUIRED,
                    event.departmentId(),
                    hrDeptId,
                    event.employeeUserId(),
                    lifecycleEmployeeId,
                    "TECH_REVIEW_CB",
                    event.reviewId(),
                    "Lập Phụ lục Hợp đồng & Quyết định: " + event.employeeName(),
                    "Kết quả đánh giá kỳ " + event.periodLabel() + " đã được phê duyệt ("
                            + String.join("; ", changeParts) + "). Đề nghị Phòng Nhân sự ban hành Quyết định & Phụ lục Hợp đồng.",
                    meta,
                    CrossDeptTaskPriority.HIGH,
                    LocalDate.now().plusDays(5),
                    event.actorId()
            );
            log.info("[Tech-HR] Đã đồng bộ hồ sơ & tạo tác vụ lập Phụ lục HĐ cho {}", event.employeeName());
        } catch (Exception e) {
            log.error("[Tech-HR] Lỗi xử lý CareerCompensationApprovedEvent review #{}: {}", event.reviewId(), e.getMessage());
        }
    }

    // =========================================================================
    // MODULE 5: CẢNH BÁO RỦI RO NGHỈ PHÉP DÀI NGÀY & BÀN GIAO NGHỈ VIỆC (OFFBOARDING)
    // =========================================================================

    @Transactional(readOnly = true)
    public TechLeaveImpactResponse checkLeaveProjectImpact(Long userId, LocalDate startDate, LocalDate endDate) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự ID: " + userId));

        boolean isTech = handoffService.isTechDepartment(user.getDepartmentId());
        long leaveDays = (startDate != null && endDate != null && !endDate.isBefore(startDate))
                ? ChronoUnit.DAYS.between(startDate, endDate) + 1 : 0;

        if (!isTech) {
            return TechLeaveImpactResponse.builder()
                    .userId(userId)
                    .employeeName(user.getHoTen())
                    .isTechEngineer(false)
                    .leaveDays(leaveDays)
                    .riskLevel("NONE")
                    .affectedProjectNames(Collections.emptyList())
                    .affectedMilestoneAlerts(Collections.emptyList())
                    .summaryMessage("Nhân sự không thuộc Phòng Công nghệ.")
                    .build();
        }

        List<TechProjectMember> memberships = techProjectMemberRepository.findActiveMembershipsWithProject(userId);
        boolean isTechLead = memberships.stream().anyMatch(m -> m.getProjectRole() == ProjectRole.TECH_LEAD);
        List<String> projectNames = memberships.stream()
                .map(m -> m.getProject().getProjectCode() + " - " + m.getProject().getProjectName()
                        + " (" + m.getProjectRole().name() + ", " + m.getAllocationPercent() + "%)")
                .toList();

        List<String> milestoneAlerts = new ArrayList<>();
        if (startDate != null && endDate != null) {
            for (TechProjectMember m : memberships) {
                List<TechProjectMilestone> milestones = techProjectMilestoneRepository
                        .findByProjectIdOrderByDueDateAscIdAsc(m.getProject().getId());
                for (TechProjectMilestone ms : milestones) {
                    if (ms.getStatus() != MilestoneStatus.COMPLETED && ms.getDueDate() != null
                            && !ms.getDueDate().isBefore(startDate) && !ms.getDueDate().isAfter(endDate.plusDays(3))) {
                        milestoneAlerts.add(m.getProject().getProjectCode() + ": Mốc '" + ms.getTitle()
                                + "' đến hạn " + ms.getDueDate());
                    }
                }
            }
        }

        int activeMentorships = techMentorshipProgramRepository
                .findByMentorIdAndStatus(userId, TechMentorshipStatus.ACTIVE).size();

        String riskLevel;
        if (memberships.isEmpty() && activeMentorships == 0) {
            riskLevel = "NONE";
        } else if (leaveDays >= 3 && (isTechLead || !milestoneAlerts.isEmpty())) {
            riskLevel = "HIGH";
        } else if (leaveDays >= 3 || !milestoneAlerts.isEmpty()) {
            riskLevel = "MEDIUM";
        } else {
            riskLevel = "LOW";
        }

        String summaryMsg = riskLevel.equals("NONE")
                ? "Không phát hiện rủi ro dự án kỹ thuật trong khoảng thời gian nghỉ."
                : "Nghỉ " + leaveDays + " ngày — đang tham gia " + memberships.size() + " dự án"
                + (isTechLead ? " (giữ vai trò TECH_LEAD)" : "")
                + (!milestoneAlerts.isEmpty() ? ", trùng hạn " + milestoneAlerts.size() + " mốc bàn giao" : "")
                + (activeMentorships > 0 ? ", đang kèm cặp " + activeMentorships + " mentee" : "") + ".";

        return TechLeaveImpactResponse.builder()
                .userId(userId)
                .employeeName(user.getHoTen())
                .isTechEngineer(true)
                .leaveDays(leaveDays)
                .riskLevel(riskLevel)
                .isTechLeadAnywhere(isTechLead)
                .activeProjectsCount(memberships.size())
                .affectedMilestonesCount(milestoneAlerts.size())
                .activeMentorshipsCount(activeMentorships)
                .affectedProjectNames(projectNames)
                .affectedMilestoneAlerts(milestoneAlerts)
                .summaryMessage(summaryMsg)
                .build();
    }

    @EventListener
    @Transactional
    public void onLongLeaveApproved(LongLeaveApprovedEvent event) {
        if (event.leaveDays() < 3 || !handoffService.isTechDepartment(event.departmentId())) {
            return;
        }
        try {
            TechLeaveImpactResponse impact = checkLeaveProjectImpact(
                    event.employeeUserId(), event.startDate(), event.endDate());
            if ("NONE".equals(impact.getRiskLevel())) {
                return;
            }

            List<User> techManagers = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> event.departmentId().equals(u.getDepartmentId()))
                    .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                    .toList();

            String mucDo = "HIGH".equals(impact.getRiskLevel()) ? "CANH_BAO" : "THONG_TIN";
            for (User mgr : techManagers) {
                String prefix = mgr.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director" : "/manager";
                notificationService.createNotification(
                        mgr.getId(),
                        "TECH_LEAVE_IMPACT",
                        "Cảnh báo nghỉ dài ngày: " + event.employeeName() + " (" + event.leaveDays() + " ngày)",
                        impact.getSummaryMessage() + " Vui lòng bố trí kỹ sư backup cho các hạng mục trọng yếu.",
                        mucDo,
                        prefix + "/tech-projects?tab=bench"
                );
            }
            log.info("[Tech-HR] Đã gửi cảnh báo tác động nghỉ dài ngày cho kỹ sư {} (risk={})",
                    event.employeeName(), impact.getRiskLevel());
        } catch (Exception e) {
            log.error("[Tech-HR] Lỗi xử lý LongLeaveApprovedEvent #{}: {}", event.requestId(), e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public TechOffboardingImpactResponse getOffboardingTechImpact(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự ID: " + userId));

        List<TechProjectMember> activeMemberships = techProjectMemberRepository.findActiveMembershipsWithProject(userId);
        int techLeadCount = (int) activeMemberships.stream()
                .filter(m -> m.getProjectRole() == ProjectRole.TECH_LEAD).count();
        List<String> projectDetails = activeMemberships.stream()
                .map(m -> m.getProject().getProjectCode() + " - " + m.getProject().getProjectName()
                        + " [" + m.getProjectRole().name() + " • " + m.getAllocationPercent() + "%]")
                .toList();

        List<TechMentorshipProgram> activeMentorships = new ArrayList<>();
        activeMentorships.addAll(techMentorshipProgramRepository.findByMentorIdAndStatus(userId, TechMentorshipStatus.ACTIVE));
        activeMentorships.addAll(techMentorshipProgramRepository.findByMenteeIdAndStatus(userId, TechMentorshipStatus.ACTIVE));
        List<String> mentorshipDetails = activeMentorships.stream()
                .map(p -> p.getProgramTitle() + (userId.equals(p.getMentorId()) ? " (Vai trò: Mentor)" : " (Vai trò: Mentee)"))
                .toList();

        List<TechProjectEnvironment> ownedEnvs = techProjectEnvironmentRepository.findByOwnerId(userId);
        List<String> envDetails = ownedEnvs.stream()
                .map(e -> e.getEnvName() + " - " + e.getDisplayName()
                        + (e.getProject() != null ? " (" + e.getProject().getProjectCode() + ")" : ""))
                .toList();

        int pendingWorklogs = techWorklogRepository
                .findMyWorklogsWithFilters(userId, null, WorklogApprovalStatus.PENDING, null, null).size();

        boolean hasBlockers = !activeMemberships.isEmpty() || !activeMentorships.isEmpty()
                || !ownedEnvs.isEmpty() || pendingWorklogs > 0;

        String riskLevel;
        if (techLeadCount > 0 || !ownedEnvs.isEmpty()) riskLevel = "CRITICAL";
        else if (!activeMemberships.isEmpty() || !activeMentorships.isEmpty()) riskLevel = "HIGH";
        else if (pendingWorklogs > 0) riskLevel = "MEDIUM";
        else riskLevel = "NONE";

        Optional<CrossDeptHandoffTask> existingTask = handoffTaskRepository
                .findByEmployeeUserIdAndStatusIn(userId, List.of(CrossDeptTaskStatus.OPEN, CrossDeptTaskStatus.IN_PROGRESS))
                .stream()
                .filter(t -> t.getTaskType() == CrossDeptTaskType.TECH_OFFBOARDING_HANDOVER)
                .findFirst();

        return TechOffboardingImpactResponse.builder()
                .userId(user.getId())
                .hoTen(user.getHoTen())
                .email(user.getEmail())
                .chucVu(user.getChucVu())
                .hasBlockers(hasBlockers)
                .riskLevel(riskLevel)
                .activeProjectsCount(activeMemberships.size())
                .techLeadProjectsCount(techLeadCount)
                .activeMentorshipsCount(activeMentorships.size())
                .ownedEnvironmentsCount(ownedEnvs.size())
                .pendingWorklogsCount(pendingWorklogs)
                .projectDetails(projectDetails)
                .mentorshipDetails(mentorshipDetails)
                .environmentDetails(envDetails)
                .openHandoverTaskExists(existingTask.isPresent())
                .existingHandoverTaskId(existingTask.map(CrossDeptHandoffTask::getId).orElse(null))
                .build();
    }

    @Transactional
    public CrossDeptHandoffTaskResponse triggerTechOffboardingHandover(
            Long userId, TriggerOffboardingRequest req, Long actorId) {

        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người thực hiện!"));
        if (actor.getRole() == Role.NHAN_VIEN || actor.getRole() == Role.CEO) {
            throw AppException.forbidden("Chỉ Trưởng phòng, Giám đốc phòng ban hoặc Admin mới có quyền khởi tạo bàn giao kỹ thuật!");
        }

        LocalDate todayVn = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        if (req == null || req.getLastWorkingDate() == null) {
            throw AppException.badRequest("Vui lòng chọn ngày dự kiến rời đi / chuyển phòng.");
        }
        LocalDate dueDate = req.getLastWorkingDate();
        if (dueDate.isBefore(todayVn)) {
            throw AppException.badRequest("Ngày dự kiến rời đi / chuyển phòng không được nằm trong quá khứ.");
        }
        if (dueDate.isAfter(todayVn.plusYears(1))) {
            throw AppException.badRequest("Ngày dự kiến rời đi / chuyển phòng không được vượt quá 1 năm kể từ hôm nay.");
        }

        String trimmedReason = req.getReason() != null ? req.getReason().trim() : "";
        if (trimmedReason.isEmpty()) {
            throw AppException.badRequest("Vui lòng nhập lý do bàn giao.");
        }
        if (trimmedReason.length() < 5) {
            throw AppException.badRequest("Lý do bàn giao phải có ít nhất 5 ký tự.");
        }
        if (trimmedReason.length() > 500) {
            throw AppException.badRequest("Lý do bàn giao không được vượt quá 500 ký tự.");
        }

        TechOffboardingImpactResponse impact = getOffboardingTechImpact(userId);
        User employee = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ sư ID: " + userId));

        Long targetTechDeptId = handoffService.isTechDepartment(employee.getDepartmentId())
                ? employee.getDepartmentId()
                : handoffService.findTechDepartmentId();
        Long sourceDeptId = actor.getDepartmentId() != null ? actor.getDepartmentId() : handoffService.findHrDepartmentId();

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("riskLevel", impact.getRiskLevel());
        meta.put("activeProjectsCount", impact.getActiveProjectsCount());
        meta.put("techLeadProjectsCount", impact.getTechLeadProjectsCount());
        meta.put("activeMentorshipsCount", impact.getActiveMentorshipsCount());
        meta.put("ownedEnvironmentsCount", impact.getOwnedEnvironmentsCount());
        meta.put("pendingWorklogsCount", impact.getPendingWorklogsCount());
        meta.put("projectDetails", impact.getProjectDetails());
        meta.put("mentorshipDetails", impact.getMentorshipDetails());
        meta.put("environmentDetails", impact.getEnvironmentDetails());
        meta.put("reason", trimmedReason);

        String summary = "Cần bàn giao kỹ thuật trước khi nghỉ việc/điều chuyển cho " + employee.getHoTen()
                + ": " + impact.getActiveProjectsCount() + " dự án active"
                + (impact.getTechLeadProjectsCount() > 0 ? " (" + impact.getTechLeadProjectsCount() + " vai trò TECH_LEAD)" : "")
                + ", " + impact.getActiveMentorshipsCount() + " kèm cặp 1-1, "
                + impact.getOwnedEnvironmentsCount() + " môi trường server, "
                + impact.getPendingWorklogsCount() + " giờ công chờ duyệt."
                + " Lý do: " + trimmedReason;

        CrossDeptTaskPriority priority = ("CRITICAL".equals(impact.getRiskLevel()) || "HIGH".equals(impact.getRiskLevel()))
                ? CrossDeptTaskPriority.URGENT
                : CrossDeptTaskPriority.HIGH;

        CrossDeptHandoffTask created = handoffService.createTaskIfNotOpen(
                CrossDeptTaskType.TECH_OFFBOARDING_HANDOVER,
                sourceDeptId,
                targetTechDeptId,
                employee.getId(),
                findLifecycleEmployeeIdByUserOrEmail(employee.getId(), employee.getEmail()),
                "OFFBOARDING_USER",
                employee.getId(),
                "Bàn giao Kỹ thuật Nghỉ việc / Điều chuyển: " + employee.getHoTen(),
                summary,
                meta,
                priority,
                dueDate,
                actorId
        );

        return handoffService.getTasksForActor(actorId, "ALL", "ALL").stream()
                .filter(t -> t.getId().equals(created.getId()))
                .findFirst()
                .orElse(CrossDeptHandoffTaskResponse.builder()
                        .id(created.getId())
                        .taskType(created.getTaskType().name())
                        .title(created.getTitle())
                        .summary(created.getSummary())
                        .status(created.getStatus().name())
                        .priority(created.getPriority().name())
                        .dueDate(created.getDueDate())
                        .build());
    }

    @Transactional(readOnly = true)
    public TechOffboardingImpactResponse getOffboardingImpactByLifecycleId(Long lifecycleEmployeeId) {
        Long userId = findUserIdByLifecycleEmployeeId(lifecycleEmployeeId);
        if (userId == null) {
            throw AppException.notFound("Nhân viên vòng đời #" + lifecycleEmployeeId + " chưa có tài khoản người dùng hệ thống để kiểm tra dự án kỹ thuật");
        }
        return getOffboardingTechImpact(userId);
    }

    private Long findUserIdByLifecycleEmployeeId(Long lifecycleEmployeeId) {
        if (lifecycleEmployeeId == null) return null;
        try {
            List<Long> byAcr = jdbcTemplate.query(
                    "SELECT user_id FROM account_creation_requests WHERE employee_id = ? AND user_id IS NOT NULL ORDER BY id DESC LIMIT 1",
                    (rs, row) -> rs.getLong(1), lifecycleEmployeeId);
            if (!byAcr.isEmpty()) return byAcr.get(0);

            List<String> emails = jdbcTemplate.query("""
                    SELECT p.email FROM employees e
                    JOIN persons p ON p.id = e.person_id
                    WHERE e.id = ?
                    """, (rs, row) -> rs.getString(1), lifecycleEmployeeId);
            if (!emails.isEmpty() && emails.get(0) != null && !emails.get(0).isBlank()) {
                return userRepository.findByEmail(emails.get(0).trim()).map(User::getId).orElse(null);
            }
        } catch (Exception e) {
            log.debug("[Tech-HR] Không tìm thấy userId cho lifecycleEmployeeId={}: {}", lifecycleEmployeeId, e.getMessage());
        }
        return null;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private void insertTechPreboardingItemIfMissing(Long checklistId, String itemCode, String label, LocalDate dueDate) {
        Integer exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM preboarding_items WHERE checklist_id = ? AND item_code = ?",
                Integer.class, checklistId, itemCode);
        if (exists == null || exists == 0) {
            jdbcTemplate.update("""
                    INSERT INTO preboarding_items(checklist_id, item_code, label, required_item, status, due_date)
                    VALUES (?, ?, ?, b'1', 'PENDING', ?)
                    """, checklistId, itemCode, label, Date.valueOf(dueDate));
        }
    }

    private Long findLifecycleEmployeeIdByUserOrEmail(Long userId, String email) {
        try {
            if (userId != null) {
                List<Long> byUser = jdbcTemplate.query(
                        "SELECT employee_id FROM account_creation_requests WHERE user_id = ? AND employee_id IS NOT NULL ORDER BY id DESC LIMIT 1",
                        (rs, row) -> rs.getLong(1), userId);
                if (!byUser.isEmpty()) return byUser.get(0);
            }
            if (email != null && !email.isBlank()) {
                List<Long> byEmail = jdbcTemplate.query("""
                        SELECT e.id FROM employees e
                        JOIN persons p ON p.id = e.person_id
                        WHERE LOWER(p.email) = LOWER(?)
                        ORDER BY e.id DESC LIMIT 1
                        """, (rs, row) -> rs.getLong(1), email.trim());
                if (!byEmail.isEmpty()) return byEmail.get(0);
            }
        } catch (Exception e) {
            log.debug("[Tech-HR] Không tìm thấy lifecycle employee cho userId={}: {}", userId, e.getMessage());
        }
        return null;
    }

    private int countActiveApplicationsForRequisition(Long requisitionId) {
        try {
            List<JobPosting> postings = jobPostingRepository.findAll().stream()
                    .filter(jp -> requisitionId.equals(jp.getJobRequisitionId()))
                    .toList();
            int count = 0;
            for (JobPosting jp : postings) {
                count += (int) applicationRepository.countByJobPostingId(jp.getId());
            }
            return count;
        } catch (Exception e) {
            return 0;
        }
    }

    private boolean isUserOnApprovedLeave(Long userId, LocalDate date) {
        try {
            List<EmployeeRequest> reqs = employeeRequestRepository.findByUserIdOrderByCreatedAtDesc(userId);
            return reqs.stream()
                    .filter(r -> r.getStatus() == RequestStatus.APPROVED)
                    .filter(r -> r.getRequestType() != RequestType.OVERTIME && r.getRequestType() != RequestType.SPECIAL_WFH_LEAVE)
                    .anyMatch(r -> r.getStartDate() != null && r.getEndDate() != null
                            && !date.isBefore(r.getStartDate()) && !date.isAfter(r.getEndDate()));
        } catch (Exception e) {
            return false;
        }
    }

    private void extractKeywordsFromText(String text, Set<String> out) {
        if (text == null || text.isBlank()) return;
        String[] tokens = text.toLowerCase().split("[,;/\\n•\\-()]+");
        for (String tok : tokens) {
            String trimmed = tok.trim();
            if (trimmed.length() >= 2 && trimmed.length() <= 40) {
                out.add(trimmed);
            }
        }
    }

    private void extractSkillsFromJson(String skillsJson, Set<String> out) {
        if (skillsJson == null || skillsJson.isBlank()) return;
        try {
            JsonNode arr = objectMapper.readTree(skillsJson);
            if (arr.isArray()) {
                for (JsonNode item : arr) {
                    JsonNode name = item.get("skillName");
                    if (name != null && !name.asText().isBlank()) {
                        out.add(name.asText().trim().toLowerCase());
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void notifyHrAboutTechRequisition(JobRequisition jr, User actor, TechProject project) {
        try {
            Long hrDeptId = handoffService.findHrDepartmentId();
            if (hrDeptId == null) return;
            List<User> hrManagers = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> hrDeptId.equals(u.getDepartmentId()))
                    .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                    .toList();

            String projSuffix = project != null ? " cho dự án " + project.getProjectCode() : "";
            for (User hr : hrManagers) {
                String prefix = hr.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director" : "/manager";
                notificationService.createNotification(
                        hr.getId(),
                        "TECH_HIRING_REQUEST",
                        "Yêu cầu tuyển dụng từ Phòng Công nghệ: " + jr.getTitle(),
                        actor.getHoTen() + " vừa gửi đề xuất tuyển " + jr.getSoLuong() + " " + jr.getTitle()
                                + " (" + jr.getCapBac() + ")" + projSuffix + " [Độ gấp: " + jr.getUrgencyLevel() + "].",
                        "CRITICAL".equals(jr.getUrgencyLevel()) ? "CANH_BAO" : "THONG_TIN",
                        prefix + "/recruitment/requisitions"
                );
            }
        } catch (Exception e) {
            log.warn("[Tech-HR] Lỗi gửi thông báo tuyển dụng tới HR: {}", e.getMessage());
        }
    }

    private String normalizeUrgency(String urgency) {
        if (urgency == null || urgency.isBlank()) return "NORMAL";
        String upper = urgency.trim().toUpperCase();
        return List.of("NORMAL", "HIGH", "CRITICAL").contains(upper) ? upper : "NORMAL";
    }

    private LocalDateTime toLocalDateTime(Timestamp ts) {
        return ts != null ? ts.toLocalDateTime() : null;
    }
}
