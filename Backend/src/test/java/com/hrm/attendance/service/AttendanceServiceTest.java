package com.hrm.attendance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.entity.FaceEmbedding;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.attendance.repository.FaceEmbeddingRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AttendanceServiceTest {

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
        attendanceService = new AttendanceService(
                attendanceRepository,
                faceEmbeddingRepository,
                userRepository,
                notificationService,
                departmentRepository
        );
    }

    @Test
    void punchUpdatesLatestCheckoutWhenAttendanceAlreadyHasTimeout() throws Exception {
        Long employeeId = 10L;
        String vectorJson = "[0.1,0.2,0.3]";
        Attendance existingAttendance = Attendance.builder()
                .id(20L)
                .employeeId(employeeId)
                .date(LocalDate.now())
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
        when(attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, LocalDate.now()))
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
}
