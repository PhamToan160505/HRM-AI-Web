package com.hrm.request.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.dto.ApproveRequestDto;
import com.hrm.request.dto.EmployeeRequestDto;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeRequestServiceTest {

    @Mock
    private EmployeeRequestRepository requestRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private EmployeeRequestService service;

    private User employee;
    private User manager;
    private User director;
    private User otherDeptManager;

    @BeforeEach
    void setUp() {
        service = new EmployeeRequestService(
                requestRepository,
                userRepository,
                attendanceRepository,
                notificationService,
                eventPublisher
        );

        employee = User.builder()
                .id(10L)
                .hoTen("Phạm Hương Lan")
                .maNhanVien("02000003")
                .email("dev_lan@hrm.vn")
                .role(Role.NHAN_VIEN)
                .departmentId(2L)
                .active(true)
                .build();

        manager = User.builder()
                .id(8L)
                .hoTen("Trần Văn Trưởng Phòng Kỹ Thuật")
                .maNhanVien("02000001")
                .email("truongphong_kt@hrm.vn")
                .role(Role.TRUONG_PHONG)
                .departmentId(2L)
                .active(true)
                .build();

        director = User.builder()
                .id(4L)
                .hoTen("Phạm Văn Giám Đốc Phòng")
                .maNhanVien("88000002")
                .email("giamdocphong@hrm.vn")
                .role(Role.GIAM_DOC_PHONG_BAN)
                .departmentId(2L)
                .active(true)
                .build();

        otherDeptManager = User.builder()
                .id(5L)
                .hoTen("Trần Thị Trưởng Phòng")
                .maNhanVien("01000001")
                .email("truongphong@hrm.vn")
                .role(Role.TRUONG_PHONG)
                .departmentId(1L)
                .active(true)
                .build();
    }

    @Test
    void approveWfhRequest_succeedsAndSyncsAttendanceAndNotifiesEmployee() {
        LocalDate wfhDate = LocalDate.of(2026, 11, 11); // Wednesday
        EmployeeRequest req = EmployeeRequest.builder()
                .id(1L)
                .user(employee)
                .requestType(RequestType.SPECIAL_WFH_LEAVE)
                .reason("test")
                .startDate(wfhDate)
                .endDate(wfhDate)
                .status(RequestStatus.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        when(requestRepository.findById(1L)).thenReturn(Optional.of(req));
        when(userRepository.findById(8L)).thenReturn(Optional.of(manager));
        when(requestRepository.save(any(EmployeeRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(10L, wfhDate)).thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(inv -> inv.getArgument(0));

        ApproveRequestDto dto = new ApproveRequestDto();
        dto.setNote("Đồng ý duyệt");

        EmployeeRequestDto result = service.approveRequest(8L, 1L, dto);

        assertEquals(RequestStatus.APPROVED, result.getStatus());
        assertEquals("Đồng ý duyệt", result.getNote());

        ArgumentCaptor<Attendance> attCaptor = ArgumentCaptor.forClass(Attendance.class);
        verify(attendanceRepository).save(attCaptor.capture());
        Attendance savedAtt = attCaptor.getValue();
        assertEquals(10L, savedAtt.getEmployeeId());
        assertEquals(wfhDate, savedAtt.getDate());
        assertEquals(LocalTime.of(0, 0), savedAtt.getTimeIn());
        assertEquals("ABSENT", savedAtt.getStatus());
        assertEquals("APPROVED", savedAtt.getExceptionStatus());
        assertEquals("SPECIAL_WFH_LEAVE", savedAtt.getLoaiNghiPhep());

        verify(notificationService).createNotification(
                eq(10L),
                eq("REQUEST"),
                eq("Đơn yêu cầu đã được duyệt"),
                anyString(),
                eq("quan_trong"),
                eq("/employee/requests")
        );
    }

    @Test
    void approveAlreadyApprovedRequest_throwsAppExceptionBadRequestInsteadOf500() {
        EmployeeRequest alreadyApproved = EmployeeRequest.builder()
                .id(1L)
                .user(employee)
                .requestType(RequestType.SPECIAL_WFH_LEAVE)
                .reason("test")
                .startDate(LocalDate.of(2026, 11, 11))
                .endDate(LocalDate.of(2026, 11, 11))
                .status(RequestStatus.APPROVED)
                .build();

        when(requestRepository.findById(1L)).thenReturn(Optional.of(alreadyApproved));
        when(userRepository.findById(8L)).thenReturn(Optional.of(manager));

        AppException ex = assertThrows(AppException.class,
                () -> service.approveRequest(8L, 1L, new ApproveRequestDto()));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Đã duyệt"));
        verify(requestRepository, never()).save(any());
        verifyNoInteractions(attendanceRepository);
    }

    @Test
    void approveRequest_whenNotificationFails_doesNotRollbackOrThrow500() {
        LocalDate wfhDate = LocalDate.of(2026, 11, 11);
        EmployeeRequest req = EmployeeRequest.builder()
                .id(2L)
                .user(employee)
                .requestType(RequestType.SPECIAL_WFH_LEAVE)
                .reason("WFH test")
                .startDate(wfhDate)
                .endDate(wfhDate)
                .status(RequestStatus.PENDING)
                .build();

        when(requestRepository.findById(2L)).thenReturn(Optional.of(req));
        when(userRepository.findById(8L)).thenReturn(Optional.of(manager));
        when(requestRepository.save(any(EmployeeRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(10L, wfhDate)).thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(inv -> inv.getArgument(0));
        doThrow(new RuntimeException("WebSocket offline"))
                .when(notificationService).createNotification(any(), any(), any(), any(), any(), any());

        EmployeeRequestDto result = assertDoesNotThrow(() -> service.approveRequest(8L, 2L, new ApproveRequestDto()));
        assertEquals(RequestStatus.APPROVED, result.getStatus());
    }

    @Test
    void approveRequest_rejectsSelfApprovalAndCrossDepartmentManager() {
        EmployeeRequest ownReq = EmployeeRequest.builder()
                .id(3L)
                .user(manager)
                .requestType(RequestType.NORMAL_LEAVE)
                .reason("Nghỉ cá nhân")
                .startDate(LocalDate.of(2026, 11, 12))
                .endDate(LocalDate.of(2026, 11, 12))
                .status(RequestStatus.PENDING)
                .build();

        when(requestRepository.findById(3L)).thenReturn(Optional.of(ownReq));
        when(userRepository.findById(8L)).thenReturn(Optional.of(manager));

        AppException selfEx = assertThrows(AppException.class,
                () -> service.approveRequest(8L, 3L, null));
        assertEquals(HttpStatus.FORBIDDEN, selfEx.getStatus());

        EmployeeRequest dept2EmpReq = EmployeeRequest.builder()
                .id(4L)
                .user(employee)
                .requestType(RequestType.NORMAL_LEAVE)
                .reason("Nghỉ")
                .startDate(LocalDate.of(2026, 11, 12))
                .endDate(LocalDate.of(2026, 11, 12))
                .status(RequestStatus.PENDING)
                .build();

        when(requestRepository.findById(4L)).thenReturn(Optional.of(dept2EmpReq));
        when(userRepository.findById(5L)).thenReturn(Optional.of(otherDeptManager));

        AppException crossDeptEx = assertThrows(AppException.class,
                () -> service.approveRequest(5L, 4L, null));
        assertEquals(HttpStatus.FORBIDDEN, crossDeptEx.getStatus());
    }

    @Test
    void forwardAndDirectorRejectForwardedRequest_workAndUseManagerPersonalNotificationRoute() {
        LocalDate leaveDate = LocalDate.of(2026, 11, 13);
        EmployeeRequest empReq = EmployeeRequest.builder()
                .id(5L)
                .user(employee)
                .requestType(RequestType.UNPAID_LEAVE)
                .reason("Việc gia đình")
                .startDate(leaveDate)
                .endDate(leaveDate)
                .status(RequestStatus.PENDING)
                .build();

        when(requestRepository.findById(5L)).thenReturn(Optional.of(empReq));
        when(userRepository.findById(8L)).thenReturn(Optional.of(manager));
        when(userRepository.findByDepartmentIdAndRole(2L, Role.GIAM_DOC_PHONG_BAN)).thenReturn(List.of(director));
        when(requestRepository.save(any(EmployeeRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ApproveRequestDto fwdNote = new ApproveRequestDto();
        fwdNote.setNote("Xin Giám đốc xem xét");
        EmployeeRequestDto forwarded = service.forwardRequest(8L, 5L, fwdNote);

        assertEquals(RequestStatus.FORWARDED, forwarded.getStatus());
        verify(notificationService).createNotification(
                eq(4L), eq("REQUEST"), eq("Đơn từ được chuyển tiếp"), anyString(), eq("quan_trong"), eq("/director/requests"));

        // Trưởng phòng cannot approve a request already forwarded up to Director
        AppException mgrTryApproveFwd = assertThrows(AppException.class,
                () -> service.approveRequest(8L, 5L, new ApproveRequestDto()));
        assertEquals(HttpStatus.BAD_REQUEST, mgrTryApproveFwd.getStatus());

        // Giám đốc can reject the forwarded request
        when(userRepository.findById(4L)).thenReturn(Optional.of(director));
        ApproveRequestDto rejNote = new ApproveRequestDto();
        rejNote.setNote("Dự án đang gấp");
        EmployeeRequestDto rejected = service.rejectRequest(4L, 5L, rejNote);

        assertEquals(RequestStatus.REJECTED, rejected.getStatus());
        assertEquals("Dự án đang gấp", rejected.getNote());

        // Approving a Manager's own request routes notification to /manager/my-requests
        EmployeeRequest mgrReq = EmployeeRequest.builder()
                .id(6L)
                .user(manager)
                .requestType(RequestType.OVERTIME)
                .reason("OT release")
                .startDate(leaveDate)
                .endDate(leaveDate)
                .status(RequestStatus.PENDING)
                .build();
        when(requestRepository.findById(6L)).thenReturn(Optional.of(mgrReq));
        service.approveRequest(4L, 6L, new ApproveRequestDto());
        verify(notificationService).createNotification(
                eq(8L), eq("REQUEST"), eq("Đơn yêu cầu đã được duyệt"), anyString(), eq("quan_trong"), eq("/manager/my-requests"));
    }
}

