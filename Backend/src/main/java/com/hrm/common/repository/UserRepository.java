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
}
