package com.hrm.tech.service;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
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
public class TechSkillService {

    private final TechSkillRepository skillRepository;
    private final UserTechSkillRepository userSkillRepository;
    private final UserTechCertificateRepository certificateRepository;
    private final TechProjectMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    // Trọng số cấp bậc phục vụ tính điểm Radar & Match Score
    private static final Map<ProficiencyLevel, Integer> LEVEL_WEIGHTS = Map.of(
            ProficiencyLevel.FRESHER, 1,
            ProficiencyLevel.JUNIOR, 2,
            ProficiencyLevel.MIDDLE, 3,
            ProficiencyLevel.SENIOR, 4,
            ProficiencyLevel.EXPERT, 5);

    @Transactional(readOnly = true)
    public List<TechSkillResponse> getAllSkills() {
        return skillRepository.findAllByOrderByCategoryAscSkillNameAsc().stream()
                .map(this::mapToSkillResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechSkillResponse createSkill(CreateTechSkillRequest req) {
        String name = req.getSkillName().trim();
        if (skillRepository.existsBySkillNameIgnoreCase(name)) {
            throw AppException.conflict("Kỹ năng '" + name + "' đã tồn tại trong danh mục!");
        }

        TechSkill skill = TechSkill.builder()
                .skillName(name)
                .category(req.getCategory())
                .description(req.getDescription())
                .iconName(req.getIconName())
                .build();

        return mapToSkillResponse(skillRepository.save(skill));
    }

    @Transactional(readOnly = true)
    public TechProfileResponse getMyProfile(Long currentUserId) {
        return buildTechProfile(currentUserId);
    }

    @Transactional(readOnly = true)
    public TechProfileResponse getUserProfile(Long userId) {
        return buildTechProfile(userId);
    }

    @Transactional
    public UserSkillResponse addUserSkill(Long userId, AddUserSkillRequest req) {
        TechSkill skill = skillRepository.findById(req.getSkillId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ năng với ID: " + req.getSkillId()));

        if (userSkillRepository.existsByUserIdAndSkillId(userId, req.getSkillId())) {
            throw AppException.conflict("Kỹ năng '" + skill.getSkillName() + "' đã tồn tại trong hồ sơ của bạn!");
        }

        if (req.getYearsOfExperience() != null) {
            if (req.getYearsOfExperience() < 0) {
                throw AppException.badRequest("Số năm kinh nghiệm không được âm!");
            }
            if (req.getYearsOfExperience() > 40) {
                throw AppException.badRequest("Số năm kinh nghiệm không hợp lệ (tối đa không quá 40 năm)!");
            }
        }

        UserTechSkill userSkill = UserTechSkill.builder()
                .userId(userId)
                .skill(skill)
                .proficiencyLevel(req.getProficiencyLevel())
                .yearsOfExperience(req.getYearsOfExperience() != null ? req.getYearsOfExperience() : 0.0)
                .isVerified(false)
                .highlightProject(req.getHighlightProject())
                .build();

        UserTechSkill saved = userSkillRepository.save(userSkill);
        log.info("[Tech] Kỹ sư {} khai báo thêm kỹ năng: {} ({})", userId, skill.getSkillName(),
                req.getProficiencyLevel());
        return mapToUserSkillResponse(saved);
    }

    @Transactional
    public UserSkillResponse updateUserSkill(Long userId, Long userSkillId, UpdateUserSkillRequest req) {
        UserTechSkill userSkill = userSkillRepository.findById(userSkillId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi kỹ năng!"));

        if (!userSkill.getUserId().equals(userId)) {
            throw AppException.forbidden("Bạn không có quyền chỉnh sửa kỹ năng này!");
        }

        if (req.getYearsOfExperience() != null) {
            if (req.getYearsOfExperience() < 0) {
                throw AppException.badRequest("Số năm kinh nghiệm không được âm!");
            }
            if (req.getYearsOfExperience() > 40) {
                throw AppException.badRequest("Số năm kinh nghiệm không hợp lệ (tối đa không quá 40 năm)!");
            }
        }

        // Nếu thay đổi cấp bậc, reset trạng thái xác thực để cấp quản lý duyệt lại
        if (req.getProficiencyLevel() != null && !req.getProficiencyLevel().equals(userSkill.getProficiencyLevel())) {
            userSkill.setProficiencyLevel(req.getProficiencyLevel());
            userSkill.setIsVerified(false);
            userSkill.setVerifiedBy(null);
            userSkill.setVerifiedAt(null);
        }

        if (req.getYearsOfExperience() != null) {
            userSkill.setYearsOfExperience(req.getYearsOfExperience());
        }
        if (req.getHighlightProject() != null) {
            userSkill.setHighlightProject(req.getHighlightProject());
        }

        UserTechSkill updated = userSkillRepository.save(userSkill);
        return mapToUserSkillResponse(updated);
    }

    @Transactional
    public void deleteUserSkill(Long userId, Long userSkillId) {
        UserTechSkill userSkill = userSkillRepository.findById(userSkillId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi kỹ năng!"));

        if (!userSkill.getUserId().equals(userId)) {
            throw AppException.forbidden("Bạn không có quyền xóa kỹ năng này!");
        }

        userSkillRepository.delete(userSkill);
        log.info("[Tech] Kỹ sư {} đã xóa kỹ năng id: {}", userId, userSkillId);
    }

    @Transactional
    public UserSkillResponse verifyUserSkill(Long userSkillId, Long verifierUserId) {
        User verifier = userRepository.findById(verifierUserId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người xác thực!"));

        if (verifier.getRole() == Role.NHAN_VIEN || verifier.getRole() == Role.CEO) {
            throw AppException.forbidden("Chỉ Giám đốc hoặc Trưởng phòng Công nghệ mới có quyền xác thực kỹ năng chuyên môn!");
        }

        UserTechSkill userSkill = userSkillRepository.findById(userSkillId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy bản ghi kỹ năng!"));

        userSkill.setIsVerified(true);
        userSkill.setVerifiedBy(verifierUserId);
        userSkill.setVerifiedAt(LocalDateTime.now());

        UserTechSkill saved = userSkillRepository.save(userSkill);
        log.info("[Tech] Quản lý {} đã xác thực kỹ năng '{}' cho nhân viên {}", verifier.getHoTen(),
                saved.getSkill().getSkillName(), saved.getUserId());
        return mapToUserSkillResponse(saved);
    }

    @Transactional
    public CertificateResponse addCertificate(Long userId, AddCertificateRequest req) {
        validateCertificateDates(req.getIssueDate(), req.getExpiryDate());

        UserTechCertificate cert = UserTechCertificate.builder()
                .userId(userId)
                .certificateName(req.getCertificateName().trim())
                .issuingOrganization(req.getIssuingOrganization().trim())
                .issueDate(req.getIssueDate())
                .expiryDate(req.getExpiryDate())
                .credentialId(req.getCredentialId() != null ? req.getCredentialId().trim() : null)
                .credentialUrl(req.getCredentialUrl() != null ? req.getCredentialUrl().trim() : null)
                .build();

        return mapToCertResponse(certificateRepository.save(cert));
    }

    @Transactional
    public CertificateResponse updateCertificate(Long userId, Long certId, UpdateCertificateRequest req) {
        UserTechCertificate cert = certificateRepository.findById(certId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chứng chỉ!"));

        if (!cert.getUserId().equals(userId)) {
            throw AppException.forbidden("Bạn không có quyền chỉnh sửa chứng chỉ này!");
        }

        validateCertificateDates(req.getIssueDate(), req.getExpiryDate());

        cert.setCertificateName(req.getCertificateName().trim());
        cert.setIssuingOrganization(req.getIssuingOrganization().trim());
        cert.setIssueDate(req.getIssueDate());
        cert.setExpiryDate(req.getExpiryDate());
        cert.setCredentialId(req.getCredentialId() != null ? req.getCredentialId().trim() : null);
        cert.setCredentialUrl(req.getCredentialUrl() != null ? req.getCredentialUrl().trim() : null);

        return mapToCertResponse(certificateRepository.save(cert));
    }

    private void validateCertificateDates(LocalDate issueDate, LocalDate expiryDate) {
        LocalDate today = LocalDate.now();

        if (issueDate == null) {
            throw AppException.badRequest("Vui lòng chọn ngày cấp chứng chỉ!");
        }

        if (issueDate.isAfter(today)) {
            throw AppException.badRequest("Ngày cấp chứng chỉ không được ở tương lai!");
        }

        if (issueDate.isBefore(today.minusYears(40))) {
            throw AppException.badRequest("Ngày cấp chứng chỉ không hợp lệ (không quá 40 năm trước)!");
        }

        if (expiryDate != null) {
            if (!expiryDate.isAfter(issueDate)) {
                throw AppException.badRequest("Ngày hết hạn phải sau ngày cấp chứng chỉ!");
            }
            if (expiryDate.isAfter(issueDate.plusYears(15))) {
                throw AppException.badRequest("Thời hạn chứng chỉ không hợp lệ (tối đa không quá 15 năm kể từ ngày cấp)!");
            }
        }
    }

    @Transactional
    public void deleteCertificate(Long userId, Long certId) {
        UserTechCertificate cert = certificateRepository.findById(certId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chứng chỉ!"));

        if (!cert.getUserId().equals(userId)) {
            throw AppException.forbidden("Bạn không có quyền xóa chứng chỉ này!");
        }

        certificateRepository.delete(cert);
    }

    @Transactional(readOnly = true)
    public List<TechProfileResponse> getSkillsMatrix(Long departmentId) {
        List<User> engineers = getTechEngineers(departmentId);
        return engineers.stream().map(u -> buildTechProfile(u.getId())).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SkillMatchCandidateResponse> matchSkills(SkillMatchRequest req, Long departmentId) {
        List<User> engineers = getTechEngineers(departmentId);
        List<Long> targetSkillIds = req.getSkillIds() != null ? req.getSkillIds() : Collections.emptyList();
        int minReqLevelWeight = req.getMinProficiencyLevel() != null ? LEVEL_WEIGHTS.get(req.getMinProficiencyLevel())
                : 1;

        List<SkillMatchCandidateResponse> results = new ArrayList<>();

        for (User user : engineers) {
            List<TechProjectMember> activeMemberships = memberRepository.findActiveMembershipsWithProject(user.getId());
            int totalAlloc = activeMemberships.stream().mapToInt(TechProjectMember::getAllocationPercent).sum();
            int availableCapacity = Math.max(0, 100 - totalAlloc);

            if (Boolean.TRUE.equals(req.getBenchOnly()) && availableCapacity <= 0) {
                continue; // Bỏ qua nếu yêu cầu chỉ tìm người đang ngồi bench/còn dung lượng
            }

            List<UserTechSkill> userSkills = userSkillRepository.findByUserId(user.getId());
            List<UserSkillResponse> allSkillResponses = userSkills.stream().map(this::mapToUserSkillResponse)
                    .sorted(Comparator.comparing((UserSkillResponse s) -> s.getProficiencyLevel() != null ? s.getProficiencyLevel().ordinal() : 99)
                            .thenComparing(s -> s.getYearsOfExperience() != null ? s.getYearsOfExperience() : 0.0)
                            .thenComparing(s -> s.getSkillName() != null ? s.getSkillName() : ""))
                    .collect(Collectors.toList());

            // Đánh giá khớp kỹ năng
            List<UserSkillResponse> matchedSkills = new ArrayList<>();
            double scoreSum = 0.0;

            if (targetSkillIds.isEmpty()) {
                scoreSum = 100.0;
            } else {
                boolean isStrict = Boolean.TRUE.equals(req.getStrictLevel());
                for (Long reqSkillId : targetSkillIds) {
                    Optional<UserTechSkill> found = userSkills.stream()
                            .filter(us -> us.getSkill().getId().equals(reqSkillId))
                            .findFirst();

                    if (found.isPresent()) {
                        UserTechSkill us = found.get();
                        int userLevelWeight = LEVEL_WEIGHTS.get(us.getProficiencyLevel());

                        if (userLevelWeight >= minReqLevelWeight) {
                            matchedSkills.add(mapToUserSkillResponse(us));
                            scoreSum += (100.0 / targetSkillIds.size());
                        } else if (!isStrict) {
                            // Khớp kỹ năng nhưng chưa đạt level mong muốn (được 60% số điểm) - chỉ tính khi KHÔNG bật lọc nghiêm ngặt
                            matchedSkills.add(mapToUserSkillResponse(us));
                            scoreSum += (100.0 / targetSkillIds.size()) * 0.6;
                        }
                    }
                }
            }

            int finalScore = (int) Math.round(scoreSum);

            // Chỉ lấy ứng viên có ít nhất 1 kỹ năng khớp (hoặc khi không chọn skill nào)
            if (targetSkillIds.isEmpty() || !matchedSkills.isEmpty()) {
                matchedSkills.sort(Comparator.comparing((UserSkillResponse s) -> s.getProficiencyLevel() != null ? s.getProficiencyLevel().ordinal() : 99)
                        .thenComparing(s -> s.getYearsOfExperience() != null ? s.getYearsOfExperience() : 0.0)
                        .thenComparing(s -> s.getSkillName() != null ? s.getSkillName() : ""));
                results.add(SkillMatchCandidateResponse.builder()
                        .userId(user.getId())
                        .hoTen(user.getHoTen())
                        .email(user.getEmail())
                        .maNhanVien(user.getMaNhanVien())
                        .chucVu(user.getChucVu())
                        .avatarUrl(user.getAvatarUrl())
                        .totalAllocation(totalAlloc)
                        .availableCapacity(availableCapacity)
                        .matchScore(finalScore)
                        .matchedSkills(matchedSkills)
                        .allSkills(allSkillResponses)
                        .build());
            }
        }

        // Sắp xếp ưu tiên: Điểm tương thích cao nhất -> Dung lượng rảnh nhiều nhất
        results.sort(Comparator.comparingInt(SkillMatchCandidateResponse::getMatchScore).reversed()
                .thenComparing(Comparator.comparingInt(SkillMatchCandidateResponse::getAvailableCapacity).reversed()));

        return results;
    }

    // --- Helper methods ---

    private List<User> getTechEngineers(Long departmentId) {
        List<User> candidates;
        if (departmentId != null) {
            candidates = userRepository.findByDepartmentId(departmentId);
        } else {
            Optional<Department> techDept = departmentRepository.findByTenPhong("Kỹ thuật");
            if (techDept.isEmpty())
                techDept = departmentRepository.findByTenPhong("Công nghệ");
            candidates = techDept.map(d -> userRepository.findByDepartmentId(d.getId()))
                    .orElseGet(userRepository::findAll);
        }

        return candidates.stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> u.getRole() == Role.NHAN_VIEN) // Chỉ lấy kỹ sư thực thi
                .collect(Collectors.toList());
    }

    private TechProfileResponse buildTechProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy người dùng với ID: " + userId));

        Department dept = user.getDepartmentId() != null
                ? departmentRepository.findById(user.getDepartmentId()).orElse(null)
                : null;

        List<TechProjectMember> activeMemberships = memberRepository.findActiveMembershipsWithProject(userId);
        int totalAlloc = activeMemberships.stream().mapToInt(TechProjectMember::getAllocationPercent).sum();
        int availableCapacity = Math.max(0, 100 - totalAlloc);

        List<UserTechSkill> userSkills = userSkillRepository.findByUserId(userId);
        List<UserSkillResponse> skillResponses = userSkills.stream()
                .map(this::mapToUserSkillResponse)
                .sorted(Comparator.comparing((UserSkillResponse s) -> s.getProficiencyLevel() != null ? s.getProficiencyLevel().ordinal() : 99)
                        .thenComparing(s -> s.getYearsOfExperience() != null ? s.getYearsOfExperience() : 0.0)
                        .thenComparing(s -> s.getSkillName() != null ? s.getSkillName() : ""))
                .collect(Collectors.toList());

        List<UserTechCertificate> certs = certificateRepository.findByUserIdOrderByIssueDateDesc(userId);
        List<CertificateResponse> certResponses = certs.stream()
                .map(this::mapToCertResponse)
                .collect(Collectors.toList());

        Map<String, Double> radarScores = calculateRadarScores(userSkills);

        int verifiedCount = (int) userSkills.stream().filter(UserTechSkill::getIsVerified).count();

        return TechProfileResponse.builder()
                .userId(user.getId())
                .hoTen(user.getHoTen())
                .email(user.getEmail())
                .maNhanVien(user.getMaNhanVien())
                .chucVu(user.getChucVu())
                .departmentName(dept != null ? dept.getTenPhong() : "Chưa phân phòng")
                .avatarUrl(user.getAvatarUrl())
                .totalAllocation(totalAlloc)
                .availableCapacity(availableCapacity)
                .skills(skillResponses)
                .certificates(certResponses)
                .radarScores(radarScores)
                .totalSkills(userSkills.size())
                .verifiedSkills(verifiedCount)
                .build();
    }

    /**
     * Tính điểm Radar 6 chiều chuyên môn (0 - 100)
     */
    private Map<String, Double> calculateRadarScores(List<UserTechSkill> userSkills) {
        Map<String, Double> scores = new LinkedHashMap<>();
        String[] dimensions = { "BACKEND", "FRONTEND", "DATABASE", "DEVOPS_CLOUD", "TESTING", "ARCHITECTURE" };

        for (String dim : dimensions) {
            List<UserTechSkill> categorySkills = userSkills.stream()
                    .filter(us -> us.getSkill().getCategory().name().equalsIgnoreCase(dim))
                    .collect(Collectors.toList());

            if (categorySkills.isEmpty()) {
                scores.put(dim, 0.0);
            } else {
                // Điểm = (Level cao nhất * 16) + (Số kỹ năng trong nhóm * 6) + (Bonus xác thực)
                int maxLevelWeight = categorySkills.stream()
                        .mapToInt(us -> LEVEL_WEIGHTS.get(us.getProficiencyLevel()))
                        .max().orElse(1);

                double baseScore = maxLevelWeight * 16.0; // max = 80
                double breadthBonus = Math.min(15.0, categorySkills.size() * 5.0);
                double verifyBonus = categorySkills.stream().anyMatch(UserTechSkill::getIsVerified) ? 5.0 : 0.0;

                double total = Math.min(100.0, baseScore + breadthBonus + verifyBonus);
                scores.put(dim, Math.round(total * 10.0) / 10.0);
            }
        }

        return scores;
    }

    private TechSkillResponse mapToSkillResponse(TechSkill s) {
        return TechSkillResponse.builder()
                .id(s.getId())
                .skillName(s.getSkillName())
                .category(s.getCategory())
                .description(s.getDescription())
                .iconName(s.getIconName())
                .build();
    }

    private UserSkillResponse mapToUserSkillResponse(UserTechSkill us) {
        String verifierName = null;
        if (us.getVerifiedBy() != null) {
            verifierName = userRepository.findById(us.getVerifiedBy()).map(User::getHoTen).orElse(null);
        }

        return UserSkillResponse.builder()
                .id(us.getId())
                .userId(us.getUserId())
                .skillId(us.getSkill().getId())
                .skillName(us.getSkill().getSkillName())
                .category(us.getSkill().getCategory())
                .proficiencyLevel(us.getProficiencyLevel())
                .yearsOfExperience(us.getYearsOfExperience())
                .isVerified(us.getIsVerified())
                .verifiedBy(us.getVerifiedBy())
                .verifierName(verifierName)
                .verifiedAt(us.getVerifiedAt())
                .highlightProject(us.getHighlightProject())
                .iconName(us.getSkill().getIconName())
                .build();
    }

    private CertificateResponse mapToCertResponse(UserTechCertificate c) {
        boolean isExpired = c.getExpiryDate() != null && c.getExpiryDate().isBefore(LocalDate.now());
        String status = c.getExpiryDate() == null ? "LIFETIME" : (isExpired ? "EXPIRED" : "ACTIVE");

        return CertificateResponse.builder()
                .id(c.getId())
                .userId(c.getUserId())
                .certificateName(c.getCertificateName())
                .issuingOrganization(c.getIssuingOrganization())
                .issueDate(c.getIssueDate())
                .expiryDate(c.getExpiryDate())
                .credentialId(c.getCredentialId())
                .credentialUrl(c.getCredentialUrl())
                .isExpired(isExpired)
                .status(status)
                .build();
    }
}
