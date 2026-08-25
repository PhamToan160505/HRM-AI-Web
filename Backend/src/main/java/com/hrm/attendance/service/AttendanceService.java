package com.hrm.attendance.service;

import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.entity.FaceEmbedding;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.attendance.repository.FaceEmbeddingRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.entity.User;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final FaceEmbeddingRepository faceEmbeddingRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    // Threshold for Euclidean distance. face-api.js default is 0.6. We use 0.4 for extremely strict match to prevent partial occlusions.
    private static final double MATCH_THRESHOLD = 0.4;
    
    // Configurable work hours (e.g., 08:30 AM)
    private static final LocalTime LATE_THRESHOLD = LocalTime.of(8, 35);

    @Transactional
    public Attendance punch(Long employeeId, String faceVectorJson, String location) {
        Optional<FaceEmbedding> registeredOpt = faceEmbeddingRepository.findFirstByEmployeeIdOrderByIdDesc(employeeId);
        if (registeredOpt.isEmpty()) {
            throw new IllegalArgumentException("Chưa đăng ký khuôn mặt trên hệ thống.");
        }

        FaceEmbedding registeredFace = registeredOpt.get();
        
        try {
            List<Double> currentVector = objectMapper.readValue(faceVectorJson, new TypeReference<List<Double>>() {});
            List<Double> registeredVector = objectMapper.readValue(registeredFace.getEmbeddingVector(), new TypeReference<List<Double>>() {});
            
            // 2. Compare vectors
            double distance = calculateEuclideanDistance(currentVector, registeredVector);
            if (distance > MATCH_THRESHOLD) {
                throw new IllegalArgumentException("Khuôn mặt không khớp (Distance: " + distance + ")");
            }
            
            // Match success, record attendance
            LocalDate today = LocalDate.now();
            LocalTime now = LocalTime.now();
            
            Optional<Attendance> todayAttendanceOpt = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, today);
            
            if (todayAttendanceOpt.isPresent()) {
                Attendance todayAttendance = todayAttendanceOpt.get();

                // --- TH ĐẶC BIỆT: Nhân viên đã có đơn nghỉ được duyệt nhưng VẪN ĐẾN LÀM ---
                if ("ABSENT".equals(todayAttendance.getStatus()) && "APPROVED".equals(todayAttendance.getExceptionStatus())) {
                    String newStatus = now.isAfter(LATE_THRESHOLD) ? "LATE" : "PRESENT";
                    todayAttendance.setStatus(newStatus);
                    todayAttendance.setTimeIn(now);
                    todayAttendance.setLocationIn(location);
                    todayAttendance.setIsException(false);
                    todayAttendance.setExceptionStatus(null);
                    todayAttendance.setExceptionReason("[Hủy - NV đến làm dù có đơn nghỉ: " + todayAttendance.getExceptionReason() + "]");
                    todayAttendance.setLoaiNghiPhep(null); // Xóa loại nghỉ phép
                    List<String> logs = new java.util.ArrayList<>();
                    logs.add(now.toString());
                    todayAttendance.setScanHistory(objectMapper.writeValueAsString(logs));
                    return attendanceRepository.save(todayAttendance);
                }

                // Bình thường: đã check-in → đây là check-out
                todayAttendance.setTimeOut(now);
                todayAttendance.setLocationOut(location);
                
                List<String> logs = new java.util.ArrayList<>();
                if (todayAttendance.getScanHistory() != null) {
                    try {
                        logs = objectMapper.readValue(todayAttendance.getScanHistory(), new TypeReference<List<String>>() {});
                    } catch (Exception ignored) {}
                }
                logs.add(now.toString());
                todayAttendance.setScanHistory(objectMapper.writeValueAsString(logs));

                return attendanceRepository.save(todayAttendance);
            } else {
                // Lần đầu trong ngày → Check-in
                String status = now.isAfter(LATE_THRESHOLD) ? "LATE" : "PRESENT";
                
                List<String> logs = new java.util.ArrayList<>();
                logs.add(now.toString());

                Attendance newAttendance = Attendance.builder()
                        .employeeId(employeeId)
                        .date(today)
                        .timeIn(now)
                        .locationIn(location)
                        .status(status)
                        .isException(false)
                        .scanHistory(objectMapper.writeValueAsString(logs))
                        .build();
                return attendanceRepository.save(newAttendance);
            }

        } catch (JsonProcessingException e) {
            throw new RuntimeException("Lỗi xử lý dữ liệu khuôn mặt", e);
        }
    }
    
    public List<Attendance> getMyAttendanceHistory(Long employeeId) {
        return attendanceRepository.findByEmployeeIdOrderByDateDesc(employeeId);
    }

    private double calculateEuclideanDistance(List<Double> v1, List<Double> v2) {
        if (v1.size() != v2.size()) {
            throw new IllegalArgumentException("Vector size mismatch");
        }
        double sum = 0.0;
        for (int i = 0; i < v1.size(); i++) {
            double diff = v1.get(i) - v2.get(i);
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    public List<java.util.Map<String, Object>> getDepartmentAttendance(Long departmentId, LocalDate date) {
        List<User> employees;
        if (departmentId == null) {
            employees = userRepository.findAll();
        } else {
            employees = userRepository.findByDepartmentId(departmentId);
        }
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        
        List<Attendance> attendances = attendanceRepository.findByEmployeeIdInAndDate(employeeIds, date);
        java.util.Map<Long, Attendance> attendanceMap = attendances.stream()
                .collect(java.util.stream.Collectors.toMap(Attendance::getEmployeeId, a -> a, (a1, a2) -> a1.getId() > a2.getId() ? a1 : a2));
                
        return employees.stream().map(emp -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", emp.getId());
            map.put("hoTen", emp.getHoTen());
            map.put("role", emp.getRole().name());
            map.put("chucVu", emp.getChucVu());
            map.put("departmentId", emp.getDepartmentId());
            map.put("date", date);
            
            Attendance record = attendanceMap.get(emp.getId());
            if (record != null) {
                map.put("timeIn", record.getTimeIn() != null ? record.getTimeIn().toString() : null);
                map.put("timeOut", record.getTimeOut() != null ? record.getTimeOut().toString() : null);
                map.put("status", record.getStatus());
                map.put("isException", record.getIsException());
                map.put("exceptionStatus", record.getExceptionStatus());
                map.put("exceptionReason", record.getExceptionReason());
                map.put("attendanceId", record.getId());
                map.put("scanHistory", record.getScanHistory());
                map.put("locationIn", record.getLocationIn());
                map.put("locationOut", record.getLocationOut());
            } else {
                map.put("timeIn", null);
                map.put("timeOut", null);
                map.put("status", "ABSENT");
                map.put("isException", false);
                map.put("scanHistory", null);
            }
            return map;
        }).toList();
    }
    public Attendance submitException(Long employeeId, LocalDate date, String reason) {
        Optional<Attendance> opt = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, date);
        Attendance attendance = opt.orElse(Attendance.builder()
                .employeeId(employeeId)
                .date(date)
                .status("ABSENT")
                .build());
        
        attendance.setIsException(true);
        attendance.setExceptionReason(reason);
        attendance.setExceptionStatus("PENDING");
        return attendanceRepository.save(attendance);
    }

    public void approveException(Long attendanceId, String status, String loaiNghiPhep, CustomUserDetails currentUser) {
        Attendance attendance = attendanceRepository.findById(attendanceId).orElseThrow(() -> new RuntimeException("Không tìm thấy"));
        
        if ("TRUONG_PHONG".equals(currentUser.getRole().name())) {
            User emp = userRepository.findById(attendance.getEmployeeId()).orElseThrow();
            if (!emp.getDepartmentId().equals(currentUser.getDepartmentId())) {
                throw new org.springframework.security.access.AccessDeniedException("Không có quyền");
            }
        }
        
        attendance.setExceptionStatus(status);
        if ("APPROVED".equals(status)) {
            if (loaiNghiPhep == null || loaiNghiPhep.isEmpty()) {
                throw new IllegalArgumentException("Phải chọn loại nghỉ phép khi duyệt");
            }
            attendance.setLoaiNghiPhep(loaiNghiPhep);
        }
        attendanceRepository.save(attendance);
    }
}
