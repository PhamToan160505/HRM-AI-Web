package com.hrm.common.service;

import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final AttendanceRepository attendanceRepository;
    private final JobPostingRepository jobPostingRepository;

    public Map<String, Object> getDirectorStats() {
        Map<String, Object> stats = new HashMap<>();
        
        long totalEmployees = userRepository.count();
        stats.put("totalEmployees", totalEmployees);
        
        long totalOpenJobs = jobPostingRepository.countByStatus("OPEN");
        stats.put("openJobs", totalOpenJobs);
        
        long activeCandidates = applicationRepository.countByApprovalStatusNotAndApprovalStatusNot("HIRED", "REJECTED");
        stats.put("activeCandidates", activeCandidates);
        
        long todayPresent = attendanceRepository.countByDateAndStatus(LocalDate.now(), "PRESENT");
        long todayLate = attendanceRepository.countByDateAndStatus(LocalDate.now(), "LATE");
        long todayAbsent = totalEmployees - todayPresent - todayLate;
        if (todayAbsent < 0) todayAbsent = 0;
        
        Map<String, Long> todayAttendance = new HashMap<>();
        todayAttendance.put("present", todayPresent);
        todayAttendance.put("late", todayLate);
        todayAttendance.put("absent", todayAbsent);
        stats.put("todayAttendance", todayAttendance);
        
        List<Object[]> deptRaw = userRepository.getDepartmentDistributionRaw();
        List<Map<String, Object>> deptDist = new ArrayList<>();
        for (Object[] row : deptRaw) {
            Map<String, Object> map = new HashMap<>();
            map.put("name", row[0]);
            map.put("value", row[1]);
            deptDist.add(map);
        }
        stats.put("departmentDistribution", deptDist);
        
        // Recent Activities
        List<Map<String, Object>> recentActivities = new ArrayList<>();
        
        applicationRepository.findTop5ByOrderByCreatedAtDesc().forEach(app -> {
            Map<String, Object> act = new HashMap<>();
            act.put("type", "APPLICATION");
            act.put("avatar", app.getFullName().substring(0, 1).toUpperCase());
            act.put("title", app.getFullName() + " ứng tuyển vào " + (app.getJobPosting() != null ? app.getJobPosting().getTitle() : ""));
            act.put("time", getTimeAgo(app.getCreatedAt()));
            act.put("createdAt", app.getCreatedAt());
            recentActivities.add(act);
        });
        
        attendanceRepository.findTop5ByIsExceptionTrueOrderByIdDesc().forEach(att -> {
            userRepository.findById(att.getEmployeeId()).ifPresent(user -> {
                Map<String, Object> act = new HashMap<>();
                act.put("type", "ATTENDANCE_EXCEPTION");
                act.put("avatar", user.getHoTen().substring(0, 1).toUpperCase());
                act.put("title", user.getHoTen() + " nộp đơn ngoại lệ chấm công");
                // Attedance exception doesn't have createdAt, let's just use date
                act.put("time", getTimeAgo(att.getDate().atStartOfDay()));
                act.put("createdAt", att.getDate().atStartOfDay());
                recentActivities.add(act);
            });
        });
        
        recentActivities.sort((a, b) -> ((LocalDateTime) b.get("createdAt")).compareTo((LocalDateTime) a.get("createdAt")));
        if (recentActivities.size() > 5) {
            stats.put("recentActivities", recentActivities.subList(0, 5));
        } else {
            stats.put("recentActivities", recentActivities);
        }
        
        return stats;
    }
    
    private String getTimeAgo(LocalDateTime time) {
        if (time == null) return "Vừa xong";
        Duration duration = Duration.between(time, LocalDateTime.now());
        if (duration.toMinutes() < 60) return duration.toMinutes() + " phút trước";
        if (duration.toHours() < 24) return duration.toHours() + " giờ trước";
        return duration.toDays() + " ngày trước";
    }

    public Map<String, Object> getManagerStats(Long departmentId) {
        Map<String, Object> stats = new HashMap<>();
        
        long pendingApplications = applicationRepository.countByApprovalStatus("PENDING_MANAGER");
        stats.put("pendingApplications", pendingApplications);
        
        long pendingAttendances = attendanceRepository.countByExceptionStatusAndDepartmentId("PENDING", departmentId);
        stats.put("pendingAttendances", pendingAttendances);
        
        stats.put("openJobs", jobPostingRepository.findByStatus("OPEN"));
        
        return stats;
    }

    public Map<String, Object> getEmployeeStats(Long employeeId) {
        Map<String, Object> stats = new HashMap<>();
        
        // Find today's attendance
        attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(employeeId, LocalDate.now())
            .ifPresent(att -> {
                stats.put("todayAttendance", att);
            });
            
        return stats;
    }
}
