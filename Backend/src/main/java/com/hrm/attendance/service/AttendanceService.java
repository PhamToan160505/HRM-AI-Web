package com.hrm.attendance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.entity.FaceEmbedding;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.attendance.repository.FaceEmbeddingRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.notification.service.NotificationService;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final FaceEmbeddingRepository faceEmbeddingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final DepartmentRepository departmentRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final double SIMILARITY_THRESHOLD = 0.6; 
    private static final LocalTime START_TIME = LocalTime.of(8, 0); 

    public Attendance punch(Long employeeId, String incomingVectorJson, String location) {
        try {
            List<Double> incomingVector = objectMapper.readValue(incomingVectorJson, new TypeReference<List<Double>>() {});
            
            FaceEmbedding storedEmbedding = faceEmbeddingRepository.findFirstByEmployeeIdOrderByIdDesc(employeeId)
                    .orElseThrow(() -> new RuntimeException("Chưa đăng ký khuôn mặt"));
                    
            List<Double> storedVector = objectMapper.readValue(storedEmbedding.getEmbeddingVector(), new TypeReference<List<Double>>() {});
            
            double distance = calculateEuclideanDistance(incomingVector, storedVector);
            if (distance > SIMILARITY_THRESHOLD) {
                throw new RuntimeException("Khuôn mặt không khớp. Vui lòng thử lại.");
            }

            LocalDate today = LocalDate.now();
            LocalTime now = LocalTime.now();
            
            // Tìm các bản ghi trong ngày (phòng trường hợp DB đang có lỗi nhiều bản ghi cùng ngày)
            java.util.Optional<Attendance> todayRecordOpt = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, today);
            
            Attendance attendance;
            if (todayRecordOpt.isPresent()) {
                // Nếu có nhiều hơn 1, lấy cái đầu tiên (nên fix triệt để DB)
                attendance = todayRecordOpt.get();
                // Check-out
                if (attendance.getTimeOut() != null) {
                    throw new RuntimeException("Bạn đã check-out hôm nay rồi.");
                }
                attendance.setTimeOut(now);
                attendance.setLocationOut(location);
                
                // Append log
                List<String> logs = new java.util.ArrayList<>();
                if (attendance.getScanHistory() != null) {
                    logs = objectMapper.readValue(attendance.getScanHistory(), new TypeReference<List<String>>() {});
                }
                logs.add(now.toString());
                attendance.setScanHistory(objectMapper.writeValueAsString(logs));
                
                return attendanceRepository.save(attendance);
            } else {
                // Check-in
                String status = "PRESENT";
                if (now.isAfter(START_TIME)) {
                    status = "LATE";
                }
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
                map.put("recordId", record.getId());
            } else {
                map.put("status", "ABSENT");
            }
            return map;
        }).toList();
    }

    public Page<java.util.Map<String, Object>> getDepartmentAttendancePaginated(Long departmentId, LocalDate date, String searchTerm, com.hrm.common.entity.Role filterRole, Pageable pageable) {
        Page<User> employeesPage;
        if (departmentId == null) {
            // For CEO
            employeesPage = userRepository.findWithFilters(java.util.List.of(
                com.hrm.common.entity.Role.NHAN_VIEN,
                com.hrm.common.entity.Role.TRUONG_PHONG,
                com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN
            ), null, filterRole, searchTerm, pageable);
        } else {
            employeesPage = userRepository.findWithFilters(java.util.List.of(
                com.hrm.common.entity.Role.NHAN_VIEN,
                com.hrm.common.entity.Role.TRUONG_PHONG
            ), departmentId, filterRole, searchTerm, pageable);
        }

        List<User> employees = employeesPage.getContent();
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        
        List<Attendance> attendances = attendanceRepository.findByEmployeeIdInAndDate(employeeIds, date);
        java.util.Map<Long, Attendance> attendanceMap = attendances.stream()
                .collect(java.util.stream.Collectors.toMap(Attendance::getEmployeeId, a -> a, (a1, a2) -> a1.getId() > a2.getId() ? a1 : a2));
                
        List<java.util.Map<String, Object>> content = employees.stream().map(emp -> {
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
                map.put("recordId", record.getId());
            } else {
                map.put("status", "ABSENT");
            }
            return map;
        }).toList();

        return new PageImpl<>(content, pageable, employeesPage.getTotalElements());
    }

    public void approveException(Long attendanceId, String approvalStatus, String loaiNghiPhep, CustomUserDetails userDetails) {
        Attendance record = attendanceRepository.findById(attendanceId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bản ghi chấm công"));
        
        if ("APPROVED".equals(approvalStatus)) {
            // Cập nhật lại status theo loại nghỉ phép hoặc chỉ đánh dấu là hợp lệ
            if (loaiNghiPhep != null && !loaiNghiPhep.isEmpty() && !"NORMAL_LEAVE".equals(loaiNghiPhep)) {
                record.setStatus(loaiNghiPhep);
            } else {
                // Nếu đi muộn, có thể giữ nguyên LATE nhưng isException=true (tức là đã duyệt), 
                // hoặc đổi sang APPROVED_LATE. Ta giữ logic đơn giản:
                if (record.getStatus() == null || record.getStatus().equals("ABSENT")) {
                    record.setStatus("EXCUSED");
                }
            }
            record.setIsException(true); // đã được duyệt ngoại lệ
        } else {
            // REJECTED
            record.setIsException(false);
        }
        
        attendanceRepository.save(record);
        
        // Notify nhân viên
        String content = String.format("Ngoại lệ chấm công ngày %s của bạn đã bị %s.", 
                record.getDate().toString(), 
                "APPROVED".equals(approvalStatus) ? "phê duyệt" : "từ chối");
        notificationService.createNotification(record.getEmployeeId(), "THONG_BAO", "Kết quả duyệt ngoại lệ chấm công", content, "quan_trong", null);
    }

    public List<java.util.Map<String, Object>> getDepartmentsAttendanceStats(LocalDate date) {
        List<Department> departments = departmentRepository.findAll();
        List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
        
        for (Department dept : departments) {
            List<User> employees = userRepository.findByDepartmentId(dept.getId());
            long totalEmployees = employees.size();
            List<Long> employeeIds = employees.stream().map(User::getId).toList();
            
            List<Attendance> attendances = attendanceRepository.findByEmployeeIdInAndDate(employeeIds, date);
            
            long presentCount = attendances.stream().filter(a -> "PRESENT".equals(a.getStatus())).count();
            long lateCount = attendances.stream().filter(a -> "LATE".equals(a.getStatus())).count();
            
            long explicitlyAbsent = attendances.stream().filter(a -> "ABSENT".equals(a.getStatus()) || "EXCUSED".equals(a.getStatus()) || "UNPAID_LEAVE".equals(a.getStatus())).count();
            long absentCount = totalEmployees - attendances.size() + explicitlyAbsent;

            java.util.Map<String, Object> stat = new java.util.HashMap<>();
            stat.put("departmentId", dept.getId());
            stat.put("departmentName", dept.getTenPhong());
            stat.put("totalEmployees", totalEmployees);
            stat.put("presentCount", presentCount);
            stat.put("lateCount", lateCount);
            stat.put("absentCount", absentCount);
            
            result.add(stat);
        }
        return result;
    }
}
