package com.hrm.tech.service;

import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.TechDeploymentLog;
import com.hrm.tech.entity.TechProject;
import com.hrm.tech.entity.TechProjectEnvironment;
import com.hrm.tech.repository.TechDeploymentLogRepository;
import com.hrm.tech.repository.TechProjectEnvironmentRepository;
import com.hrm.tech.repository.TechProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechProjectEnvironmentService {

    private final TechProjectEnvironmentRepository environmentRepository;
    private final TechDeploymentLogRepository deploymentLogRepository;
    private final TechProjectRepository projectRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<TechProjectEnvironmentResponse> getEnvironments(Long projectId) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        return environmentRepository.findByProjectIdOrderByEnvNameAsc(project.getId())
                .stream()
                .map(this::mapEnvToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechProjectEnvironmentResponse createEnvironment(Long projectId, CreateTechEnvironmentRequest req) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        String envName = req.getEnvName().trim().toUpperCase();
        environmentRepository.findByProjectIdAndEnvName(projectId, envName).ifPresent(e -> {
            throw AppException.badRequest("Môi trường '" + envName + "' đã tồn tại trong dự án này!");
        });

        TechProjectEnvironment env = TechProjectEnvironment.builder()
                .project(project)
                .envName(envName)
                .displayName(req.getDisplayName().trim())
                .accessUrl(req.getAccessUrl() != null ? req.getAccessUrl().trim() : null)
                .gitBranch(req.getGitBranch() != null ? req.getGitBranch().trim() : null)
                .serverHost(req.getServerHost() != null ? req.getServerHost().trim() : null)
                .status(req.getStatus() != null ? req.getStatus() : com.hrm.tech.entity.TechEnvironmentStatus.ONLINE)
                .ownerId(req.getOwnerId())
                .notes(req.getNotes() != null ? req.getNotes().trim() : null)
                .build();

        TechProjectEnvironment saved = environmentRepository.save(env);
        log.info("[Tech] Đã tạo môi trường '{}' cho dự án {}", saved.getEnvName(), project.getProjectCode());
        return mapEnvToResponse(saved);
    }

    @Transactional
    public TechProjectEnvironmentResponse updateEnvironment(Long envId, UpdateTechEnvironmentRequest req) {
        TechProjectEnvironment env = environmentRepository.findById(envId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy môi trường với ID: " + envId));

        if (req.getDisplayName() != null && !req.getDisplayName().trim().isEmpty()) {
            env.setDisplayName(req.getDisplayName().trim());
        }
        if (req.getAccessUrl() != null) {
            env.setAccessUrl(req.getAccessUrl().trim());
        }
        if (req.getGitBranch() != null) {
            env.setGitBranch(req.getGitBranch().trim());
        }
        if (req.getServerHost() != null) {
            env.setServerHost(req.getServerHost().trim());
        }
        if (req.getStatus() != null) {
            env.setStatus(req.getStatus());
        }
        if (req.getOwnerId() != null) {
            env.setOwnerId(req.getOwnerId());
        }
        if (req.getNotes() != null) {
            env.setNotes(req.getNotes().trim());
        }

        TechProjectEnvironment updated = environmentRepository.save(env);
        log.info("[Tech] Đã cập nhật môi trường ID {}", envId);
        return mapEnvToResponse(updated);
    }

    @Transactional
    public void deleteEnvironment(Long envId) {
        TechProjectEnvironment env = environmentRepository.findById(envId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy môi trường với ID: " + envId));
        environmentRepository.delete(env);
        log.info("[Tech] Đã xóa môi trường ID {}", envId);
    }

    // --- Deployment Logs ---

    @Transactional(readOnly = true)
    public List<TechDeploymentLogResponse> getDeploymentLogs(Long envId) {
        TechProjectEnvironment env = environmentRepository.findById(envId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy môi trường với ID: " + envId));

        return deploymentLogRepository.findByEnvironmentIdOrderByDeployedAtDesc(env.getId())
                .stream()
                .map(this::mapDeployToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TechDeploymentLogResponse> getProjectDeploymentLogs(Long projectId) {
        return deploymentLogRepository.findByEnvironmentProjectIdOrderByDeployedAtDesc(projectId)
                .stream()
                .map(this::mapDeployToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechDeploymentLogResponse createDeploymentLog(Long envId, CreateTechDeploymentLogRequest req, Long actorId) {
        TechProjectEnvironment env = environmentRepository.findById(envId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy môi trường với ID: " + envId));

        TechDeploymentLog logItem = TechDeploymentLog.builder()
                .environment(env)
                .versionTag(req.getVersionTag().trim())
                .commitHash(req.getCommitHash() != null ? req.getCommitHash().trim() : null)
                .status(req.getStatus() != null ? req.getStatus() : com.hrm.tech.entity.TechDeploymentStatus.SUCCESS)
                .changelog(req.getChangelog() != null ? req.getChangelog().trim() : null)
                .deployedBy(actorId)
                .deployedAt(LocalDateTime.now())
                .build();

        TechDeploymentLog saved = deploymentLogRepository.save(logItem);
        log.info("[Tech] Đã ghi nhận đợt triển khai '{}' ({}) lên môi trường {}",
                saved.getVersionTag(), saved.getStatus(), env.getEnvName());
        return mapDeployToResponse(saved);
    }

    private TechProjectEnvironmentResponse mapEnvToResponse(TechProjectEnvironment env) {
        String ownerName = env.getOwnerId() != null
                ? userRepository.findById(env.getOwnerId()).map(User::getHoTen).orElse(null)
                : null;

        List<TechDeploymentLog> logs = deploymentLogRepository.findByEnvironmentIdOrderByDeployedAtDesc(env.getId());
        long deployCount = logs.size();
        String latestTag = logs.isEmpty() ? null : logs.get(0).getVersionTag();
        LocalDateTime latestAt = logs.isEmpty() ? null : logs.get(0).getDeployedAt();

        return TechProjectEnvironmentResponse.builder()
                .id(env.getId())
                .projectId(env.getProject().getId())
                .envName(env.getEnvName())
                .displayName(env.getDisplayName())
                .accessUrl(env.getAccessUrl())
                .gitBranch(env.getGitBranch())
                .serverHost(env.getServerHost())
                .status(env.getStatus())
                .ownerId(env.getOwnerId())
                .ownerName(ownerName)
                .notes(env.getNotes())
                .updatedAt(env.getUpdatedAt())
                .deploymentCount(deployCount)
                .latestVersionTag(latestTag)
                .latestDeployedAt(latestAt)
                .build();
    }

    private TechDeploymentLogResponse mapDeployToResponse(TechDeploymentLog d) {
        String deployerName = d.getDeployedBy() != null
                ? userRepository.findById(d.getDeployedBy()).map(User::getHoTen).orElse(null)
                : null;

        return TechDeploymentLogResponse.builder()
                .id(d.getId())
                .environmentId(d.getEnvironment().getId())
                .envName(d.getEnvironment().getEnvName())
                .envDisplayName(d.getEnvironment().getDisplayName())
                .versionTag(d.getVersionTag())
                .commitHash(d.getCommitHash())
                .status(d.getStatus())
                .changelog(d.getChangelog())
                .deployedBy(d.getDeployedBy())
                .deployedByName(deployerName)
                .deployedAt(d.getDeployedAt())
                .build();
    }
}

