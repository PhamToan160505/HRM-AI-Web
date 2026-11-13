package com.hrm.tech;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.ai.service.GeminiClientService;
import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.SalaryHistory;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.payroll.repository.SalaryHistoryRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.tech.controller.TechPerformanceController;
import com.hrm.tech.controller.TechSkillController;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import com.hrm.tech.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import reactor.core.publisher.Mono;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TechPerformanceCareerTest {

    private final TechEvaluationCycleRepository cycleRepository = mock(TechEvaluationCycleRepository.class);
    private final TechPerformanceReviewRepository reviewRepository = mock(TechPerformanceReviewRepository.class);
    private final TechSkillPromotionItemRepository promoItemRepository = mock(TechSkillPromotionItemRepository.class);
    private final TechCareerEventRepository careerEventRepository = mock(TechCareerEventRepository.class);
    private final TechSkillRepository skillRepository = mock(TechSkillRepository.class);
    private final UserTechSkillRepository userSkillRepository = mock(UserTechSkillRepository.class);
    private final UserTechCertificateRepository certificateRepository = mock(UserTechCertificateRepository.class);
    private final TechProjectMemberRepository memberRepository = mock(TechProjectMemberRepository.class);
    private final TechProjectMilestoneRepository milestoneRepository = mock(TechProjectMilestoneRepository.class);
    private final TechWorklogRepository worklogRepository = mock(TechWorklogRepository.class);
    private final TechWorklogService techWorklogService = mock(TechWorklogService.class);
    private final AttendanceRepository attendanceRepository = mock(AttendanceRepository.class);
    private final EmployeeRequestRepository employeeRequestRepository = mock(EmployeeRequestRepository.class);
    private final HolidayRepository holidayRepository = mock(HolidayRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private final SalaryHistoryRepository salaryHistoryRepository = mock(SalaryHistoryRepository.class);
    private final EmployeeHistoryService employeeHistoryService = mock(EmployeeHistoryService.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final GeminiClientService geminiClientService = mock(GeminiClientService.class);

    private final ObjectMapper objectMapper = new ObjectMapper();

    private TechTelemetryScoreCalculator telemetryCalculator;
    private TechEvaluationCopilotService copilotService;
    private TechSkillService techSkillService;
    private TechPerformanceService performanceService;

    private Department techDept;
    private User ceoUser;
    private User directorUser;
    private User managerUser;
    private User devUser;
    private User otherDeptUser;
    private TechSkill javaSkill;
    private TechSkill microSkill;

    @BeforeEach
    void setUp() {
        telemetryCalculator = new TechTelemetryScoreCalculator(
                memberRepository,
                milestoneRepository,
                worklogRepository,
                techWorklogService,
                userSkillRepository,
                certificateRepository,
                attendanceRepository,
                employeeRequestRepository,
                holidayRepository
        );
        copilotService = new TechEvaluationCopilotService(geminiClientService, objectMapper);
        techSkillService = new TechSkillService(
                skillRepository,
                userSkillRepository,
                certificateRepository,
                memberRepository,
                userRepository,
                departmentRepository,
                notificationService
        );
        performanceService = new TechPerformanceService(
                cycleRepository,
                reviewRepository,
                promoItemRepository,
                careerEventRepository,
                skillRepository,
                userSkillRepository,
                userRepository,
                departmentRepository,
                salaryHistoryRepository,
                employeeHistoryService,
                notificationService,
                telemetryCalculator,
                copilotService,
                techSkillService,
                objectMapper
        );

        techDept = Department.builder().id(2L).tenPhong("Công nghệ").build();

        ceoUser = User.builder().id(1L).hoTen("Tổng Giám Đốc").email("ceo@hrm.vn").role(Role.CEO).active(true).build();
        directorUser = User.builder().id(2L).hoTen("Giám Đốc CN").email("giamdocphong@hrm.vn").role(Role.GIAM_DOC_PHONG_BAN).departmentId(2L).active(true).build();
        managerUser = User.builder().id(3L).hoTen("Trưởng Phòng CN").email("truongphong_kt@hrm.vn").role(Role.TRUONG_PHONG).departmentId(2L).active(true).build();
        devUser = User.builder()
                .id(10L)
                .hoTen("Nguyễn Hoàng Nam")
                .maNhanVien("02000002")
                .email("dev_nam@hrm.vn")
                .chucVu("Senior Backend Developer")
                .role(Role.NHAN_VIEN)
                .departmentId(2L)
                .baseSalary(25_000_000.0)
                .allowance(2_000_000.0)
                .active(true)
                .build();
        otherDeptUser = User.builder().id(99L).hoTen("HR Manager").role(Role.TRUONG_PHONG).departmentId(1L).active(true).build();

        javaSkill = TechSkill.builder().id(100L).skillName("Java").category(SkillCategory.BACKEND).build();
        microSkill = TechSkill.builder().id(101L).skillName("Microservices Architecture").category(SkillCategory.ARCHITECTURE).build();

        when(userRepository.findById(1L)).thenReturn(Optional.of(ceoUser));
        when(userRepository.findById(2L)).thenReturn(Optional.of(directorUser));
        when(userRepository.findById(3L)).thenReturn(Optional.of(managerUser));
        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findById(99L)).thenReturn(Optional.of(otherDeptUser));
        when(departmentRepository.findByTenPhong("Công nghệ")).thenReturn(Optional.of(techDept));

        when(holidayRepository.findByNgayLeBetween(any(), any())).thenReturn(Collections.emptyList());
        when(attendanceRepository.findByEmployeeIdAndDateBetween(anyLong(), any(), any())).thenReturn(Collections.emptyList());
        when(employeeRequestRepository.findApprovedRequestsForMonth(anyLong(), any(), any())).thenReturn(Collections.emptyList());
        when(milestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(anyLong())).thenReturn(Collections.emptyList());
        when(careerEventRepository.findByEmployeeIdOrderByEventDateDescIdDesc(anyLong())).thenReturn(Collections.emptyList());
        when(careerEventRepository.save(any(TechCareerEvent.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void tc01_telemetryCalculationFairnessForInternalAndBenchAndMilestones() {
        LocalDate start = LocalDate.of(2026, 11, 2); // Mon..Fri = 5 days -> 40h
        LocalDate end = LocalDate.of(2026, 11, 6);

        TechProject internalProject = TechProject.builder()
                .id(50L).projectCode("PRJ-HRM-AI").projectName("HRM AI").projectType(ProjectType.INTERNAL)
                .status(ProjectStatus.IN_PROGRESS).build();
        TechProjectMember leadMember = TechProjectMember.builder()
                .id(1L).project(internalProject).userId(10L).projectRole(ProjectRole.TECH_LEAD)
                .allocationPercent(100).isActive(true).build();
        when(memberRepository.findActiveMembershipsWithProject(10L)).thenReturn(List.of(leadMember));

        // 5 ngày x 8h = 40h INTERNAL DEVELOPMENT & ARCHITECTURE, sạch audit, milestone completed on-time
        TechWorklog wl1 = TechWorklog.builder()
                .id(1L).project(internalProject).userId(10L).workDate(start)
                .hoursSpent(BigDecimal.valueOf(24.0)).workType(WorklogType.ARCHITECTURE)
                .isBillable(false).approvalStatus(WorklogApprovalStatus.APPROVED)
                .referenceUrl("https://github.com/company/hrm-ai/pull/1").build();
        TechWorklog wl2 = TechWorklog.builder()
                .id(2L).project(internalProject).userId(10L).workDate(start.plusDays(1))
                .hoursSpent(BigDecimal.valueOf(16.0)).workType(WorklogType.DEVELOPMENT)
                .isBillable(false).approvalStatus(WorklogApprovalStatus.APPROVED)
                .referenceUrl("https://github.com/company/hrm-ai/pull/2").build();
        when(worklogRepository.findMyWorklogsWithFilters(10L, null, WorklogApprovalStatus.APPROVED, start, end))
                .thenReturn(List.of(wl1, wl2));
        when(techWorklogService.enrichWorklogsWithAudit(anyList())).thenReturn(List.of(
                TechWorklogResponse.builder().id(1L).hasAuditWarning(false).build(),
                TechWorklogResponse.builder().id(2L).hasAuditWarning(false).build()
        ));

        TechProjectMilestone onTimeMs = TechProjectMilestone.builder()
                .id(500L).project(internalProject).title("API Core").dueDate(end)
                .status(MilestoneStatus.COMPLETED).completedAt(end.atTime(15, 0)).build();
        when(milestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(50L)).thenReturn(List.of(onTimeMs));

        when(userSkillRepository.findByUserId(10L)).thenReturn(List.of(
                UserTechSkill.builder().id(1L).userId(10L).skill(javaSkill).proficiencyLevel(ProficiencyLevel.EXPERT).isVerified(true).build(),
                UserTechSkill.builder().id(2L).userId(10L).skill(microSkill).proficiencyLevel(ProficiencyLevel.EXPERT).isVerified(true).build()
        ));
        when(certificateRepository.findByUserIdOrderByIssueDateDesc(10L)).thenReturn(List.of(
                UserTechCertificate.builder().id(1L).userId(10L).certificateName("OCP Java 17")
                        .expiryDate(LocalDate.now().plusMonths(6)).build()
        ));

        // 1 late (miễn phạt vì freeLateQuota = 1), 1 absent có đơn WFH -> kỷ luật vẫn đạt trọn 20đ
        when(attendanceRepository.findByEmployeeIdAndDateBetween(10L, start, end)).thenReturn(List.of(
                Attendance.builder().employeeId(10L).date(start).status("LATE").build(),
                Attendance.builder().employeeId(10L).date(start.plusDays(1)).status("ABSENT").build()
        ));
        when(employeeRequestRepository.findApprovedRequestsForMonth(10L, start, end)).thenReturn(List.of(
                EmployeeRequest.builder().requestType(RequestType.SPECIAL_WFH_LEAVE).status(RequestStatus.APPROVED)
                        .startDate(start.plusDays(1)).endDate(start.plusDays(1)).build()
        ));

        TechTelemetryBreakdownResponse fullRAndD = telemetryCalculator.calculateTelemetry(10L, start, end);
        assertEquals(35.0, fullRAndD.getDeliveryScore());
        assertEquals(25.0, fullRAndD.getImpactScore(), "Team INTERNAL không bị trừ điểm Billable oan");
        assertEquals(20.0, fullRAndD.getCapabilityScore());
        assertEquals(20.0, fullRAndD.getDisciplineScore(), "1 lần đi muộn miễn phạt & ngày vắng có đơn WFH không bị trừ điểm");
        assertEquals(100.0, fullRAndD.getTelemetryTotalScore());
        assertFalse(fullRAndD.getIsBench());

        // Bench engineer (allocation = 0, chưa có log) -> không bị 0đ oan phần coverage
        when(memberRepository.findActiveMembershipsWithProject(10L)).thenReturn(Collections.emptyList());
        when(worklogRepository.findMyWorklogsWithFilters(10L, null, WorklogApprovalStatus.APPROVED, start, end))
                .thenReturn(Collections.emptyList());
        TechTelemetryBreakdownResponse benchRes = telemetryCalculator.calculateTelemetry(10L, start, end);
        assertTrue(benchRes.getIsBench());
        assertEquals(7.5, benchRes.getCoverageScore());
    }

    @Test
    void tc02_createEvaluationCycleBulkGeneratesReviewsAndRejectsDuplicates() {
        when(cycleRepository.existsByCycleCodeIgnoreCase("Q4-2026")).thenReturn(false);
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(managerUser, devUser));
        when(reviewRepository.existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(anyLong(), any(), any(), any()))
                .thenReturn(false);
        when(cycleRepository.save(any(TechEvaluationCycle.class))).thenAnswer(inv -> {
            TechEvaluationCycle c = inv.getArgument(0);
            c.setId(1L);
            return c;
        });
        when(reviewRepository.save(any(TechPerformanceReview.class))).thenAnswer(inv -> {
            TechPerformanceReview r = inv.getArgument(0);
            r.setId(r.getEmployeeId() + 500L);
            return r;
        });
        when(memberRepository.findActiveMembershipsWithProject(anyLong())).thenReturn(Collections.emptyList());
        when(worklogRepository.findMyWorklogsWithFilters(anyLong(), any(), any(), any(), any())).thenReturn(Collections.emptyList());
        when(userSkillRepository.findByUserId(anyLong())).thenReturn(Collections.emptyList());
        when(certificateRepository.findByUserIdOrderByIssueDateDesc(anyLong())).thenReturn(Collections.emptyList());

        CreateTechEvaluationCycleRequest req = CreateTechEvaluationCycleRequest.builder()
                .cycleCode("Q4-2026")
                .title("Đánh giá Q4/2026")
                .reviewType(TechReviewType.QUARTERLY)
                .periodStart(LocalDate.of(2026, 10, 1))
                .periodEnd(LocalDate.of(2026, 12, 31))
                .includeManagers(true)
                .build();

        TechEvaluationCycleResponse res = performanceService.createCycle(req, 3L);
        assertEquals(2L, res.getTotalReviews());
        verify(notificationService, times(2)).createNotification(
                anyLong(), eq("TECH_REVIEW_CREATED"), anyString(), anyString(), anyString(), contains("tab=reviews"));

        // Trùng mã kỳ -> 409 CONFLICT
        when(cycleRepository.existsByCycleCodeIgnoreCase("Q4-2026")).thenReturn(true);
        AppException dupEx = assertThrows(AppException.class, () -> performanceService.createCycle(req, 3L));
        assertEquals(HttpStatus.CONFLICT, dupEx.getStatus());

        // Tạo kỳ cho phòng ban khác -> 403 FORBIDDEN
        req.setCycleCode("Q4-2026-HR");
        req.setDepartmentId(1L);
        AppException deptEx = assertThrows(AppException.class, () -> performanceService.createCycle(req, 3L));
        assertEquals(HttpStatus.FORBIDDEN, deptEx.getStatus());

        // Kiểm tra cửa sổ trượt: Ngoài phạm vi [kỳ trước, kỳ này, kỳ kế tiếp] -> 400 BAD_REQUEST
        when(cycleRepository.existsByCycleCodeIgnoreCase(anyString())).thenReturn(false);
        req.setDepartmentId(null);

        // Tháng quá xa (Tháng 1/2026 khi hiện tại là Tháng 11/2026)
        CreateTechEvaluationCycleRequest oldMonthlyReq = CreateTechEvaluationCycleRequest.builder()
                .cycleCode("T01-2026").title("Đánh giá T01/2026").reviewType(TechReviewType.MONTHLY)
                .periodStart(LocalDate.of(2026, 1, 1)).periodEnd(LocalDate.of(2026, 1, 31)).build();
        AppException oldMonthlyEx = assertThrows(AppException.class, () -> performanceService.createCycle(oldMonthlyReq, 3L));
        assertEquals(HttpStatus.BAD_REQUEST, oldMonthlyEx.getStatus());
        assertTrue(oldMonthlyEx.getMessage().contains("Kỳ đánh giá theo tháng chỉ được mở trong phạm vi"));

        // Quý quá xa (Q1/2026 khi hiện tại là Q4/2026)
        CreateTechEvaluationCycleRequest oldQuarterlyReq = CreateTechEvaluationCycleRequest.builder()
                .cycleCode("Q1-2026").title("Đánh giá Q1/2026").reviewType(TechReviewType.QUARTERLY)
                .periodStart(LocalDate.of(2026, 1, 1)).periodEnd(LocalDate.of(2026, 3, 31)).build();
        AppException oldQuarterlyEx = assertThrows(AppException.class, () -> performanceService.createCycle(oldQuarterlyReq, 3L));
        assertEquals(HttpStatus.BAD_REQUEST, oldQuarterlyEx.getStatus());
        assertTrue(oldQuarterlyEx.getMessage().contains("Kỳ đánh giá theo quý chỉ được mở trong phạm vi"));

        // Năm quá xa (2024 khi hiện tại là 2026)
        CreateTechEvaluationCycleRequest oldAnnualReq = CreateTechEvaluationCycleRequest.builder()
                .cycleCode("NAM-2024").title("Đánh giá Năm 2024").reviewType(TechReviewType.ANNUAL)
                .periodStart(LocalDate.of(2024, 1, 1)).periodEnd(LocalDate.of(2024, 12, 31)).build();
        AppException oldAnnualEx = assertThrows(AppException.class, () -> performanceService.createCycle(oldAnnualReq, 3L));
        assertEquals(HttpStatus.BAD_REQUEST, oldAnnualEx.getStatus());
        assertTrue(oldAnnualEx.getMessage().contains("Kỳ đánh giá theo năm chỉ được mở cho năm trước"));
    }

    @Test
    void tc03_submitSelfReviewWithSkillPromotionsAndValidation() {
        TechPerformanceReview review = TechPerformanceReview.builder()
                .id(11L).employeeId(10L).departmentId(2L).periodLabel("Q4-2026")
                .periodStart(LocalDate.of(2026, 10, 1)).periodEnd(LocalDate.of(2026, 12, 31))
                .status(TechReviewStatus.SELF_REVIEW_PENDING).build();

        when(reviewRepository.findById(11L)).thenReturn(Optional.of(review));
        when(reviewRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(skillRepository.findById(100L)).thenReturn(Optional.of(javaSkill));
        when(userSkillRepository.findByUserId(10L)).thenReturn(List.of(
                UserTechSkill.builder().id(88L).userId(10L).skill(javaSkill).proficiencyLevel(ProficiencyLevel.MIDDLE).build()
        ));
        when(userRepository.findByDepartmentIdAndRole(2L, Role.TRUONG_PHONG)).thenReturn(List.of(managerUser));
        when(userRepository.findByDepartmentIdAndRole(2L, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of(directorUser));

        // 1. Cấp bậc mục tiêu <= hiện tại (MIDDLE -> MIDDLE) -> 400
        SubmitSelfReviewRequest invalidLevelReq = SubmitSelfReviewRequest.builder()
                .selfSummary("Hoàn thành task")
                .skillPromotions(List.of(SubmitSelfReviewRequest.SkillPromotionProposalInput.builder()
                        .skillId(100L).targetLevel(ProficiencyLevel.MIDDLE).evidenceNote("PR #12").build()))
                .build();
        AppException badLevel = assertThrows(AppException.class,
                () -> performanceService.submitSelfReview(11L, invalidLevelReq, 10L));
        assertEquals(HttpStatus.BAD_REQUEST, badLevel.getStatus());

        // 2. Hợp lệ (MIDDLE -> SENIOR) -> MANAGER_REVIEW_PENDING
        SubmitSelfReviewRequest validReq = SubmitSelfReviewRequest.builder()
                .selfSummary("Thiết kế module đánh giá hiệu suất")
                .selfRatingScore(88.0)
                .skillPromotions(List.of(SubmitSelfReviewRequest.SkillPromotionProposalInput.builder()
                        .skillId(100L).targetLevel(ProficiencyLevel.SENIOR).evidenceNote("PR #48").evidenceUrl("https://github.com/pr/48").build()))
                .build();
        TechPerformanceReviewResponse res = performanceService.submitSelfReview(11L, validReq, 10L);
        assertEquals(TechReviewStatus.MANAGER_REVIEW_PENDING, res.getStatus());
        assertEquals(1, res.getSkillPromotionItems().size());
        verify(notificationService, atLeastOnce()).createNotification(
                eq(3L), eq("TECH_REVIEW_SELF_SUBMITTED"), anyString(), anyString(), anyString(), contains("reviewId=11"));
    }

    @Test
    void tc04_blocksSelfEvaluationAndSelfFinalApproval() {
        TechPerformanceReview managerReview = TechPerformanceReview.builder()
                .id(12L).employeeId(3L).departmentId(2L).periodLabel("Q4-2026")
                .telemetryTotalScore(BigDecimal.valueOf(85.0))
                .managerQualScore(BigDecimal.valueOf(80.0))
                .status(TechReviewStatus.DIRECTOR_APPROVAL_PENDING).build();
        when(reviewRepository.findById(12L)).thenReturn(Optional.of(managerReview));

        ManagerEvaluateReviewRequest evalReq = ManagerEvaluateReviewRequest.builder()
                .qualCraftScore(22.0).qualOwnershipScore(22.0).qualCollabScore(22.0).qualGrowthScore(22.0)
                .managerComment("Tự chấm")
                .build();
        AppException selfEval = assertThrows(AppException.class,
                () -> performanceService.evaluateReview(12L, evalReq, 3L));
        assertEquals(HttpStatus.FORBIDDEN, selfEval.getStatus());

        FinalDecisionRequest finalReq = FinalDecisionRequest.builder().decision("APPROVED").build();
        AppException selfApprove = assertThrows(AppException.class,
                () -> performanceService.finalDecision(12L, finalReq, 3L));
        assertEquals(HttpStatus.FORBIDDEN, selfApprove.getStatus());
    }

    @Test
    void tc05_and_tc07_standardManagerEvaluationClosesApprovedAndUpdatesSkillsTimeline() {
        TechSkill nextJs = TechSkill.builder().id(102L).skillName("Next.js").category(SkillCategory.FRONTEND).build();
        UserTechSkill existingNext = UserTechSkill.builder()
                .id(200L).userId(10L).skill(nextJs).proficiencyLevel(ProficiencyLevel.JUNIOR).isVerified(false).build();

        TechPerformanceReview review = TechPerformanceReview.builder()
                .id(13L).employeeId(10L).departmentId(2L).periodLabel("Q4-2026")
                .periodStart(LocalDate.of(2026, 10, 1)).periodEnd(LocalDate.of(2026, 12, 31))
                .telemetryTotalScore(BigDecimal.valueOf(85.0)) // 0.6 * 85 = 51
                .status(TechReviewStatus.MANAGER_REVIEW_PENDING).build();
        TechSkillPromotionItem middlePromo = TechSkillPromotionItem.builder()
                .id(301L).review(review).userTechSkillId(200L).skill(nextJs)
                .fromLevel(ProficiencyLevel.JUNIOR).targetLevel(ProficiencyLevel.MIDDLE)
                .evidenceNote("Storefront SSR").status(TechPromotionItemStatus.PENDING).build();
        review.getSkillPromotionItems().add(middlePromo);

        when(reviewRepository.findById(13L)).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userSkillRepository.findByUserIdAndSkillId(10L, 102L)).thenReturn(Optional.of(existingNext));
        when(userSkillRepository.save(any(UserTechSkill.class))).thenAnswer(inv -> inv.getArgument(0));
        when(promoItemRepository.save(any(TechSkillPromotionItem.class))).thenAnswer(inv -> inv.getArgument(0));

        // Manager chấm 20+20+20+20 = 80đ -> 0.4 * 80 = 32 -> final = 51 + 32 = 83.0 (Grade A)
        ManagerEvaluateReviewRequest evalReq = ManagerEvaluateReviewRequest.builder()
                .qualCraftScore(20.0).qualOwnershipScore(20.0).qualCollabScore(20.0).qualGrowthScore(20.0)
                .managerComment("Hoàn thành tốt, đồng ý nâng Next.js lên MIDDLE")
                .skillDecisions(List.of(ManagerEvaluateReviewRequest.SkillDecisionInput.builder()
                        .itemId(301L).status(TechPromotionItemStatus.APPROVED).build()))
                .build();

        TechPerformanceReviewResponse res = performanceService.evaluateReview(13L, evalReq, 3L);
        assertEquals(TechReviewStatus.APPROVED, res.getStatus());
        assertEquals(83.0, res.getFinalScore());
        assertEquals(TechRatingGrade.A, res.getFinalGrade());
        assertEquals(ProficiencyLevel.MIDDLE, existingNext.getProficiencyLevel());
        assertTrue(existingNext.getIsVerified());
        verify(careerEventRepository, times(2)).save(any(TechCareerEvent.class)); // REVIEW_COMPLETED + SKILL_LEVEL_UP
    }

    @Test
    void tc06_and_tc08_escalationAndCeoCompensationApprovalSyncsSalaryHistory() {
        TechPerformanceReview review = TechPerformanceReview.builder()
                .id(14L).employeeId(10L).departmentId(2L).periodLabel("Q4-2026")
                .periodStart(LocalDate.of(2026, 10, 1)).periodEnd(LocalDate.of(2026, 12, 31))
                .telemetryTotalScore(BigDecimal.valueOf(88.0))
                .status(TechReviewStatus.MANAGER_REVIEW_PENDING).build();
        TechSkillPromotionItem seniorPromo = TechSkillPromotionItem.builder()
                .id(401L).review(review).skill(microSkill)
                .fromLevel(ProficiencyLevel.MIDDLE).targetLevel(ProficiencyLevel.SENIOR)
                .evidenceNote("Core architecture").status(TechPromotionItemStatus.PENDING).build();
        review.getSkillPromotionItems().add(seniorPromo);

        when(reviewRepository.findById(14L)).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(userSkillRepository.findByUserIdAndSkillId(10L, 101L)).thenReturn(Optional.empty());
        when(userSkillRepository.save(any(UserTechSkill.class))).thenAnswer(inv -> {
            UserTechSkill s = inv.getArgument(0);
            s.setId(999L);
            return s;
        });
        when(promoItemRepository.save(any(TechSkillPromotionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.CEO)).thenReturn(List.of(ceoUser));

        // 1. Trưởng phòng đề xuất Senior skill + Thăng chức + Tăng lương -> Escalate DIRECTOR_APPROVAL_PENDING & PENDING_CEO
        ManagerEvaluateReviewRequest evalReq = ManagerEvaluateReviewRequest.builder()
                .qualCraftScore(23.0).qualOwnershipScore(23.0).qualCollabScore(22.0).qualGrowthScore(22.0) // 90đ
                .managerComment("Đề xuất thăng Tech Lead & nâng bậc Senior Microservices")
                .recommendPromotion(true)
                .recommendedTitle("Tech Lead")
                .recommendedSalaryIncreasePct(20.0)
                .compensationReason("Gánh tải 2 dự án trọng điểm")
                .skillDecisions(List.of(ManagerEvaluateReviewRequest.SkillDecisionInput.builder()
                        .itemId(401L).status(TechPromotionItemStatus.APPROVED).build()))
                .build();

        TechPerformanceReviewResponse escalated = performanceService.evaluateReview(14L, evalReq, 3L);
        assertEquals(TechReviewStatus.DIRECTOR_APPROVAL_PENDING, escalated.getStatus());
        assertEquals(CompensationProposalStatus.PENDING_CEO, escalated.getCompensationStatus());

        // 2. Giám đốc phòng ban KHÔNG thể chốt cuối khi có đề xuất đãi ngộ PENDING_CEO -> 403
        FinalDecisionRequest directorTry = FinalDecisionRequest.builder().decision("APPROVED").approveCompensation(true).build();
        AppException nonCeoComp = assertThrows(AppException.class,
                () -> performanceService.finalDecision(14L, directorTry, 2L));
        assertEquals(HttpStatus.FORBIDDEN, nonCeoComp.getStatus());

        // 3. CEO phê duyệt cuối -> User chucVu/baseSalary/allowance, SalaryHistory, EmployeeHistory & TechCareerEvent
        FinalDecisionRequest ceoApprove = FinalDecisionRequest.builder()
                .decision("APPROVED")
                .approveCompensation(true)
                .overrideTitle("Tech Lead")
                .newBaseSalary(30_000_000.0)
                .newAllowance(3_500_000.0)
                .compensationNote("CEO duyệt tăng lương & thăng chức Tech Lead")
                .build();

        TechPerformanceReviewResponse approved = performanceService.finalDecision(14L, ceoApprove, 1L);
        assertEquals(TechReviewStatus.APPROVED, approved.getStatus());
        assertEquals(CompensationProposalStatus.APPROVED, approved.getCompensationStatus());
        assertEquals("Tech Lead", devUser.getChucVu());
        assertEquals(30_000_000.0, devUser.getBaseSalary());
        assertEquals(3_500_000.0, devUser.getAllowance());

        verify(salaryHistoryRepository).save(any(SalaryHistory.class));
        verify(employeeHistoryService).logHistory(eq(10L), eq("PROMOTED"), eq("Senior Backend Developer"), eq("Tech Lead"), anyString());
        verify(employeeHistoryService).logHistory(eq(10L), eq("SALARY_CHANGED"), anyString(), anyString(), anyString());
        // Career Events: TITLE_PROMOTED + COMPENSATION_ADJUSTED + REVIEW_COMPLETED + SKILL_LEVEL_UP
        verify(careerEventRepository, times(4)).save(any(TechCareerEvent.class));
    }

    @Test
    void tc09_b10SalaryPrivacyEnforcedAcrossApis() {
        TechPerformanceReview review = TechPerformanceReview.builder()
                .id(15L).employeeId(10L).departmentId(2L).periodLabel("Q4-2026")
                .periodStart(LocalDate.of(2026, 10, 1)).periodEnd(LocalDate.of(2026, 12, 31))
                .telemetryTotalScore(BigDecimal.valueOf(85.0))
                .recommendedNewBaseSalary(28_000_000.0)
                .recommendedNewAllowance(2_500_000.0)
                .status(TechReviewStatus.DIRECTOR_APPROVAL_PENDING)
                .compensationStatus(CompensationProposalStatus.PENDING_CEO)
                .build();

        when(reviewRepository.findById(15L)).thenReturn(Optional.of(review));
        when(reviewRepository.findReviewsPaginated(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(review), PageRequest.of(0, 10), 1));

        // 1. Danh sách phân trang: thậm chí CEO xem danh sách cũng KHÔNG rò rỉ tiền lương tuyệt đối
        TechPerformancePageResponse page = performanceService.getReviewsPaginated(1L, null, null, null, null, null, 0, 10);
        assertNull(page.getContent().get(0).getCurrentBaseSalary());
        assertNull(page.getContent().get(0).getRecommendedNewBaseSalary());

        // 2. Chi tiết: Kỹ sư & Trưởng phòng KHÔNG thấy số tiền lương tuyệt đối
        TechPerformanceReviewResponse managerView = performanceService.getReviewById(15L, 3L);
        assertNull(managerView.getCurrentBaseSalary());
        assertNull(managerView.getRecommendedNewBaseSalary());

        TechPerformanceReviewResponse ownerView = performanceService.getReviewById(15L, 10L);
        assertNull(ownerView.getCurrentBaseSalary());
        assertNull(ownerView.getRecommendedNewBaseSalary());

        // 3. CEO & Giám đốc xem chi tiết thấy đúng tiền lương phục vụ luồng đãi ngộ
        TechPerformanceReviewResponse ceoView = performanceService.getReviewById(15L, 1L);
        assertEquals(25_000_000.0, ceoView.getCurrentBaseSalary());
        assertEquals(28_000_000.0, ceoView.getRecommendedNewBaseSalary());

        // 4. Trưởng phòng truyền recommendedNewBaseSalary khi evaluate -> 403 FORBIDDEN
        ManagerEvaluateReviewRequest illegalSalaryPass = ManagerEvaluateReviewRequest.builder()
                .qualCraftScore(20.0).qualOwnershipScore(20.0).qualCollabScore(20.0).qualGrowthScore(20.0)
                .managerComment("Test B-10")
                .recommendedNewBaseSalary(30_000_000.0)
                .build();
        AppException b10Ex = assertThrows(AppException.class,
                () -> performanceService.evaluateReview(15L, illegalSalaryPass, 3L));
        assertEquals(HttpStatus.FORBIDDEN, b10Ex.getStatus());
    }

    @Test
    void tc10_certificateExpiryRadarDetectsExpiringSoonExpiredAndSendsReminders() {
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(managerUser, devUser));
        LocalDate today = LocalDate.now();
        UserTechCertificate expiringSoon = UserTechCertificate.builder()
                .id(51L).userId(10L).certificateName("AWS CLF-C02").issuingOrganization("AWS")
                .issueDate(today.minusYears(3)).expiryDate(today.plusDays(10)).build();
        UserTechCertificate expired = UserTechCertificate.builder()
                .id(52L).userId(10L).certificateName("ISTQB Agile").issuingOrganization("ISTQB")
                .issueDate(today.minusYears(3)).expiryDate(today.minusDays(5)).build();
        UserTechCertificate lifetime = UserTechCertificate.builder()
                .id(53L).userId(10L).certificateName("Oracle Java 17").issuingOrganization("Oracle")
                .issueDate(today.minusYears(1)).expiryDate(null).build();
        when(certificateRepository.findByUserIdIn(anyList())).thenReturn(List.of(expiringSoon, expired, lifetime));

        List<ExpiringCertificateResponse> radar = techSkillService.getExpiringCertificates(2L);
        assertEquals(2, radar.size());
        assertEquals("EXPIRED", radar.get(0).getExpiryStatus());
        assertEquals(-5L, radar.get(0).getDaysRemaining());
        assertEquals("EXPIRING_SOON", radar.get(1).getExpiryStatus());
        assertEquals(10L, radar.get(1).getDaysRemaining());

        when(certificateRepository.findById(51L)).thenReturn(Optional.of(expiringSoon));
        techSkillService.remindCertificateRenewal(51L, 3L);
        verify(notificationService).createNotification(
                eq(10L), eq("TECH_CERTIFICATE_EXPIRING"), anyString(), contains("AWS CLF-C02"), anyString(), eq("/employee/my-projects?tab=profile"));

        // Nhân viên thường không thể gọi nhắc gia hạn -> 403
        AppException empForbidden = assertThrows(AppException.class,
                () -> techSkillService.remindCertificateRenewal(51L, 10L));
        assertEquals(HttpStatus.FORBIDDEN, empForbidden.getStatus());
    }

    @Test
    void tc11_aiCopilotGeneratesSummaryWithDeterministicFallback() {
        TechPerformanceReview review = TechPerformanceReview.builder()
                .id(16L).employeeId(10L).departmentId(2L).periodLabel("Q4-2026")
                .periodStart(LocalDate.of(2026, 10, 1)).periodEnd(LocalDate.of(2026, 12, 31))
                .deliveryScore(BigDecimal.valueOf(30.0))
                .impactScore(BigDecimal.valueOf(22.0))
                .capabilityScore(BigDecimal.valueOf(16.0))
                .disciplineScore(BigDecimal.valueOf(19.0))
                .telemetryTotalScore(BigDecimal.valueOf(87.0))
                .selfSummary("Hoàn thiện Core Backend HRM AI.")
                .build();
        when(reviewRepository.findById(16L)).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(memberRepository.findActiveMembershipsWithProject(10L)).thenReturn(Collections.emptyList());
        when(worklogRepository.findMyWorklogsWithFilters(anyLong(), any(), any(), any(), any())).thenReturn(Collections.emptyList());
        when(userSkillRepository.findByUserId(10L)).thenReturn(Collections.emptyList());
        when(certificateRepository.findByUserIdOrderByIssueDateDesc(10L)).thenReturn(Collections.emptyList());

        // Case 1: Gemini lỗi -> fallback Deterministic Java Rule Engine
        when(geminiClientService.callGemini(anyString(), anyInt(), anyInt()))
                .thenReturn(Mono.error(new RuntimeException("Gemini timeout")));
        TechAiCopilotResponse fallbackRes = performanceService.generateAiCopilotSummary(16L, 3L);
        assertFalse(fallbackRes.getGeneratedByAi());
        assertNotNull(fallbackRes.getStrengths());
        assertNotNull(fallbackRes.getGrowthAreas());
        assertNotNull(fallbackRes.getRoadmap90Days());
        assertTrue(review.getAiCopilotSummary().contains("1. Điểm mạnh kỹ thuật"));

        // Case 2: Gemini trả JSON hợp lệ
        when(geminiClientService.callGemini(anyString(), anyInt(), anyInt()))
                .thenReturn(Mono.just("mock-raw"));
        when(geminiClientService.extractTextFromGeminiResponse("mock-raw"))
                .thenReturn("{\"strengths\":\"Tốt\",\"growthAreas\":\"Chứng chỉ\",\"roadmap90Days\":\"Thi AWS\"}");
        TechAiCopilotResponse aiRes = performanceService.generateAiCopilotSummary(16L, 3L);
        assertTrue(aiRes.getGeneratedByAi());
        assertEquals("Tốt", aiRes.getStrengths());
    }

    @Test
    void updateAndDeleteCycleFlow() {
        TechEvaluationCycle cycle = TechEvaluationCycle.builder()
                .id(100L)
                .cycleCode("Q4-2026")
                .title("Đánh giá Quý 4")
                .reviewType(TechReviewType.QUARTERLY)
                .periodStart(LocalDate.of(2026, 10, 1))
                .periodEnd(LocalDate.of(2026, 12, 31))
                .selfReviewDeadline(LocalDate.of(2026, 12, 26))
                .status(TechEvaluationCycleStatus.OPEN)
                .departmentId(2L)
                .createdBy(3L)
                .build();
        when(cycleRepository.findById(100L)).thenReturn(Optional.of(cycle));
        when(cycleRepository.save(any(TechEvaluationCycle.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. Update cycle title & deadline & status
        UpdateTechEvaluationCycleRequest updateReq = UpdateTechEvaluationCycleRequest.builder()
                .title("Đánh giá Quý 4/2026 - Mở rộng")
                .selfReviewDeadline(LocalDate.of(2026, 12, 28))
                .status(TechEvaluationCycleStatus.CLOSED)
                .build();
        when(reviewRepository.findByCycleId(100L)).thenReturn(Collections.emptyList());

        TechEvaluationCycleResponse updated = performanceService.updateCycle(100L, updateReq, 3L);
        assertEquals("Đánh giá Quý 4/2026 - Mở rộng", updated.getTitle());
        assertEquals(LocalDate.of(2026, 12, 28), updated.getSelfReviewDeadline());
        assertEquals(TechEvaluationCycleStatus.CLOSED, updated.getStatus());

        // 2. Delete cycle blocked if has approved reviews
        TechPerformanceReview approvedReview = TechPerformanceReview.builder()
                .id(201L)
                .cycle(cycle)
                .employeeId(10L)
                .departmentId(2L)
                .status(TechReviewStatus.APPROVED)
                .build();
        when(reviewRepository.findByCycleId(100L)).thenReturn(List.of(approvedReview));

        AppException ex = assertThrows(AppException.class, () -> performanceService.deleteCycle(100L, 3L));
        assertTrue(ex.getMessage().contains("Không thể xóa kỳ đánh giá đã có 1 phiếu được phê duyệt hoàn tất"));

        // 3. Delete cycle success when reviews are not approved
        TechPerformanceReview pendingReview = TechPerformanceReview.builder()
                .id(202L)
                .cycle(cycle)
                .employeeId(10L)
                .departmentId(2L)
                .status(TechReviewStatus.SELF_REVIEW_PENDING)
                .build();
        when(reviewRepository.findByCycleId(100L)).thenReturn(List.of(pendingReview));

        performanceService.deleteCycle(100L, 3L);
        verify(promoItemRepository).deleteByReviewId(202L);
        verify(reviewRepository).delete(pendingReview);
        verify(cycleRepository).delete(cycle);
    }

    @Test
    void controllersEnforceExpectedPreAuthorizeAnnotations() {
        assertPreAuthorizeContains(TechPerformanceController.class, "createCycle", "'GIAM_DOC_PHONG_BAN'", "'TRUONG_PHONG'");
        assertPreAuthorizeExcludes(TechPerformanceController.class, "createCycle", "'CEO'");
        assertPreAuthorizeContains(TechPerformanceController.class, "updateCycle", "'GIAM_DOC_PHONG_BAN'", "'TRUONG_PHONG'");
        assertPreAuthorizeContains(TechPerformanceController.class, "deleteCycle", "'GIAM_DOC_PHONG_BAN'", "'TRUONG_PHONG'");
        assertPreAuthorizeContains(TechPerformanceController.class, "finalDecision", "'CEO'", "'GIAM_DOC_PHONG_BAN'");
        assertPreAuthorizeExcludes(TechPerformanceController.class, "finalDecision", "'TRUONG_PHONG'");
        assertPreAuthorizeContains(TechSkillController.class, "getExpiringCertificates", "'CEO'", "'GIAM_DOC_PHONG_BAN'", "'TRUONG_PHONG'");
        assertPreAuthorizeContains(TechSkillController.class, "remindCertificateRenewal", "'GIAM_DOC_PHONG_BAN'", "'TRUONG_PHONG'");
        assertPreAuthorizeExcludes(TechSkillController.class, "remindCertificateRenewal", "'CEO'");
    }

    private void assertPreAuthorizeContains(Class<?> clazz, String methodName, String... expectedRoles) {
        PreAuthorize pre = findPreAuthorize(clazz, methodName);
        for (String role : expectedRoles) {
            assertTrue(pre.value().contains(role), "Missing " + role + " on " + clazz.getSimpleName() + "." + methodName);
        }
    }

    private void assertPreAuthorizeExcludes(Class<?> clazz, String methodName, String... excludedRoles) {
        PreAuthorize pre = findPreAuthorize(clazz, methodName);
        for (String role : excludedRoles) {
            assertFalse(pre.value().contains(role), "Should not allow " + role + " on " + clazz.getSimpleName() + "." + methodName);
        }
    }

    private PreAuthorize findPreAuthorize(Class<?> clazz, String methodName) {
        for (Method m : clazz.getDeclaredMethods()) {
            if (m.getName().equals(methodName)) {
                PreAuthorize pre = m.getAnnotation(PreAuthorize.class);
                assertNotNull(pre, "@PreAuthorize missing on " + methodName);
                return pre;
            }
        }
        fail("Method not found: " + methodName);
        return null;
    }
}
