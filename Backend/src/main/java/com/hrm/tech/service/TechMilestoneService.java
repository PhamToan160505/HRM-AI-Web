package com.hrm.tech.service;

import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.dto.CreateMilestoneRequest;
import com.hrm.tech.dto.ProjectMilestonesSummaryResponse;
import com.hrm.tech.dto.TechMilestoneResponse;
import com.hrm.tech.dto.UpdateMilestoneRequest;
import com.hrm.tech.entity.MilestoneStatus;
import com.hrm.tech.entity.TechProject;
import com.hrm.tech.entity.TechProjectMilestone;
import com.hrm.tech.repository.TechProjectMilestoneRepository;
import com.hrm.tech.repository.TechProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechMilestoneService {

    private final TechProjectMilestoneRepository milestoneRepository;
    private final TechProjectRepository projectRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public ProjectMilestonesSummaryResponse getProjectMilestones(Long projectId) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        List<TechProjectMilestone> milestones = milestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(projectId);
        List<TechMilestoneResponse> responses = milestones.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());

        int totalWeight = milestones.stream()
                .mapToInt(m -> m.getWeightPercent() != null ? m.getWeightPercent() : 0)
                .sum();
        int completedCount = (int) milestones.stream()
                .filter(m -> m.getStatus() == MilestoneStatus.COMPLETED)
                .count();
        int overdueCount = (int) responses.stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsOverdue()))
                .count();
        int dueSoonCount = (int) responses.stream()
                .filter(r -> Boolean.TRUE.equals(r.getIsDueSoon()))
                .count();

        return ProjectMilestonesSummaryResponse.builder()
                .projectId(project.getId())
                .projectCode(project.getProjectCode())
                .projectName(project.getProjectName())
                .actualProgressPercent(calculateActualProgressPercent(milestones))
                .totalWeightPercent(totalWeight)
                .remainingWeightPercent(Math.max(0, 100 - totalWeight))
                .totalCount(milestones.size())
                .completedCount(completedCount)
                .overdueCount(overdueCount)
                .dueSoonCount(dueSoonCount)
                .milestones(responses)
                .build();
    }

    @Transactional
    public TechMilestoneResponse createMilestone(Long projectId, CreateMilestoneRequest req, Long currentUserId) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        if (req.getDueDate() != null && req.getDueDate().isBefore(LocalDate.now())) {
            throw AppException.badRequest("Hạn chót bàn giao không được chọn ngày trong quá khứ!");
        }

        int weight = req.getWeightPercent() != null ? req.getWeightPercent() : 0;
        validateWeightCapacity(projectId, null, weight);

        int completion = req.getCompletionPercent() != null ? req.getCompletionPercent() : 0;
        MilestoneStatus status = req.getStatus() != null ? req.getStatus() : MilestoneStatus.NOT_STARTED;

        if (status == MilestoneStatus.COMPLETED) {
            completion = 100;
        } else if (completion == 100) {
            status = MilestoneStatus.COMPLETED;
        } else if (completion > 0 && status == MilestoneStatus.NOT_STARTED) {
            status = MilestoneStatus.IN_PROGRESS;
        }

        LocalDateTime completedAt = status == MilestoneStatus.COMPLETED ? LocalDateTime.now() : null;

        TechProjectMilestone milestone = TechProjectMilestone.builder()
                .project(project)
                .title(req.getTitle().trim())
                .description(req.getDescription() != null ? req.getDescription().trim() : null)
                .dueDate(req.getDueDate())
                .completedAt(completedAt)
                .status(status)
                .weightPercent(weight)
                .completionPercent(completion)
                .deliverableUrl(req.getDeliverableUrl() != null && !req.getDeliverableUrl().trim().isEmpty()
                        ? req.getDeliverableUrl().trim() : null)
                .createdBy(currentUserId)
                .build();

        TechProjectMilestone saved = milestoneRepository.save(milestone);
        log.info("[Tech] Tạo milestone '{}' ({}%) cho dự án {}", saved.getTitle(), saved.getWeightPercent(), project.getProjectCode());
        return mapToResponse(saved);
    }

    @Transactional
    public TechMilestoneResponse updateMilestone(Long projectId, Long milestoneId, UpdateMilestoneRequest req) {
        TechProjectMilestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy mốc tiến độ với ID: " + milestoneId));

        if (!milestone.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Mốc tiến độ không thuộc dự án này!");
        }

        if (req.getDueDate() != null
                && !req.getDueDate().equals(milestone.getDueDate())
                && req.getDueDate().isBefore(LocalDate.now())) {
            throw AppException.badRequest("Không thể chuyển hạn chót bàn giao sang ngày trong quá khứ!");
        }

        int weight = req.getWeightPercent() != null ? req.getWeightPercent() : milestone.getWeightPercent();
        validateWeightCapacity(projectId, milestoneId, weight);

        int completion = req.getCompletionPercent() != null ? req.getCompletionPercent() : milestone.getCompletionPercent();
        MilestoneStatus status = req.getStatus() != null ? req.getStatus() : milestone.getStatus();

        if (status == MilestoneStatus.COMPLETED) {
            completion = 100;
            if (milestone.getCompletedAt() == null) {
                milestone.setCompletedAt(LocalDateTime.now());
            }
        } else if (req.getStatus() == null && completion == 100) {
            status = MilestoneStatus.COMPLETED;
            if (milestone.getCompletedAt() == null) {
                milestone.setCompletedAt(LocalDateTime.now());
            }
        } else {
            milestone.setCompletedAt(null);
            if (completion > 0 && status == MilestoneStatus.NOT_STARTED) {
                status = MilestoneStatus.IN_PROGRESS;
            }
        }

        milestone.setTitle(req.getTitle().trim());
        milestone.setDescription(req.getDescription() != null ? req.getDescription().trim() : null);
        milestone.setDueDate(req.getDueDate());
        milestone.setStatus(status);
        milestone.setWeightPercent(weight);
        milestone.setCompletionPercent(completion);
        milestone.setDeliverableUrl(req.getDeliverableUrl() != null && !req.getDeliverableUrl().trim().isEmpty()
                ? req.getDeliverableUrl().trim() : null);

        TechProjectMilestone updated = milestoneRepository.save(milestone);
        log.info("[Tech] Cập nhật milestone ID {} của dự án {}: status={}, completion={}%",
                milestoneId, milestone.getProject().getProjectCode(), status, completion);
        return mapToResponse(updated);
    }

    @Transactional
    public void deleteMilestone(Long projectId, Long milestoneId) {
        TechProjectMilestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy mốc tiến độ với ID: " + milestoneId));

        if (!milestone.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Mốc tiến độ không thuộc dự án này!");
        }

        milestoneRepository.delete(milestone);
        log.info("[Tech] Đã xóa milestone ID {} khỏi dự án {}", milestoneId, projectId);
    }

    public static Integer calculateActualProgressPercent(List<TechProjectMilestone> milestones) {
        if (milestones == null || milestones.isEmpty()) {
            return null;
        }
        int totalWeight = milestones.stream()
                .mapToInt(m -> m.getWeightPercent() != null ? m.getWeightPercent() : 0)
                .sum();

        if (totalWeight > 0) {
            double weightedSum = milestones.stream()
                    .mapToDouble(m -> (m.getCompletionPercent() != null ? m.getCompletionPercent() : 0)
                            * (m.getWeightPercent() != null ? m.getWeightPercent() : 0))
                    .sum();
            return (int) Math.round(weightedSum / totalWeight);
        }

        double avg = milestones.stream()
                .mapToInt(m -> m.getCompletionPercent() != null ? m.getCompletionPercent() : 0)
                .average()
                .orElse(0.0);
        return (int) Math.round(avg);
    }

    public static boolean isMilestoneOverdue(TechProjectMilestone m, LocalDate today) {
        return m.getStatus() != MilestoneStatus.COMPLETED
                && m.getDueDate() != null
                && m.getDueDate().isBefore(today);
    }

    public static boolean isMilestoneDueSoon(TechProjectMilestone m, LocalDate today) {
        return m.getStatus() != MilestoneStatus.COMPLETED
                && m.getDueDate() != null
                && !m.getDueDate().isBefore(today)
                && !m.getDueDate().isAfter(today.plusDays(3));
    }

    private void validateWeightCapacity(Long projectId, Long excludeId, int newWeight) {
        if (newWeight < 0 || newWeight > 100) {
            throw AppException.badRequest("Trọng số mốc tiến độ phải nằm trong khoảng 0% - 100%!");
        }
        Integer existingWeight = milestoneRepository.sumWeightPercentByProjectIdExcluding(projectId, excludeId);
        int otherWeight = existingWeight != null ? existingWeight : 0;
        if (otherWeight + newWeight > 100) {
            int remaining = Math.max(0, 100 - otherWeight);
            throw AppException.badRequest("Tổng trọng số các mốc trong dự án không được vượt quá 100% "
                    + "(hiện tại các mốc khác đã chiếm " + otherWeight + "%, chỉ còn tối đa " + remaining + "%).");
        }
    }

    private TechMilestoneResponse mapToResponse(TechProjectMilestone m) {
        LocalDate today = LocalDate.now();
        String creatorName = m.getCreatedBy() != null
                ? userRepository.findById(m.getCreatedBy()).map(User::getHoTen).orElse(null)
                : null;

        return TechMilestoneResponse.builder()
                .id(m.getId())
                .projectId(m.getProject().getId())
                .projectCode(m.getProject().getProjectCode())
                .projectName(m.getProject().getProjectName())
                .title(m.getTitle())
                .description(m.getDescription())
                .dueDate(m.getDueDate())
                .completedAt(m.getCompletedAt())
                .status(m.getStatus())
                .weightPercent(m.getWeightPercent())
                .completionPercent(m.getCompletionPercent())
                .deliverableUrl(m.getDeliverableUrl())
                .createdBy(m.getCreatedBy())
                .createdByName(creatorName)
                .isOverdue(isMilestoneOverdue(m, today))
                .isDueSoon(isMilestoneDueSoon(m, today))
                .createdAt(m.getCreatedAt())
                .updatedAt(m.getUpdatedAt())
                .build();
    }
}

