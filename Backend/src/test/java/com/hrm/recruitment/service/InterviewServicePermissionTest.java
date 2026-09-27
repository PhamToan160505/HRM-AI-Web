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
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InterviewServicePermissionTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
    private final OutboxEventRepository outboxRepository = mock(OutboxEventRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private InterviewService service;
    private Application application;

    @BeforeEach
    void setUp() {
        service = new InterviewService(jdbcTemplate, applicationRepository, outboxRepository,
                new ObjectMapper(), userRepository, departmentRepository);
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
}
