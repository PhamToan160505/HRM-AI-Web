package com.hrm.tech.service;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechMentorshipService {

    private final TechMentorshipProgramRepository programRepository;
    private final TechMentorshipCheckinRepository checkinRepository;
    private final TechSkillRepository skillRepository;
    private final UserTechSkillRepository userSkillRepository;
    private final UserRepository userRepository;
    private final TechCareerEventRepository careerEventRepository;

    @Transactional(readOnly = true)
    public List<TechMentorshipProgramResponse> getDepartmentPrograms(Long departmentId) {
        return programRepository.findByDepartmentIdOrderByCreatedAtDesc(departmentId)
                .stream()
                .map(this::mapProgramToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TechMentorshipProgramResponse> getMyPrograms(Long userId) {
        return programRepository.findByMentorIdOrMenteeIdOrderByCreatedAtDesc(userId, userId)
                .stream()
                .map(this::mapProgramToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechMentorshipProgramResponse createProgram(Long departmentId, CreateTechMentorshipRequest req, Long actorId) {
        if (req.getMentorId().equals(req.getMenteeId())) {
            throw AppException.badRequest("Kỹ sư không thể tự làm Mentor cho chính mình!");
        }

        if (req.getEndDate().isBefore(req.getStartDate())) {
            throw AppException.badRequest("Ngày kết thúc dự kiến không được trước ngày bắt đầu chương trình!");
        }

        long durationDays = java.time.temporal.ChronoUnit.DAYS.between(req.getStartDate(), req.getEndDate());
        if (durationDays < 14) {
            throw AppException.badRequest("Thời lượng chương trình kèm cặp tối thiểu là 14 ngày (2 tuần) để đảm bảo chu kỳ check-in và bồi dưỡng năng lực!");
        }

        java.time.LocalDate maxAllowedEndDate = req.getStartDate().plusMonths(6);
        if (req.getEndDate().isAfter(maxAllowedEndDate)) {
            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
            throw AppException.badRequest("Thời lượng chương trình kèm cặp tối đa không được vượt quá 6 tháng (trước ngày " + maxAllowedEndDate.format(formatter) + ")!");
        }

        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDate minAllowedStartDate = today.minusDays(30);
        if (req.getStartDate().isBefore(minAllowedStartDate)) {
            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
            throw AppException.badRequest("Ngày bắt đầu không được trước ngày " + minAllowedStartDate.format(formatter) + " (giới hạn tối đa 30 ngày trong chu kỳ báo cáo tháng)!");
        }

        User mentor = userRepository.findById(req.getMentorId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy thông tin Mentor với ID: " + req.getMentorId()));
        User mentee = userRepository.findById(req.getMenteeId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy thông tin Mentee với ID: " + req.getMenteeId()));

        if (!isEligibleMentor(mentor)) {
            throw AppException.badRequest("Không thể chỉ định Ban lãnh đạo (Giám đốc phòng ban, CEO, Admin) hoặc tài khoản đã vô hiệu hóa làm Mentor kèm cặp kỹ thuật!");
        }

        TechSkill focusSkill = null;
        if (req.getFocusSkillId() != null) {
            focusSkill = skillRepository.findById(req.getFocusSkillId())
                    .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ năng với ID: " + req.getFocusSkillId()));

            // Ràng buộc chống xung đột: Mentee không nên có 2 chương trình active cùng lúc về cùng 1 kỹ năng
            List<TechMentorshipProgram> activePrograms = programRepository.findByMenteeIdAndStatus(mentee.getId(), TechMentorshipStatus.ACTIVE);
            boolean alreadyHasSameSkill = activePrograms.stream()
                    .anyMatch(p -> p.getFocusSkill() != null && p.getFocusSkill().getId().equals(req.getFocusSkillId()));
            if (alreadyHasSameSkill) {
                throw AppException.badRequest("Kỹ sư " + mentee.getHoTen() + " hiện đã có chương trình kèm cặp đang hoạt động cho kỹ năng '" + focusSkill.getSkillName() + "'!");
            }
        }

        TechMentorshipProgram program = TechMentorshipProgram.builder()
                .departmentId(departmentId)
                .mentorId(mentor.getId())
                .menteeId(mentee.getId())
                .focusSkill(focusSkill)
                .programTitle(req.getProgramTitle().trim())
                .targetGoal(req.getTargetGoal().trim())
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .status(TechMentorshipStatus.ACTIVE)
                .createdBy(actorId)
                .build();

        TechMentorshipProgram saved = programRepository.save(program);
        log.info("[Tech Mentorship] Khởi tạo chương trình '{}' giữa Mentor {} và Mentee {}",
                saved.getProgramTitle(), mentor.getHoTen(), mentee.getHoTen());
        return mapProgramToResponse(saved);
    }

    @Transactional
    public TechMentorshipProgramResponse updateProgram(Long programId, UpdateTechMentorshipRequest req, Long actorId) {
        TechMentorshipProgram program = programRepository.findById(programId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chương trình kèm cặp với ID: " + programId));

        User actor = actorId != null ? userRepository.findById(actorId).orElse(null) : null;
        boolean isAuthorizedManager = actor != null && (actor.getRole() == Role.ADMIN
                || actor.getRole() == Role.GIAM_DOC_PHONG_BAN
                || actor.getRole() == Role.TRUONG_PHONG);
        if (!isAuthorizedManager) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc Phòng ban mới có quyền chỉnh sửa hoặc phê duyệt Tốt nghiệp chương trình kèm cặp!");
        }

        TechMentorshipStatus oldStatus = program.getStatus();

        if (req.getProgramTitle() != null && !req.getProgramTitle().trim().isEmpty()) {
            program.setProgramTitle(req.getProgramTitle().trim());
        }
        if (req.getTargetGoal() != null && !req.getTargetGoal().trim().isEmpty()) {
            program.setTargetGoal(req.getTargetGoal().trim());
        }
        if (req.getFocusSkillId() != null) {
            TechSkill skill = skillRepository.findById(req.getFocusSkillId())
                    .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ năng với ID: " + req.getFocusSkillId()));
            program.setFocusSkill(skill);
        }
        if (req.getEndDate() != null) {
            if (req.getEndDate().isBefore(program.getStartDate())) {
                throw AppException.badRequest("Ngày kết thúc không được trước ngày bắt đầu!");
            }
            long durationDays = java.time.temporal.ChronoUnit.DAYS.between(program.getStartDate(), req.getEndDate());
            if (durationDays < 14) {
                throw AppException.badRequest("Thời lượng chương trình kèm cặp tối thiểu là 14 ngày (2 tuần)!");
            }
            java.time.LocalDate maxAllowedEndDate = program.getStartDate().plusMonths(6);
            if (req.getEndDate().isAfter(maxAllowedEndDate)) {
                java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
                throw AppException.badRequest("Thời lượng chương trình kèm cặp tối đa không được vượt quá 6 tháng (trước ngày " + maxAllowedEndDate.format(formatter) + ")!");
            }
            program.setEndDate(req.getEndDate());
        }
        if (req.getFinalAssessment() != null) {
            program.setFinalAssessment(req.getFinalAssessment().trim());
        }
        if (req.getStatus() != null) {
            program.setStatus(req.getStatus());
        }

        TechMentorshipProgram updated = programRepository.save(program);

        // If newly marked as COMPLETED, record career event for both mentee and mentor
        if (oldStatus != TechMentorshipStatus.COMPLETED && updated.getStatus() == TechMentorshipStatus.COMPLETED) {
            logCompletionCareerEvents(updated, actorId);
        }

        log.info("[Tech Mentorship] Cập nhật chương trình ID {}: status={}", programId, updated.getStatus());
        return mapProgramToResponse(updated);
    }

    @Transactional
    public TechMentorshipProgramResponse proposeGraduation(Long programId, ProposeTechGraduationRequest req, Long actorId) {
        TechMentorshipProgram program = programRepository.findById(programId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chương trình kèm cặp với ID: " + programId));

        if (program.getStatus() != TechMentorshipStatus.ACTIVE) {
            throw AppException.badRequest("Chỉ có thể gửi đề xuất tốt nghiệp cho chương trình kèm cặp đang hoạt động!");
        }
        if (actorId == null || !actorId.equals(program.getMentorId())) {
            throw AppException.forbidden("Chỉ Mentor trực tiếp dẫn dắt chương trình này mới có quyền gửi nhận xét tổng kết và đề xuất Tốt nghiệp!");
        }

        program.setGraduationProposed(true);
        program.setMentorSummary(req.getMentorSummary().trim());
        program.setGraduationProposedAt(LocalDateTime.now());

        TechMentorshipProgram saved = programRepository.save(program);
        log.info("[Tech Mentorship] Mentor ID {} đã gửi đề xuất Tốt nghiệp cho chương trình ID {}", actorId, programId);
        return mapProgramToResponse(saved);
    }

    @Transactional(readOnly = true)
    public TechMentorshipProgramResponse getProgramById(Long programId) {
        TechMentorshipProgram program = programRepository.findById(programId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chương trình kèm cặp với ID: " + programId));
        return mapProgramToResponse(program);
    }

    @Transactional
    public void deleteProgram(Long programId, Long actorId) {
        TechMentorshipProgram program = programRepository.findById(programId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chương trình kèm cặp với ID: " + programId));

        List<TechMentorshipCheckin> checkins = checkinRepository.findByProgramIdOrderByCheckinDateDescCreatedAtDesc(programId);
        if (!checkins.isEmpty()) {
            checkinRepository.deleteAll(checkins);
        }
        programRepository.delete(program);
        log.info("[Tech Mentorship] Người dùng ID {} đã xóa chương trình kèm cặp ID '{}' ({})",
                actorId, program.getProgramTitle(), programId);
    }

    @Transactional(readOnly = true)
    public List<TechMentorshipCheckinResponse> getProgramCheckins(Long programId) {
        TechMentorshipProgram program = programRepository.findById(programId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chương trình kèm cặp với ID: " + programId));

        return checkinRepository.findByProgramIdOrderByCheckinDateDescCreatedAtDesc(program.getId())
                .stream()
                .map(this::mapCheckinToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TechMentorshipCheckinResponse createCheckin(Long programId, CreateTechCheckinRequest req, Long actorId) {
        TechMentorshipProgram program = programRepository.findById(programId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy chương trình kèm cặp với ID: " + programId));

        validateCheckinDatesAndStatus(program, req.getCheckinDate());

        TechMentorshipCheckin checkin = TechMentorshipCheckin.builder()
                .program(program)
                .checkinDate(req.getCheckinDate())
                .topicsCovered(req.getTopicsCovered().trim())
                .progressRating(req.getProgressRating())
                .mentorFeedback(req.getMentorFeedback() != null ? req.getMentorFeedback().trim() : null)
                .menteeNotes(req.getMenteeNotes() != null ? req.getMenteeNotes().trim() : null)
                .loggedBy(actorId)
                .build();

        TechMentorshipCheckin saved = checkinRepository.save(checkin);
        log.info("[Tech Mentorship] Ghi nhận checkin cho chương trình ID {} vào ngày {}", programId, saved.getCheckinDate());
        return mapCheckinToResponse(saved);
    }

    @Transactional
    public TechMentorshipCheckinResponse updateCheckin(Long checkinId, CreateTechCheckinRequest req, Long actorId) {
        TechMentorshipCheckin checkin = checkinRepository.findById(checkinId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy buổi check-in với ID: " + checkinId));

        TechMentorshipProgram program = checkin.getProgram();
        verifyCanModifyCheckin(program, checkin, actorId);
        validateCheckinDatesAndStatus(program, req.getCheckinDate());

        checkin.setCheckinDate(req.getCheckinDate());
        checkin.setTopicsCovered(req.getTopicsCovered().trim());
        checkin.setProgressRating(req.getProgressRating());
        checkin.setMentorFeedback(req.getMentorFeedback() != null && !req.getMentorFeedback().isBlank()
                ? req.getMentorFeedback().trim() : null);
        checkin.setMenteeNotes(req.getMenteeNotes() != null && !req.getMenteeNotes().isBlank()
                ? req.getMenteeNotes().trim() : null);

        TechMentorshipCheckin updated = checkinRepository.save(checkin);
        log.info("[Tech Mentorship] Người dùng ID {} đã cập nhật buổi check-in ID {}", actorId, checkinId);
        return mapCheckinToResponse(updated);
    }

    @Transactional
    public void deleteCheckin(Long checkinId, Long actorId) {
        TechMentorshipCheckin checkin = checkinRepository.findById(checkinId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy buổi check-in với ID: " + checkinId));

        TechMentorshipProgram program = checkin.getProgram();
        if (program.getStatus() != TechMentorshipStatus.ACTIVE) {
            throw AppException.badRequest("Chỉ có thể xóa buổi check-in khi chương trình kèm cặp đang hoạt động!");
        }
        verifyCanModifyCheckin(program, checkin, actorId);

        checkinRepository.delete(checkin);
        log.info("[Tech Mentorship] Người dùng ID {} đã xóa buổi check-in ID {}", actorId, checkinId);
    }

    private void validateCheckinDatesAndStatus(TechMentorshipProgram program, java.time.LocalDate checkinDate) {
        if (program.getStatus() != TechMentorshipStatus.ACTIVE) {
            throw AppException.badRequest("Chỉ có thể thao tác check-in cho chương trình kèm cặp đang hoạt động!");
        }
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
        if (program.getStartDate() != null && checkinDate.isBefore(program.getStartDate())) {
            throw AppException.badRequest("Ngày check-in không được trước ngày bắt đầu chương trình ("
                    + program.getStartDate().format(formatter) + ")!");
        }
        if (program.getEndDate() != null && checkinDate.isAfter(program.getEndDate())) {
            throw AppException.badRequest("Ngày check-in không được vượt quá ngày kết thúc chương trình ("
                    + program.getEndDate().format(formatter) + ")!");
        }
    }

    private void verifyCanModifyCheckin(TechMentorshipProgram program, TechMentorshipCheckin checkin, Long actorId) {
        if (actorId == null) {
            throw AppException.forbidden("Không xác định được người thực hiện thao tác!");
        }
        User actor = userRepository.findById(actorId).orElse(null);
        boolean isManager = actor != null && (actor.getRole() == Role.ADMIN
                || actor.getRole() == Role.GIAM_DOC_PHONG_BAN
                || actor.getRole() == Role.TRUONG_PHONG);
        boolean isCreator = actorId.equals(checkin.getLoggedBy());
        boolean isMentor = actorId.equals(program.getMentorId());

        if (!isManager && !isCreator && !isMentor) {
            throw AppException.forbidden("Chỉ Quản lý, Mentor của chương trình hoặc người ghi nhận mới có quyền sửa/xóa buổi check-in này!");
        }
    }

    @Transactional(readOnly = true)
    public TechSmartMentorSuggestionResponse getSmartMentorSuggestions(Long menteeId, Long skillId) {
        User mentee = userRepository.findById(menteeId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự Mentee với ID: " + menteeId));

        String skillName = null;
        String menteeLevel = "Chưa thiết lập";

        if (skillId != null) {
            TechSkill skill = skillRepository.findById(skillId).orElse(null);
            if (skill != null) {
                skillName = skill.getSkillName();
            }
            Optional<UserTechSkill> menteeSkill = userSkillRepository.findByUserIdAndSkillId(menteeId, skillId);
            if (menteeSkill.isPresent() && menteeSkill.get().getProficiencyLevel() != null) {
                menteeLevel = menteeSkill.get().getProficiencyLevel().name();
            }
        }

        List<TechSmartMentorSuggestionResponse.MentorCandidateDto> candidates = new ArrayList<>();

        if (skillId != null) {
            List<UserTechSkill> skilledUsers = userSkillRepository.findBySkillId(skillId);
            for (UserTechSkill uts : skilledUsers) {
                if (uts.getUserId().equals(menteeId)) {
                    continue;
                }
                ProficiencyLevel lvl = uts.getProficiencyLevel();
                if (lvl == ProficiencyLevel.SENIOR || lvl == ProficiencyLevel.EXPERT) {
                    User u = userRepository.findById(uts.getUserId()).orElse(null);
                    if (isEligibleMentor(u)) {
                        List<TechMentorshipProgram> activePrograms = programRepository.findByMentorIdAndStatus(u.getId(), TechMentorshipStatus.ACTIVE);
                        String slotInfo = activePrograms.isEmpty() ? ", số lượng mentee hiện tại là 0 (dung lượng trống)" : ", số lượng mentee hiện tại: " + activePrograms.size();
                        candidates.add(TechSmartMentorSuggestionResponse.MentorCandidateDto.builder()
                                .mentorId(u.getId())
                                .mentorName(u.getHoTen())
                                .mentorEmail(u.getEmail())
                                .mentorLevel(lvl.name())
                                .yearsExperience(uts.getYearsOfExperience() != null ? uts.getYearsOfExperience() : 0.0)
                                .activeMentorshipsCount(activePrograms.size())
                                .recommendationReason("Nắm giữ kỹ năng " + skillName + " ở cấp bậc " + lvl.name() + " (" + (uts.getYearsOfExperience() != null ? uts.getYearsOfExperience() : 0) + " năm KN)" + slotInfo)
                                .build());
                    }
                }
            }
        } else {
            // General mentor candidates in the same department
            List<User> deptUsers = userRepository.findAll();
            for (User u : deptUsers) {
                if (u.getId().equals(menteeId)) continue;
                if (!isEligibleMentor(u)) continue;
                if (u.getDepartmentId() != null && mentee.getDepartmentId() != null && u.getDepartmentId().equals(mentee.getDepartmentId())) {
                    List<TechMentorshipProgram> active = programRepository.findByMentorIdAndStatus(u.getId(), TechMentorshipStatus.ACTIVE);
                    List<UserTechSkill> seniorSkills = userSkillRepository.findByUserId(u.getId()).stream()
                            .filter(s -> s.getProficiencyLevel() == ProficiencyLevel.SENIOR || s.getProficiencyLevel() == ProficiencyLevel.EXPERT)
                            .collect(Collectors.toList());
                    String skillStr = seniorSkills.isEmpty() ? "Kỹ thuật chuyên môn" : seniorSkills.stream().map(s -> s.getSkill().getSkillName()).collect(Collectors.joining("/"));
                    String slotInfo = active.isEmpty() ? ", số lượng mentee hiện tại là 0 (dung lượng trống)" : ", số lượng mentee hiện tại: " + active.size();
                    candidates.add(TechSmartMentorSuggestionResponse.MentorCandidateDto.builder()
                            .mentorId(u.getId())
                            .mentorName(u.getHoTen())
                            .mentorEmail(u.getEmail())
                            .mentorLevel(seniorSkills.isEmpty() ? "SENIOR" : seniorSkills.get(0).getProficiencyLevel().name())
                            .yearsExperience(seniorSkills.isEmpty() ? 3.0 : (seniorSkills.get(0).getYearsOfExperience() != null ? seniorSkills.get(0).getYearsOfExperience() : 3.0))
                            .activeMentorshipsCount(active.size())
                            .recommendationReason("Nắm giữ kỹ năng " + skillStr + " ở cấp bậc SENIOR" + slotInfo)
                            .build());
                }
            }
        }

        // Sort candidates: fewer active mentorships first, then higher experience
        candidates.sort(Comparator.comparingInt(TechSmartMentorSuggestionResponse.MentorCandidateDto::getActiveMentorshipsCount)
                .thenComparing((a, b) -> Double.compare(b.getYearsExperience() != null ? b.getYearsExperience() : 0,
                        a.getYearsExperience() != null ? a.getYearsExperience() : 0)));

        return TechSmartMentorSuggestionResponse.builder()
                .menteeId(menteeId)
                .menteeName(mentee.getHoTen())
                .skillId(skillId)
                .skillName(skillName)
                .menteeLevel(menteeLevel)
                .suggestedMentors(candidates.stream().limit(5).collect(Collectors.toList()))
                .build();
    }

    private void logCompletionCareerEvents(TechMentorshipProgram program, Long actorId) {
        String skillLabel = program.getFocusSkill() != null ? " (" + program.getFocusSkill().getSkillName() + ")" : "";

        // Career event for Mentee
        careerEventRepository.save(TechCareerEvent.builder()
                .employeeId(program.getMenteeId())
                .eventType(TechCareerEventType.MENTORSHIP_COMPLETED)
                .title("Tốt nghiệp chương trình Kèm cặp 1-1" + skillLabel)
                .oldValue("Mentee")
                .newValue("Đã hoàn thành")
                .actorId(actorId)
                .note(program.getFinalAssessment() != null && !program.getFinalAssessment().isEmpty()
                        ? program.getFinalAssessment() : "Đạt mục tiêu đào tạo: " + program.getTargetGoal())
                .eventDate(LocalDateTime.now())
                .build());

        // Career event for Mentor
        careerEventRepository.save(TechCareerEvent.builder()
                .employeeId(program.getMentorId())
                .eventType(TechCareerEventType.MENTORSHIP_COMPLETED)
                .title("Hoàn thành dẫn dắt Kỹ sư Kèm cặp 1-1" + skillLabel)
                .oldValue("Mentor")
                .newValue("Xuất sắc")
                .actorId(actorId)
                .note("Dẫn dắt thành công kỹ sư kèm cặp: " + program.getProgramTitle())
                .eventDate(LocalDateTime.now())
                .build());
    }

    private TechMentorshipProgramResponse mapProgramToResponse(TechMentorshipProgram p) {
        User mentor = userRepository.findById(p.getMentorId()).orElse(null);
        User mentee = userRepository.findById(p.getMenteeId()).orElse(null);

        List<TechMentorshipCheckin> checkins = checkinRepository.findByProgramIdOrderByCheckinDateDescCreatedAtDesc(p.getId());
        long checkinCount = checkins.size();
        Double avgRating = checkins.isEmpty() ? null : checkins.stream()
                .mapToInt(c -> c.getProgressRating() != null ? c.getProgressRating() : 3)
                .average()
                .orElse(0.0);

        if (avgRating != null) {
            avgRating = Math.round(avgRating * 10.0) / 10.0;
        }

        return TechMentorshipProgramResponse.builder()
                .id(p.getId())
                .departmentId(p.getDepartmentId())
                .mentorId(p.getMentorId())
                .mentorName(mentor != null ? mentor.getHoTen() : null)
                .mentorEmail(mentor != null ? mentor.getEmail() : null)
                .menteeId(p.getMenteeId())
                .menteeName(mentee != null ? mentee.getHoTen() : null)
                .menteeEmail(mentee != null ? mentee.getEmail() : null)
                .focusSkillId(p.getFocusSkill() != null ? p.getFocusSkill().getId() : null)
                .focusSkillName(p.getFocusSkill() != null ? p.getFocusSkill().getSkillName() : null)
                .programTitle(p.getProgramTitle())
                .targetGoal(p.getTargetGoal())
                .startDate(p.getStartDate())
                .endDate(p.getEndDate())
                .status(p.getStatus())
                .finalAssessment(p.getFinalAssessment())
                .graduationProposed(Boolean.TRUE.equals(p.getGraduationProposed()))
                .mentorSummary(p.getMentorSummary())
                .graduationProposedAt(p.getGraduationProposedAt())
                .createdBy(p.getCreatedBy())
                .createdAt(p.getCreatedAt())
                .checkinCount(checkinCount)
                .averageRating(avgRating)
                .build();
    }

    private TechMentorshipCheckinResponse mapCheckinToResponse(TechMentorshipCheckin c) {
        String loggerName = c.getLoggedBy() != null
                ? userRepository.findById(c.getLoggedBy()).map(User::getHoTen).orElse(null)
                : null;

        return TechMentorshipCheckinResponse.builder()
                .id(c.getId())
                .programId(c.getProgram().getId())
                .checkinDate(c.getCheckinDate())
                .topicsCovered(c.getTopicsCovered())
                .progressRating(c.getProgressRating())
                .mentorFeedback(c.getMentorFeedback())
                .menteeNotes(c.getMenteeNotes())
                .loggedBy(c.getLoggedBy())
                .loggedByName(loggerName)
                .createdAt(c.getCreatedAt())
                .build();
    }

    /**
     * Kiểm tra tính hợp lệ của ứng viên Mentor:
     * - Tài khoản đang active
     * - Loại trừ các vai trò quản lý cấp cao / ban điều hành (Giám đốc phòng ban, CEO, Admin)
     *   vì Mentor kỹ thuật 1-1 là vai trò kèm cặp thực thi chuyên môn (hands-on) của Kỹ sư Cấp cao / Tech Lead.
     */
    private boolean isEligibleMentor(User u) {
        if (u == null) return false;
        if (Boolean.FALSE.equals(u.getActive())) return false;
        Role role = u.getRole();
        if (role == Role.GIAM_DOC_PHONG_BAN || role == Role.CEO || role == Role.ADMIN) {
            return false;
        }
        return true;
    }
}
