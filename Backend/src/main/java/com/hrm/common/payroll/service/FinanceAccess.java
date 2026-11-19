package com.hrm.common.payroll.service;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Xác định ai thuộc phòng Tài chính - Kế toán.
 *
 * Tạm thời nhận diện phòng theo TÊN phòng (giống cách module Nhân sự đang làm với "Nhân sự").
 * Khi nhóm bổ sung mã phòng ban (department code), chỉ cần sửa {@link #findFinanceDepartment()}.
 *
 *  - Kế toán viên   : mọi thành viên đang hoạt động của phòng TC-KT.
 *  - Kế toán trưởng : Trưởng phòng hoặc Giám đốc phòng TC-KT.
 */
@Component("financeAccess")
@RequiredArgsConstructor
public class FinanceAccess {

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    @Value("${payroll.finance-department-name:Tài chính - Kế toán}")
    private String financeDepartmentName;

    public String getFinanceDepartmentName() {
        return financeDepartmentName;
    }

    public Optional<Department> findFinanceDepartment() {
        String target = normalize(financeDepartmentName);
        return departmentRepository.findAll().stream()
                .filter(d -> d.getTenPhong() != null && normalize(d.getTenPhong()).equals(target))
                .findFirst();
    }

    public Optional<Long> financeDepartmentId() {
        return findFinanceDepartment().map(Department::getId);
    }

    public boolean isAccountant(CustomUserDetails user) {
        if (user == null || user.getDepartmentId() == null) return false;
        if (user.getRole() == Role.ADMIN || user.getRole() == Role.CEO) return false;
        return financeDepartmentId().map(id -> id.equals(user.getDepartmentId())).orElse(false);
    }

    public boolean isChiefAccountant(CustomUserDetails user) {
        return isAccountant(user)
                && (user.getRole() == Role.TRUONG_PHONG || user.getRole() == Role.GIAM_DOC_PHONG_BAN);
    }

    /** Thành viên đang hoạt động của phòng TC-KT (để gửi thông báo). */
    public List<User> accountants() {
        return financeDepartmentId()
                .map(id -> userRepository.findByDepartmentId(id).stream()
                        .filter(u -> Boolean.TRUE.equals(u.getActive()))
                        .filter(u -> u.getRole() != Role.ADMIN && u.getRole() != Role.CEO)
                        .toList())
                .orElse(List.of());
    }

    public List<User> chiefAccountants() {
        return accountants().stream()
                .filter(u -> u.getRole() == Role.TRUONG_PHONG || u.getRole() == Role.GIAM_DOC_PHONG_BAN)
                .toList();
    }

    private static String normalize(String s) {
        return s.trim().replaceAll("\\s+", " ").toLowerCase();
    }
}
