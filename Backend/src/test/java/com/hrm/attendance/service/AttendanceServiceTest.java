package com.hrm.attendance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.entity.FaceEmbedding;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.attendance.repository.FaceEmbeddingRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AttendanceServiceTest {

    private static final ZoneId ATTENDANCE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 1);

    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private FaceEmbeddingRepository faceEmbeddingRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private DepartmentRepository departmentRepository;

    private AttendanceService attendanceService;

    @BeforeEach
    void setUp() {
        attendanceService = serviceAt(LocalTime.of(12, 30));
    }

    private AttendanceService serviceAt(LocalTime time) {
        Clock clock = Clock.fixed(
                ZonedDateTime.of(TODAY, time, ATTENDANCE_ZONE).toInstant(),
                ATTENDANCE_ZONE);
        return new AttendanceService(
                attendanceRepository,
                faceEmbeddingRepository,
                userRepository,
                notificationService,
                departmentRepository,
                clock
        );
    }

    @Test
    void punchRejectsBeforeCheckInWindowOpens() {
        attendanceService = serviceAt(LocalTime.of(7, 29, 59));

        AppException exception = assertThrows(AppException.class,
                () -> attendanceService.punch(10L, "[0.1,0.2,0.3]", "Văn phòng"));

        assertEquals("Chưa đến giờ chấm công. Check-in mở từ 07:30.", exception.getMessage());
        verifyNoInteractions(faceEmbeddingRepository, attendanceRepository);
    }

    @Test
    void punchRejectsAfterCheckoutWindowCloses() {
        attendanceService = serviceAt(LocalTime.of(18, 1));

        AppException exception = assertThrows(AppException.class,
                () -> attendanceService.punch(10L, "[0.1,0.2,0.3]", "Văn phòng"));

        assertEquals("Đã hết giờ chấm công. Check-out đóng lúc 18:00.", exception.getMessage());
        verifyNoInteractions(faceEmbeddingRepository, attendanceRepository);
    }

    @Test
    void punchUpdatesLatestCheckoutWhenAttendanceAlreadyHasTimeout() throws Exception {
        Long employeeId = 10L;
        String vectorJson = "[0.1,0.2,0.3]";
        Attendance existingAttendance = Attendance.builder()
                .id(20L)
                .employeeId(employeeId)
                .date(TODAY)
                .timeIn(LocalTime.of(8, 0))
                .timeOut(LocalTime.of(12, 0))
                .locationIn("Văn phòng")
                .locationOut("Cổng phụ")
                .status("PRESENT")
                .scanHistory("[\"08:00\",\"12:00\"]")
                .build();

        FaceEmbedding storedEmbedding = FaceEmbedding.builder()
                .employeeId(employeeId)
                .embeddingVector(vectorJson)
                .build();

        when(faceEmbeddingRepository.findFirstByEmployeeIdOrderByIdDesc(employeeId))
                .thenReturn(Optional.of(storedEmbedding));
        when(attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, TODAY))
                .thenReturn(Optional.of(existingAttendance));
        when(attendanceRepository.save(any(Attendance.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Attendance result = attendanceService.punch(employeeId, vectorJson, "Cổng chính");

        assertNotNull(result.getTimeOut());
        assertFalse(result.getTimeOut().equals(LocalTime.of(12, 0)));
        assertEquals(LocalTime.of(8, 0), result.getTimeIn());
        assertEquals("Cổng chính", result.getLocationOut());

        List<String> scanHistory = new ObjectMapper().readValue(
                result.getScanHistory(),
                new TypeReference<List<String>>() {}
        );
        assertEquals(3, scanHistory.size());
        assertEquals(result.getTimeOut().toString(), scanHistory.get(2));
    }

    @Test
    void punchAllowsCheckInAtExactlySevenThirty() {
        attendanceService = serviceAt(LocalTime.of(7, 30));
        Long employeeId = 10L;
        String vectorJson = "[0.1,0.2,0.3]";
        FaceEmbedding storedEmbedding = FaceEmbedding.builder()
                .employeeId(employeeId)
                .embeddingVector(vectorJson)
                .build();

        when(faceEmbeddingRepository.findFirstByEmployeeIdOrderByIdDesc(employeeId))
                .thenReturn(Optional.of(storedEmbedding));
        when(attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, TODAY))
                .thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Attendance result = attendanceService.punch(employeeId, vectorJson, "Văn phòng");

        assertEquals(LocalTime.of(7, 30), result.getTimeIn());
        assertEquals("PRESENT", result.getStatus());
    }

    @Test
    void punchAllowsCheckoutAtExactlyEighteen() {
        attendanceService = serviceAt(LocalTime.of(18, 0));
        Long employeeId = 10L;
        String vectorJson = "[0.1,0.2,0.3]";
        Attendance existingAttendance = Attendance.builder()
                .id(20L)
                .employeeId(employeeId)
                .date(TODAY)
                .timeIn(LocalTime.of(8, 0))
                .status("PRESENT")
                .scanHistory("[\"08:00\"]")
                .build();
        FaceEmbedding storedEmbedding = FaceEmbedding.builder()
                .employeeId(employeeId)
                .embeddingVector(vectorJson)
                .build();

        when(faceEmbeddingRepository.findFirstByEmployeeIdOrderByIdDesc(employeeId))
                .thenReturn(Optional.of(storedEmbedding));
        when(attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, TODAY))
                .thenReturn(Optional.of(existingAttendance));
        when(attendanceRepository.save(any(Attendance.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Attendance result = attendanceService.punch(employeeId, vectorJson, "Cổng chính");

        assertEquals(LocalTime.of(18, 0), result.getTimeOut());
    }
}
