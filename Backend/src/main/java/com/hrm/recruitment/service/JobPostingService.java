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

    private static final Pattern NONLATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s]");

    public List<JobPosting> getAllJobs() {
        return jobPostingRepository.findAll();
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

        String slug = toSlug(request.title()) + "-" + System.currentTimeMillis();
        
        JobPosting job = JobPosting.builder()
                .title(request.title())
                .description(request.description())
                .requirements(request.requirements())
                .soLuongTuyen(request.soLuongTuyen())
                .diaDiem(request.diaDiem())
                .hinhThucLamViec(com.hrm.recruitment.entity.HinhThucLamViec.valueOf(request.hinhThucLamViec()))
                .ngayBatDau(request.ngayBatDau())
                .hanNopHoSo(request.hanNopHoSo())
                .mucLuong(request.mucLuong())
                .coThoaThuan(request.coThoaThuan())
                .quyenLoi(request.quyenLoi())
                .capBac(request.capBac() != null ? com.hrm.recruitment.entity.CapBac.valueOf(request.capBac()) : null)
                .status("OPEN")
                .slug(slug)
                .build();
                
        return jobPostingRepository.save(job);
    }

    public JobPosting updateJobStatus(Long id, String status) {
        JobPosting job = jobPostingRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin tuyển dụng"));
        job.setStatus(status);
        return jobPostingRepository.save(job);
    }

    public String toSlug(String input) {
        String nowhitespace = WHITESPACE.matcher(input).replaceAll("-");
        String normalized = Normalizer.normalize(nowhitespace, Normalizer.Form.NFD);
        String slug = NONLATIN.matcher(normalized).replaceAll("");
        return slug.toLowerCase(Locale.ENGLISH);
    }
}
