package com.hrm.recruitment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.recruitment.entity.Application;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.ApplicationTransitionLog;
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.ApplicationTransitionLogRepository;
import com.hrm.recruitment.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InterviewServicePermissionTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
    private final OutboxEventRepository outboxRepository = mock(OutboxEventRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private final ApplicationTransitionLogRepository transitionLogRepository = mock(ApplicationTransitionLogRepository.class);
    private InterviewService service;
    private Application application;

    @BeforeEach
    void setUp() {
        service = new InterviewService(jdbcTemplate, applicationRepository, outboxRepository,
                new ObjectMapper(), userRepository, departmentRepository, transitionLogRepository);
        JobPosting posting = JobPosting.builder().id(8L).departmentId(20L).build();
        application = Application.builder().id(4L).jobPosting(posting)
                .approvalStatus(ApplicationStatus.PENDING_INTERVIEW_1).build();
        when(applicationRepository.findById(4L)).thenReturn(Optional.of(application));
        when(applicationRepository.lockById(4L)).thenReturn(Optional.of(application));
    }

    @Test
    void employeeCannotEnumerateEligibleInterviewers() {
        when(userRepository.findById(90L)).thenReturn(Optional.of(User.builder()
                .id(90L).role(Role.NHAN_VIEN).departmentId(20L).build()));

        assertThrows(AppException.class, () -> service.eligibleInterviewers(4L, 90L));
    }

    @Test
    void managerFromAnotherDepartmentCannotScheduleInterview() {
        when(userRepository.findById(91L)).thenReturn(Optional.of(User.builder()
                .id(91L).role(Role.TRUONG_PHONG).departmentId(10L).build()));
        when(departmentRepository.findById(10L)).thenReturn(Optional.of(Department.builder()
                .id(10L).tenPhong("Kinh doanh").build()));
        var request = new InterviewService.ScheduleRequest(1, LocalDateTime.now().plusDays(1),
                LocalDateTime.now().plusDays(1).plusHours(1), "Asia/Ho_Chi_Minh", "ONLINE",
                null, "https://meet.example.test", 91L, List.of());

        assertThrows(AppException.class, () -> service.schedule(4L, request, 91L));
    }

    @Test
    void eligibleInterviewersAreHiringDepartmentManagersAndDirectHrOnly() {
        User salesManager = User.builder().id(21L).hoTen("Trưởng phòng Kinh doanh")
                .role(Role.TRUONG_PHONG).departmentId(20L).active(true).build();
        User salesDirector = User.builder().id(22L).hoTen("Giám đốc Kinh doanh")
                .role(Role.GIAM_DOC_PHONG_BAN).departmentId(20L).active(true).build();
        User salesEmployee = User.builder().id(23L).hoTen("Nhân viên Kinh doanh")
                .role(Role.NHAN_VIEN).departmentId(20L).active(true).build();
        User directHr = User.builder().id(31L).hoTen("HR phụ trách")
                .role(Role.TRUONG_PHONG).departmentId(30L).active(true).build();
        ApplicationTransitionLog hrApproval = ApplicationTransitionLog.create(
                RecruitmentEntityType.APPLICATION, 4L, 31L, Role.TRUONG_PHONG.name(),
                RecruitmentAction.APPROVE_HR_CV, "PENDING_HR_CV_REVIEW",
                "PENDING_TECH_CV_REVIEW", "Đạt", null, "hr-approval-4");

        when(userRepository.findById(21L)).thenReturn(Optional.of(salesManager));
        when(userRepository.findByDepartmentId(20L)).thenReturn(List.of(salesManager, salesDirector, salesEmployee));
        when(transitionLogRepository
                .findFirstByEntityTypeAndEntityIdAndActionAndActorIdIsNotNullOrderByOccurredAtDescIdDesc(
                        RecruitmentEntityType.APPLICATION, 4L, RecruitmentAction.APPROVE_HR_CV))
                .thenReturn(Optional.of(hrApproval));
        when(userRepository.findById(31L)).thenReturn(Optional.of(directHr));
        when(departmentRepository.findById(30L)).thenReturn(Optional.of(Department.builder()
                .id(30L).tenPhong("Nhân sự").build()));

        List<InterviewService.EligibleInterviewer> result = service.eligibleInterviewers(4L, 31L);

        assertEquals(List.of(21L, 22L, 31L), result.stream().map(InterviewService.EligibleInterviewer::id).toList());
    }

    @Test
    void hrWhoCreatedPostingCanScheduleRoundOne() {
        User campaignHr = User.builder().id(41L).hoTen("HR phụ trách chiến dịch")
                .role(Role.TRUONG_PHONG).departmentId(30L).active(true).build();
        ApplicationTransitionLog postingCreation = ApplicationTransitionLog.create(
                RecruitmentEntityType.JOB_POSTING, 8L, 41L, Role.TRUONG_PHONG.name(),
                RecruitmentAction.CREATE, null, "DRAFT", null, null, "posting-create-8");

        when(transitionLogRepository
                .findFirstByEntityTypeAndEntityIdAndActionAndActorIdIsNotNullOrderByOccurredAtDescIdDesc(
                        RecruitmentEntityType.JOB_POSTING, 8L, RecruitmentAction.CREATE))
                .thenReturn(Optional.of(postingCreation));
        when(userRepository.findById(41L)).thenReturn(Optional.of(campaignHr));
        when(departmentRepository.findById(30L)).thenReturn(Optional.of(Department.builder()
                .id(30L).tenPhong("Nhân sự").build()));
        when(userRepository.findByDepartmentId(20L)).thenReturn(List.of());

        List<InterviewService.EligibleInterviewer> result = service.eligibleInterviewers(4L, 41L);

        assertEquals(List.of(41L), result.stream().map(InterviewService.EligibleInterviewer::id).toList());
    }

    @Test
    void departmentManagerCannotCreateInterviewSchedule() {
        User salesManager = User.builder().id(21L).hoTen("Trưởng phòng Kinh doanh")
                .role(Role.TRUONG_PHONG).departmentId(20L).active(true).build();
        when(userRepository.findById(21L)).thenReturn(Optional.of(salesManager));
        when(userRepository.findByDepartmentId(20L)).thenReturn(List.of(salesManager));

        var request = new InterviewService.ScheduleRequest(1, LocalDateTime.now().plusDays(1),
                null, "Asia/Ho_Chi_Minh", "ONLINE", null,
                "https://meet.example.test", 21L, List.of());

        assertThrows(AppException.class, () -> service.schedule(4L, request, 21L));
    }
}
