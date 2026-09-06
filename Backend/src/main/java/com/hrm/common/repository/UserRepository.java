package com.hrm.common.repository;

import com.hrm.common.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);
    Optional<User> findByMaNhanVien(String maNhanVien);
    
    @org.springframework.data.jpa.repository.Query("SELECT MAX(u.maNhanVien) FROM User u WHERE u.maNhanVien LIKE CONCAT(:prefix, '%')")
    String findMaxMaNhanVienByPrefix(@org.springframework.data.repository.query.Param("prefix") String prefix);
    Optional<User> findTopByOrderByMaNhanVienDesc();

    boolean existsByEmail(String email);

    java.util.List<User> findByRole(com.hrm.common.entity.Role role);
    long countByRole(com.hrm.common.entity.Role role);
    long countByActive(Boolean active);
    
    java.util.List<User> findByRoleIn(java.util.List<com.hrm.common.entity.Role> roles);
    Page<User> findByRoleIn(java.util.List<com.hrm.common.entity.Role> roles, Pageable pageable);
    long countByRoleIn(java.util.List<com.hrm.common.entity.Role> roles);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(u.baseSalary + COALESCE(u.allowance, 0)) FROM User u WHERE u.role IN :roles")
    Double sumTotalSalaryBudgetByRoleIn(@org.springframework.data.repository.query.Param("roles") java.util.List<com.hrm.common.entity.Role> roles);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(u.baseSalary + COALESCE(u.allowance, 0)) FROM User u WHERE u.departmentId = :departmentId")
    Double sumTotalSalaryBudgetByDepartmentId(@org.springframework.data.repository.query.Param("departmentId") Long departmentId);

    java.util.List<User> findByDepartmentId(Long departmentId);
    java.util.List<User> findByDepartmentIdAndRole(Long departmentId, com.hrm.common.entity.Role role);
    Page<User> findByDepartmentIdAndRoleIn(Long departmentId, java.util.List<com.hrm.common.entity.Role> roles, Pageable pageable);
    java.util.List<User> findByTeamId(Long teamId);

    @org.springframework.data.jpa.repository.Query("SELECT d.tenPhong, COUNT(u) FROM User u JOIN com.hrm.common.entity.Department d ON u.departmentId = d.id GROUP BY d.tenPhong")
    java.util.List<Object[]> getDepartmentDistributionRaw();

    @org.springframework.data.jpa.repository.Query("SELECT u.role, COUNT(u) FROM User u WHERE u.departmentId = :departmentId GROUP BY u.role")
    java.util.List<Object[]> getRoleDistributionByDepartmentId(@org.springframework.data.repository.query.Param("departmentId") Long departmentId);

    long countByDepartmentId(Long departmentId);
    long countByDepartmentIdAndActiveTrue(Long departmentId);
    long countByTeamId(Long teamId);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE " +
           "u.role IN :roles AND " +
           "(:departmentId IS NULL OR u.departmentId = :departmentId) AND " +
           "(:filterRole IS NULL OR u.role = :filterRole) AND " +
           "(:searchTerm IS NULL OR LOWER(u.hoTen) LIKE LOWER(CONCAT('%', :searchTerm, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :searchTerm, '%')))")
    Page<User> findWithFilters(
            @org.springframework.data.repository.query.Param("roles") java.util.List<com.hrm.common.entity.Role> roles,
            @org.springframework.data.repository.query.Param("departmentId") Long departmentId,
            @org.springframework.data.repository.query.Param("filterRole") com.hrm.common.entity.Role filterRole,
            @org.springframework.data.repository.query.Param("searchTerm") String searchTerm,
            Pageable pageable);
}
