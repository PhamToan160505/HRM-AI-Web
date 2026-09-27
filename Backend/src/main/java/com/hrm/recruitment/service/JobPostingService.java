package com.hrm.recruitment.service;

import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.entity.RecruitmentAction;
import com.hrm.recruitment.entity.RecruitmentEntityType;
import com.hrm.recruitment.repository.JobPostingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class JobPostingService {

    private final JobPostingRepository jobPostingRepository;
    private final com.hrm.recruitment.repository.ApplicationRepository applicationRepository;
    private final com.hrm.recruitment.repository.JobRequisitionRepository jobRequisitionRepository;
    private final com.hrm.common.repository.DepartmentRepository departmentRepository;
    private final RecruitmentTransitionService recruitmentTransitionService;
    private final PostingVersionLockService postingVersionLockService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    private static final Pattern NONLATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s]");

    public boolean isSpecialRole(com.hrm.security.CustomUserDetails user) {
        if (user.getRole() == com.hrm.common.entity.Role.CEO || user.getRole() == com.hrm.common.entity.Role.ADMIN) {
            return true;
        }
        if (user.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN || user.getRole() == com.hrm.common.entity.Role.TRUONG_PHONG) {
            if (user.getDepartmentId() != null) {
                return departmentRepository.findById(user.getDepartmentId())
                        .map(dept -> "Nhân sự".equalsIgnoreCase(dept.getTenPhong()) || "Nhân Su".equalsIgnoreCase(dept.getTenPhong()) || "Phòng Nhân sự".equalsIgnoreCase(dept.getTenPhong()))
                        .orElse(false);
            }
        }
        return false;
    }

    private boolean isRequester(JobPosting job, Long userId) {
        if (job.getJobRequisitionId() != null) {
            return jobRequisitionRepository.findById(job.getJobRequisitionId())
                    .map(req -> req.getRequesterId().equals(userId))
                    .orElse(false);
        }
        return false;
    }

    public boolean hasAccessToJob(Long jobId, com.hrm.security.CustomUserDetails user) {
        if (isSpecialRole(user)) return true;
        return jobPostingRepository.findById(jobId)
                .map(job -> isRequester(job, user.getUserId()))
                .orElse(false);
    }

    public List<JobPosting> getAllJobs(com.hrm.security.CustomUserDetails currentUser) {
        List<JobPosting> jobs = jobPostingRepository.findAll();
        if (isSpecialRole(currentUser)) {
            return jobs;
        }
        return jobs.stream().filter(job -> job.getStatus() == JobPostingStatus.OPEN || isRequester(job, currentUser.getUserId())).toList();
    }

    public List<java.util.Map<String, Object>> getJobStats(com.hrm.security.CustomUserDetails currentUser) {
        List<JobPosting> jobs = jobPostingRepository.findAll();
        if (!isSpecialRole(currentUser)) {
            jobs = jobs.stream().filter(job -> job.getStatus() == JobPostingStatus.OPEN || isRequester(job, currentUser.getUserId())).toList();
        }
        List<java.util.Map<String, Object>> statsList = new java.util.ArrayList<>();
        
        for (JobPosting job : jobs) {
            long total = applicationRepository.countByJobPostingId(job.getId());
            long newApps = applicationRepository.countByJobPostingIdAndFirstViewedAtIsNull(job.getId());
            long pendingHr = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_HR_CV_REVIEW);
            long pendingTech = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long approved = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.OFFER_ACCEPTED);
            long rejected = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.REJECTED);
            
            java.util.Map<String, Object> stat = new java.util.HashMap<>();
            String departmentName = job.getDepartmentId() != null ? 
                    departmentRepository.findById(job.getDepartmentId())
                        .map(com.hrm.common.entity.Department::getTenPhong)
                        .orElse("Phòng ban") 
                    : "Phòng ban";
                    
            stat.put("jobPosting", job);
            stat.put("departmentName", departmentName);
            stat.put("totalApps", total);
            stat.put("newApps", newApps);
            stat.put("pendingHrApps", pendingHr);
            stat.put("pendingTechApps", pendingTech);
            stat.put("approvedApps", approved);
            stat.put("rejectedApps", rejected);
            statsList.add(stat);
        }
        return statsList;
    }

    public org.springframework.data.domain.Page<java.util.Map<String, Object>> getJobStatsPaginated(Long departmentId, String capBac, int page, int size, boolean restrictToRequester, com.hrm.security.CustomUserDetails currentUser) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        
        Long requesterId = isSpecialRole(currentUser) ? null : currentUser.getUserId();
        
        org.springframework.data.domain.Page<JobPosting> jobPage;
        if (restrictToRequester && requesterId != null) {
            jobPage = jobPostingRepository.findWithFiltersStrictRequester(departmentId, capBac, requesterId, pageable);
        } else {
            jobPage = jobPostingRepository.findWithFilters(departmentId, capBac, requesterId, pageable);
        }
        
        List<java.util.Map<String, Object>> statsList = new java.util.ArrayList<>();
        for (JobPosting job : jobPage.getContent()) {
            long total = applicationRepository.countByJobPostingId(job.getId());
            long newApps = applicationRepository.countByJobPostingIdAndFirstViewedAtIsNull(job.getId());
            long pendingHr = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_HR_CV_REVIEW);
            long pendingTech = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long approved = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.OFFER_ACCEPTED);
            long rejected = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.REJECTED);
            
            java.util.Map<String, Object> stat = new java.util.HashMap<>();
            String departmentName = job.getDepartmentId() != null ? 
                    departmentRepository.findById(job.getDepartmentId())
                        .map(com.hrm.common.entity.Department::getTenPhong)
                        .orElse("Phòng ban") 
                    : "Phòng ban";
                    
            stat.put("jobPosting", job);
            stat.put("departmentName", departmentName);
            stat.put("totalApps", total);
            stat.put("newApps", newApps);
            stat.put("pendingHrApps", pendingHr);
            stat.put("pendingTechApps", pendingTech);
            stat.put("approvedApps", approved);
            stat.put("rejectedApps", rejected);
            statsList.add(stat);
        }
        
        return new org.springframework.data.domain.PageImpl<>(statsList, pageable, jobPage.getTotalElements());
    }

    public JobPosting getJobById(Long id) {
        return jobPostingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin tuyển dụng"));
    }

    public List<JobPosting> getOpenJobs() {
        return jobPostingRepository.findAll().stream()
                .filter(job -> job.getStatus() == JobPostingStatus.OPEN)
                .toList();
    }

    public JobPosting getJobBySlug(String slug) {
        return jobPostingRepository.findBySlug(slug)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin tuyển dụng"));
    }

    @jakarta.annotation.PostConstruct
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 0 * * ?")
    public void closeExpiredJobs() {
        List<JobPosting> openJobs = jobPostingRepository.findAll().stream()
                .filter(job -> job.getStatus() == JobPostingStatus.OPEN && java.time.LocalDateTime.now().isAfter(job.getHanNopHoSo()))
                .toList();

        openJobs.forEach(job -> recruitmentTransitionService.transitionPosting(
                job,
                RecruitmentAction.EXPIRE_POSTING,
                null,
                null,
                "Hết hạn nộp hồ sơ",
                null,
                "posting-expire-" + job.getId() + "-" + job.getHanNopHoSo()));
    }

    @org.springframework.transaction.annotation.Transactional
    public JobPosting createJob(
            com.hrm.recruitment.controller.RecruitmentController.JobPostingRequest request,
            com.hrm.security.CustomUserDetails actor) {
        if (!request.ngayBatDau().isBefore(request.hanNopHoSo())) {
            throw new IllegalArgumentException("Ngày bắt đầu phải trước hạn nộp hồ sơ");
        }

        if (request.soLuongTuyen() != null && request.soLuongTuyen() <= 0) {
            throw new IllegalArgumentException("Số lượng tuyển phải lớn hơn 0");
        }
        
        if (Boolean.FALSE.equals(request.coThoaThuan()) && request.mucLuong() != null && request.mucLuong().trim().startsWith("-")) {
            throw new IllegalArgumentException("Mức lương không được là số âm");
        }

        if (request.jobRequisitionId() == null) {
            throw new IllegalArgumentException("Phải chọn yêu cầu tuyển dụng đã được duyệt");
        }
        JobRequisition requisition = jobRequisitionRepository.findById(request.jobRequisitionId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy yêu cầu tuyển dụng"));
        if (requisition.getStatus() != JobRequisitionStatus.APPROVED) {
            throw new com.hrm.exception.AppException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "Chỉ có thể tạo chiến dịch từ yêu cầu tuyển dụng đã được duyệt");
        }

        String slug = toSlug(request.title()) + "-" + System.currentTimeMillis();
        String criteriaDefinition = validateAndSerializeCriteria(request, null);
        
        JobPosting job = JobPosting.builder()
                .title(request.title())
                .description(request.description())
                .requirements(request.requirements())
                .soLuongTuyen(request.soLuongTuyen())
                .diaDiem(request.diaDiem())
                .hinhThucLamViec(request.hinhThucLamViec())
                .ngayBatDau(request.ngayBatDau())
                .hanNopHoSo(request.hanNopHoSo())
                .mucLuong(request.mucLuong())
                .coThoaThuan(request.coThoaThuan())
                .quyenLoi(request.quyenLoi())
                .capBac(request.capBac())
                .targetRole(request.targetRole())
                .departmentId(request.departmentId())
                .jobRequisitionId(request.jobRequisitionId())
                .criteriaDefinition(criteriaDefinition)
                .status(JobPostingStatus.DRAFT)
                .slug(slug)
                .build();
        JobPosting savedJob = jobPostingRepository.save(job);

        recruitmentTransitionService.recordCreation(
                RecruitmentEntityType.JOB_POSTING,
                savedJob.getId(),
                actor.getUserId(),
                actor.getRole(),
                JobPostingStatus.DRAFT.name(),
                null,
                null);

        savedJob = postingVersionLockService.lockInitialPair(savedJob, actor.getUserId());
        return recruitmentTransitionService.transitionPosting(
                savedJob,
                RecruitmentAction.OPEN_POSTING,
                actor.getUserId(),
                actor.getRole(),
                "Mở chiến dịch sau khi tạo",
                null,
                null);
    }

    @org.springframework.transaction.annotation.Transactional
    public JobPosting updateJob(
            Long id,
            com.hrm.recruitment.controller.RecruitmentController.JobPostingRequest request,
            com.hrm.security.CustomUserDetails actor) {
        JobPosting job = jobPostingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin tuyển dụng"));
                
        if (!request.ngayBatDau().isBefore(request.hanNopHoSo())) {
            throw new IllegalArgumentException("Ngày bắt đầu phải trước hạn nộp hồ sơ");
        }

        if (request.soLuongTuyen() != null && request.soLuongTuyen() <= 0) {
            throw new IllegalArgumentException("Số lượng tuyển phải lớn hơn 0");
        }
        
        if (Boolean.FALSE.equals(request.coThoaThuan()) && request.mucLuong() != null && request.mucLuong().trim().startsWith("-")) {
            throw new IllegalArgumentException("Mức lương không được là số âm");
        }

        boolean scoringCriteriaChanged = !java.util.Objects.equals(job.getTitle(), request.title())
                || !java.util.Objects.equals(job.getDescription(), request.description())
                || !java.util.Objects.equals(job.getRequirements(), request.requirements())
                || !java.util.Objects.equals(job.getCapBac(), request.capBac())
                || !java.util.Objects.equals(job.getTargetRole(), request.targetRole());
        String criteriaDefinition = validateAndSerializeCriteria(request, job.getCriteriaDefinition());
        scoringCriteriaChanged = scoringCriteriaChanged
                || !java.util.Objects.equals(job.getCriteriaDefinition(), criteriaDefinition);

        job.setTitle(request.title());
        job.setDescription(request.description());
        job.setRequirements(request.requirements());
        job.setSoLuongTuyen(request.soLuongTuyen());
        job.setDiaDiem(request.diaDiem());
        job.setHinhThucLamViec(request.hinhThucLamViec());
        job.setNgayBatDau(request.ngayBatDau());
        job.setHanNopHoSo(request.hanNopHoSo());
        job.setMucLuong(request.mucLuong());
        job.setCoThoaThuan(request.coThoaThuan());
        job.setQuyenLoi(request.quyenLoi());
        job.setCriteriaDefinition(criteriaDefinition);
        if (request.capBac() != null && !request.capBac().trim().isEmpty()) {
            job.setCapBac(request.capBac());
        }
        if (request.targetRole() != null) {
            job.setTargetRole(request.targetRole());
        }
        if (request.departmentId() != null) {
            job.setDepartmentId(request.departmentId());
        }
        if (request.jobRequisitionId() != null) {
            job.setJobRequisitionId(request.jobRequisitionId());
        }
        
        JobPosting saved = jobPostingRepository.save(job);
        if (saved.getStatus() != JobPostingStatus.DRAFT && scoringCriteriaChanged) {
            saved = postingVersionLockService.createNewCriteriaVersion(
                    saved,
                    actor.getUserId(),
                    "Cập nhật nội dung JD/tiêu chí của posting đã mở");
        }
        return saved;
    }

    @org.springframework.transaction.annotation.Transactional
    public JobPosting updateJobStatus(
            Long id,
            String status,
            String reason,
            com.hrm.security.CustomUserDetails actor) {
        JobPosting job = jobPostingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin tuyển dụng"));
        JobPostingStatus target;
        try {
            target = JobPostingStatus.valueOf(status == null ? "" : status.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Trạng thái chiến dịch không hợp lệ: " + status);
        }
        RecruitmentAction action = resolvePostingAction(job.getStatus(), target);
        if (target == JobPostingStatus.OPEN
                && (job.getCriteriaVersionId() == null || job.getScoringProfileVersionId() == null)) {
            job = postingVersionLockService.lockInitialPair(job, actor.getUserId());
        }
        return recruitmentTransitionService.transitionPosting(
                job,
                action,
                actor.getUserId(),
                actor.getRole(),
                reason,
                null,
                null);
    }

    private RecruitmentAction resolvePostingAction(JobPostingStatus from, JobPostingStatus to) {
        if (from == JobPostingStatus.OPEN && to == JobPostingStatus.PAUSED) return RecruitmentAction.PAUSE_POSTING;
        if (from == JobPostingStatus.PAUSED && to == JobPostingStatus.OPEN) return RecruitmentAction.RESUME_POSTING;
        if (from == JobPostingStatus.EXPIRED && to == JobPostingStatus.OPEN) return RecruitmentAction.EXTEND_POSTING;
        if (from == JobPostingStatus.FILLED && to == JobPostingStatus.OPEN) return RecruitmentAction.REOPEN_POSTING;
        if ((from == JobPostingStatus.OPEN || from == JobPostingStatus.PAUSED) && to == JobPostingStatus.CANCELLED) {
            return RecruitmentAction.CANCEL_POSTING;
        }
        throw com.hrm.exception.AppException.conflict(
                "Không thể chuyển chiến dịch từ " + from + " sang " + to);
    }

    @org.springframework.transaction.annotation.Transactional
    public void deleteJob(Long id) {
        JobPosting job = jobPostingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin tuyển dụng"));
        // Delete all applications linked to this job first to prevent constraint violations
        List<com.hrm.recruitment.entity.Application> apps = applicationRepository.findByJobPostingId(id);
        applicationRepository.deleteAll(apps);
        jobPostingRepository.delete(job);
    }

    public String toSlug(String input) {
        String nowhitespace = WHITESPACE.matcher(input).replaceAll("-");
        String normalized = Normalizer.normalize(nowhitespace, Normalizer.Form.NFD);
        String slug = NONLATIN.matcher(normalized).replaceAll("");
        return slug.toLowerCase(Locale.ENGLISH);
    }

    private String validateAndSerializeCriteria(
            com.hrm.recruitment.controller.RecruitmentController.JobPostingRequest request,
            String existingDefinition) {
        List<com.hrm.recruitment.controller.RecruitmentController.ScreeningCriterionRequest> criteria =
                request.criteria();
        if (criteria == null || criteria.isEmpty()) {
            if (existingDefinition != null && !existingDefinition.isBlank()) {
                return existingDefinition;
            }
            criteria = List.of(new com.hrm.recruitment.controller.RecruitmentController.ScreeningCriterionRequest(
                    "C1", request.title(), "MUST", 100, List.of(),
                    request.requirements() == null ? request.description() : request.requirements()));
        }
        java.util.Set<String> ids = new java.util.HashSet<>();
        int totalWeight = 0;
        for (var criterion : criteria) {
            if (criterion.id() == null || criterion.id().isBlank() || !ids.add(criterion.id().trim())) {
                throw com.hrm.exception.AppException.badRequest("Mã tiêu chí phải có và không được trùng");
            }
            if (criterion.name() == null || criterion.name().isBlank()) {
                throw com.hrm.exception.AppException.badRequest("Tên tiêu chí là bắt buộc");
            }
            if (!"MUST".equals(criterion.type()) && !"NICE".equals(criterion.type())) {
                throw com.hrm.exception.AppException.badRequest("Loại tiêu chí chỉ nhận MUST hoặc NICE");
            }
            if (criterion.weight() == null || criterion.weight() <= 0) {
                throw com.hrm.exception.AppException.badRequest("Trọng số tiêu chí phải lớn hơn 0");
            }
            totalWeight += criterion.weight();
        }
        if (totalWeight != 100) {
            throw com.hrm.exception.AppException.badRequest("Tổng trọng số bộ tiêu chí phải bằng 100");
        }
        try {
            return objectMapper.writeValueAsString(criteria);
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("Không thể lưu bộ tiêu chí chấm CV", exception);
        }
    }
}
