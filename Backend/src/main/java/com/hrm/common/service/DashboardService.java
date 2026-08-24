package com.hrm.common.service;

import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.common.payroll.repository.PayrollRepository;
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
    private final PayrollRepository payrollRepository;

    public Map<String, Object> getDirectorStats() {
        Map<String, Object> stats = new HashMap<>();
        
        java.util.List<com.hrm.common.entity.Role> employeeRoles = java.util.List.of(
            com.hrm.common.entity.Role.NHAN_VIEN, 
            com.hrm.common.entity.Role.TRUONG_PHONG, 
            com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN
        );
        long totalEmployees = userRepository.countByRoleIn(employeeRoles);
        stats.put("totalEmployees", totalEmployees);

        Double totalBudget = userRepository.sumTotalSalaryBudgetByRoleIn(employeeRoles);
        stats.put("totalSalaryBudget", totalBudget != null ? totalBudget : 0.0);
        
        long totalOpenJobs = jobPostingRepository.countByStatus("OPEN");
        stats.put("openJobs", totalOpenJobs);
        
        long pendingDirectorApps = applicationRepository.countByApprovalStatus("PENDING_DIRECTOR");
        stats.put("pendingApplications", pendingDirectorApps);
        
        long pendingPayrolls = payrollRepository.countByStatus("DRAFT");
        stats.put("pendingPayrolls", pendingPayrolls);
        
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

    public Map<String, Object> getManagerStats(com.hrm.security.CustomUserDetails userDetails) {
        Map<String, Object> stats = new HashMap<>();
        
        long pendingApplications = applicationRepository.countByApprovalStatus("PENDING");
        stats.put("pendingApplications", pendingApplications);
        
        long pendingAttendances = 0;
        long totalEmployees = 0;
        long todayCheckedIn = 0;
        java.util.List<com.hrm.common.entity.User> employees = new java.util.ArrayList<>();
        
        if (userDetails.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN || userDetails.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            Long departmentId = userDetails.getDepartmentId();
            pendingAttendances = attendanceRepository.countByExceptionStatusAndDepartmentId("PENDING", departmentId);
            totalEmployees = userRepository.countByDepartmentId(departmentId);
            todayCheckedIn = attendanceRepository.countByDepartmentIdAndDateAndPresentOrLate(departmentId, LocalDate.now());
            employees = userRepository.findByDepartmentId(departmentId);
        }
        
        stats.put("pendingAttendances", pendingAttendances);
        
        long todayNotCheckedIn = totalEmployees - todayCheckedIn;
        if (todayNotCheckedIn < 0) todayNotCheckedIn = 0;

        stats.put("todayCheckedIn", todayCheckedIn);
        stats.put("todayNotCheckedIn", todayNotCheckedIn);
        
        // Payroll status logic
        LocalDate now = LocalDate.now();
        java.util.List<Long> employeeIds = employees.stream().map(com.hrm.common.entity.User::getId).toList();
        java.util.List<com.hrm.common.payroll.entity.Payroll> payrolls = new java.util.ArrayList<>();
        if (!employeeIds.isEmpty()) {
            payrolls = payrollRepository.findByMonthAndYearAndEmployeeIdIn(now.getMonthValue(), now.getYear(), employeeIds);
        }
            
        String payrollStatus;
        if (payrolls.isEmpty()) {
            payrollStatus = "Chưa tính";
        } else if (payrolls.size() < employees.size()) {
            payrollStatus = String.format("Đã tính một phần (%d/%d nhân viên)", payrolls.size(), employees.size());
        } else {
            boolean hasDraft = payrolls.stream().anyMatch(p -> "DRAFT".equals(p.getStatus()));
            boolean hasRejected = payrolls.stream().anyMatch(p -> "REJECTED".equals(p.getStatus()));
            
            if (hasDraft) {
                payrollStatus = "Đã tính, chờ duyệt";
            } else if (hasRejected) {
                payrollStatus = "Có hồ sơ bị từ chối, cần tính lại";
            } else {
                payrollStatus = "Đã duyệt";
            }
        }
        stats.put("payrollStatus", payrollStatus);
        
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
