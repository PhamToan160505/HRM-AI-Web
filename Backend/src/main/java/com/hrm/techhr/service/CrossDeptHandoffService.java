package com.hrm.techhr.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.techhr.dto.TechHrIntegrationDtos.CompleteHandoffTaskRequest;
import com.hrm.techhr.dto.TechHrIntegrationDtos.CrossDeptHandoffTaskResponse;
import com.hrm.techhr.dto.TechHrIntegrationDtos.CrossDeptSlaSummaryResponse;
import com.hrm.techhr.entity.CrossDeptHandoffTask;
import com.hrm.techhr.entity.CrossDeptTaskPriority;
import com.hrm.techhr.entity.CrossDeptTaskStatus;
import com.hrm.techhr.entity.CrossDeptTaskType;
import com.hrm.techhr.repository.CrossDeptHandoffTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrossDeptHandoffService {

    private final CrossDeptHandoffTaskRepository taskRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    public static boolean isTechDepartmentName(String tenPhong) {
        if (tenPhong == null) return false;
        String lower = tenPhong.trim().toLowerCase();
        return lower.contains("công nghệ") || lower.contains("kỹ thuật") || lower.equals("tech") || lower.equals("it");
    }

    public static boolean isHrDepartmentName(String tenPhong) {
        if (tenPhong == null) return false;
        String lower = tenPhong.trim().toLowerCase();
        return lower.contains("nhân sự") || lower.equals("hr");
    }

    public Long findHrDepartmentId() {
        return departmentRepository.findAll().stream()
                .filter(d -> isHrDepartmentName(d.getTenPhong()))
                .map(Department::getId)
                .findFirst()
                .orElse(null);
    }

    public Long findTechDepartmentId() {
        return departmentRepository.findAll().stream()
                .filter(d -> isTechDepartmentName(d.getTenPhong()))
                .map(Department::getId)
                .findFirst()
                .orElse(null);
    }

    public boolean isTechDepartment(Long departmentId) {
        if (departmentId == null) return false;
        return departmentRepository.findById(departmentId)
                .map(d -> isTechDepartmentName(d.getTenPhong()))
                .orElse(false);
    }

    public boolean isHrDepartment(Long departmentId) {
        if (departmentId == null) return false;
        return departmentRepository.findById(departmentId)
                .map(d -> isHrDepartmentName(d.getTenPhong()))
                .orElse(false);
    }

    @Transactional
    public CrossDeptHandoffTask createTaskIfNotOpen(
            CrossDeptTaskType taskType,
            Long sourceDepartmentId,
            Long targetDepartmentId,
            Long employeeUserId,
            Long lifecycleEmployeeId,
            String referenceType,
            Long referenceId,
            String title,
            String summary,
            Map<String, Object> metadata,
            CrossDeptTaskPriority priority,
            LocalDate dueDate,
            Long createdBy) {

        if (referenceType != null && referenceId != null) {
            Optional<CrossDeptHandoffTask> existing = taskRepository
                    .findFirstByTaskTypeAndReferenceTypeAndReferenceIdAndStatusIn(
                            taskType, referenceType, referenceId,
                            List.of(CrossDeptTaskStatus.OPEN, CrossDeptTaskStatus.IN_PROGRESS));
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        String metadataJson = null;
        if (metadata != null && !metadata.isEmpty()) {
            try {
                metadataJson = objectMapper.writeValueAsString(metadata);
            } catch (Exception e) {
                log.warn("[Tech-HR] Không thể tuần tự hóa metadataJson cho task {}: {}", taskType, e.getMessage());
            }
        }

        CrossDeptHandoffTask task = CrossDeptHandoffTask.builder()
                .taskType(taskType)
                .sourceDepartmentId(sourceDepartmentId)
                .targetDepartmentId(targetDepartmentId)
                .employeeUserId(employeeUserId)
                .lifecycleEmployeeId(lifecycleEmployeeId)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .title(title)
                .summary(summary)
                .metadataJson(metadataJson)
                .priority(priority != null ? priority : CrossDeptTaskPriority.NORMAL)
                .status(CrossDeptTaskStatus.OPEN)
                .dueDate(dueDate)
                .createdBy(createdBy)
                .build();

        CrossDeptHandoffTask saved = taskRepository.save(task);
        notifyTargetDepartmentManagers(saved);
        broadcastSync(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<CrossDeptHandoffTaskResponse> getTasksForActor(Long actorId, String direction, String statusFilter) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người dùng ID: " + actorId));

        List<CrossDeptHandoffTask> tasks;
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) {
            tasks = taskRepository.findAllByOrderByCreatedAtDesc();
        } else {
            if (actor.getDepartmentId() == null) {
                return Collections.emptyList();
            }
            if ("INCOMING".equalsIgnoreCase(direction)) {
                tasks = taskRepository.findByTargetDepartmentIdOrderByCreatedAtDesc(actor.getDepartmentId());
            } else {
                tasks = taskRepository.findByTargetDepartmentIdOrSourceDepartmentIdOrderByCreatedAtDesc(
                        actor.getDepartmentId(), actor.getDepartmentId());
            }
        }

        if (statusFilter != null && !statusFilter.isBlank() && !"ALL".equalsIgnoreCase(statusFilter)) {
            tasks = tasks.stream()
                    .filter(t -> t.getStatus().name().equalsIgnoreCase(statusFilter.trim()))
                    .collect(Collectors.toList());
        }

        return mapTasksToResponses(tasks, actor);
    }

    @Transactional
    public CrossDeptHandoffTaskResponse updateTaskStatus(Long taskId, CompleteHandoffTaskRequest req, Long actorId) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người dùng ID: " + actorId));

        if (actor.getRole() == Role.CEO) {
            throw AppException.forbidden("CEO hoạt động ở chế độ Giám sát Điều hành (Chỉ xem) đối với tác vụ phối hợp liên phòng!");
        }
        if (actor.getRole() == Role.NHAN_VIEN) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc phòng ban mới có quyền xử lý tác vụ phối hợp liên phòng!");
        }

        CrossDeptHandoffTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tác vụ liên phòng ID: " + taskId));

        boolean belongsToTargetOrSource = actor.getRole() == Role.ADMIN
                || (actor.getDepartmentId() != null && (actor.getDepartmentId().equals(task.getTargetDepartmentId())
                || actor.getDepartmentId().equals(task.getSourceDepartmentId())));
        if (!belongsToTargetOrSource) {
            throw AppException.forbidden("Bạn không thuộc phòng ban liên quan tới tác vụ này!");
        }

        CrossDeptTaskStatus newStatus;
        try {
            newStatus = CrossDeptTaskStatus.valueOf(
                    (req.getStatus() == null || req.getStatus().isBlank() ? "COMPLETED" : req.getStatus()).trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw AppException.badRequest("Trạng thái tác vụ không hợp lệ: " + req.getStatus());
        }

        task.setStatus(newStatus);
        if (req.getResolutionNote() != null && !req.getResolutionNote().isBlank()) {
            task.setResolutionNote(req.getResolutionNote().trim());
        }
        if (newStatus == CrossDeptTaskStatus.COMPLETED) {
            task.setCompletedBy(actorId);
            task.setCompletedAt(LocalDateTime.now());
        }

        CrossDeptHandoffTask saved = taskRepository.save(task);
        notifySourceDepartmentCompleted(saved, actor);
        broadcastSync(saved);
        return mapTasksToResponses(List.of(saved), actor).get(0);
    }

    @Transactional(readOnly = true)
    public CrossDeptSlaSummaryResponse getSlaSummary() {
        List<CrossDeptHandoffTask> all = taskRepository.findAllByOrderByCreatedAtDesc();
        LocalDate today = LocalDate.now();
        Long hrDeptId = findHrDepartmentId();
        Long techDeptId = findTechDepartmentId();

        long open = 0, inProgress = 0, completed = 0, overdue = 0;
        long techToHr = 0, hrToTech = 0;
        long completedWithDue = 0, completedOnTime = 0;

        for (CrossDeptHandoffTask t : all) {
            if (t.getStatus() == CrossDeptTaskStatus.OPEN) open++;
            else if (t.getStatus() == CrossDeptTaskStatus.IN_PROGRESS) inProgress++;
            else if (t.getStatus() == CrossDeptTaskStatus.COMPLETED) {
                completed++;
                if (t.getDueDate() != null && t.getCompletedAt() != null) {
                    completedWithDue++;
                    if (!t.getCompletedAt().toLocalDate().isAfter(t.getDueDate())) {
                        completedOnTime++;
                    }
                }
            }

            if ((t.getStatus() == CrossDeptTaskStatus.OPEN || t.getStatus() == CrossDeptTaskStatus.IN_PROGRESS)
                    && t.getDueDate() != null && t.getDueDate().isBefore(today)) {
                overdue++;
            }

            if (techDeptId != null && techDeptId.equals(t.getSourceDepartmentId())
                    && hrDeptId != null && hrDeptId.equals(t.getTargetDepartmentId())) {
                techToHr++;
            } else if (hrDeptId != null && hrDeptId.equals(t.getSourceDepartmentId())
                    && techDeptId != null && techDeptId.equals(t.getTargetDepartmentId())) {
                hrToTech++;
            }
        }

        double onTimeRate = completedWithDue == 0
                ? (completed > 0 ? 100.0 : 0.0)
                : Math.round((completedOnTime * 1000.0) / completedWithDue) / 10.0;

        return CrossDeptSlaSummaryResponse.builder()
                .totalTasks(all.size())
                .openTasks(open)
                .inProgressTasks(inProgress)
                .completedTasks(completed)
                .overdueTasks(overdue)
                .techToHrCount(techToHr)
                .hrToTechCount(hrToTech)
                .onTimeCompletionRate(onTimeRate)
                .build();
    }

    private List<CrossDeptHandoffTaskResponse> mapTasksToResponses(List<CrossDeptHandoffTask> tasks, User viewer) {
        Map<Long, Department> deptMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getId, d -> d, (a, b) -> a));

        Set<Long> userIds = new HashSet<>();
        for (CrossDeptHandoffTask t : tasks) {
            if (t.getEmployeeUserId() != null) userIds.add(t.getEmployeeUserId());
            if (t.getCompletedBy() != null) userIds.add(t.getCompletedBy());
        }
        Map<Long, User> userMap = userIds.isEmpty()
                ? Collections.emptyMap()
                : userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        boolean canViewSalaryDetails = canViewSalaryMetadata(viewer);
        LocalDate today = LocalDate.now();

        return tasks.stream().map(t -> {
            Department src = t.getSourceDepartmentId() != null ? deptMap.get(t.getSourceDepartmentId()) : null;
            Department tgt = t.getTargetDepartmentId() != null ? deptMap.get(t.getTargetDepartmentId()) : null;
            User emp = t.getEmployeeUserId() != null ? userMap.get(t.getEmployeeUserId()) : null;
            User comp = t.getCompletedBy() != null ? userMap.get(t.getCompletedBy()) : null;

            boolean isOverdue = (t.getStatus() == CrossDeptTaskStatus.OPEN || t.getStatus() == CrossDeptTaskStatus.IN_PROGRESS)
                    && t.getDueDate() != null && t.getDueDate().isBefore(today);

            String safeMetadata = t.getMetadataJson();
            if (!canViewSalaryDetails && t.getTaskType() == CrossDeptTaskType.CONTRACT_ADDENDUM_REQUIRED && safeMetadata != null) {
                safeMetadata = maskSalaryFieldsInJson(safeMetadata);
            }

            return CrossDeptHandoffTaskResponse.builder()
                    .id(t.getId())
                    .taskType(t.getTaskType().name())
                    .sourceDepartmentId(t.getSourceDepartmentId())
                    .sourceDepartmentName(src != null ? src.getTenPhong() : null)
                    .targetDepartmentId(t.getTargetDepartmentId())
                    .targetDepartmentName(tgt != null ? tgt.getTenPhong() : null)
                    .employeeUserId(t.getEmployeeUserId())
                    .employeeName(emp != null ? emp.getHoTen() : null)
                    .employeeEmail(emp != null ? emp.getEmail() : null)
                    .lifecycleEmployeeId(t.getLifecycleEmployeeId())
                    .referenceType(t.getReferenceType())
                    .referenceId(t.getReferenceId())
                    .title(t.getTitle())
                    .summary(t.getSummary())
                    .metadataJson(safeMetadata)
                    .priority(t.getPriority().name())
                    .status(t.getStatus().name())
                    .dueDate(t.getDueDate())
                    .overdue(isOverdue)
                    .completedBy(t.getCompletedBy())
                    .completedByName(comp != null ? comp.getHoTen() : null)
                    .completedAt(t.getCompletedAt())
                    .resolutionNote(t.getResolutionNote())
                    .createdAt(t.getCreatedAt())
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * Tuân thủ Bảo mật B-10: Chỉ CEO, Admin, Giám đốc Phòng ban hoặc Trưởng/Giám đốc Nhân sự (C&B)
     * mới được xem con số lương VNĐ chi tiết trong tác vụ lập Phụ lục Hợp đồng.
     */
    private boolean canViewSalaryMetadata(User viewer) {
        if (viewer == null) return false;
        if (viewer.getRole() == Role.CEO || viewer.getRole() == Role.ADMIN || viewer.getRole() == Role.GIAM_DOC_PHONG_BAN) {
            return true;
        }
        return viewer.getRole() == Role.TRUONG_PHONG && isHrDepartment(viewer.getDepartmentId());
    }

    private String maskSalaryFieldsInJson(String rawJson) {
        try {
            JsonNode node = objectMapper.readTree(rawJson);
            if (node instanceof ObjectNode obj) {
                List<String> sensitiveKeys = List.of("oldBaseSalary", "newBaseSalary", "oldAllowance", "newAllowance");
                for (String key : sensitiveKeys) {
                    if (obj.has(key)) {
                        obj.put(key, "*** [Bảo mật B-10]");
                    }
                }
                return objectMapper.writeValueAsString(obj);
            }
        } catch (Exception ignored) {
        }
        return rawJson;
    }

    private void notifyTargetDepartmentManagers(CrossDeptHandoffTask task) {
        if (task.getTargetDepartmentId() == null) return;
        try {
            boolean targetIsHr = isHrDepartment(task.getTargetDepartmentId());
            List<User> recipients = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> task.getTargetDepartmentId().equals(u.getDepartmentId()))
                    .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                    .toList();

            for (User recipient : recipients) {
                String prefix = recipient.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director" : "/manager";
                String link = targetIsHr ? prefix + "/lifecycle" : prefix + "/tech-projects";
                String mucDo = task.getPriority() == CrossDeptTaskPriority.URGENT ? "CANH_BAO" : "THONG_TIN";
                notificationService.createNotification(
                        recipient.getId(),
                        "CROSS_DEPT_HANDOFF",
                        task.getTitle(),
                        task.getSummary() != null ? task.getSummary() : "Có tác vụ phối hợp mới từ phòng ban liên quan.",
                        mucDo,
                        link
                );
            }
        } catch (Exception e) {
            log.warn("[Tech-HR] Không thể gửi thông báo tới phòng ban đích {}: {}", task.getTargetDepartmentId(), e.getMessage());
        }
    }

    private void notifySourceDepartmentCompleted(CrossDeptHandoffTask task, User actor) {
        if (task.getStatus() != CrossDeptTaskStatus.COMPLETED || task.getSourceDepartmentId() == null) return;
        try {
            boolean sourceIsHr = isHrDepartment(task.getSourceDepartmentId());
            List<User> recipients = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> task.getSourceDepartmentId().equals(u.getDepartmentId()))
                    .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                    .filter(u -> !u.getId().equals(actor.getId()))
                    .toList();

            for (User recipient : recipients) {
                String prefix = recipient.getRole() == Role.GIAM_DOC_PHONG_BAN ? "/director" : "/manager";
                String link = sourceIsHr ? prefix + "/lifecycle" : prefix + "/tech-projects";
                notificationService.createNotification(
                        recipient.getId(),
                        "CROSS_DEPT_HANDOFF_DONE",
                        "Đã hoàn tất tác vụ liên phòng: " + task.getTitle(),
                        actor.getHoTen() + " đã xác nhận hoàn tất"
                                + (task.getResolutionNote() != null ? " — " + task.getResolutionNote() : "."),
                        "THONG_TIN",
                        link
                );
            }
        } catch (Exception e) {
            log.warn("[Tech-HR] Không thể gửi thông báo hoàn tất tác vụ {}: {}", task.getId(), e.getMessage());
        }
    }

    private void broadcastSync(CrossDeptHandoffTask task) {
        try {
            notificationService.broadcastTopic("/topic/tech-updates", Map.of(
                    "type", "CROSS_DEPT_HANDOFF",
                    "taskId", task.getId(),
                    "taskType", task.getTaskType().name(),
                    "status", task.getStatus().name()
            ));
        } catch (Exception ignored) {
        }
    }
}
