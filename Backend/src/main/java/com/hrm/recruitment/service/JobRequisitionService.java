package com.hrm.recruitment.service;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.recruitment.controller.JobRequisitionController.RequisitionRequest;
import com.hrm.recruitment.entity.JobRequisition;
import com.hrm.recruitment.entity.JobRequisitionStatus;
import com.hrm.recruitment.repository.JobRequisitionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class JobRequisitionService {

    private final JobRequisitionRepository jobRequisitionRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;

    private void enrichRequisition(JobRequisition req) {
        userRepository.findById(req.getRequesterId()).ifPresent(user -> {
            req.setRequesterName(user.getHoTen());
            String roleName = switch (user.getRole()) {
                case NHAN_VIEN -> "Nhân viên";
                case TRUONG_PHONG -> "Trưởng phòng";
                case GIAM_DOC_PHONG_BAN -> "Giám đốc";
                case CEO -> "Tổng giám đốc";
                case ADMIN -> "Quản trị viên";
            };
            if (user.getDepartmentId() != null) {
                departmentRepository.findById(user.getDepartmentId()).ifPresent(dept -> {
                    req.setRequesterPosition(roleName + " " + dept.getTenPhong());
                });
            } else {
                req.setRequesterPosition(roleName);
            }
        });
    }

    public List<JobRequisition> getAllRequisitions(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        final String tenPhong = (user.getDepartmentId() != null) ?
                departmentRepository.findById(user.getDepartmentId())
                        .map(dept -> dept.getTenPhong()).orElse(null) : null;

        List<JobRequisition> reqs = jobRequisitionRepository.findAll();
        reqs.forEach(this::enrichRequisition);
        
        return reqs.stream().filter(req -> {
            boolean isCreator = req.getRequesterId().equals(userId);
            boolean isCEO = (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN);
            boolean isHRManager = (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN) 
                                  && "Nhân sự".equals(tenPhong);
            
            if (isCreator || isCEO) return true;
            if ((req.getStatus() == JobRequisitionStatus.APPROVED || req.getStatus() == JobRequisitionStatus.POSTED) && isHRManager) return true;
            
            return false;
        }).toList();
    }

    public org.springframework.data.domain.Page<JobRequisition> getAllRequisitionsPaginated(Long userId, Long departmentId, Role targetRole, JobRequisitionStatus status, Long filterRequesterId, int page, int size) {
        User user = userRepository.findById(userId).orElseThrow();
        final String tenPhong = (user.getDepartmentId() != null) ?
                departmentRepository.findById(user.getDepartmentId())
                        .map(dept -> dept.getTenPhong()).orElse(null) : null;

        boolean isCEO = (user.getRole() == Role.CEO || user.getRole() == Role.ADMIN);
        boolean isHRManager = (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN) 
                              && "Nhân sự".equals(tenPhong);

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        
        org.springframework.data.domain.Page<JobRequisition> reqPage = jobRequisitionRepository.findWithFiltersAndPermissions(
                departmentId, targetRole, status, filterRequesterId, userId, isCEO, isHRManager, pageable);
                
        reqPage.getContent().forEach(this::enrichRequisition);
        return reqPage;
    }

    public List<JobRequisition> getRequisitionsByDepartment(Long departmentId) {
        List<JobRequisition> reqs = jobRequisitionRepository.findByDepartmentId(departmentId);
        reqs.forEach(this::enrichRequisition);
        return reqs;
    }
    
    public List<JobRequisition> getRequisitionsByRequester(Long requesterId) {
        List<JobRequisition> reqs = jobRequisitionRepository.findByRequesterId(requesterId);
        reqs.forEach(this::enrichRequisition);
        return reqs;
    }

    public JobRequisition createRequisition(Long requesterId, RequisitionRequest request) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người yêu cầu"));

        validateRequisitionContent(request);

        // Validate thẩm quyền
        // Tuyển NHAN_VIEN -> Trưởng phòng hoặc cao hơn
        // Tuyển TRUONG_PHONG -> Giám đốc phòng ban hoặc cao hơn
        // Tuyển GIAM_DOC_PHONG -> Tổng giám đốc
        
        if (request.targetRole() == Role.NHAN_VIEN && (requester.getRole() == Role.NHAN_VIEN)) {
            throw new RuntimeException("Chỉ Trưởng phòng trở lên mới được yêu cầu tuyển Nhân viên");
        }
        if (request.targetRole() == Role.TRUONG_PHONG && 
           (requester.getRole() == Role.NHAN_VIEN || requester.getRole() == Role.TRUONG_PHONG)) {
            throw new RuntimeException("Chỉ Giám đốc phòng ban trở lên mới được yêu cầu tuyển Trưởng phòng");
        }
        if (request.targetRole() == Role.GIAM_DOC_PHONG_BAN && requester.getRole() != Role.CEO && requester.getRole() != Role.ADMIN) {
            throw new RuntimeException("Chỉ Tổng Giám Đốc mới được yêu cầu tuyển Giám đốc phòng ban");
        }

        JobRequisitionStatus initialStatus = (requester.getRole() == Role.CEO || requester.getRole() == Role.ADMIN) 
                ? JobRequisitionStatus.APPROVED 
                : JobRequisitionStatus.PENDING_CEO;

        JobRequisition req = JobRequisition.builder()
                .title(request.title())
                .targetRole(request.targetRole())
                .departmentId(request.departmentId())
                .soLuong(request.soLuong())
                .reason(request.reason())
                .requirements(request.requirements())
                .description(request.description())
                .budget(request.budget())
                .capBac(request.capBac())
                .hinhThucLamViec(request.hinhThucLamViec())
                .status(initialStatus)
                .requesterId(requesterId)
                .build();

        return jobRequisitionRepository.save(req);
    }

    private void validateRequisitionContent(RequisitionRequest request) {
        if (request.soLuong() == null || request.soLuong() <= 0) {
            throw new RuntimeException("Số lượng tuyển phải lớn hơn 0");
        }

        String description = request.description();
        long descriptionWordCount = description == null || description.isBlank()
                ? 0
                : java.util.Arrays.stream(description.trim().split("\\s+"))
                        .filter(word -> !word.isBlank())
                        .count();
        if (descriptionWordCount < 10) {
            throw new RuntimeException("Mô tả công việc (JD) phải có ít nhất 10 từ");
        }

        String budget = request.budget();
        if (budget == null || budget.isBlank()) {
            return;
        }

        try {
            String normalizedBudget = budget.replace("VNĐ", "").replace(".", "").trim();
            String[] range = normalizedBudget.split("\\s*-\\s*");
            if (range.length != 2) {
                throw new NumberFormatException("Invalid budget range");
            }

            long budgetMin = Long.parseLong(range[0]);
            long budgetMax = Long.parseLong(range[1]);
            if (budgetMin <= 0 || budgetMax <= 0) {
                throw new RuntimeException("Ngân sách dự kiến phải là số lớn hơn 0");
            }
            if (budgetMin > budgetMax) {
                throw new RuntimeException("Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu");
            }
        } catch (NumberFormatException exception) {
            throw new RuntimeException("Ngân sách dự kiến không hợp lệ");
        }
    }

    public JobRequisition approveRequisition(Long id, Long approverId) {
        JobRequisition req = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu"));
        
        User approver = userRepository.findById(approverId).orElseThrow();
        // Chỉ CEO mới có quyền duyệt
        if (approver.getRole() != Role.CEO && approver.getRole() != Role.ADMIN) {
            throw new RuntimeException("Không có thẩm quyền duyệt");
        }

        req.setStatus(JobRequisitionStatus.APPROVED);
        req.setApproverId(approverId);
        return jobRequisitionRepository.save(req);
    }

    public JobRequisition rejectRequisition(Long id, Long approverId, String reason) {
        JobRequisition req = jobRequisitionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy yêu cầu"));
        
        User approver = userRepository.findById(approverId).orElseThrow();
        if (approver.getRole() != Role.CEO && approver.getRole() != Role.ADMIN) {
            throw new RuntimeException("Không có thẩm quyền duyệt");
        }
        
        req.setStatus(JobRequisitionStatus.REJECTED);
        req.setApproverId(approverId);
        req.setRejectionReason(reason);
        return jobRequisitionRepository.save(req);
    }
}
