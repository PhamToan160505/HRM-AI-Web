package com.hrm.tech;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import com.hrm.tech.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TechAdvancedSuiteTest {

    // Repositories for DoD & Docs
    private final TechMilestoneDodItemRepository dodItemRepository = mock(TechMilestoneDodItemRepository.class);
    private final TechProjectMilestoneRepository milestoneRepository = mock(TechProjectMilestoneRepository.class);
    private final TechProjectDocumentRepository documentRepository = mock(TechProjectDocumentRepository.class);
    private final TechProjectRepository projectRepository = mock(TechProjectRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);

    // Repositories for Environments & Deployment
    private final TechProjectEnvironmentRepository environmentRepository = mock(TechProjectEnvironmentRepository.class);
    private final TechDeploymentLogRepository deploymentLogRepository = mock(TechDeploymentLogRepository.class);

    // Repositories for Mentorship
    private final TechMentorshipProgramRepository mentorshipProgramRepository = mock(TechMentorshipProgramRepository.class);
    private final TechMentorshipCheckinRepository mentorshipCheckinRepository = mock(TechMentorshipCheckinRepository.class);
    private final TechSkillRepository skillRepository = mock(TechSkillRepository.class);
    private final UserTechSkillRepository userSkillRepository = mock(UserTechSkillRepository.class);
    private final TechCareerEventRepository careerEventRepository = mock(TechCareerEventRepository.class);

    // Repositories for Reports
    private final TechWorklogRepository worklogRepository = mock(TechWorklogRepository.class);
    private final UserTechCertificateRepository certificateRepository = mock(UserTechCertificateRepository.class);
    private final TechEvaluationCycleRepository cycleRepository = mock(TechEvaluationCycleRepository.class);
    private final TechPerformanceReviewRepository reviewRepository = mock(TechPerformanceReviewRepository.class);

    // Services
    private TechMilestoneDodService dodService;
    private TechMilestoneService milestoneService;
    private TechProjectEnvironmentService environmentService;
    private TechMentorshipService mentorshipService;
    private TechReportExportService reportExportService;

    private User engineerUser;
    private User mentorUser;
    private TechProject sampleProject;
    private TechProjectMilestone sampleMilestone;

    @BeforeEach
    void setUp() {
        dodService = new TechMilestoneDodService(
                dodItemRepository, milestoneRepository, documentRepository, projectRepository, userRepository
        );

        milestoneService = new TechMilestoneService(
                milestoneRepository, projectRepository, userRepository, dodItemRepository
        );

        environmentService = new TechProjectEnvironmentService(
                environmentRepository, deploymentLogRepository, projectRepository, userRepository
        );

        mentorshipService = new TechMentorshipService(
                mentorshipProgramRepository, mentorshipCheckinRepository, skillRepository,
                userSkillRepository, userRepository, careerEventRepository
        );

        reportExportService = new TechReportExportService(
                worklogRepository, projectRepository, skillRepository, userSkillRepository,
                certificateRepository, cycleRepository, reviewRepository, userRepository
        );

        engineerUser = User.builder()
                .id(101L)
                .maNhanVien("EMP101")
                .hoTen("Nguyễn Văn Dev")
                .email("dev@hrm.com")
                .build();

        mentorUser = User.builder()
                .id(102L)
                .maNhanVien("EMP102")
                .hoTen("Trần Văn Senior")
                .email("senior@hrm.com")
                .build();

        sampleProject = TechProject.builder()
                .id(1L)
                .projectCode("PRJ-AI")
                .projectName("Dự án AI HRM")
                .build();

        sampleMilestone = TechProjectMilestone.builder()
                .id(10L)
                .project(sampleProject)
                .title("Bàn giao Sprint 1")
                .weightPercent(50)
                .completionPercent(50)
                .status(MilestoneStatus.IN_PROGRESS)
                .dueDate(LocalDate.now().plusDays(10))
                .build();
    }

    // ==========================================
    // PHÂN HỆ 1: DoD & ARCHITECTURE DOCS
    // ==========================================

    @Test
    void testCreateDodItem_Success() {
        when(milestoneRepository.findById(10L)).thenReturn(Optional.of(sampleMilestone));
        when(dodItemRepository.save(any(TechMilestoneDodItem.class))).thenAnswer(inv -> {
            TechMilestoneDodItem item = inv.getArgument(0);
            item.setId(501L);
            return item;
        });

        CreateTechDodItemRequest req = CreateTechDodItemRequest.builder()
                .title("SonarQube Clean code 0 blockers")
                .description("Không còn code smell cấp critical")
                .isRequired(true)
                .build();

        TechDodItemResponse res = dodService.createDodItem(10L, req, 102L);

        assertNotNull(res);
        assertEquals(501L, res.getId());
        assertEquals("SonarQube Clean code 0 blockers", res.getTitle());
        assertTrue(res.getIsRequired());
        assertFalse(res.getIsCompleted());
    }

    @Test
    void testMilestoneCompletion_BlockedByUncompletedRequiredDod() {
        when(milestoneRepository.findById(10L)).thenReturn(Optional.of(sampleMilestone));
        // Mock 1 required DoD item remains uncompleted
        when(dodItemRepository.countByMilestoneIdAndIsRequiredTrueAndIsCompletedFalse(10L)).thenReturn(1L);

        UpdateMilestoneRequest req = UpdateMilestoneRequest.builder()
                .title("Bàn giao Sprint 1")
                .dueDate(LocalDate.now().plusDays(10))
                .weightPercent(50)
                .completionPercent(100) // Attempting 100%
                .status(MilestoneStatus.COMPLETED)
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                milestoneService.updateMilestone(1L, 10L, req)
        );

        assertTrue(ex.getMessage().contains("tiêu chí DoD bắt buộc chưa được nghiệm thu"));
    }

    @Test
    void testMilestoneCompletion_AllowedWhenAllRequiredDodCompleted() {
        when(milestoneRepository.findById(10L)).thenReturn(Optional.of(sampleMilestone));
        // All required DoD items completed
        when(dodItemRepository.countByMilestoneIdAndIsRequiredTrueAndIsCompletedFalse(10L)).thenReturn(0L);
        when(milestoneRepository.save(any(TechProjectMilestone.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateMilestoneRequest req = UpdateMilestoneRequest.builder()
                .title("Bàn giao Sprint 1")
                .dueDate(LocalDate.now().plusDays(10))
                .weightPercent(50)
                .completionPercent(100)
                .status(MilestoneStatus.COMPLETED)
                .build();

        TechMilestoneResponse res = milestoneService.updateMilestone(1L, 10L, req);

        assertNotNull(res);
        assertEquals(MilestoneStatus.COMPLETED, res.getStatus());
        assertEquals(100, res.getCompletionPercent());
    }

    @Test
    void testCreateArchitectureDocument_Success() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(documentRepository.save(any(TechProjectDocument.class))).thenAnswer(inv -> {
            TechProjectDocument doc = inv.getArgument(0);
            doc.setId(201L);
            return doc;
        });

        CreateTechProjectDocumentRequest req = CreateTechProjectDocumentRequest.builder()
                .docType(TechProjectDocumentType.ARCHITECTURE_SPEC)
                .title("Kiến trúc Clean Architecture & C4 Model")
                .url("https://wiki.company.internal/docs/c4-model")
                .description("Sơ đồ C4 cấp component")
                .build();

        TechProjectDocumentResponse res = dodService.createProjectDocument(1L, req, 102L);

        assertNotNull(res);
        assertEquals(201L, res.getId());
        assertEquals("Kiến trúc Clean Architecture & C4 Model", res.getTitle());
        assertEquals(TechProjectDocumentType.ARCHITECTURE_SPEC, res.getDocType());
    }

    @Test
    void testUploadArchitectureDocument_Success() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(documentRepository.save(any(TechProjectDocument.class))).thenAnswer(inv -> {
            TechProjectDocument doc = inv.getArgument(0);
            doc.setId(202L);
            return doc;
        });

        org.springframework.mock.web.MockMultipartFile mockFile = new org.springframework.mock.web.MockMultipartFile(
                "file",
                "C4_Architecture_Specification.pdf",
                "application/pdf",
                "%PDF-1.4 sample content".getBytes()
        );

        TechProjectDocumentResponse res = dodService.uploadProjectDocument(
                1L, mockFile, "C4 Architecture Spec", TechProjectDocumentType.ARCHITECTURE_SPEC, "Bản đặc tả PDF", 102L
        );

        assertNotNull(res);
        assertEquals(202L, res.getId());
        assertEquals("C4 Architecture Spec", res.getTitle());
        assertNotNull(res.getUrl());
    }

    @Test
    void testUploadArchitectureDocument_BlockedExtension_Throws() {
        org.springframework.mock.web.MockMultipartFile badFile = new org.springframework.mock.web.MockMultipartFile(
                "file", "malicious_script.exe", "application/octet-stream", "bad".getBytes()
        );

        AppException ex = assertThrows(AppException.class, () ->
                dodService.uploadProjectDocument(1L, badFile, null, null, null, 102L)
        );
        assertTrue(ex.getMessage().contains("bị cấm"));
    }

    @Test
    void testUpdateProjectDocument_Success() {
        TechProjectDocument existingDoc = TechProjectDocument.builder()
                .id(203L)
                .project(sampleProject)
                .docType(TechProjectDocumentType.ARCHITECTURE_SPEC)
                .title("Tài liệu cũ")
                .url("https://old.url/docs")
                .description("Mô tả cũ")
                .createdBy(102L)
                .build();

        when(documentRepository.findById(203L)).thenReturn(Optional.of(existingDoc));
        when(documentRepository.save(any(TechProjectDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateTechProjectDocumentRequest req = UpdateTechProjectDocumentRequest.builder()
                .title("Tài liệu Kiến trúc Cập nhật v2")
                .docType(TechProjectDocumentType.API_SWAGGER)
                .url("https://new.swagger.internal/v2")
                .description("Mô tả mới đã sửa")
                .build();

        TechProjectDocumentResponse res = dodService.updateProjectDocument(1L, 203L, req, 102L);

        assertNotNull(res);
        assertEquals(203L, res.getId());
        assertEquals("Tài liệu Kiến trúc Cập nhật v2", res.getTitle());
        assertEquals(TechProjectDocumentType.API_SWAGGER, res.getDocType());
        assertEquals("https://new.swagger.internal/v2", res.getUrl());
        assertEquals("Mô tả mới đã sửa", res.getDescription());
    }

    @Test
    void testUpdateProjectDocumentWithFile_Success() {
        TechProjectDocument existingDoc = TechProjectDocument.builder()
                .id(204L)
                .project(sampleProject)
                .docType(TechProjectDocumentType.ARCHITECTURE_SPEC)
                .title("Tài liệu Specs")
                .url("/uploads/tech-documents/old_file.pdf")
                .createdBy(102L)
                .build();

        when(documentRepository.findById(204L)).thenReturn(Optional.of(existingDoc));
        when(documentRepository.save(any(TechProjectDocument.class))).thenAnswer(inv -> inv.getArgument(0));

        org.springframework.mock.web.MockMultipartFile newFile = new org.springframework.mock.web.MockMultipartFile(
                "file",
                "Updated_Architecture.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "new content".getBytes()
        );

        TechProjectDocumentResponse res = dodService.updateProjectDocumentWithFile(
                1L, 204L, newFile, "Updated Architecture Doc", TechProjectDocumentType.ARCHITECTURE_SPEC, "Phiên bản sửa đổi", 102L
        );

        assertNotNull(res);
        assertEquals(204L, res.getId());
        assertEquals("Updated Architecture Doc", res.getTitle());
        assertTrue(res.getUrl().contains("Updated_Architecture") || res.getUrl().contains("/uploads/"));
    }

    // ==========================================
    // PHÂN HỆ 3: MÔI TRƯỜNG & DEPLOYMENT LOGS
    // ==========================================

    @Test
    void testCreateEnvironmentAndDeploymentLog_Success() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(environmentRepository.findByProjectIdAndEnvName(1L, "STAGING")).thenReturn(Optional.empty());

        TechProjectEnvironment env = TechProjectEnvironment.builder()
                .id(301L)
                .project(sampleProject)
                .envName("STAGING")
                .displayName("Staging Kubernetes Cluster")
                .accessUrl("https://staging.internal.app")
                .status(TechEnvironmentStatus.ONLINE)
                .build();

        when(environmentRepository.save(any(TechProjectEnvironment.class))).thenReturn(env);
        when(environmentRepository.findById(301L)).thenReturn(Optional.of(env));

        CreateTechEnvironmentRequest envReq = CreateTechEnvironmentRequest.builder()
                .envName("STAGING")
                .displayName("Staging Kubernetes Cluster")
                .accessUrl("https://staging.internal.app")
                .build();

        TechProjectEnvironmentResponse envRes = environmentService.createEnvironment(1L, envReq);
        assertEquals("STAGING", envRes.getEnvName());

        // Deployment log
        when(deploymentLogRepository.save(any(TechDeploymentLog.class))).thenAnswer(inv -> {
            TechDeploymentLog log = inv.getArgument(0);
            log.setId(401L);
            return log;
        });

        CreateTechDeploymentLogRequest deployReq = CreateTechDeploymentLogRequest.builder()
                .versionTag("v2.4.0-rc1")
                .commitHash("a1b2c3d")
                .status(TechDeploymentStatus.SUCCESS)
                .changelog("Tích hợp DoD Checklist & POI Export Hub")
                .build();

        TechDeploymentLogResponse deployRes = environmentService.createDeploymentLog(301L, deployReq, 102L);

        assertNotNull(deployRes);
        assertEquals("v2.4.0-rc1", deployRes.getVersionTag());
        assertEquals(TechDeploymentStatus.SUCCESS, deployRes.getStatus());
    }

    // ==========================================
    // PHÂN HỆ 4: MENTORSHIP 1-1 & CAREER EVENT
    // ==========================================

    @Test
    void testCreateMentorshipProgramAndCheckin_Success() {
        when(userRepository.findById(102L)).thenReturn(Optional.of(mentorUser));
        when(userRepository.findById(101L)).thenReturn(Optional.of(engineerUser));

        TechSkill springSkill = TechSkill.builder().id(11L).skillName("Spring Boot").build();
        when(skillRepository.findById(11L)).thenReturn(Optional.of(springSkill));

        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .id(601L)
                .departmentId(1L)
                .mentorId(102L)
                .menteeId(101L)
                .focusSkill(springSkill)
                .programTitle("Lộ trình bồi dưỡng Spring Boot Microservices")
                .targetGoal("Nâng bậc từ Junior lên Middle")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusMonths(3))
                .status(TechMentorshipStatus.ACTIVE)
                .build();

        when(mentorshipProgramRepository.save(any(TechMentorshipProgram.class))).thenReturn(program);

        CreateTechMentorshipRequest req = CreateTechMentorshipRequest.builder()
                .mentorId(102L)
                .menteeId(101L)
                .focusSkillId(11L)
                .programTitle("Lộ trình bồi dưỡng Spring Boot Microservices")
                .targetGoal("Nâng bậc từ Junior lên Middle")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusMonths(3))
                .build();

        TechMentorshipProgramResponse progRes = mentorshipService.createProgram(1L, req, 102L);

        assertNotNull(progRes);
        assertEquals(601L, progRes.getId());
        assertEquals(TechMentorshipStatus.ACTIVE, progRes.getStatus());

        // Checkin
        when(mentorshipProgramRepository.findById(601L)).thenReturn(Optional.of(program));
        when(mentorshipCheckinRepository.save(any(TechMentorshipCheckin.class))).thenAnswer(inv -> {
            TechMentorshipCheckin c = inv.getArgument(0);
            c.setId(701L);
            return c;
        });

        CreateTechCheckinRequest checkinReq = CreateTechCheckinRequest.builder()
                .checkinDate(LocalDate.now())
                .topicsCovered("Review kiến trúc JPA & Hibernate N+1 issue")
                .progressRating(4)
                .mentorFeedback("Nắm bài tốt, cần tối ưu fetch join")
                .build();

        TechMentorshipCheckinResponse checkinRes = mentorshipService.createCheckin(601L, checkinReq, 102L);

        assertNotNull(checkinRes);
        assertEquals(4, checkinRes.getProgressRating());
    }

    @Test
    void testCompleteMentorship_TriggersCareerEventsForBoth() {
        TechSkill springSkill = TechSkill.builder().id(11L).skillName("Spring Boot").build();
        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .id(601L)
                .departmentId(1L)
                .mentorId(102L)
                .menteeId(101L)
                .focusSkill(springSkill)
                .programTitle("Lộ trình bồi dưỡng Spring Boot")
                .targetGoal("Nâng bậc")
                .startDate(LocalDate.now().minusMonths(3))
                .endDate(LocalDate.now())
                .status(TechMentorshipStatus.ACTIVE)
                .build();

        when(mentorshipProgramRepository.findById(601L)).thenReturn(Optional.of(program));
        when(mentorshipProgramRepository.save(any(TechMentorshipProgram.class))).thenAnswer(inv -> inv.getArgument(0));
        User managerActor = User.builder().id(100L).role(com.hrm.common.entity.Role.TRUONG_PHONG).hoTen("Trưởng phòng").build();
        when(userRepository.findById(100L)).thenReturn(Optional.of(managerActor));
        mentorUser.setRole(com.hrm.common.entity.Role.NHAN_VIEN);
        when(userRepository.findById(102L)).thenReturn(Optional.of(mentorUser));

        UpdateTechMentorshipRequest updateReq = UpdateTechMentorshipRequest.builder()
                .status(TechMentorshipStatus.COMPLETED)
                .finalAssessment("Hoàn thành xuất sắc toàn bộ tiêu chí")
                .build();

        // Chặn NHAN_VIEN / Mentor không được tự gọi API đổi status COMPLETED (Maker-Checker)
        AppException forbiddenEx = assertThrows(AppException.class,
                () -> mentorshipService.updateProgram(601L, updateReq, 102L));
        assertTrue(forbiddenEx.getMessage().contains("Chỉ Trưởng phòng hoặc Giám đốc Phòng ban"));

        // Trưởng phòng phê duyệt Tốt nghiệp thành công
        TechMentorshipProgramResponse res = mentorshipService.updateProgram(601L, updateReq, 100L);

        assertEquals(TechMentorshipStatus.COMPLETED, res.getStatus());

        // Verify career events logged for both mentee (101L) and mentor (102L)
        ArgumentCaptor<TechCareerEvent> captor = ArgumentCaptor.forClass(TechCareerEvent.class);
        verify(careerEventRepository, times(2)).save(captor.capture());

        List<TechCareerEvent> capturedEvents = captor.getAllValues();
        assertEquals(2, capturedEvents.size());

        TechCareerEvent menteeEvent = capturedEvents.stream()
                .filter(e -> e.getEmployeeId().equals(101L))
                .findFirst().orElseThrow();
        assertEquals(TechCareerEventType.MENTORSHIP_COMPLETED, menteeEvent.getEventType());
        assertTrue(menteeEvent.getTitle().contains("Tốt nghiệp chương trình Kèm cặp 1-1"));

        TechCareerEvent mentorEvent = capturedEvents.stream()
                .filter(e -> e.getEmployeeId().equals(102L))
                .findFirst().orElseThrow();
        assertEquals(TechCareerEventType.MENTORSHIP_COMPLETED, mentorEvent.getEventType());
        assertTrue(mentorEvent.getTitle().contains("Hoàn thành dẫn dắt Kỹ sư Kèm cặp"));
    }

    @Test
    void testSmartMentorSuggestions_ExcludesExecutiveRoles_DirectorCeoAdmin() {
        User mentee = User.builder()
                .id(101L)
                .hoTen("Phạm Hương Lan")
                .role(Role.NHAN_VIEN)
                .departmentId(1L)
                .active(true)
                .build();
        User director = User.builder()
                .id(201L)
                .hoTen("Phạm Văn Giám Đốc Phòng")
                .role(Role.GIAM_DOC_PHONG_BAN)
                .departmentId(1L)
                .active(true)
                .build();
        User ceo = User.builder()
                .id(202L)
                .hoTen("Trịnh Văn Tổng Giám Đốc")
                .role(Role.CEO)
                .departmentId(1L)
                .active(true)
                .build();
        User admin = User.builder()
                .id(203L)
                .hoTen("Hệ Thống Admin")
                .role(Role.ADMIN)
                .departmentId(1L)
                .active(true)
                .build();
        User senior = User.builder()
                .id(102L)
                .hoTen("Nguyễn Hoàng Nam")
                .role(Role.NHAN_VIEN)
                .departmentId(1L)
                .active(true)
                .build();

        when(userRepository.findById(101L)).thenReturn(Optional.of(mentee));
        when(userRepository.findAll()).thenReturn(List.of(mentee, director, ceo, admin, senior));
        when(mentorshipProgramRepository.findByMentorIdAndStatus(anyLong(), any())).thenReturn(Collections.emptyList());

        TechSmartMentorSuggestionResponse res = mentorshipService.getSmartMentorSuggestions(101L, null);

        assertNotNull(res);
        assertNotNull(res.getSuggestedMentors());
        // Verify that executive roles (GIAM_DOC_PHONG_BAN, CEO, ADMIN) are filtered out
        boolean containsDirector = res.getSuggestedMentors().stream().anyMatch(m -> m.getMentorId().equals(201L));
        boolean containsCeo = res.getSuggestedMentors().stream().anyMatch(m -> m.getMentorId().equals(202L));
        boolean containsAdmin = res.getSuggestedMentors().stream().anyMatch(m -> m.getMentorId().equals(203L));
        boolean containsSenior = res.getSuggestedMentors().stream().anyMatch(m -> m.getMentorId().equals(102L));

        assertFalse(containsDirector, "Giám đốc phòng ban không được xuất hiện trong danh sách gợi ý Mentor");
        assertFalse(containsCeo, "CEO không được xuất hiện trong danh sách gợi ý Mentor");
        assertFalse(containsAdmin, "Admin không được xuất hiện trong danh sách gợi ý Mentor");
        assertTrue(containsSenior, "Kỹ sư cấp cao phải xuất hiện trong gợi ý Mentor");
    }

    @Test
    void testCreateMentorshipProgram_BlocksDirectorAsMentor() {
        User director = User.builder()
                .id(201L)
                .hoTen("Phạm Văn Giám Đốc Phòng")
                .role(Role.GIAM_DOC_PHONG_BAN)
                .departmentId(1L)
                .active(true)
                .build();
        User mentee = User.builder()
                .id(101L)
                .hoTen("Phạm Hương Lan")
                .role(Role.NHAN_VIEN)
                .departmentId(1L)
                .active(true)
                .build();

        when(userRepository.findById(201L)).thenReturn(Optional.of(director));
        when(userRepository.findById(101L)).thenReturn(Optional.of(mentee));

        CreateTechMentorshipRequest req = CreateTechMentorshipRequest.builder()
                .mentorId(201L)
                .menteeId(101L)
                .programTitle("Kèm cặp JPA & Clean Architecture")
                .targetGoal("Nâng cao năng lực")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusMonths(3))
                .build();

        AppException ex = assertThrows(AppException.class, () -> mentorshipService.createProgram(1L, req, 100L));
        assertTrue(ex.getMessage().contains("Không thể chỉ định Ban lãnh đạo"));
    }

    @Test
    void testCreateMentorshipProgram_DateValidations() {
        // 1. End date before start date
        CreateTechMentorshipRequest req1 = CreateTechMentorshipRequest.builder()
                .mentorId(102L)
                .menteeId(101L)
                .programTitle("Kèm cặp test")
                .targetGoal("Nâng cao năng lực")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().minusDays(2))
                .build();
        AppException ex1 = assertThrows(AppException.class, () -> mentorshipService.createProgram(1L, req1, 100L));
        assertTrue(ex1.getMessage().contains("Ngày kết thúc dự kiến không được trước"));

        // 2. Duration too short (< 14 days)
        CreateTechMentorshipRequest req2 = CreateTechMentorshipRequest.builder()
                .mentorId(102L)
                .menteeId(101L)
                .programTitle("Kèm cặp test")
                .targetGoal("Nâng cao năng lực")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusDays(5))
                .build();
        AppException ex2 = assertThrows(AppException.class, () -> mentorshipService.createProgram(1L, req2, 100L));
        assertTrue(ex2.getMessage().contains("tối thiểu là 14 ngày"));

        // 3. Duration too long (> 180 days / 6 months)
        CreateTechMentorshipRequest req3 = CreateTechMentorshipRequest.builder()
                .mentorId(102L)
                .menteeId(101L)
                .programTitle("Kèm cặp test")
                .targetGoal("Nâng cao năng lực")
                .startDate(LocalDate.now())
                .endDate(LocalDate.now().plusDays(200))
                .build();
        AppException ex3 = assertThrows(AppException.class, () -> mentorshipService.createProgram(1L, req3, 100L));
        assertTrue(ex3.getMessage().contains("vượt quá 6 tháng"));

        // 4. Start date too far in past (> 30 days)
        CreateTechMentorshipRequest req4 = CreateTechMentorshipRequest.builder()
                .mentorId(102L)
                .menteeId(101L)
                .programTitle("Kèm cặp test")
                .targetGoal("Nâng cao năng lực")
                .startDate(LocalDate.now().minusDays(45))
                .endDate(LocalDate.now().plusMonths(3))
                .build();
        AppException ex4 = assertThrows(AppException.class, () -> mentorshipService.createProgram(1L, req4, 100L));
        assertTrue(ex4.getMessage().contains("không được trước ngày"));
    }

    @Test
    void testDeleteMentorshipProgram_Success() {
        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .id(602L)
                .programTitle("Chương trình cần xóa")
                .build();

        when(mentorshipProgramRepository.findById(602L)).thenReturn(Optional.of(program));
        when(mentorshipCheckinRepository.findByProgramIdOrderByCheckinDateDescCreatedAtDesc(602L)).thenReturn(Collections.emptyList());

        mentorshipService.deleteProgram(602L, 100L);

        verify(mentorshipProgramRepository, times(1)).delete(program);
    }

    @Test
    void testCreateCheckin_ValidationRules_ThrowsAppException() {
        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .id(603L)
                .programTitle("Lộ trình Kèm cặp Test Check-in")
                .startDate(LocalDate.of(2026, 11, 19))
                .endDate(LocalDate.of(2027, 2, 19))
                .status(TechMentorshipStatus.ACTIVE)
                .build();

        when(mentorshipProgramRepository.findById(603L)).thenReturn(Optional.of(program));

        // 1. Checkin trước ngày bắt đầu chương trình
        CreateTechCheckinRequest beforeReq = CreateTechCheckinRequest.builder()
                .checkinDate(LocalDate.of(2026, 11, 10))
                .topicsCovered("Review kiến trúc")
                .progressRating(4)
                .build();
        AppException exBefore = assertThrows(AppException.class,
                () -> mentorshipService.createCheckin(603L, beforeReq, 102L));
        assertTrue(exBefore.getMessage().contains("không được trước ngày bắt đầu chương trình"));

        // 2. Checkin sau ngày kết thúc chương trình
        CreateTechCheckinRequest afterReq = CreateTechCheckinRequest.builder()
                .checkinDate(LocalDate.of(2027, 2, 21))
                .topicsCovered("Review kiến trúc")
                .progressRating(4)
                .build();
        AppException exAfter = assertThrows(AppException.class,
                () -> mentorshipService.createCheckin(603L, afterReq, 102L));
        assertTrue(exAfter.getMessage().contains("không được vượt quá ngày kết thúc chương trình"));
    }

    @Test
    void testUpdateAndDeleteCheckin_SuccessAndPermissionGuard() {
        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .id(604L)
                .mentorId(102L)
                .menteeId(101L)
                .startDate(LocalDate.of(2026, 11, 19))
                .endDate(LocalDate.of(2027, 2, 19))
                .status(TechMentorshipStatus.ACTIVE)
                .build();

        TechMentorshipCheckin existing = TechMentorshipCheckin.builder()
                .id(705L)
                .program(program)
                .checkinDate(LocalDate.of(2026, 11, 21))
                .topicsCovered("Review Clean Architecture")
                .progressRating(4)
                .loggedBy(102L)
                .build();

        when(mentorshipCheckinRepository.findById(705L)).thenReturn(Optional.of(existing));
        when(mentorshipCheckinRepository.save(any(TechMentorshipCheckin.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.findById(102L)).thenReturn(Optional.of(mentorUser));
        when(userRepository.findById(101L)).thenReturn(Optional.of(engineerUser));

        // Mentee không phải người tạo & không phải Mentor => bị chặn sửa
        CreateTechCheckinRequest updateReq = CreateTechCheckinRequest.builder()
                .checkinDate(LocalDate.of(2026, 11, 22))
                .topicsCovered("Review Clean Architecture & Kafka")
                .progressRating(5)
                .mentorFeedback("Tiến bộ vượt bậc")
                .build();
        assertThrows(AppException.class, () -> mentorshipService.updateCheckin(705L, updateReq, 101L));

        // Mentor chỉnh sửa thành công
        TechMentorshipCheckinResponse updatedRes = mentorshipService.updateCheckin(705L, updateReq, 102L);
        assertEquals(5, updatedRes.getProgressRating());
        assertEquals("Review Clean Architecture & Kafka", updatedRes.getTopicsCovered());

        // Mentor xóa thành công
        mentorshipService.deleteCheckin(705L, 102L);
        verify(mentorshipCheckinRepository, times(1)).delete(existing);
    }

    @Test
    void testProposeGraduation_MentorOnlyAndKeepsStatusActive() {
        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .id(605L)
                .mentorId(102L)
                .menteeId(101L)
                .programTitle("Lộ trình bồi dưỡng Spring Boot")
                .targetGoal("Làm chủ Microservices")
                .startDate(LocalDate.of(2026, 11, 19))
                .endDate(LocalDate.of(2027, 2, 19))
                .status(TechMentorshipStatus.ACTIVE)
                .build();

        when(mentorshipProgramRepository.findById(605L)).thenReturn(Optional.of(program));
        when(mentorshipProgramRepository.save(any(TechMentorshipProgram.class))).thenAnswer(inv -> inv.getArgument(0));

        ProposeTechGraduationRequest req = ProposeTechGraduationRequest.builder()
                .mentorSummary("Mentee đã làm chủ Clean Architecture và áp dụng Kafka vào dự án thực tế. Đề xuất duyệt tốt nghiệp.")
                .build();

        // Mentee không thể tự gửi đề xuất tốt nghiệp thay Mentor
        assertThrows(AppException.class, () -> mentorshipService.proposeGraduation(605L, req, 101L));

        // Mentor gửi đề xuất thành công; status vẫn giữ nguyên ACTIVE chờ Trưởng phòng duyệt
        TechMentorshipProgramResponse proposedRes = mentorshipService.proposeGraduation(605L, req, 102L);
        assertTrue(Boolean.TRUE.equals(proposedRes.getGraduationProposed()));
        assertEquals(TechMentorshipStatus.ACTIVE, proposedRes.getStatus());
        assertNotNull(proposedRes.getGraduationProposedAt());
        assertTrue(proposedRes.getMentorSummary().contains("Clean Architecture"));
    }

    // ==========================================
    // PHÂN HỆ 2: EXCEL POI EXPORT HUB
    // ==========================================

    @Test
    void testExportTimesheetExcel_GeneratesValidWorkbook() throws Exception {
        TechWorklog log1 = TechWorklog.builder()
                .id(801L)
                .userId(101L)
                .project(sampleProject)
                .milestone(sampleMilestone)
                .workType(WorklogType.DEVELOPMENT)
                .taskSummary("Xây dựng API DoD Checklist")
                .hoursSpent(BigDecimal.valueOf(6.5))
                .workDate(LocalDate.now())
                .approvalStatus(WorklogApprovalStatus.APPROVED)
                .approvedBy(102L)
                .build();

        when(worklogRepository.findDepartmentWorklogsWithFilters(any(), any(), any(), any(), any()))
                .thenReturn(List.of(log1));
        when(userRepository.findAllById(any())).thenReturn(List.of(engineerUser, mentorUser));

        byte[] excelBytes = reportExportService.exportTimesheet(1L, 101L, LocalDate.now().minusDays(7), LocalDate.now());

        assertNotNull(excelBytes);
        assertTrue(excelBytes.length > 0);

        // Verify Excel workbook can be read by POI
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            assertEquals(1, wb.getNumberOfSheets());
            assertEquals("Bảng kê Giờ công Kỹ thuật", wb.getSheetAt(0).getSheetName());
        }
    }

    @Test
    void testExportSkillsMatrixExcel_GeneratesMultiSheetWorkbook() throws Exception {
        TechSkill reactSkill = TechSkill.builder().id(1L).skillName("ReactJS").category(SkillCategory.FRONTEND).build();
        UserTechSkill uts = UserTechSkill.builder()
                .id(1L)
                .userId(101L)
                .skill(reactSkill)
                .proficiencyLevel(ProficiencyLevel.SENIOR)
                .yearsOfExperience(4.5)
                .isVerified(true)
                .highlightProject("HRM Dashboard")
                .build();

        UserTechCertificate cert = UserTechCertificate.builder()
                .id(1L)
                .userId(101L)
                .certificateName("AWS Solutions Architect Associate")
                .issuingOrganization("Amazon Web Services")
                .issueDate(LocalDate.now().minusYears(1))
                .expiryDate(LocalDate.now().plusYears(2))
                .build();

        when(userSkillRepository.findAll()).thenReturn(List.of(uts));
        when(certificateRepository.findAll()).thenReturn(List.of(cert));
        when(userRepository.findAllById(any())).thenReturn(List.of(engineerUser));

        byte[] excelBytes = reportExportService.exportSkillsMatrix(1L);

        assertNotNull(excelBytes);
        assertTrue(excelBytes.length > 0);

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            assertEquals(2, wb.getNumberOfSheets());
            assertEquals("Ma trận Kỹ năng (Skills Matrix)", wb.getSheetAt(0).getSheetName());
            assertEquals("Danh sách Chứng chỉ Kỹ thuật", wb.getSheetAt(1).getSheetName());
        }
    }

    @Test
    void testExportEvaluationCycleExcel_GeneratesValidWorkbookWithB10Masking() throws Exception {
        TechEvaluationCycle cycle = TechEvaluationCycle.builder()
                .id(5L)
                .cycleCode("Q4-2026")
                .title("Đánh giá Quý 4/2026")
                .periodStart(LocalDate.of(2026, 10, 1))
                .periodEnd(LocalDate.of(2026, 12, 31))
                .status(TechEvaluationCycleStatus.CLOSED)
                .build();

        TechPerformanceReview review = TechPerformanceReview.builder()
                .id(1001L)
                .cycle(cycle)
                .employeeId(101L)
                .departmentId(1L)
                .status(TechReviewStatus.APPROVED)
                .telemetryTotalScore(BigDecimal.valueOf(82.5))
                .managerQualScore(BigDecimal.valueOf(85.0))
                .finalScore(BigDecimal.valueOf(83.5))
                .finalGrade(TechRatingGrade.A)
                .compensationStatus(CompensationProposalStatus.PENDING_CEO)
                .recommendedNewBaseSalary(25000000.0)
                .build();

        when(cycleRepository.findById(5L)).thenReturn(Optional.of(cycle));
        when(reviewRepository.findByCycleId(5L)).thenReturn(List.of(review));
        when(userRepository.findAllById(any())).thenReturn(List.of(engineerUser));

        byte[] excelBytes = reportExportService.exportEvaluationCycle(5L);

        assertNotNull(excelBytes);
        assertTrue(excelBytes.length > 0);

        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            assertEquals(1, wb.getNumberOfSheets());
            assertEquals("Kết quả Đánh giá Kỹ thuật", wb.getSheetAt(0).getSheetName());
        }
    }
}
