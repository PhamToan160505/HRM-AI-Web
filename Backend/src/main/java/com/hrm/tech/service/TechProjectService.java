package com.hrm.tech.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.ProjectRole;
import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.entity.TechProject;
import com.hrm.tech.entity.TechProjectMember;
import com.hrm.tech.repository.TechProjectMemberRepository;
import com.hrm.tech.repository.TechProjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechProjectService {

    private final TechProjectRepository projectRepository;
    private final TechProjectMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Transactional(readOnly = true)
    public List<TechProjectResponse> getAllProjects(ProjectStatus status, String keyword) {
        List<TechProject> projects = projectRepository.searchProjects(status, keyword);
        return projects.stream().map(this::mapToProjectResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TechProjectResponse getProjectById(Long id) {
        TechProject project = projectRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + id));
        return mapToProjectResponse(project);
    }

    @Transactional
    public TechProjectResponse createProject(CreateProjectRequest req, Long currentUserId) {
        String code = req.getProjectCode();
        if (code == null || code.trim().isEmpty()) {
            code = "PRJ-" + System.currentTimeMillis() % 1000000;
        } else {
            code = code.trim().toUpperCase();
            if (projectRepository.existsByProjectCode(code)) {
                throw AppException.conflict("Mã dự án '" + code + "' đã tồn tại! Không cho phép tạo trùng.");
            }
        }

        LocalDate today = LocalDate.now();
        LocalDate startDate = req.getStartDate() != null ? req.getStartDate() : today;

        if (startDate.isBefore(today)) {
            throw AppException.badRequest("Ngày bắt đầu không được chọn ngày trong quá khứ (phải từ ngày " + today.format(DATE_FMT) + " trở đi)!");
        }

        if (req.getEndDate() == null) {
            throw AppException.badRequest("Vui lòng chọn ngày kết thúc dự kiến!");
        }

        if (req.getEndDate().isBefore(today)) {
            throw AppException.badRequest("Ngày kết thúc không được chọn ngày trong quá khứ (phải từ ngày " + today.format(DATE_FMT) + " trở đi)!");
        }

        LocalDate minEndDate = startDate.plusDays(1);
        if (req.getEndDate().isBefore(minEndDate)) {
            throw AppException.badRequest("Ngày kết thúc dự kiến phải sau ngày bắt đầu ít nhất 24 giờ (phải từ ngày " + minEndDate.format(DATE_FMT) + " trở đi)!");
        }

        String techStackJson = serializeTechStack(req.getTechStack());

        TechProject project = TechProject.builder()
                .projectCode(code)
                .projectName(req.getProjectName())
                .projectType(req.getProjectType())
                .status(req.getStatus() != null ? req.getStatus() : ProjectStatus.PLANNING)
                .techStack(techStackJson)
                .startDate(startDate)
                .endDate(req.getEndDate())
                .gitRepoUrl(req.getGitRepoUrl())
                .jiraUrl(req.getJiraUrl())
                .figmaUrl(req.getFigmaUrl())
                .description(req.getDescription())
                .createdBy(currentUserId)
                .build();

        TechProject saved = projectRepository.save(project);
        log.info("[Tech] Tạo dự án mới thành công: {} ({}) bởi user {}", saved.getProjectName(), saved.getProjectCode(), currentUserId);
        return mapToProjectResponse(saved);
    }

    @Transactional
    public TechProjectResponse updateProject(Long id, UpdateProjectRequest req) {
        TechProject project = projectRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + id));

        if (req.getProjectCode() != null && !req.getProjectCode().trim().equalsIgnoreCase(project.getProjectCode())) {
            String newCode = req.getProjectCode().trim().toUpperCase();
            if (projectRepository.existsByProjectCode(newCode)) {
                throw AppException.conflict("Mã dự án '" + newCode + "' đã tồn tại! Không cho phép tạo trùng.");
            }
            project.setProjectCode(newCode);
        }

        project.setProjectName(req.getProjectName());
        if (req.getProjectType() != null) project.setProjectType(req.getProjectType());

        ProjectStatus oldStatus = project.getStatus();
        if (req.getStatus() != null) {
            project.setStatus(req.getStatus());
            // Nếu dự án chuyển sang COMPLETED, giải phóng tất cả thành viên về Bench
            if (req.getStatus() == ProjectStatus.COMPLETED && oldStatus != ProjectStatus.COMPLETED) {
                List<TechProjectMember> activeMembers = memberRepository.findByProjectIdAndIsActiveTrue(project.getId());
                LocalDate now = LocalDate.now();
                for (TechProjectMember m : activeMembers) {
                    m.setIsActive(false);
                    if (m.getLeftAt() == null) {
                        m.setLeftAt(now);
                    }
                }
                memberRepository.saveAll(activeMembers);
                log.info("[Tech] Dự án {} đã hoàn thành. Đã giải phóng {} nhân sự về Bench", project.getProjectCode(), activeMembers.size());
            }
        }

        if (req.getTechStack() != null) {
            project.setTechStack(serializeTechStack(req.getTechStack()));
        }
        // Quy tắc khi sửa: Ngày bắt đầu KHÔNG được phép thay đổi (giữ nguyên project.getStartDate())
        // Ngày kết thúc không được chọn ngày trong quá khứ và phải sau ngày bắt đầu ít nhất 24 giờ
        if (req.getEndDate() != null) {
            LocalDate today = LocalDate.now();
            if (req.getEndDate().isBefore(today)) {
                throw AppException.badRequest("Ngày kết thúc không được chọn ngày trong quá khứ (phải từ ngày " + today.format(DATE_FMT) + " trở đi)!");
            }
            if (project.getStartDate() != null) {
                LocalDate minEndDate = project.getStartDate().plusDays(1);
                if (req.getEndDate().isBefore(minEndDate)) {
                    throw AppException.badRequest("Ngày kết thúc dự kiến phải sau ngày bắt đầu ít nhất 24 giờ (phải từ ngày " + minEndDate.format(DATE_FMT) + " trở đi)!");
                }
            }
            project.setEndDate(req.getEndDate());
        }
        project.setGitRepoUrl(req.getGitRepoUrl());
        project.setJiraUrl(req.getJiraUrl());
        project.setFigmaUrl(req.getFigmaUrl());
        project.setDescription(req.getDescription());

        TechProject updated = projectRepository.save(project);
        return mapToProjectResponse(updated);
    }

    @Transactional
    public void deleteProject(Long id) {
        TechProject project = projectRepository.findById(id)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + id));
        projectRepository.delete(project);
        log.info("[Tech] Đã xóa dự án ID: {}", id);
    }

    @Transactional
    public TechProjectMemberResponse addMember(Long projectId, AddProjectMemberRequest req) {
        TechProject project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy dự án với ID: " + projectId));

        User user = userRepository.findById(req.getUserId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân viên ID: " + req.getUserId()));

        Optional<TechProjectMember> existingActive = memberRepository.findByProjectIdAndUserIdAndIsActiveTrue(projectId, req.getUserId());
        if (existingActive.isPresent()) {
            throw AppException.conflict("Nhân viên " + user.getHoTen() + " đã là thành viên đang hoạt động trong dự án này!");
        }

        Integer currentTotal = memberRepository.getTotalActiveAllocationByUserId(req.getUserId());
        int newTotal = currentTotal + req.getAllocationPercent();
        if (newTotal > 100) {
            log.warn("[Tech] Cảnh báo: Gán nhân viên {} vào dự án {} khiến tổng tải đạt {}% (Quá tải)",
                    user.getHoTen(), project.getProjectCode(), newTotal);
        }

        TechProjectMember member = TechProjectMember.builder()
                .project(project)
                .userId(req.getUserId())
                .projectRole(req.getProjectRole())
                .allocationPercent(req.getAllocationPercent())
                .joinedAt(req.getJoinedAt() != null ? req.getJoinedAt() : LocalDate.now())
                .isActive(true)
                .build();

        TechProjectMember saved = memberRepository.save(member);
        return mapToMemberResponse(saved, user, newTotal);
    }

    @Transactional
    public TechProjectMemberResponse updateMember(Long projectId, Long memberId, UpdateProjectMemberRequest req) {
        TechProjectMember member = memberRepository.findById(memberId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi thành viên với ID: " + memberId));

        if (!member.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Thành viên không thuộc dự án này");
        }

        if (req.getProjectRole() != null) {
            member.setProjectRole(req.getProjectRole());
        }
        if (req.getAllocationPercent() != null) {
            member.setAllocationPercent(req.getAllocationPercent());
        }
        if (req.getIsActive() != null) {
            member.setIsActive(req.getIsActive());
            if (!req.getIsActive() && member.getLeftAt() == null) {
                member.setLeftAt(LocalDate.now());
            }
        }

        TechProjectMember updated = memberRepository.save(member);
        User user = userRepository.findById(updated.getUserId()).orElse(null);
        Integer totalAllocation = memberRepository.getTotalActiveAllocationByUserId(updated.getUserId());
        return mapToMemberResponse(updated, user, totalAllocation);
    }

    @Transactional
    public void removeMember(Long projectId, Long memberId) {
        TechProjectMember member = memberRepository.findById(memberId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi thành viên với ID: " + memberId));

        if (!member.getProject().getId().equals(projectId)) {
            throw AppException.badRequest("Thành viên không thuộc dự án này");
        }

        member.setIsActive(false);
        member.setLeftAt(LocalDate.now());
        memberRepository.save(member);
        log.info("[Tech] Đã cho nhân sự ID {} rời khỏi dự án {}", member.getUserId(), projectId);
    }

    @Transactional(readOnly = true)
    public List<TechProjectResponse> getMyProjects(Long currentUserId) {
        List<TechProject> projects = projectRepository.findProjectsByMemberUserId(currentUserId);
        return projects.stream().map(this::mapToProjectResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TechBenchUserResponse> getBenchEngineers(Long departmentId) {
        List<User> candidates;
        if (departmentId != null) {
            candidates = userRepository.findByDepartmentId(departmentId);
        } else {
            // Lấy theo phòng Kỹ thuật hoặc tất cả user
            Optional<Department> techDept = departmentRepository.findByTenPhong("Kỹ thuật");
            if (techDept.isEmpty()) {
                techDept = departmentRepository.findByTenPhong("Công nghệ");
            }
            if (techDept.isPresent()) {
                candidates = userRepository.findByDepartmentId(techDept.get().getId());
            } else {
                candidates = userRepository.findAll();
            }
        }

        List<TechBenchUserResponse> benchList = new ArrayList<>();
        for (User user : candidates) {
            if (Boolean.FALSE.equals(user.getActive())) continue;
            // Chỉ quản lý ghế chờ (Bench) và điều phối dự án cho kỹ sư thực thi (NHAN_VIEN), loại trừ cấp quản lý (GIAM_DOC, TRUONG_PHONG, CEO, ADMIN)
            if (user.getRole() != Role.NHAN_VIEN) continue;

            List<TechProjectMember> activeMemberships = memberRepository.findActiveMembershipsWithProject(user.getId());
            int totalAlloc = activeMemberships.stream().mapToInt(TechProjectMember::getAllocationPercent).sum();
            List<String> projectNames = activeMemberships.stream()
                    .map(m -> m.getProject().getProjectName() + " (" + m.getAllocationPercent() + "%)")
                    .collect(Collectors.toList());

            Department dept = user.getDepartmentId() != null ? departmentRepository.findById(user.getDepartmentId()).orElse(null) : null;

            benchList.add(TechBenchUserResponse.builder()
                    .userId(user.getId())
                    .hoTen(user.getHoTen())
                    .email(user.getEmail())
                    .maNhanVien(user.getMaNhanVien())
                    .chucVu(user.getChucVu())
                    .avatarUrl(user.getAvatarUrl())
                    .departmentName(dept != null ? dept.getTenPhong() : "Chưa phân phòng")
                    .totalAllocation(totalAlloc)
                    .availableCapacity(Math.max(0, 100 - totalAlloc))
                    .activeProjectsCount(activeMemberships.size())
                    .isOverloaded(totalAlloc > 100)
                    .activeProjectNames(projectNames)
                    .build());
        }

        // Sắp xếp: Ưu tiên ai rảnh nhiều nhất (% available cao nhất) lên đầu
        benchList.sort((a, b) -> b.getAvailableCapacity().compareTo(a.getAvailableCapacity()));
        return benchList;
    }

    @Transactional(readOnly = true)
    public List<TechBenchUserResponse> getDepartmentEngineers(Long departmentId) {
        return getBenchEngineers(departmentId);
    }

    // ── Helper Mappers ──────────────────────────────────────────────────────────

    private TechProjectResponse mapToProjectResponse(TechProject project) {
        List<TechProjectMember> members = memberRepository.findByProjectId(project.getId());
        List<TechProjectMemberResponse> memberResponses = new ArrayList<>();
        String techLeadName = null;
        int totalAlloc = 0;

        for (TechProjectMember m : members) {
            User u = userRepository.findById(m.getUserId()).orElse(null);
            Integer currentTotal = memberRepository.getTotalActiveAllocationByUserId(m.getUserId());
            TechProjectMemberResponse mr = mapToMemberResponse(m, u, currentTotal);
            memberResponses.add(mr);

            if (Boolean.TRUE.equals(m.getIsActive())) {
                totalAlloc += m.getAllocationPercent();
                if (m.getProjectRole() == ProjectRole.TECH_LEAD && techLeadName == null && u != null) {
                    techLeadName = u.getHoTen();
                }
            }
        }

        String createdByName = null;
        if (project.getCreatedBy() != null) {
            createdByName = userRepository.findById(project.getCreatedBy()).map(User::getHoTen).orElse(null);
        }

        List<String> stackList = deserializeTechStack(project.getTechStack());

        return TechProjectResponse.builder()
                .id(project.getId())
                .projectCode(project.getProjectCode())
                .projectName(project.getProjectName())
                .projectType(project.getProjectType())
                .status(project.getStatus())
                .techStack(stackList)
                .startDate(project.getStartDate())
                .endDate(project.getEndDate())
                .gitRepoUrl(project.getGitRepoUrl())
                .jiraUrl(project.getJiraUrl())
                .figmaUrl(project.getFigmaUrl())
                .description(project.getDescription())
                .createdBy(project.getCreatedBy())
                .createdByName(createdByName)
                .createdAt(project.getCreatedAt())
                .updatedAt(project.getUpdatedAt())
                .members(memberResponses)
                .techLeadName(techLeadName != null ? techLeadName : "Chưa chỉ định")
                .totalMembersCount((int) memberResponses.stream().filter(m -> Boolean.TRUE.equals(m.getIsActive())).count())
                .totalAllocationSum(totalAlloc)
                .build();
    }

    private TechProjectMemberResponse mapToMemberResponse(TechProjectMember member, User user, Integer totalAllocation) {
        int alloc = totalAllocation != null ? totalAllocation : member.getAllocationPercent();
        return TechProjectMemberResponse.builder()
                .id(member.getId())
                .projectId(member.getProject().getId())
                .userId(member.getUserId())
                .userName(user != null ? user.getHoTen() : "N/A")
                .userEmail(user != null ? user.getEmail() : "N/A")
                .userMaNhanVien(user != null ? user.getMaNhanVien() : "N/A")
                .userAvatarUrl(user != null ? user.getAvatarUrl() : null)
                .userChucVu(user != null ? user.getChucVu() : null)
                .projectRole(member.getProjectRole())
                .allocationPercent(member.getAllocationPercent())
                .joinedAt(member.getJoinedAt())
                .leftAt(member.getLeftAt())
                .isActive(member.getIsActive())
                .totalCurrentAllocation(alloc)
                .isOverloaded(alloc > 100)
                .build();
    }

    private String serializeTechStack(List<String> stack) {
        if (stack == null || stack.isEmpty()) return "[]";
        try {
            return objectMapper.writeValueAsString(stack);
        } catch (Exception e) {
            log.warn("Không thể serialize techStack: {}", e.getMessage());
            return "[]";
        }
    }

    private List<String> deserializeTechStack(String json) {
        if (json == null || json.trim().isEmpty() || json.equals("[]")) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Không thể deserialize techStack: {}", e.getMessage());
            return Collections.singletonList(json);
        }
    }
}

