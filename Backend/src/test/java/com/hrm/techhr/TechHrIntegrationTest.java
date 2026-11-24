package com.hrm.techhr;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.recruitment.entity.*;
import com.hrm.recruitment.repository.*;
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
import com.hrm.techhr.service.CrossDeptHandoffService;
import com.hrm.techhr.service.TechHrIntegrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TechHrIntegrationTest {

    private final CrossDeptHandoffTaskRepository handoffTaskRepository = mock(CrossDeptHandoffTaskRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final JobRequisitionService jobRequisitionService = mock(JobRequisitionService.class);
    private final JobRequisitionRepository jobRequisitionRepository = mock(JobRequisitionRepository.class);
    private final JobPostingRepository jobPostingRepository = mock(JobPostingRepository.class);
    private final HiringSeatRepository hiringSeatRepository = mock(HiringSeatRepository.class);
    private final ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
    private final TechProjectRepository techProjectRepository = mock(TechProjectRepository.class);
    private final TechProjectMemberRepository techProjectMemberRepository = mock(TechProjectMemberRepository.class);
    private final TechProjectMilestoneRepository techProjectMilestoneRepository = mock(TechProjectMilestoneRepository.class);
    private final TechProjectEnvironmentRepository techProjectEnvironmentRepository = mock(TechProjectEnvironmentRepository.class);
    private final TechMentorshipProgramRepository techMentorshipProgramRepository = mock(TechMentorshipProgramRepository.class);
    private final TechWorklogRepository techWorklogRepository = mock(TechWorklogRepository.class);
    private final UserTechSkillRepository userTechSkillRepository = mock(UserTechSkillRepository.class);
    private final EmployeeRequestRepository employeeRequestRepository = mock(EmployeeRequestRepository.class);
    private final EmployeeHistoryService employeeHistoryService = mock(EmployeeHistoryService.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private CrossDeptHandoffService handoffService;
    private TechHrIntegrationService integrationService;

    private Department techDept;
    private Department hrDept;
    private User techManager;
    private User hrManager;
    private User seniorDev;
    private User busySeniorDev;
    private User ceoUser;

    @BeforeEach
    void setUp() {
        handoffService = new CrossDeptHandoffService(
                handoffTaskRepository, userRepository, departmentRepository, notificationService, objectMapper
        );
        integrationService = new TechHrIntegrationService(
                handoffService, handoffTaskRepository, jobRequisitionService, jobRequisitionRepository,
                jobPostingRepository, hiringSeatRepository, applicationRepository, techProjectRepository,
                techProjectMemberRepository, techProjectMilestoneRepository, techProjectEnvironmentRepository,
                techMentorshipProgramRepository, techWorklogRepository, userTechSkillRepository,
                employeeRequestRepository, userRepository, employeeHistoryService, notificationService,
                jdbcTemplate, objectMapper
        );

        techDept = Department.builder().id(2L).tenPhong("Công nghệ").build();
        hrDept = Department.builder().id(1L).tenPhong("Nhân sự").build();

        techManager = User.builder().id(20L).hoTen("Trần Văn Trưởng Phòng CN").email("tp_cn@hrm.vn")
                .role(Role.TRUONG_PHONG).departmentId(2L).active(true).build();
        hrManager = User.builder().id(10L).hoTen("Lê Thị Trưởng Phòng NS").email("tp_ns@hrm.vn")
                .role(Role.TRUONG_PHONG).departmentId(1L).active(true).build();
        seniorDev = User.builder().id(21L).hoTen("Nguyễn Hoàng Nam").email("dev_nam@hrm.vn")
                .chucVu("Senior Backend Engineer").role(Role.NHAN_VIEN).departmentId(2L).active(true).build();
        busySeniorDev = User.builder().id(22L).hoTen("Đỗ Mạnh Hùng").email("dev_hung@hrm.vn")
                .chucVu("Senior Backend Engineer").role(Role.NHAN_VIEN).departmentId(2L).active(true).build();
        ceoUser = User.builder().id(1L).hoTen("Tổng Giám Đốc").email("ceo@hrm.vn")
                .role(Role.CEO).departmentId(null).active(true).build();

        when(departmentRepository.findAll()).thenReturn(List.of(hrDept, techDept));
        when(departmentRepository.findById(2L)).thenReturn(Optional.of(techDept));
        when(departmentRepository.findById(1L)).thenReturn(Optional.of(hrDept));
        when(userRepository.findById(20L)).thenReturn(Optional.of(techManager));
        when(userRepository.findById(10L)).thenReturn(Optional.of(hrManager));
        when(userRepository.findById(21L)).thenReturn(Optional.of(seniorDev));
        when(userRepository.findById(22L)).thenReturn(Optional.of(busySeniorDev));
        when(userRepository.findById(1L)).thenReturn(Optional.of(ceoUser));
        when(handoffTaskRepository.save(any(CrossDeptHandoffTask.class))).thenAnswer(inv -> {
            CrossDeptHandoffTask t = inv.getArgument(0);
            if (t.getId() == null) t.setId(900L);
            return t;
        });
    }

    // ─── MODULE 1 ─────────────────────────────────────────────────────────────

    @Test
    void testCreateRequisitionFromTechGap_SuccessAndBlocksEmployee() {
        TechProject project = TechProject.builder().id(5L).projectCode("PRJ-AI").projectName("HRM AI Platform").build();
        when(techProjectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(jobRequisitionService.createRequisitionWithTechContext(
                eq(20L), any(), eq(5L), anyString(), eq("CRITICAL"), isNull(), anyString()))
                .thenAnswer(inv -> JobRequisition.builder()
                        .id(301L)
                        .title("Senior Java Engineer")
                        .soLuong(2)
                        .capBac("Senior")
                        .departmentId(2L)
                        .techProjectId(inv.getArgument(2))
                        .requiredTechSkillsJson(inv.getArgument(3))
                        .urgencyLevel(inv.getArgument(4))
                        .status(JobRequisitionStatus.PENDING_APPROVAL)
                        .build());

        CreateTechGapRequisitionRequest req = CreateTechGapRequisitionRequest.builder()
                .techProjectId(5L)
                .title("Senior Java Engineer")
                .soLuong(2)
                .capBac("Senior")
                .urgencyLevel("CRITICAL")
                .reason("Đội Backend đang quá tải 100%, thiếu người cho Sprint Q4")
                .requiredSkills(List.of(
                        CreateTechGapRequisitionRequest.RequiredTechSkillItem.builder()
                                .skillId(1L).skillName("Spring Boot").minLevel("SENIOR").build()
                ))
                .build();

        // Nhân viên thường bị chặn
        assertThrows(AppException.class, () -> integrationService.createRequisitionFromTechGap(req, 21L, "k1"));

        // Trưởng phòng CN tạo thành công
        JobRequisition res = integrationService.createRequisitionFromTechGap(req, 20L, "k2");
        assertEquals(5L, res.getTechProjectId());
        assertEquals("CRITICAL", res.getUrgencyLevel());
        assertNotNull(res.getRequiredTechSkillsJson());
        assertTrue(res.getRequiredTechSkillsJson().contains("Spring Boot"));
    }

    @Test
    void testGetProjectHiringStatus_AggregatesSeatsCorrectly() {
        TechProject project = TechProject.builder().id(5L).projectCode("PRJ-AI").projectName("HRM AI").build();
        when(techProjectRepository.findById(5L)).thenReturn(Optional.of(project));

        JobRequisition jr = JobRequisition.builder()
                .id(301L).title("Backend Dev").capBac("Middle").soLuong(2)
                .status(JobRequisitionStatus.APPROVED).urgencyLevel("HIGH").build();
        when(jobRequisitionRepository.findByTechProjectIdOrderByCreatedAtDesc(5L)).thenReturn(List.of(jr));
        HiringSeat seat1 = mock(HiringSeat.class);
        when(seat1.getStatus()).thenReturn(HiringSeatStatus.AVAILABLE);
        HiringSeat seat2 = mock(HiringSeat.class);
        when(seat2.getStatus()).thenReturn(HiringSeatStatus.JOINED);
        when(hiringSeatRepository.findByRequisitionIdOrderBySeatNumber(301L)).thenReturn(List.of(seat1, seat2));
        when(jobPostingRepository.findAll()).thenReturn(Collections.emptyList());

        ProjectHiringStatusResponse status = integrationService.getProjectHiringStatus(5L);
        assertEquals(1, status.getTotalRequisitions());
        assertEquals(2, status.getTotalRequestedHeadcount());
        assertEquals(1, status.getTotalFilledSeats());
        assertEquals(1, status.getRequisitions().get(0).getJoinedSeats());
    }

    // ─── MODULE 2 ─────────────────────────────────────────────────────────────

    @Test
    void testSuggestTechnicalInterviewers_PrefersAvailableSeniorOverOverloadedOrOnLeave() {
        when(userRepository.findAll()).thenReturn(List.of(seniorDev, busySeniorDev));

        TechSkill spring = TechSkill.builder().id(1L).skillName("Spring Boot").build();
        when(userTechSkillRepository.findByUserId(21L)).thenReturn(List.of(
                UserTechSkill.builder().userId(21L).skill(spring).proficiencyLevel(ProficiencyLevel.SENIOR).isVerified(true).build()
        ));
        when(userTechSkillRepository.findByUserId(22L)).thenReturn(List.of(
                UserTechSkill.builder().userId(22L).skill(spring).proficiencyLevel(ProficiencyLevel.SENIOR).isVerified(true).build()
        ));

        when(techProjectMemberRepository.getTotalActiveAllocationByUserId(21L)).thenReturn(50);
        when(techProjectMemberRepository.getTotalActiveAllocationByUserId(22L)).thenReturn(110);
        when(employeeRequestRepository.findByUserIdOrderByCreatedAtDesc(21L)).thenReturn(Collections.emptyList());
        when(employeeRequestRepository.findByUserIdOrderByCreatedAtDesc(22L)).thenReturn(List.of(
                EmployeeRequest.builder().requestType(RequestType.NORMAL_LEAVE).status(RequestStatus.APPROVED)
                        .startDate(LocalDate.now()).endDate(LocalDate.now().plusDays(1)).build()
        ));

        List<TechInterviewerSuggestion> result = integrationService.suggestTechnicalInterviewers(null, 2L, LocalDate.now());
        assertEquals(2, result.size());
        assertEquals(21L, result.get(0).getUserId());
        assertEquals("OPTIMAL", result.get(0).getAvailabilityBadge());
        assertTrue(result.get(1).isOnLeaveThatDay());
        assertEquals("ON_LEAVE", result.get(1).getAvailabilityBadge());
    }

    // ─── MODULE 3 & 4 ─────────────────────────────────────────────────────────

    @Test
    void testProbationApproved_CreatesOfficialContractHandoffForHr() {
        when(jdbcTemplate.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any()))
                .thenReturn(Collections.emptyList());

        integrationService.onProbationReviewApproved(new ProbationReviewApprovedEvent(
                501L, 21L, "Nguyễn Hoàng Nam", "dev_nam@hrm.vn", 2L,
                85.0, "A", true, "Đạt xuất sắc tiêu chuẩn kỹ thuật", 20L
        ));

        ArgumentCaptor<CrossDeptHandoffTask> captor = ArgumentCaptor.forClass(CrossDeptHandoffTask.class);
        verify(handoffTaskRepository).save(captor.capture());
        CrossDeptHandoffTask saved = captor.getValue();
        assertEquals(CrossDeptTaskType.PROBATION_OFFICIAL_CONTRACT, saved.getTaskType());
        assertEquals(2L, saved.getSourceDepartmentId());
        assertEquals(1L, saved.getTargetDepartmentId());
        assertEquals(CrossDeptTaskStatus.OPEN, saved.getStatus());
        verify(employeeHistoryService).logHistory(eq(21L), eq("PROBATION_PASSED"), anyString(), eq("Đạt thử việc"), anyString());
    }

    @Test
    void testCareerCompensationApproved_MasksB10SalaryForTechManagerButVisibleForHrManager() throws Exception {
        when(jdbcTemplate.query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any()))
                .thenReturn(Collections.emptyList());

        integrationService.onCareerCompensationApproved(new CareerCompensationApprovedEvent(
                502L, 21L, "Nguyễn Hoàng Nam", "dev_nam@hrm.vn", 2L, "Q4-2026",
                true, "Middle Backend", "Senior Backend",
                true, 25000000.0, 32000000.0, 2000000.0, 3000000.0,
                "Hoàn thành xuất sắc", 1L
        ));

        ArgumentCaptor<CrossDeptHandoffTask> captor = ArgumentCaptor.forClass(CrossDeptHandoffTask.class);
        verify(handoffTaskRepository).save(captor.capture());
        CrossDeptHandoffTask task = captor.getValue();
        assertEquals(CrossDeptTaskType.CONTRACT_ADDENDUM_REQUIRED, task.getTaskType());

        when(handoffTaskRepository.findByTargetDepartmentIdOrSourceDepartmentIdOrderByCreatedAtDesc(2L, 2L))
                .thenReturn(List.of(task));
        when(handoffTaskRepository.findByTargetDepartmentIdOrSourceDepartmentIdOrderByCreatedAtDesc(1L, 1L))
                .thenReturn(List.of(task));
        when(userRepository.findAllById(any())).thenReturn(List.of(seniorDev));

        // Trưởng phòng CN bị che lương B-10
        List<CrossDeptHandoffTaskResponse> techMgrView = handoffService.getTasksForActor(20L, "ALL", "ALL");
        assertTrue(techMgrView.get(0).getMetadataJson().contains("Bảo mật B-10"));
        assertFalse(techMgrView.get(0).getMetadataJson().contains("32000000"));

        // Trưởng phòng Nhân sự (C&B) được xem chi tiết để lập Phụ lục HĐ
        List<CrossDeptHandoffTaskResponse> hrMgrView = handoffService.getTasksForActor(10L, "ALL", "ALL");
        assertFalse(hrMgrView.get(0).getMetadataJson().contains("Bảo mật B-10"));
        assertEquals(32000000.0, objectMapper.readTree(hrMgrView.get(0).getMetadataJson()).get("newBaseSalary").asDouble(), 0.01);
    }

    // ─── MODULE 5 & SLA ───────────────────────────────────────────────────────

    @Test
    void testLeaveImpactAndOffboardingGuard_DetectsTechLeadAndTriggersHandover() {
        TechProject project = TechProject.builder().id(5L).projectCode("PRJ-AI").projectName("HRM AI").build();
        TechProjectMember leadMember = TechProjectMember.builder()
                .id(1L).userId(21L).project(project).projectRole(ProjectRole.TECH_LEAD)
                .allocationPercent(70).isActive(true).build();
        when(techProjectMemberRepository.findActiveMembershipsWithProject(21L)).thenReturn(List.of(leadMember));

        TechProjectMilestone ms = TechProjectMilestone.builder()
                .id(10L).project(project).title("Release v2").status(MilestoneStatus.IN_PROGRESS)
                .dueDate(LocalDate.now().plusDays(2)).build();
        when(techProjectMilestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(5L)).thenReturn(List.of(ms));
        when(techMentorshipProgramRepository.findByMentorIdAndStatus(21L, TechMentorshipStatus.ACTIVE))
                .thenReturn(List.of(TechMentorshipProgram.builder().id(60L).mentorId(21L).programTitle("Spring 1-1").build()));
        when(techMentorshipProgramRepository.findByMenteeIdAndStatus(21L, TechMentorshipStatus.ACTIVE))
                .thenReturn(Collections.emptyList());
        when(techProjectEnvironmentRepository.findByOwnerId(21L)).thenReturn(List.of(
                TechProjectEnvironment.builder().id(70L).envName("PRODUCTION").displayName("Prod Cluster").project(project).build()
        ));
        when(techWorklogRepository.findMyWorklogsWithFilters(eq(21L), isNull(), eq(WorklogApprovalStatus.PENDING), isNull(), isNull()))
                .thenReturn(Collections.emptyList());
        when(handoffTaskRepository.findByEmployeeUserIdAndStatusIn(eq(21L), anyList())).thenReturn(Collections.emptyList());

        // 1. Check leave impact >= 3 days -> HIGH risk
        TechLeaveImpactResponse leaveImpact = integrationService.checkLeaveProjectImpact(
                21L, LocalDate.now(), LocalDate.now().plusDays(4));
        assertEquals("HIGH", leaveImpact.getRiskLevel());
        assertTrue(leaveImpact.isTechLeadAnywhere());
        assertEquals(1, leaveImpact.getAffectedMilestonesCount());

        // 2. Check offboarding impact -> CRITICAL (Tech Lead + Prod Server Owner)
        TechOffboardingImpactResponse offImpact = integrationService.getOffboardingTechImpact(21L);
        assertEquals("CRITICAL", offImpact.getRiskLevel());
        assertTrue(offImpact.isHasBlockers());
        assertEquals(1, offImpact.getTechLeadProjectsCount());
        assertEquals(1, offImpact.getOwnedEnvironmentsCount());

        // 3. SLA Summary check
        when(handoffTaskRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(
                CrossDeptHandoffTask.builder().id(1L).sourceDepartmentId(2L).targetDepartmentId(1L)
                        .status(CrossDeptTaskStatus.COMPLETED).dueDate(LocalDate.now().plusDays(2))
                        .completedAt(LocalDateTime.now()).priority(CrossDeptTaskPriority.HIGH).build(),
                CrossDeptHandoffTask.builder().id(2L).sourceDepartmentId(1L).targetDepartmentId(2L)
                        .status(CrossDeptTaskStatus.OPEN).dueDate(LocalDate.now().minusDays(1))
                        .priority(CrossDeptTaskPriority.URGENT).build()
        ));
        CrossDeptSlaSummaryResponse sla = handoffService.getSlaSummary();
        assertEquals(2, sla.getTotalTasks());
        assertEquals(1, sla.getOverdueTasks());
        assertEquals(100.0, sla.getOnTimeCompletionRate());
    }
}
