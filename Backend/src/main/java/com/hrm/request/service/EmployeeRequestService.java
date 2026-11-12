package com.hrm.request.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.request.dto.ApproveRequestDto;
import com.hrm.request.dto.CreateRequestDto;
import com.hrm.request.dto.EmployeeRequestDto;
import com.hrm.request.entity.EmployeeRequest;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.entity.RequestType;
import com.hrm.request.repository.EmployeeRequestRepository;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import com.hrm.request.event.RequestCreatedEvent;
import org.springframework.context.ApplicationEventPublisher;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeRequestService {

    private final EmployeeRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;

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
        if (dto == null || dto.getRequestType() == null) {
            throw AppException.badRequest("Vui lòng chọn loại đơn yêu cầu");
        }
        if (dto.getStartDate() == null || dto.getEndDate() == null) {
            throw AppException.badRequest("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc");
        }
        if (dto.getEndDate().isBefore(dto.getStartDate())) {
            throw AppException.badRequest("Ngày kết thúc không được nhỏ hơn ngày bắt đầu");
        }
        if (dto.getReason() == null || dto.getReason().trim().isEmpty()) {
            throw AppException.badRequest("Vui lòng nhập lý do chi tiết");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài khoản người dùng"));

        EmployeeRequest request = EmployeeRequest.builder()
                .user(user)
                .requestType(dto.getRequestType())
                .reason(dto.getReason().trim())
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .status(RequestStatus.PENDING)
                .build();

        EmployeeRequest saved = requestRepository.save(request);

        // Tìm cấp trên để gửi thông báo
        List<User> approvers = new java.util.ArrayList<>();
        if (user.getRole() == Role.NHAN_VIEN) {
            approvers = userRepository.findByDepartmentIdAndRole(user.getDepartmentId(), Role.TRUONG_PHONG);
        } else if (user.getRole() == Role.TRUONG_PHONG) {
            approvers = userRepository.findByDepartmentIdAndRole(user.getDepartmentId(), Role.GIAM_DOC_PHONG_BAN);
        } else if (user.getRole() == Role.GIAM_DOC_PHONG_BAN) {
            approvers = userRepository.findByRole(Role.CEO);
        }

        for (User approver : approvers) {
            String path = switch (approver.getRole()) {
                case CEO -> "/ceo/requests";
                case GIAM_DOC_PHONG_BAN -> "/director/requests";
                case TRUONG_PHONG -> "/manager/requests";
                default -> "/employee/requests";
            };
            safeNotify(
                    approver.getId(),
                    "REQUEST",
                    "Có đơn yêu cầu mới",
                    "Nhân viên " + user.getHoTen() + " vừa tạo đơn yêu cầu mới.",
                    "binh_thuong",
                    path
            );
        }

        // Gui event thong bao TUC THI cho cac listener (VD: Telegram Bot)
        try {
            eventPublisher.publishEvent(new RequestCreatedEvent(saved));
        } catch (Exception e) {
            // Ignore event publish error so request creation is not blocked
        }

        return mapToDto(saved);
    }

    public List<EmployeeRequestDto> getMyRequests(Long userId) {
        return requestRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public List<EmployeeRequestDto> getRequestsForManager(CustomUserDetails manager) {
        List<User> subordinates = new java.util.ArrayList<>();
        
        if (manager.getRole() == Role.TRUONG_PHONG) {
            subordinates = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), Role.NHAN_VIEN);
        } else if (manager.getRole() == Role.GIAM_DOC_PHONG_BAN) {
            subordinates = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), Role.TRUONG_PHONG);
            // Also include NHAN_VIEN requests that are forwarded
            List<User> nhanViens = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), Role.NHAN_VIEN);
            List<Long> nvIds = nhanViens.stream().map(User::getId).collect(Collectors.toList());
            List<EmployeeRequest> forwardedReqs = nvIds.isEmpty() ? new java.util.ArrayList<>() : requestRepository.findByUserIdInOrderByCreatedAtDesc(nvIds)
                .stream().filter(r -> r.getStatus() == RequestStatus.FORWARDED).collect(Collectors.toList());
            
            List<Long> trPhongIds = subordinates.stream().map(User::getId).collect(Collectors.toList());
            List<EmployeeRequest> allReqs = new java.util.ArrayList<>(forwardedReqs);
            if (!trPhongIds.isEmpty()) {
                allReqs.addAll(requestRepository.findByUserIdInOrderByCreatedAtDesc(trPhongIds));
            }
            allReqs.sort(Comparator.comparing(EmployeeRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
            return allReqs.stream().map(this::mapToDto).collect(Collectors.toList());
        } else if (manager.getRole() == Role.CEO) {
            subordinates = userRepository.findByRole(Role.GIAM_DOC_PHONG_BAN);
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
                .orElseThrow(() -> AppException.notFound("Không tìm thấy đơn yêu cầu"));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> AppException.notFound("Tài khoản người duyệt không tồn tại"));

        validateApproverScope(manager, request);

        if (request.getStatus() != RequestStatus.PENDING && request.getStatus() != RequestStatus.FORWARDED) {
            throw AppException.badRequest(buildAlreadyProcessedMessage(request.getStatus()));
        }

        if (manager.getRole() == Role.TRUONG_PHONG && request.getStatus() == RequestStatus.FORWARDED) {
            throw AppException.badRequest("Đơn yêu cầu này đã được chuyển tiếp lên Giám đốc phòng ban");
        }

        if (request.getStartDate() == null || request.getEndDate() == null
                || request.getEndDate().isBefore(request.getStartDate())) {
            throw AppException.badRequest("Khoảng thời gian của đơn yêu cầu không hợp lệ");
        }

        request.setStatus(RequestStatus.APPROVED);
        request.setApprover(manager);
        if (dto != null && dto.getNote() != null) {
            request.setNote(dto.getNote().trim());
        }

        EmployeeRequest saved = requestRepository.save(request);

        // Ghi vào bảng Attendance (chấm công) cho các ngày nghỉ
        if (request.getRequestType() != RequestType.OVERTIME) {
            LocalDate current = request.getStartDate();
            while (!current.isAfter(request.getEndDate())) {
                LocalDate dateToProcess = current;
                
                // Bỏ qua Thứ 7, Chủ nhật (nếu logic cty không tính nghỉ vào cuối tuần)
                if (dateToProcess.getDayOfWeek() != java.time.DayOfWeek.SATURDAY && 
                    dateToProcess.getDayOfWeek() != java.time.DayOfWeek.SUNDAY) {
                    
                    Optional<Attendance> existing = attendanceRepository.findFirstByEmployeeIdAndDateOrderByIdDesc(request.getUser().getId(), dateToProcess);
                    if (existing.isPresent()) {
                        Attendance att = existing.get();
                        if (att.getTimeIn() == null) {
                            att.setTimeIn(LocalTime.of(0, 0));
                        }
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
        safeNotify(
                request.getUser().getId(),
                "REQUEST",
                "Đơn yêu cầu đã được duyệt",
                "Cấp trên đã duyệt đơn yêu cầu của bạn.",
                "quan_trong",
                resolvePersonalRequestPath(request.getUser().getRole())
        );

        return mapToDto(saved);
    }

    @Transactional
    public EmployeeRequestDto rejectRequest(Long managerId, Long requestId, ApproveRequestDto dto) {
        EmployeeRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy đơn yêu cầu"));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> AppException.notFound("Tài khoản người duyệt không tồn tại"));

        validateApproverScope(manager, request);

        if (request.getStatus() != RequestStatus.PENDING && request.getStatus() != RequestStatus.FORWARDED) {
            throw AppException.badRequest(buildAlreadyProcessedMessage(request.getStatus()));
        }

        if (manager.getRole() == Role.TRUONG_PHONG && request.getStatus() == RequestStatus.FORWARDED) {
            throw AppException.badRequest("Đơn yêu cầu này đã được chuyển tiếp lên Giám đốc phòng ban");
        }

        String note = (dto != null && dto.getNote() != null && !dto.getNote().trim().isEmpty())
                ? dto.getNote().trim()
                : null;

        request.setStatus(RequestStatus.REJECTED);
        request.setApprover(manager);
        if (dto != null && dto.getNote() != null) {
            request.setNote(dto.getNote().trim());
        }

        EmployeeRequest saved = requestRepository.save(request);

        // Notify user
        safeNotify(
                request.getUser().getId(),
                "REQUEST",
                "Đơn yêu cầu bị từ chối",
                "Cấp trên đã từ chối đơn yêu cầu của bạn. Lý do: " + (note != null ? note : "Không có"),
                "quan_trong",
                resolvePersonalRequestPath(request.getUser().getRole())
        );

        return mapToDto(saved);
    }

    @Transactional
    public EmployeeRequestDto forwardRequest(Long managerId, Long requestId, ApproveRequestDto dto) {
        EmployeeRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy đơn yêu cầu"));

        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> AppException.notFound("Tài khoản người duyệt không tồn tại"));

        if (manager.getRole() != Role.TRUONG_PHONG) {
            throw AppException.forbidden("Chỉ Trưởng phòng mới có quyền chuyển tiếp đơn");
        }

        validateApproverScope(manager, request);

        if (request.getStatus() != RequestStatus.PENDING) {
            throw AppException.badRequest("Chỉ có thể chuyển tiếp đơn ở trạng thái Chờ duyệt (" + statusDisplayName(request.getStatus()) + ")");
        }

        request.setStatus(RequestStatus.FORWARDED);
        if (dto != null && dto.getNote() != null) {
            request.setNote(dto.getNote().trim());
        }

        EmployeeRequest saved = requestRepository.save(request);

        // Notify GIAM_DOC_PHONG_BAN
        if (manager.getDepartmentId() != null) {
            List<User> directors = userRepository.findByDepartmentIdAndRole(manager.getDepartmentId(), Role.GIAM_DOC_PHONG_BAN);
            for (User director : directors) {
                safeNotify(
                        director.getId(),
                        "REQUEST",
                        "Đơn từ được chuyển tiếp",
                        "Trưởng phòng " + manager.getHoTen() + " vừa chuyển tiếp một đơn từ.",
                        "quan_trong",
                        "/director/requests"
                );
            }
        }

        return mapToDto(saved);
    }

    private void validateApproverScope(User manager, EmployeeRequest request) {
        User owner = request.getUser();
        if (owner == null || owner.getId() == null) {
            throw AppException.badRequest("Đơn yêu cầu thiếu thông tin người tạo");
        }
        if (owner.getId().equals(manager.getId())) {
            throw AppException.forbidden("Bạn không thể tự xử lý đơn yêu cầu của chính mình");
        }

        Role managerRole = manager.getRole();
        if (managerRole == Role.CEO || managerRole == Role.ADMIN) {
            return;
        }

        if (managerRole == Role.TRUONG_PHONG) {
            if (owner.getRole() != Role.NHAN_VIEN) {
                throw AppException.forbidden("Trưởng phòng chỉ có quyền xử lý đơn của nhân viên cấp dưới");
            }
            if (manager.getDepartmentId() == null || !manager.getDepartmentId().equals(owner.getDepartmentId())) {
                throw AppException.forbidden("Bạn chỉ có quyền xử lý đơn của nhân viên thuộc phòng ban mình");
            }
            return;
        }

        if (managerRole == Role.GIAM_DOC_PHONG_BAN) {
            if (owner.getRole() == Role.CEO || owner.getRole() == Role.ADMIN) {
                throw AppException.forbidden("Bạn không có quyền xử lý đơn của cấp này");
            }
            if (manager.getDepartmentId() == null || !manager.getDepartmentId().equals(owner.getDepartmentId())) {
                throw AppException.forbidden("Bạn chỉ có quyền xử lý đơn của nhân sự thuộc phòng ban mình");
            }
            return;
        }

        throw AppException.forbidden("Bạn không có quyền xử lý đơn yêu cầu");
    }

    private String buildAlreadyProcessedMessage(RequestStatus currentStatus) {
        return "Đơn yêu cầu này đã ở trạng thái \"" + statusDisplayName(currentStatus)
                + "\", không thể thao tác lại. Vui lòng tải lại danh sách.";
    }

    private String statusDisplayName(RequestStatus status) {
        if (status == null) return "Không xác định";
        return switch (status) {
            case PENDING -> "Chờ duyệt";
            case FORWARDED -> "Đã chuyển tiếp";
            case APPROVED -> "Đã duyệt";
            case REJECTED -> "Từ chối";
            case CANCELLED -> "Đã hủy";
        };
    }

    private String resolvePersonalRequestPath(Role ownerRole) {
        if (ownerRole == null) return "/employee/requests";
        return switch (ownerRole) {
            case CEO -> "/ceo/my-requests";
            case GIAM_DOC_PHONG_BAN -> "/director/my-requests";
            case TRUONG_PHONG -> "/manager/my-requests";
            default -> "/employee/requests";
        };
    }

    private void safeNotify(Long userId, String loai, String tieuDe, String noiDung, String mucDo, String lienKet) {
        if (notificationService == null || userId == null) return;
        try {
            notificationService.createNotification(userId, loai, tieuDe, noiDung, mucDo, lienKet);
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo đơn từ tới userId={}: {}", userId, e.getMessage());
        }
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
