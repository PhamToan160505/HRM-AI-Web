package com.hrm.telegram;

import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.repository.EmployeeRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramHrmDataService {

    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final PayrollRepository payrollRepository;
    private final ApplicationRepository applicationRepository;
    private final JobPostingRepository jobPostingRepository;
    private final EmployeeRequestRepository employeeRequestRepository;
    private final DepartmentRepository departmentRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private static final List<Role> EMPLOYEE_ROLES = List.of(
            Role.NHAN_VIEN, Role.TRUONG_PHONG, Role.GIAM_DOC_PHONG_BAN, Role.CEO
    );

    public String getEmployeeSummary() {
        try {
            long total = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long active = userRepository.countByActive(true);
            long inactive = total - active;
            List<Object[]> deptDist = userRepository.getDepartmentDistributionRaw();
            StringBuilder sb = new StringBuilder();
            sb.append("*TONG QUAN NHAN SU*\n");
            sb.append("------------------------\n");
            sb.append(String.format("Tong nhan vien: *%d nguoi*\n", total));
            sb.append(String.format("Dang hoat dong: *%d nguoi*\n", active));
            sb.append(String.format("Da nghi viec: *%d nguoi*\n\n", inactive));
            if (!deptDist.isEmpty()) {
                sb.append("*Phan bo theo phong ban:*\n");
                for (Object[] row : deptDist) {
                    String dept = row[0] != null ? row[0].toString() : "Chua phan cong";
                    long count = ((Number) row[1]).longValue();
                    sb.append(String.format("  - %s: *%d nguoi*\n", dept, count));
                }
            }
            sb.append("\n_Cap nhat: ").append(LocalDate.now().format(DATE_FMT)).append("_");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting employee summary", e);
            return "Khong the lay du lieu nhan su. Vui long thu lai.";
        }
    }

    public String getTodayAttendance() {
        try {
            LocalDate today = LocalDate.now();
            long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
            long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
            long absent  = attendanceRepository.countByDateAndStatus(today, "ABSENT");
            long onLeave = attendanceRepository.countByDateAndStatus(today, "ON_LEAVE");
            long totalActive = userRepository.countByActive(true);
            StringBuilder sb = new StringBuilder();
            sb.append("*CHAM CONG HOM NAY*\n");
            sb.append("Ngay: ").append(today.format(DATE_FMT)).append("\n");
            sb.append("------------------------\n");
            sb.append(String.format("Co mat dung gio: *%d nguoi*\n", present));
            sb.append(String.format("Di muon: *%d nguoi*\n", late));
            sb.append(String.format("Vang mat: *%d nguoi*\n", absent));
            sb.append(String.format("Nghi phep: *%d nguoi*\n", onLeave));
            sb.append(String.format("Tong nhan vien: *%d nguoi*\n\n", totalActive));
            long checked = present + late + absent + onLeave;
            long notChecked = Math.max(0, totalActive - checked);
            if (notChecked > 0) sb.append(String.format("Chua cham cong: *%d nguoi*\n", notChecked));
            sb.append("\n_Cap nhat: ").append(LocalDate.now().format(DATE_FMT)).append("_");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting attendance", e);
            return "Khong the lay du lieu cham cong. Vui long thu lai.";
        }
    }

    public String getPayrollSummary() {
        try {
            LocalDate now = LocalDate.now();
            int month = now.getMonthValue();
            int year  = now.getYear();
            var payrolls = payrollRepository.findByMonthAndYear(month, year);
            if (payrolls.isEmpty()) {
                LocalDate prev = now.minusMonths(1);
                payrolls = payrollRepository.findByMonthAndYear(prev.getMonthValue(), prev.getYear());
                if (!payrolls.isEmpty()) { month = prev.getMonthValue(); year = prev.getYear(); }
            }
            if (payrolls.isEmpty()) return "Chua co du lieu bang luong thang nay.";
            double totalNet   = payrolls.stream().mapToDouble(p -> p.getNetSalary()   != null ? p.getNetSalary()   : 0).sum();
            double totalGross = payrolls.stream().mapToDouble(p -> p.getGrossSalary() != null ? p.getGrossSalary() : 0).sum();
            double maxSalary  = payrolls.stream().mapToDouble(p -> p.getNetSalary()   != null ? p.getNetSalary()   : 0).max().orElse(0);
            double avgSalary  = payrolls.stream().mapToDouble(p -> p.getNetSalary()   != null ? p.getNetSalary()   : 0).average().orElse(0);
            long approved = payrolls.stream().filter(p -> "APPROVED".equals(p.getStatus())).count();
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("*BANG LUONG THANG %d/%d*\n", month, year));
            sb.append("------------------------\n");
            sb.append(String.format("So nhan vien: *%d nguoi*\n", payrolls.size()));
            sb.append(String.format("Da phe duyet: *%d nguoi*\n", approved));
            sb.append(String.format("Tong Gross: *%,.0f VND*\n", totalGross));
            sb.append(String.format("Tong Net: *%,.0f VND*\n", totalNet));
            sb.append(String.format("Luong trung binh: *%,.0f VND*\n", avgSalary));
            sb.append(String.format("Luong cao nhat: *%,.0f VND*\n", maxSalary));
            sb.append("\n_Nguon: He thong HRM AI_");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting payroll summary", e);
            return "Khong the lay du lieu luong. Vui long thu lai.";
        }
    }

    public String getRecruitmentSummary() {
        try {
            long openPostings    = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long totalApps       = applicationRepository.count();
            long pendingCvReview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long pendingInterview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_1)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
            long pendingOffer = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_OFFER)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_OFFER_APPROVAL)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.OFFER_INTERNALLY_APPROVED);
            StringBuilder sb = new StringBuilder();
            sb.append("*TINH HINH TUYEN DUNG*\n");
            sb.append("------------------------\n");
            sb.append(String.format("Vi tri dang tuyen: *%d vi tri*\n", openPostings));
            sb.append(String.format("Tong ung vien: *%d nguoi*\n", totalApps));
            sb.append(String.format("Dang sang loc CV: *%d nguoi*\n", pendingCvReview));
            sb.append(String.format("Dang phong van: *%d nguoi*\n", pendingInterview));
            sb.append(String.format("Giai doan Offer: *%d nguoi*\n", pendingOffer));
            sb.append("\n_Nguon: He thong HRM AI_");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting recruitment summary", e);
            return "Khong the lay du lieu tuyen dung. Vui long thu lai.";
        }
    }

    public String getPendingRequestsSummary() {
        try {
            var allRequests = employeeRequestRepository.findAll();
            long pendingCount  = allRequests.stream().filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            long approvedToday = allRequests.stream()
                    .filter(r -> r.getStatus() == RequestStatus.APPROVED
                            && r.getCreatedAt() != null
                            && r.getCreatedAt().toLocalDate().equals(LocalDate.now())).count();
            long rejectedToday = allRequests.stream()
                    .filter(r -> r.getStatus() == RequestStatus.REJECTED
                            && r.getCreatedAt() != null
                            && r.getCreatedAt().toLocalDate().equals(LocalDate.now())).count();
            StringBuilder sb = new StringBuilder();
            sb.append("*YEU CAU NHAN VIEN*\n");
            sb.append("------------------------\n");
            sb.append(String.format("Cho phe duyet: *%d yeu cau*\n", pendingCount));
            sb.append(String.format("Da duyet hom nay: *%d yeu cau*\n", approvedToday));
            sb.append(String.format("Tu choi hom nay: *%d yeu cau*\n", rejectedToday));
            if (pendingCount > 0) sb.append("\n_Con ").append(pendingCount).append(" yeu cau can xu ly!_");
            sb.append("\n_Cap nhat: ").append(LocalDate.now().format(DATE_FMT)).append("_");
            return sb.toString();
        } catch (Exception e) {
            log.error("Error getting pending requests", e);
            return "Khong the lay du lieu yeu cau. Vui long thu lai.";
        }
    }

    public String getFullDashboard() {
        StringBuilder sb = new StringBuilder();
        sb.append("*DASHBOARD HRM AI - TONG QUAN*\n");
        sb.append("------------------------------\n\n");
        try {
            long total  = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long active = userRepository.countByActive(true);
            sb.append(String.format("Nhan vien: *%d* (dang lam: *%d*)\n", total, active));
        } catch (Exception ignored) {}
        try {
            LocalDate today = LocalDate.now();
            long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
            long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
            sb.append(String.format("Hom nay: *%d* dung gio, *%d* di muon\n", present, late));
        } catch (Exception ignored) {}
        try {
            long open = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long pendingApp = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            sb.append(String.format("Tuyen dung: *%d* vi tri mo, *%d* ung vien dang xet\n", open, pendingApp));
        } catch (Exception ignored) {}
        try {
            var allReqs = employeeRequestRepository.findAll();
            long pending = allReqs.stream().filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            if (pending > 0) sb.append(String.format("Yeu cau cho duyet: *%d*\n", pending));
        } catch (Exception ignored) {}
        sb.append("\n_Go /help de xem danh sach lenh chi tiet._");
        return sb.toString();
    }
}