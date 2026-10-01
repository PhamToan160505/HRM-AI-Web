package com.hrm.recruitment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.approval.service.ApprovalService;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import com.hrm.recruitment.controller.JobRequisitionController.RequisitionRequest;
import com.hrm.recruitment.controller.RecruitmentController.JobPostingRequest;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecruitmentDepartmentValidationTest {

    @Mock private JobPostingRepository jobPostingRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private JobRequisitionRepository jobRequisitionRepository;
    @Mock private DepartmentRepository departmentRepository;
    @Mock private RecruitmentTransitionService recruitmentTransitionService;
    @Mock private PostingVersionLockService postingVersionLockService;
    @Mock private ObjectMapper objectMapper;
    @Mock private InterviewService interviewService;
    @Mock private UserRepository userRepository;
    @Mock private ApprovalService approvalService;
    @Mock private HiringSeatService hiringSeatService;

    @InjectMocks private JobPostingService jobPostingService;
    @InjectMocks private JobRequisitionService jobRequisitionService;

    @Test
    void requisitionRequiresDepartment() {
        User requester = User.builder().id(5L).role(Role.TRUONG_PHONG).build();
        when(userRepository.findById(5L)).thenReturn(Optional.of(requester));

        RequisitionRequest request = new RequisitionRequest(
                "Backend Developer",
                Role.NHAN_VIEN,
                null,
                1,
                "Bổ sung nhân sự",
                "Java",
                "Phát triển và bảo trì hệ thống backend",
                "",
                "Nhân viên (Junior)",
                "Toàn thời gian (Full-time)");

        AppException exception = assertThrows(AppException.class,
                () -> jobRequisitionService.createRequisition(5L, request, null, "req-1"));

        assertEquals("Phòng ban tuyển dụng là bắt buộc", exception.getMessage());
    }

    @Test
    void campaignDepartmentMustMatchApprovedRequisition() {
        when(departmentRepository.findById(2L)).thenReturn(Optional.of(
                Department.builder().id(2L).tenPhong("Kinh doanh").isLock(false).build()));
        when(jobRequisitionRepository.findById(9L)).thenReturn(Optional.of(
                JobRequisition.builder()
                        .id(9L)
                        .departmentId(3L)
                        .status(JobRequisitionStatus.APPROVED)
                        .build()));

        LocalDateTime start = LocalDateTime.now().plusDays(1);
        JobPostingRequest request = new JobPostingRequest(
                "Nhân viên kinh doanh",
                "Tìm kiếm và chăm sóc khách hàng",
                "Kỹ năng giao tiếp",
                2,
                "TP.HCM",
                "Toàn thời gian (Full-time)",
                start,
                start.plusDays(7),
                "",
                true,
                "",
                "Nhân viên (Junior)",
                Role.NHAN_VIEN,
                2L,
                9L,
                null);

        AppException exception = assertThrows(AppException.class,
                () -> jobPostingService.createJob(request, null));

        assertEquals(
                "Phòng ban của chiến dịch phải trùng với phòng ban trong yêu cầu tuyển dụng",
                exception.getMessage());
    }
}
