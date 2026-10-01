package com.hrm.recruitment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import com.hrm.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobPostingServiceVisibilityTest {

    @Test
    void assignedDirectorCanSeeCampaignEvenWhenNotRequester() {
        JobPostingRepository jobPostingRepository = mock(JobPostingRepository.class);
        ApplicationRepository applicationRepository = mock(ApplicationRepository.class);
        JobRequisitionRepository requisitionRepository = mock(JobRequisitionRepository.class);
        DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
        RecruitmentTransitionService transitionService = mock(RecruitmentTransitionService.class);
        PostingVersionLockService versionLockService = mock(PostingVersionLockService.class);
        InterviewService interviewService = mock(InterviewService.class);
        JobPostingService service = new JobPostingService(
                jobPostingRepository,
                applicationRepository,
                requisitionRepository,
                departmentRepository,
                transitionService,
                versionLockService,
                new ObjectMapper(),
                interviewService);
        CustomUserDetails director = new CustomUserDetails(
                22L, "director@example.test", Role.GIAM_DOC_PHONG_BAN,
                20L, null, "Giám đốc Kinh doanh");

        when(departmentRepository.findById(20L)).thenReturn(Optional.of(
                Department.builder().id(20L).tenPhong("Kinh doanh").build()));
        when(interviewService.assignedJobPostingIds(22L)).thenReturn(List.of(8L));
        when(jobPostingRepository.findWithFiltersForRequesterOrInterviewer(
                eq(null), eq(null), eq(22L), eq(List.of(8L)), any(Pageable.class)))
                .thenReturn(Page.empty());

        service.getJobStatsPaginated(null, null, 0, 6, true, director);

        verify(jobPostingRepository).findWithFiltersForRequesterOrInterviewer(
                eq(null), eq(null), eq(22L), eq(List.of(8L)), any(Pageable.class));
    }
}
