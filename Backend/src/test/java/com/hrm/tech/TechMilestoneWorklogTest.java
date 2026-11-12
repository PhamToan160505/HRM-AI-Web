package com.hrm.tech;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import com.hrm.tech.service.TechMilestoneService;
import com.hrm.tech.service.TechWorklogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TechMilestoneWorklogTest {

    private final TechProjectMilestoneRepository milestoneRepository = mock(TechProjectMilestoneRepository.class);
    private final TechWorklogRepository worklogRepository = mock(TechWorklogRepository.class);
    private final TechProjectRepository projectRepository = mock(TechProjectRepository.class);
    private final TechProjectMemberRepository memberRepository = mock(TechProjectMemberRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final AttendanceRepository attendanceRepository = mock(AttendanceRepository.class);
    private final EmployeeRequestRepository employeeRequestRepository = mock(EmployeeRequestRepository.class);
    private final HolidayRepository holidayRepository = mock(HolidayRepository.class);

    private TechMilestoneService milestoneService;
    private TechWorklogService worklogService;

    private TechProject sampleProject;
    private User devUser;
    private User managerUser;
    private User otherDeptManager;

    @BeforeEach
    void setUp() {
        milestoneService = new TechMilestoneService(milestoneRepository, projectRepository, userRepository);
        worklogService = new TechWorklogService(
                worklogRepository,
                projectRepository,
                memberRepository,
                milestoneRepository,
                userRepository,
                departmentRepository,
                notificationService,
                attendanceRepository,
                employeeRequestRepository,
                holidayRepository
        );

        sampleProject = TechProject.builder()
                .id(1L)
                .projectCode("PRJ-HRM-AI")
                .projectName("HRM AI Core")
                .projectType(ProjectType.INTERNAL)
                .status(ProjectStatus.IN_PROGRESS)
                .build();

        devUser = User.builder()
                .id(10L)
                .hoTen("Nguyen Hoang Nam")
                .email("dev_nam@hrm.vn")
                .maNhanVien("02000002")
                .role(Role.NHAN_VIEN)
                .departmentId(2L)
                .active(true)
                .build();

        managerUser = User.builder()
                .id(20L)
                .hoTen("Tran Van Truong Phong")
                .email("truongphong_kt@hrm.vn")
                .role(Role.TRUONG_PHONG)
                .departmentId(2L)
                .active(true)
                .build();

        otherDeptManager = User.builder()
                .id(21L)
                .hoTen("Tran Thi Nhan Su")
                .email("truongphong@hrm.vn")
                .role(Role.TRUONG_PHONG)
                .departmentId(1L)
                .active(true)
                .build();
    }

    @Test
    void tc01_createMilestoneValidatesTotalWeightNotExceeding100Percent() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(milestoneRepository.sumWeightPercentByProjectIdExcluding(1L, null)).thenReturn(70);
        when(userRepository.findById(20L)).thenReturn(Optional.of(managerUser));
        when(milestoneRepository.save(any(TechProjectMilestone.class))).thenAnswer(inv -> {
            TechProjectMilestone m = inv.getArgument(0);
            m.setId(100L);
            return m;
        });

        CreateMilestoneRequest overReq = new CreateMilestoneRequest();
        overReq.setTitle("Over Weight Milestone");
        overReq.setDueDate(LocalDate.now().plusDays(10));
        overReq.setWeightPercent(40); // 70 + 40 = 110 > 100

        AppException ex = assertThrows(AppException.class,
                () -> milestoneService.createMilestone(1L, overReq, 20L));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());

        CreateMilestoneRequest pastReq = new CreateMilestoneRequest();
        pastReq.setTitle("Past Due Date Milestone");
        pastReq.setDueDate(LocalDate.now().minusDays(1));
        pastReq.setWeightPercent(20);

        AppException pastEx = assertThrows(AppException.class,
                () -> milestoneService.createMilestone(1L, pastReq, 20L));
        assertEquals(HttpStatus.BAD_REQUEST, pastEx.getStatus());

        CreateMilestoneRequest validReq = new CreateMilestoneRequest();
        validReq.setTitle("Valid Completed Milestone");
        validReq.setDueDate(LocalDate.now().plusDays(10));
        validReq.setWeightPercent(30); // 70 + 30 = 100
        validReq.setStatus(MilestoneStatus.COMPLETED);
        validReq.setCompletionPercent(50);

        TechMilestoneResponse res = milestoneService.createMilestone(1L, validReq, 20L);
        assertEquals(100, res.getCompletionPercent());
        assertNotNull(res.getCompletedAt());
    }

    @Test
    void tc02_actualProgressCalculationSupportsWeightedAverageAndEmptyNull() {
        assertNull(TechMilestoneService.calculateActualProgressPercent(Collections.emptyList()));

        List<TechProjectMilestone> weighted = Arrays.asList(
                TechProjectMilestone.builder().weightPercent(25).completionPercent(100).build(),
                TechProjectMilestone.builder().weightPercent(40).completionPercent(80).build(),
                TechProjectMilestone.builder().weightPercent(35).completionPercent(30).build()
        );
        // (2500 + 3200 + 1050) / 100 = 67.5 -> 68
        assertEquals(68, TechMilestoneService.calculateActualProgressPercent(weighted));

        List<TechProjectMilestone> unweighted = Arrays.asList(
                TechProjectMilestone.builder().weightPercent(0).completionPercent(100).build(),
                TechProjectMilestone.builder().weightPercent(0).completionPercent(50).build()
        );
        assertEquals(75, TechMilestoneService.calculateActualProgressPercent(unweighted));
    }

    @Test
    void tc03_activeMemberCanCreateWorklogAndNotifiesManager() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(memberRepository.existsByProjectIdAndUserIdAndIsActiveTrue(1L, 10L)).thenReturn(true);
        when(worklogRepository.sumActiveHoursByUserIdAndWorkDateExcluding(eq(10L), any(LocalDate.class), isNull()))
                .thenReturn(BigDecimal.valueOf(4.0));
        when(worklogRepository.save(any(TechWorklog.class))).thenAnswer(inv -> {
            TechWorklog w = inv.getArgument(0);
            w.setId(500L);
            return w;
        });
        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findByDepartmentIdAndRole(2L, Role.TRUONG_PHONG)).thenReturn(List.of(managerUser));

        CreateWorklogRequest req = new CreateWorklogRequest();
        req.setProjectId(1L);
        req.setWorkDate(LocalDate.now());
        req.setHoursSpent(4.0);
        req.setWorkType(WorklogType.DEVELOPMENT);
        req.setTaskSummary("Implement API milestone");

        TechWorklogResponse res = worklogService.createWorklog(req, 10L);
        assertEquals(WorklogApprovalStatus.PENDING, res.getApprovalStatus());
        assertEquals(4.0, res.getHoursSpent());
        String expectedMgrLink = "/manager/tech-projects?tab=timesheet&worklogId=500&month="
                + YearMonth.from(req.getWorkDate());
        verify(notificationService, times(1))
                .createNotification(eq(20L), eq("TECH_WORKLOG_SUBMITTED"), anyString(), anyString(), eq("binh_thuong"), eq(expectedMgrLink));
    }

    @Test
    void tc04_nonMemberCannotLogWorkForProject() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(memberRepository.existsByProjectIdAndUserIdAndIsActiveTrue(1L, 10L)).thenReturn(false);

        CreateWorklogRequest req = new CreateWorklogRequest();
        req.setProjectId(1L);
        req.setWorkDate(LocalDate.now());
        req.setHoursSpent(2.0);
        req.setTaskSummary("Unauthorized log");

        AppException ex = assertThrows(AppException.class, () -> worklogService.createWorklog(req, 10L));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    void tc05_dailyCapOver16hAndFutureDateAreBlocked() {
        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(memberRepository.existsByProjectIdAndUserIdAndIsActiveTrue(1L, 10L)).thenReturn(true);

        CreateWorklogRequest futureReq = new CreateWorklogRequest();
        futureReq.setProjectId(1L);
        futureReq.setWorkDate(LocalDate.now().plusDays(1));
        futureReq.setHoursSpent(4.0);
        futureReq.setTaskSummary("Future work");
        assertThrows(AppException.class, () -> worklogService.createWorklog(futureReq, 10L));

        when(worklogRepository.sumActiveHoursByUserIdAndWorkDateExcluding(eq(10L), any(LocalDate.class), isNull()))
                .thenReturn(BigDecimal.valueOf(12.5));

        CreateWorklogRequest overCapReq = new CreateWorklogRequest();
        overCapReq.setProjectId(1L);
        overCapReq.setWorkDate(LocalDate.now());
        overCapReq.setHoursSpent(4.0); // 12.5 + 4.0 = 16.5 > 16
        overCapReq.setTaskSummary("Overtime past cap");

        AppException ex = assertThrows(AppException.class, () -> worklogService.createWorklog(overCapReq, 10L));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void tc06_tc07_worklogApprovalSelfApprovalRejectionAndLockAfterApproval() {
        TechWorklog pendingLog = TechWorklog.builder()
                .id(600L)
                .project(sampleProject)
                .userId(10L)
                .workDate(LocalDate.now())
                .hoursSpent(BigDecimal.valueOf(6.0))
                .workType(WorklogType.DEVELOPMENT)
                .isBillable(false)
                .taskSummary("Build API")
                .approvalStatus(WorklogApprovalStatus.PENDING)
                .build();

        TechWorklog managerOwnLog = TechWorklog.builder()
                .id(601L)
                .project(sampleProject)
                .userId(20L)
                .workDate(LocalDate.now())
                .hoursSpent(BigDecimal.valueOf(3.0))
                .approvalStatus(WorklogApprovalStatus.PENDING)
                .build();

        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findById(20L)).thenReturn(Optional.of(managerUser));
        when(userRepository.findById(21L)).thenReturn(Optional.of(otherDeptManager));
        when(worklogRepository.findById(600L)).thenReturn(Optional.of(pendingLog));
        when(worklogRepository.findById(601L)).thenReturn(Optional.of(managerOwnLog));
        when(worklogRepository.save(any(TechWorklog.class))).thenAnswer(inv -> inv.getArgument(0));

        // Engineer cannot approve
        assertThrows(AppException.class, () -> worklogService.approveWorklog(600L, 10L));
        // Cross-department manager cannot approve
        assertThrows(AppException.class, () -> worklogService.approveWorklog(600L, 21L));
        // Manager cannot self-approve
        assertThrows(AppException.class, () -> worklogService.approveWorklog(601L, 20L));
        // Blank rejection reason blocked
        RejectWorklogRequest emptyReject = new RejectWorklogRequest();
        emptyReject.setRejectionReason("   ");
        assertThrows(AppException.class, () -> worklogService.rejectWorklog(600L, 20L, emptyReject));

        // Same-department manager approves successfully
        TechWorklogResponse approved = worklogService.approveWorklog(600L, 20L);
        assertEquals(WorklogApprovalStatus.APPROVED, approved.getApprovalStatus());
        String expectedEmpLink = "/employee/my-projects?tab=timesheet&worklogId=600&month="
                + YearMonth.from(pendingLog.getWorkDate());
        verify(notificationService, times(1))
                .createNotification(eq(10L), eq("TECH_WORKLOG_APPROVED"), anyString(), anyString(), eq("binh_thuong"), eq(expectedEmpLink));

        // TC-07: Engineer blocked from editing/deleting APPROVED worklog
        UpdateWorklogRequest updateReq = new UpdateWorklogRequest();
        updateReq.setWorkDate(LocalDate.now());
        updateReq.setHoursSpent(5.0);
        updateReq.setTaskSummary("Modified task");
        assertThrows(AppException.class, () -> worklogService.updateWorklog(600L, updateReq, 10L));
        assertThrows(AppException.class, () -> worklogService.deleteWorklog(600L, 10L));

        // Rejected worklog can be edited and resets to PENDING
        pendingLog.setApprovalStatus(WorklogApprovalStatus.REJECTED);
        pendingLog.setRejectionReason("Thieu link PR");
        when(worklogRepository.sumActiveHoursByUserIdAndWorkDateExcluding(eq(10L), any(LocalDate.class), eq(600L)))
                .thenReturn(BigDecimal.ZERO);
        TechWorklogResponse resubmitted = worklogService.updateWorklog(600L, updateReq, 10L);
        assertEquals(WorklogApprovalStatus.PENDING, resubmitted.getApprovalStatus());
        assertNull(resubmitted.getRejectionReason());
    }

    @Test
    void tc09_analyticsRespectsSalarySecurityAndDoesNotExposePersonalSalaries() {
        devUser.setBaseSalary(35_200_000.0); // 200,000/h across 176h/mo

        TechWorklog approvedLog = TechWorklog.builder()
                .id(700L)
                .project(sampleProject)
                .userId(10L)
                .workDate(LocalDate.now())
                .hoursSpent(BigDecimal.valueOf(8.0))
                .workType(WorklogType.DEVELOPMENT)
                .isBillable(true)
                .approvalStatus(WorklogApprovalStatus.APPROVED)
                .build();

        when(userRepository.findAll()).thenReturn(List.of(devUser, managerUser));
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(devUser, managerUser));
        when(projectRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(sampleProject));
        when(worklogRepository.findAllForAnalyticsInRange(any(), any())).thenReturn(List.of(approvedLog));
        when(memberRepository.findByProjectIdAndIsActiveTrue(1L)).thenReturn(List.of(
                TechProjectMember.builder().project(sampleProject).userId(10L).allocationPercent(100).isActive(true).build()
        ));
        when(memberRepository.getTotalActiveAllocationByUserId(10L)).thenReturn(100);
        when(milestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(1L)).thenReturn(Collections.emptyList());

        String currentMonth = YearMonth.now().toString();

        // TRUONG_PHONG cannot see labor costs
        WorklogAnalyticsResponse mgrView = worklogService.getAnalytics(currentMonth, Role.TRUONG_PHONG, 2L);
        assertFalse(mgrView.getCanViewCost());
        assertNull(mgrView.getEstimatedTotalLaborCost());
        assertNull(mgrView.getProjectBreakdowns().get(0).getEstimatedLaborCost());

        // CEO sees aggregated project cost (8h * 200,000 = 1,600,000), still ZERO salary fields on EngineerBurnItem/WorklogResponse
        when(departmentRepository.findByTenPhong("Công nghệ")).thenReturn(Optional.empty());
        when(departmentRepository.findByTenPhong("Kỹ thuật")).thenReturn(Optional.empty());
        WorklogAnalyticsResponse ceoView = worklogService.getAnalytics(currentMonth, Role.CEO, null);
        assertTrue(ceoView.getCanViewCost());
        assertEquals(1_600_000.0, ceoView.getEstimatedTotalLaborCost());
        assertEquals(1_600_000.0, ceoView.getProjectBreakdowns().get(0).getEstimatedLaborCost());

        List<String> engFieldNames = Arrays.stream(WorklogAnalyticsResponse.EngineerBurnItem.class.getDeclaredFields())
                .map(Field::getName).toList();
        assertFalse(engFieldNames.stream().anyMatch(n -> n.toLowerCase().contains("salary") || n.toLowerCase().contains("cost")));

        List<String> wlFieldNames = Arrays.stream(TechWorklogResponse.class.getDeclaredFields())
                .map(Field::getName).toList();
        assertFalse(wlFieldNames.stream().anyMatch(n -> n.toLowerCase().contains("salary") || n.toLowerCase().contains("allowance")));
    }

    @Test
    void tc10_approvedWfhWorklogIsNotFalselyFlaggedEvenWhenAttendanceStatusIsAbsent() {
        LocalDate wfhDate = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.WEDNESDAY));

        TechWorklog wfh5hLog = TechWorklog.builder()
                .id(801L)
                .project(sampleProject)
                .userId(10L)
                .workDate(wfhDate)
                .hoursSpent(BigDecimal.valueOf(5.0))
                .workType(WorklogType.DEVELOPMENT)
                .isBillable(true)
                .taskSummary("Phát triển tính năng đối chiếu WFH tại nhà")
                .referenceUrl("https://github.com/company/hrm-ai/pull/99")
                .approvalStatus(WorklogApprovalStatus.PENDING)
                .build();

        // Simulate exact DB state written by EmployeeRequestService.approveRequest() for SPECIAL_WFH_LEAVE
        Attendance wfhAttendance = Attendance.builder()
                .id(101L)
                .employeeId(10L)
                .date(wfhDate)
                .timeIn(LocalTime.of(0, 0))
                .timeOut(null)
                .status("ABSENT")
                .isException(true)
                .exceptionStatus("APPROVED")
                .loaiNghiPhep(RequestType.SPECIAL_WFH_LEAVE.name())
                .build();

        EmployeeRequest wfhRequest = EmployeeRequest.builder()
                .id(201L)
                .user(devUser)
                .requestType(RequestType.SPECIAL_WFH_LEAVE)
                .startDate(wfhDate)
                .endDate(wfhDate)
                .status(RequestStatus.APPROVED)
                .reason("Làm việc tại nhà")
                .build();

        TechProjectMember fullAlloc = TechProjectMember.builder()
                .id(301L)
                .project(sampleProject)
                .userId(10L)
                .allocationPercent(100)
                .isActive(true)
                .build();

        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(devUser, managerUser));
        when(worklogRepository.findDepartmentWorklogsWithFilters(isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of(wfh5hLog));
        when(worklogRepository.findActiveWorklogsByUserIdsInRange(anyCollection(), any(), any()))
                .thenReturn(List.of(wfh5hLog));
        when(attendanceRepository.findByEmployeeIdInAndDateBetween(anyCollection(), any(), any()))
                .thenReturn(List.of(wfhAttendance));
        when(employeeRequestRepository.findApprovedRequestsByUserIdsInRange(anyCollection(), any(), any()))
                .thenReturn(List.of(wfhRequest));
        when(holidayRepository.findByNgayLeBetween(any(), any())).thenReturn(Collections.emptyList());
        when(memberRepository.findAllByUserIdInWithProjectOrderByActiveDesc(anyCollection()))
                .thenReturn(List.of(fullAlloc));

        List<TechWorklogResponse> result = worklogService.getDepartmentWorklogs(Role.TRUONG_PHONG, 2L, null, null, null, null);
        assertEquals(1, result.size());
        TechWorklogResponse res = result.get(0);
        assertEquals("ATTENDANCE_WFH", res.getAttendanceContextCode());
        assertEquals("WFH đã duyệt", res.getAttendanceContextLabel());
        assertEquals("INFO", res.getAttendanceSeverity());
        assertFalse(Boolean.TRUE.equals(res.getHasAuditWarning()));

        // Now log 10h on WFH without OT -> flags WFH over 8h warning
        wfh5hLog.setHoursSpent(BigDecimal.valueOf(10.0));
        List<TechWorklogResponse> overResult = worklogService.getDepartmentWorklogs(Role.GIAM_DOC_PHONG_BAN, 2L, null, null, null, null);
        assertEquals("ATTENDANCE_WFH_OVER_HOURS", overResult.get(0).getAttendanceContextCode());
        assertEquals("WARNING", overResult.get(0).getAttendanceSeverity());
        assertTrue(Boolean.TRUE.equals(overResult.get(0).getHasAuditWarning()));
    }

    @Test
    void tc11_halfDayOvertimeLeaveAndOfficePresenceAreProperlyClassified() {
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate tuesday = monday.plusDays(1);
        LocalDate wednesday = monday.plusDays(2);
        LocalDate thursday = monday.plusDays(3);
        LocalDate saturday = monday.plusDays(5);

        TechWorklog halfDayOk = TechWorklog.builder()
                .id(810L).project(sampleProject).userId(10L).workDate(monday)
                .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.CODE_REVIEW)
                .approvalStatus(WorklogApprovalStatus.PENDING).build();

        TechWorklog fullLeaveConflict = TechWorklog.builder()
                .id(811L).project(sampleProject).userId(10L).workDate(tuesday)
                .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.MEETING)
                .approvalStatus(WorklogApprovalStatus.PENDING).build();

        TechWorklog officeMismatch = TechWorklog.builder()
                .id(812L).project(sampleProject).userId(10L).workDate(wednesday)
                .hoursSpent(BigDecimal.valueOf(7.0)).workType(WorklogType.MEETING)
                .approvalStatus(WorklogApprovalStatus.PENDING).build();

        TechWorklog officeMatched = TechWorklog.builder()
                .id(813L).project(sampleProject).userId(10L).workDate(thursday)
                .hoursSpent(BigDecimal.valueOf(8.0)).workType(WorklogType.MEETING)
                .approvalStatus(WorklogApprovalStatus.PENDING).build();

        TechWorklog saturdayOt = TechWorklog.builder()
                .id(814L).project(sampleProject).userId(10L).workDate(saturday)
                .hoursSpent(BigDecimal.valueOf(6.0)).workType(WorklogType.CODE_REVIEW)
                .approvalStatus(WorklogApprovalStatus.PENDING).build();

        List<TechWorklog> logs = List.of(halfDayOk, fullLeaveConflict, officeMismatch, officeMatched, saturdayOt);

        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(devUser, managerUser));
        when(worklogRepository.findDepartmentWorklogsWithFilters(isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(logs);
        when(worklogRepository.findActiveWorklogsByUserIdsInRange(anyCollection(), any(), any()))
                .thenReturn(logs);
        when(holidayRepository.findByNgayLeBetween(any(), any())).thenReturn(Collections.emptyList());
        when(memberRepository.findAllByUserIdInWithProjectOrderByActiveDesc(anyCollection()))
                .thenReturn(List.of(TechProjectMember.builder().project(sampleProject).userId(10L).allocationPercent(100).isActive(true).build()));

        when(attendanceRepository.findByEmployeeIdInAndDateBetween(anyCollection(), any(), any())).thenReturn(List.of(
                Attendance.builder().id(1L).employeeId(10L).date(monday).timeIn(LocalTime.of(8, 0)).timeOut(LocalTime.of(12, 0))
                        .status("ABSENT").isException(true).exceptionStatus("APPROVED").loaiNghiPhep("HALF_DAY_LEAVE").build(),
                Attendance.builder().id(2L).employeeId(10L).date(tuesday).timeIn(LocalTime.of(0, 0))
                        .status("ABSENT").isException(true).exceptionStatus("APPROVED").loaiNghiPhep("NORMAL_LEAVE").build(),
                Attendance.builder().id(3L).employeeId(10L).date(wednesday).timeIn(LocalTime.of(8, 0)).timeOut(LocalTime.of(12, 0))
                        .status("PRESENT").build(),
                Attendance.builder().id(4L).employeeId(10L).date(thursday).timeIn(LocalTime.of(8, 0)).timeOut(LocalTime.of(17, 30))
                        .status("PRESENT").build()
        ));

        when(employeeRequestRepository.findApprovedRequestsByUserIdsInRange(anyCollection(), any(), any())).thenReturn(List.of(
                EmployeeRequest.builder().id(10L).user(devUser).requestType(RequestType.HALF_DAY_LEAVE).startDate(monday).endDate(monday).status(RequestStatus.APPROVED).build(),
                EmployeeRequest.builder().id(11L).user(devUser).requestType(RequestType.NORMAL_LEAVE).startDate(tuesday).endDate(tuesday).status(RequestStatus.APPROVED).build(),
                EmployeeRequest.builder().id(12L).user(devUser).requestType(RequestType.OVERTIME).startDate(saturday).endDate(saturday).status(RequestStatus.APPROVED).build()
        ));

        List<TechWorklogResponse> responses = worklogService.getDepartmentWorklogs(Role.TRUONG_PHONG, 2L, null, null, null, null);
        assertEquals("ATTENDANCE_HALF_DAY", responses.get(0).getAttendanceContextCode());
        assertFalse(responses.get(0).getHasAuditWarning());

        assertEquals("ATTENDANCE_LEAVE_CONFLICT", responses.get(1).getAttendanceContextCode());
        assertEquals("DANGER", responses.get(1).getAttendanceSeverity());
        assertTrue(responses.get(1).getHasAuditWarning());

        assertEquals("ATTENDANCE_HOURS_EXCEEDED", responses.get(2).getAttendanceContextCode());
        assertEquals("DANGER", responses.get(2).getAttendanceSeverity());
        assertTrue(responses.get(2).getHasAuditWarning());

        assertEquals("ATTENDANCE_MATCHED", responses.get(3).getAttendanceContextCode());
        assertEquals("OK", responses.get(3).getAttendanceSeverity());
        assertFalse(responses.get(3).getHasAuditWarning());

        assertEquals("ATTENDANCE_OVERTIME", responses.get(4).getAttendanceContextCode());
        assertEquals("INFO", responses.get(4).getAttendanceSeverity());
        assertFalse(responses.get(4).getHasAuditWarning());
    }

    @Test
    void tc12_tc13_missingPrLinkAndAllocationOverloadAlertsWorkCorrectly() {
        LocalDate workDate = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.FRIDAY));

        TechWorklog bugMissingUrlAndOverloaded = TechWorklog.builder()
                .id(820L)
                .project(sampleProject)
                .userId(10L)
                .workDate(workDate)
                .hoursSpent(BigDecimal.valueOf(8.0))
                .workType(WorklogType.BUG_FIX)
                .referenceUrl(null)
                .approvalStatus(WorklogApprovalStatus.PENDING)
                .build();

        TechWorklog smallDevOk = TechWorklog.builder()
                .id(821L)
                .project(sampleProject)
                .userId(10L)
                .workDate(workDate.minusDays(1))
                .hoursSpent(BigDecimal.valueOf(1.5))
                .workType(WorklogType.DEVELOPMENT)
                .referenceUrl(null)
                .approvalStatus(WorklogApprovalStatus.PENDING)
                .build();

        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(devUser, managerUser));
        when(worklogRepository.findDepartmentWorklogsWithFilters(isNull(), isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of(bugMissingUrlAndOverloaded, smallDevOk));
        when(worklogRepository.findActiveWorklogsByUserIdsInRange(anyCollection(), any(), any()))
                .thenReturn(List.of(bugMissingUrlAndOverloaded, smallDevOk));
        when(attendanceRepository.findByEmployeeIdInAndDateBetween(anyCollection(), any(), any())).thenReturn(List.of(
                Attendance.builder().id(5L).employeeId(10L).date(workDate).timeIn(LocalTime.of(8, 0)).timeOut(LocalTime.of(17, 30)).status("PRESENT").build(),
                Attendance.builder().id(6L).employeeId(10L).date(workDate.minusDays(1)).timeIn(LocalTime.of(8, 0)).timeOut(LocalTime.of(17, 30)).status("PRESENT").build()
        ));
        when(employeeRequestRepository.findApprovedRequestsByUserIdsInRange(anyCollection(), any(), any())).thenReturn(Collections.emptyList());
        when(holidayRepository.findByNgayLeBetween(any(), any())).thenReturn(Collections.emptyList());
        // Engineer allocated only 50% (~4h/day) on sampleProject
        when(memberRepository.findAllByUserIdInWithProjectOrderByActiveDesc(anyCollection()))
                .thenReturn(List.of(TechProjectMember.builder().project(sampleProject).userId(10L).allocationPercent(50).isActive(true).build()));

        List<TechWorklogResponse> responses = worklogService.getDepartmentWorklogs(Role.TRUONG_PHONG, 2L, null, null, null, null);

        TechWorklogResponse flagged = responses.get(0);
        assertTrue(Boolean.TRUE.equals(flagged.getHasAuditWarning()));
        assertEquals(50, flagged.getProjectAllocationPercent());
        assertTrue(flagged.getAuditAlerts().stream().anyMatch(a -> "MISSING_EVIDENCE_URL".equals(a.getCode())));
        assertTrue(flagged.getAuditAlerts().stream().anyMatch(a -> "ALLOCATION_OVERLOAD".equals(a.getCode())));

        TechWorklogResponse okSmall = responses.get(1);
        assertFalse(Boolean.TRUE.equals(okSmall.getHasAuditWarning()));
        assertFalse(okSmall.getAuditAlerts().stream().anyMatch(a -> "MISSING_EVIDENCE_URL".equals(a.getCode())));
        assertFalse(okSmall.getAuditAlerts().stream().anyMatch(a -> "ALLOCATION_OVERLOAD".equals(a.getCode())));
    }

    @Test
    void tc14_submittedWorklogNotifiesBothManagerAndDirectorWithDeepLinkAndBroadcastsSync() {
        User directorUser = User.builder()
                .id(30L)
                .hoTen("Pham Van Giam Doc Phong")
                .email("giamdocphong@hrm.vn")
                .role(Role.GIAM_DOC_PHONG_BAN)
                .departmentId(2L)
                .active(true)
                .build();

        when(projectRepository.findById(1L)).thenReturn(Optional.of(sampleProject));
        when(memberRepository.existsByProjectIdAndUserIdAndIsActiveTrue(1L, 10L)).thenReturn(true);
        when(worklogRepository.sumActiveHoursByUserIdAndWorkDateExcluding(eq(10L), any(LocalDate.class), isNull()))
                .thenReturn(BigDecimal.ZERO);
        when(worklogRepository.save(any(TechWorklog.class))).thenAnswer(inv -> {
            TechWorklog w = inv.getArgument(0);
            w.setId(555L);
            return w;
        });
        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findByDepartmentIdAndRole(2L, Role.TRUONG_PHONG)).thenReturn(List.of(managerUser));
        when(userRepository.findByDepartmentIdAndRole(2L, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of(directorUser));

        CreateWorklogRequest req = new CreateWorklogRequest();
        req.setProjectId(1L);
        req.setWorkDate(LocalDate.now());
        req.setHoursSpent(4.0);
        req.setWorkType(WorklogType.CODE_REVIEW);
        req.setTaskSummary("Review ma nguon");

        worklogService.createWorklog(req, 10L);
        String monthStr = YearMonth.from(req.getWorkDate()).toString();

        verify(notificationService, times(1)).createNotification(
                eq(20L),
                eq("TECH_WORKLOG_SUBMITTED"),
                anyString(),
                anyString(),
                eq("binh_thuong"),
                eq("/manager/tech-projects?tab=timesheet&worklogId=555&month=" + monthStr)
        );
        verify(notificationService, times(1)).createNotification(
                eq(30L),
                eq("TECH_WORKLOG_SUBMITTED"),
                anyString(),
                anyString(),
                eq("binh_thuong"),
                eq("/director/tech-projects?tab=timesheet&worklogId=555&month=" + monthStr)
        );
        verify(notificationService, times(1)).broadcastTopic(eq("/topic/tech-updates"), anyMap());
    }

    @Test
    void tc15_departmentWorklogsPaginationSupportsPageableFilteringAuditChipsAndFocusPage() {
        LocalDate d1 = LocalDate.now();
        List<TechWorklog> sixLogs = List.of(
                TechWorklog.builder().id(901L).project(sampleProject).userId(10L).workDate(d1)
                        .hoursSpent(BigDecimal.valueOf(3.0)).workType(WorklogType.DEVELOPMENT)
                        .referenceUrl(null).approvalStatus(WorklogApprovalStatus.PENDING).build(),
                TechWorklog.builder().id(902L).project(sampleProject).userId(10L).workDate(d1.minusDays(1))
                        .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.CODE_REVIEW)
                        .referenceUrl("https://github.com/org/repo/pull/2").approvalStatus(WorklogApprovalStatus.PENDING).build(),
                TechWorklog.builder().id(903L).project(sampleProject).userId(10L).workDate(d1.minusDays(2))
                        .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.DEVELOPMENT)
                        .referenceUrl("https://github.com/org/repo/pull/3").approvalStatus(WorklogApprovalStatus.APPROVED).build(),
                TechWorklog.builder().id(904L).project(sampleProject).userId(10L).workDate(d1.minusDays(3))
                        .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.BUG_FIX)
                        .referenceUrl(null).approvalStatus(WorklogApprovalStatus.APPROVED).build(),
                TechWorklog.builder().id(905L).project(sampleProject).userId(10L).workDate(d1.minusDays(4))
                        .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.TESTING_QA)
                        .referenceUrl("https://github.com/org/repo/pull/5").approvalStatus(WorklogApprovalStatus.APPROVED).build(),
                TechWorklog.builder().id(906L).project(sampleProject).userId(10L).workDate(d1.minusDays(5))
                        .hoursSpent(BigDecimal.valueOf(4.0)).workType(WorklogType.DEPLOYMENT)
                        .referenceUrl("https://github.com/org/repo/pull/6").approvalStatus(WorklogApprovalStatus.REJECTED).build()
        );

        when(userRepository.findById(10L)).thenReturn(Optional.of(devUser));
        when(userRepository.findByDepartmentId(2L)).thenReturn(List.of(devUser, managerUser));
        when(worklogRepository.findDepartmentWorklogsWithFilters(isNull(), isNull(), isNull(), any(), any()))
                .thenReturn(sixLogs);
        when(worklogRepository.findActiveWorklogsByUserIdsInRange(anyCollection(), any(), any()))
                .thenReturn(sixLogs.subList(0, 5));
        when(attendanceRepository.findByEmployeeIdInAndDateBetween(anyCollection(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(employeeRequestRepository.findApprovedRequestsByUserIdsInRange(anyCollection(), any(), any()))
                .thenReturn(Collections.emptyList());
        when(holidayRepository.findByNgayLeBetween(any(), any())).thenReturn(Collections.emptyList());
        when(memberRepository.findAllByUserIdInWithProjectOrderByActiveDesc(anyCollection()))
                .thenReturn(List.of(TechProjectMember.builder().project(sampleProject).userId(10L).allocationPercent(100).isActive(true).build()));

        when(worklogRepository.findScopedDepartmentWorklogsPage(anyCollection(), isNull(), isNull(), isNull(), any(), any(), any(Pageable.class)))
                .thenAnswer(inv -> {
                    Pageable p = inv.getArgument(6);
                    int start = (int) p.getOffset();
                    int end = Math.min(start + p.getPageSize(), sixLogs.size());
                    List<TechWorklog> slice = start < sixLogs.size() ? sixLogs.subList(start, end) : Collections.emptyList();
                    return new PageImpl<>(slice, p, sixLogs.size());
                });

        String monthStr = YearMonth.from(d1).toString();
        // 1. Standard Pageable page=0, size=5 -> 5 items on page 0 out of 6 total (2 pages), monthPendingCount=2
        DepartmentWorklogPageResponse page0 = worklogService.getDepartmentWorklogsPaginated(
                Role.TRUONG_PHONG, 2L, null, null, null, monthStr, null, null, 0, 5);
        assertEquals(0, page0.getNumber());
        assertEquals(5, page0.getContent().size());
        assertEquals(6L, page0.getTotalElements());
        assertEquals(2, page0.getTotalPages());
        assertTrue(page0.isFirst());
        assertFalse(page0.isLast());
        assertEquals(6L, page0.getMonthTotalCount());
        assertEquals(2L, page0.getMonthPendingCount());
        assertEquals(2L, page0.getMissingEvidenceCount());

        // 2. Out-of-bounds page=5 clamps down to last page (page=1, 1 item: ID 906)
        DepartmentWorklogPageResponse clamped = worklogService.getDepartmentWorklogsPaginated(
                Role.TRUONG_PHONG, 2L, null, null, null, monthStr, null, null, 5, 5);
        assertEquals(1, clamped.getNumber());
        assertEquals(1, clamped.getContent().size());
        assertEquals(906L, clamped.getContent().get(0).getId());
        assertTrue(clamped.isLast());

        // 3. auditFilter=MISSING_EVIDENCE returns only logs 901 & 904 paginated properly
        DepartmentWorklogPageResponse missingEv = worklogService.getDepartmentWorklogsPaginated(
                Role.TRUONG_PHONG, 2L, null, null, null, monthStr, "MISSING_EVIDENCE", null, 0, 1);
        assertEquals(2L, missingEv.getTotalElements());
        assertEquals(2, missingEv.getTotalPages());
        assertEquals(901L, missingEv.getContent().get(0).getId());

        // 4. focusWorklogId=906 jumps automatically from page=0 to page=1 (index 5 / size 5 = 1)
        DepartmentWorklogPageResponse focused = worklogService.getDepartmentWorklogsPaginated(
                Role.GIAM_DOC_PHONG_BAN, 2L, null, null, null, monthStr, null, 906L, 0, 5);
        assertEquals(1, focused.getNumber());
        assertEquals(1, focused.getContent().size());
        assertEquals(906L, focused.getContent().get(0).getId());
    }
}

