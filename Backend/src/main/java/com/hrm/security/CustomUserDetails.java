package com.hrm.security;

import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * Chứa thông tin đã xác thực từ JWT — đây là nguồn sự thật duy nhất cho phân quyền.
 * KHÔNG BAO GIỜ tin role/departmentId/userId từ client request body/params.
 * Theo SKILL_backend-patterns.md mục 3.
 */
@Getter
public class CustomUserDetails implements UserDetails {

    private final Long userId;
    private final String email;
    private final Role role;
    private final Long departmentId; // null cho GIAM_DOC
    private final String hoTen;

    public CustomUserDetails(User user) {
        this.userId = user.getId();
        this.email = user.getEmail();
        this.role = user.getRole();
        this.departmentId = user.getDepartmentId();
        this.hoTen = user.getHoTen();
    }

    /**
     * Constructor dùng khi parse trực tiếp từ JWT claims (tránh query DB trong mọi request).
     */
    public CustomUserDetails(Long userId, String email, Role role, Long departmentId, String hoTen) {
        this.userId = userId;
        this.email = email;
        this.role = role;
        this.departmentId = departmentId;
        this.hoTen = hoTen;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // Spring Security convention: ROLE_ prefix cho @PreAuthorize("hasRole('GIAM_DOC')")
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return null; // không dùng password trong JWT flow
    }

    @Override
    public String getUsername() {
        return String.valueOf(userId);
    }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return true; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return true; }
}
