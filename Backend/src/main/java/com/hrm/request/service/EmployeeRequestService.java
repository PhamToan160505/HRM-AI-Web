package com.hrm.request.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.dto.ApproveRequestDto;
import com.hrm.request.dto.CreateRequestDto;
import com.hrm.request.dto.EmployeeRequestDto;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmployeeRequestService {

    private final EmployeeRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final NotificationService notificationService;

    @org.springframework.beans.factory.annotation.Value("${payroll.normal-leave-days-per-month:1}")
    private int normalLeaveDaysPerMonth;

    public int getRemainingLeaveQuota(Long userId) {
        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate endOfMonth = LocalDate.now().withDayOfMonth(LocalDate.now().lengthOfMonth());
        
        List<Attendance> attendances = attendanceRepository.findByEmployeeIdAndDateBetween(userId, startOfMonth, endOfMonth);
        int used = 0;
        for (Attendance a : attendances) {
            if ("NORMAL_LEAVE".equals(a.getLoaiNghiPhep()) && "APPROVED".equals(a.getExceptionStatus())) {
                used++;
            }
        }
        return Math.max(0, normalLeaveDaysPerMonth - used);
    }

    public java.util.Map<String, Object> getMonthlySummary(Long userId) {
        LocalDate startOfMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate endOfMonth = LocalDate.now().withDayOfMonth(LocalDate.now().lengthOfMonth());

        List<com.hrm.request.entity.EmployeeRequest> approvedRequests =
                requestRepository.findApprovedRequestsForMonth(userId, startOfMonth, endOfMonth);

        int normalLeaveDays = 0;
        int wfhDays = 0;
        int halfDayCount = 0;
        int unpaidDays = 0;
        int overtimeRequests = 0;

        for (com.hrm.request.entity.EmployeeRequest req : approvedRequests) {
            // Tính số ngày làm việc (bỏ qua cuối tuần)
            int days = 0;
            LocalDate d = req.getStartDate();
            while (!d.isAfter(req.getEndDate())) {
                if (!d.isBefore(startOfMonth) && !d.isAfter(endOfMonth)) {
                    if (d.getDayOfWeek() != java.time.DayOfWeek.SATURDAY && d.getDayOfWeek() != java.time.DayOfWeek.SUNDAY) {
                        days++;
                    }
                }
                d = d.plusDays(1);
            }

            switch (req.getRequestType()) {
                case NORMAL_LEAVE -> normalLeaveDays += days;
                case SPECIAL_WFH_LEAVE -> wfhDays += days;
                case HALF_DAY_LEAVE -> halfDayCount += days;
                case UNPAID_LEAVE -> unpaidDays += days;
                case OVERTIME -> overtimeRequests++;
            }
        }

        int usedPaidLeave = Math.min(normalLeaveDays, normalLeaveDaysPerMonth);
        int extraUnpaidFromLeave = Math.max(0, normalLeaveDays - normalLeaveDaysPerMonth);

        return java.util.Map.of(
                "month", LocalDate.now().getMonthValue(),
                "year", LocalDate.now().getYear(),
                "paidLeaveQuota", normalLeaveDaysPerMonth,
                "paidLeaveUsed", usedPaidLeave,
                "paidLeaveRemaining", Math.max(0, normalLeaveDaysPerMonth - usedPaidLeave),
                "wfhDays", wfhDays,
                "halfDayCount", halfDayCount,
                "unpaidDays", unpaidDays + extraUnpaidFromLeave,
                "overtimeRequests", overtimeRequests
        );
    }

    public EmployeeRequestDto createRequest(Long userId, CreateRequestDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        EmployeeRequest request = EmployeeRequest.builder()
                .user(user)
                .requestType(dto.getRequestType())
                .reason(dto.getReason())
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .status(RequestStatus.PENDING)
                .build();

        EmployeeRequest saved = requestRepository.save(request);

        // Tìm cấp trên để gửi thông báo
        List<User> approvers = new java.util.ArrayList<>();
        if (user.getRole() == com.hrm.common.entity.Role.NHAN_VIEN) {
            approvers = userRepository.findByDepartmentIdAndRole(user.getDepartmentId(), com.hrm.common.entity.Role.TRUONG_PHONG);
        } else if (user.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            approvers = userRepository.findByDepartmentIdAndRole(user.getDepartmentId(), com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN);
        } else if (user.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            approvers = userRepository.findByRole(com.hrm.common.entity.Role.CEO);
        }

        for (User approver : approvers) {
            notificationService.createNotification(
                    approver.getId(),
                    "REQUEST",
                    "Có đơn yêu cầu mới",
                    "Nhân viên " + user.getHoTen() + " vừa tạo đơn yêu cầu mới.",
                    "binh_thuong",
                    "/manager/requests"
            );
        }

        return mapToDto(saved);
    }

    public List<EmployeeRequestDto> getMyRequests(Long userId) {
        return requestRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public List<EmployeeRequestDto> getRequestsForManager(CustomUserDetails manager) {
        List<User> subordinates = new java.util.ArrayList<>();
        
        if (manager.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            subordinates = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), com.hrm.common.entity.Role.NHAN_VIEN);
        } else if (manager.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
            subordinates = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), com.hrm.common.entity.Role.TRUONG_PHONG);
            // Also include NHAN_VIEN requests that are forwarded
            List<User> nhanViens = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), com.hrm.common.entity.Role.NHAN_VIEN);
            List<Long> nvIds = nhanViens.stream().map(User::getId).collect(Collectors.toList());
            List<EmployeeRequest> forwardedReqs = nvIds.isEmpty() ? new java.util.ArrayList<>() : requestRepository.findByUserIdInOrderByCreatedAtDesc(nvIds)
                .stream().filter(r -> r.getStatus() == RequestStatus.FORWARDED).collect(Collectors.toList());
            
            List<Long> trPhongIds = subordinates.stream().map(User::getId).collect(Collectors.toList());
            List<EmployeeRequest> allReqs = new java.util.ArrayList<>(forwardedReqs);
            if (!trPhongIds.isEmpty()) {
                allReqs.addAll(requestRepository.findByUserIdInOrderByCreatedAtDesc(trPhongIds));
            }
            allReqs.sort((r1, r2) -> r2.getCreatedAt().compareTo(r1.getCreatedAt()));
            return allReqs.stream().map(this::mapToDto).collect(Collectors.toList());
        } else if (manager.getRole() == com.hrm.common.entity.Role.CEO) {
            subordinates = userRepository.findByRole(com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN);
        } else {
            // Admin hoặc các role khác
            subordinates = userRepository.findAll();
        }

        List<Long> userIds = subordinates.stream().map(User::getId).collect(Collectors.toList());
        if (userIds.isEmpty()) {
            return new java.util.ArrayList<>();
        }

        return requestRepository.findByUserIdInOrderByCreatedAtDesc(userIds)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional
    public EmployeeRequestDto approveRequest(Long managerId, Long requestId, ApproveRequestDto dto) {
        EmployeeRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn yêu cầu"));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (request.getStatus() != RequestStatus.PENDING && request.getStatus() != RequestStatus.FORWARDED) {
            throw new RuntimeException("Chỉ có thể duyệt đơn ở trạng thái chờ duyệt hoặc chuyển tiếp (PENDING, FORWARDED)");
        }

        request.setStatus(RequestStatus.APPROVED);
        request.setApprover(manager);
        if (dto != null && dto.getNote() != null) {
            request.setNote(dto.getNote());
        }

        EmployeeRequest saved = requestRepository.save(request);

        // Ghi vào bảng Attendance (chấm công) cho các ngày nghỉ
        if (request.getRequestType() != com.hrm.request.entity.RequestType.OVERTIME) {
            LocalDate current = request.getStartDate();
            while (!current.isAfter(request.getEndDate())) {
                LocalDate dateToProcess = current;
                
                // Bỏ qua Thứ 7, Chủ nhật (nếu logic cty không tính nghỉ vào cuối tuần)
                if (dateToProcess.getDayOfWeek() != java.time.DayOfWeek.SATURDAY && 
                    dateToProcess.getDayOfWeek() != java.time.DayOfWeek.SUNDAY) {
                    
                    Optional<Attendance> existing = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(request.getUser().getId(), dateToProcess);
                    if (existing.isPresent()) {
                        Attendance att = existing.get();
                        att.setStatus("ABSENT");
                        att.setIsException(true);
                        att.setExceptionReason(request.getReason());
                        att.setExceptionStatus("APPROVED");
                        att.setLoaiNghiPhep(request.getRequestType().name());
                        attendanceRepository.save(att);
                    } else {
                        Attendance att = Attendance.builder()
                                .employeeId(request.getUser().getId())
                                .date(dateToProcess)
                                .timeIn(LocalTime.of(0, 0)) // default
                                .status("ABSENT")
                                .isException(true)
                                .exceptionReason(request.getReason())
                                .exceptionStatus("APPROVED")
                                .loaiNghiPhep(request.getRequestType().name())
                                .build();
                        attendanceRepository.save(att);
                    }
                }
                current = current.plusDays(1);
            }
        }

        // Notify user
        notificationService.createNotification(
                request.getUser().getId(),
                "REQUEST",
                "Đơn yêu cầu đã được duyệt",
                "Cấp trên đã duyệt đơn yêu cầu của bạn.",
                "quan_trong",
                "/employee/requests"
        );

        return mapToDto(saved);
    }

    @Transactional
    public EmployeeRequestDto rejectRequest(Long managerId, Long requestId, ApproveRequestDto dto) {
        EmployeeRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn yêu cầu"));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (request.getStatus() != RequestStatus.PENDING && request.getStatus() != RequestStatus.FORWARDED) {
            throw new RuntimeException("Chỉ có thể từ chối đơn ở trạng thái chờ duyệt hoặc chuyển tiếp (PENDING, FORWARDED)");
        }

        request.setStatus(RequestStatus.REJECTED);
        request.setApprover(manager);
        if (dto != null && dto.getNote() != null) {
            request.setNote(dto.getNote());
        }

        EmployeeRequest saved = requestRepository.save(request);

        // Notify user
        notificationService.createNotification(
                request.getUser().getId(),
                "REQUEST",
                "Đơn yêu cầu bị từ chối",
                "Cấp trên đã từ chối đơn yêu cầu của bạn. Lý do: " + (dto != null ? dto.getNote() : "Không có"),
                "quan_trong",
                "/employee/requests"
        );

        return mapToDto(saved);
    }

    @Transactional
    public EmployeeRequestDto forwardRequest(Long managerId, Long requestId, ApproveRequestDto dto) {
        EmployeeRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn yêu cầu"));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));

        if (manager.getRole() != com.hrm.common.entity.Role.TRUONG_PHONG) {
            throw new RuntimeException("Chỉ Trưởng phòng mới có quyền chuyển tiếp đơn");
        }

        if (request.getStatus() != RequestStatus.PENDING) {
            throw new RuntimeException("Chỉ có thể chuyển tiếp đơn ở trạng thái chờ (PENDING)");
        }

        request.setStatus(RequestStatus.FORWARDED);
        if (dto != null && dto.getNote() != null) {
            request.setNote(dto.getNote());
        }

        EmployeeRequest saved = requestRepository.save(request);

        // Notify GIAM_DOC_PHONG_BAN
        List<User> directors = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN);
        for (User director : directors) {
            notificationService.createNotification(
                    director.getId(),
                    "REQUEST",
                    "Đơn từ được chuyển tiếp",
                    "Trưởng phòng " + manager.getHoTen() + " vừa chuyển tiếp một đơn từ.",
                    "quan_trong",
                    "/director/requests"
            );
        }

        return mapToDto(saved);
    }

    private EmployeeRequestDto mapToDto(EmployeeRequest req) {
        return EmployeeRequestDto.builder()
                .id(req.getId())
                .userId(req.getUser().getId())
                .hoTen(req.getUser().getHoTen())
                .maNhanVien(req.getUser().getMaNhanVien())
                .role(req.getUser().getRole() != null ? req.getUser().getRole().name() : null)
                .avatarUrl(req.getUser().getAvatarUrl())
                .requestType(req.getRequestType())
                .reason(req.getReason())
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .status(req.getStatus())
                .note(req.getNote())
                .createdAt(req.getCreatedAt())
                .updatedAt(req.getUpdatedAt())
                .build();
    }
}
