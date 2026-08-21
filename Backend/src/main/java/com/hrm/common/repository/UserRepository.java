package com.hrm.common.repository;

import com.hrm.common.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Dùng cho login — Spring Data tự tạo PreparedStatement, không nối chuỗi SQL.
     * Theo SKILL_backend-patterns.md mục 5.
     */
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    java.util.List<User> findByRole(com.hrm.common.entity.Role role);

    java.util.List<User> findByDepartmentId(Long departmentId);

    @org.springframework.data.jpa.repository.Query("SELECT d.tenPhong, COUNT(u) FROM User u JOIN com.hrm.common.entity.Department d ON u.departmentId = d.id GROUP BY d.tenPhong")
    java.util.List<Object[]> getDepartmentDistributionRaw();
}
