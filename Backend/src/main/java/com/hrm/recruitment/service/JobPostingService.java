package com.hrm.recruitment.service;

import com.hrm.recruitment.entity.JobPosting;
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
        return jobs.stream().filter(job -> "OPEN".equals(job.getStatus()) || isRequester(job, currentUser.getUserId())).toList();
    }

    public List<java.util.Map<String, Object>> getJobStats(com.hrm.security.CustomUserDetails currentUser) {
        List<JobPosting> jobs = jobPostingRepository.findAll();
        if (!isSpecialRole(currentUser)) {
            jobs = jobs.stream().filter(job -> "OPEN".equals(job.getStatus()) || isRequester(job, currentUser.getUserId())).toList();
        }
        List<java.util.Map<String, Object>> statsList = new java.util.ArrayList<>();
        
        for (JobPosting job : jobs) {
            long total = applicationRepository.countByJobPostingId(job.getId());
            long newApps = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.NEW);
            long pendingHr = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_HR_CV_REVIEW);
            long pendingTech = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long approved = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.OFFER_APPROVED);
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
            long newApps = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.NEW);
            long pendingHr = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_HR_CV_REVIEW);
            long pendingTech = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long approved = applicationRepository.countByJobPostingIdAndApprovalStatus(job.getId(), com.hrm.recruitment.entity.ApplicationStatus.OFFER_APPROVED);
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
                .filter(job -> "OPEN".equals(job.getStatus()))
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
                .filter(job -> "OPEN".equals(job.getStatus()) && java.time.LocalDateTime.now().isAfter(job.getHanNopHoSo()))
                .toList();
        
        openJobs.forEach(job -> job.setStatus("CLOSED"));
        jobPostingRepository.saveAll(openJobs);
    }

    public JobPosting createJob(com.hrm.recruitment.controller.RecruitmentController.JobPostingRequest request) {
        if (!request.ngayBatDau().isBefore(request.hanNopHoSo())) {
            throw new IllegalArgumentException("Ngày bắt đầu phải trước hạn nộp hồ sơ");
        }

        if (request.soLuongTuyen() != null && request.soLuongTuyen() <= 0) {
            throw new IllegalArgumentException("Số lượng tuyển phải lớn hơn 0");
        }
        
        if (Boolean.FALSE.equals(request.coThoaThuan()) && request.mucLuong() != null && request.mucLuong().trim().startsWith("-")) {
            throw new IllegalArgumentException("Mức lương không được là số âm");
        }

        String slug = toSlug(request.title()) + "-" + System.currentTimeMillis();
        
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
                .status("OPEN")
                .slug(slug)
                .build();
        JobPosting savedJob = jobPostingRepository.save(job);
        
        if (request.jobRequisitionId() != null) {
            jobRequisitionRepository.findById(request.jobRequisitionId()).ifPresent(req -> {
                req.setStatus(com.hrm.recruitment.entity.JobRequisitionStatus.POSTED);
                jobRequisitionRepository.save(req);
            });
        }
        
        return savedJob;
    }

    public JobPosting updateJob(Long id, com.hrm.recruitment.controller.RecruitmentController.JobPostingRequest request) {
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
        
        return jobPostingRepository.save(job);
    }

    public JobPosting updateJobStatus(Long id, String status) {
        JobPosting job = jobPostingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin tuyển dụng"));
        job.setStatus(status);
        return jobPostingRepository.save(job);
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
}
