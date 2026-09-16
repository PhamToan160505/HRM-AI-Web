package com.hrm.config;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seed dữ liệu mẫu khi khởi động — idempotent (kiểm tra existsByEmail/existsByTenPhong trước).
 *
 * 3 tài khoản mẫu:
 *   - giamdoc@hrm.vn      → GIAM_DOC   (không thuộc phòng)
 *   - truongphong@hrm.vn  → TRUONG_PHONG → phòng "Nhân sự"
 *   - nhanvien@hrm.vn     → NHAN_VIEN    → phòng "Nhân sự"
 *
 * Password mặc định: Admin@123 (BCrypt hash, không hardcode plain text)
 */
@Component
@RequiredArgsConstructor
@Slf4j
@org.springframework.core.annotation.Order(1)
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    private static final String DEFAULT_PASSWORD = "Admin@123";

    @Override
    public void run(String... args) {
        // Removed legacy cleanup as we are using ddl-auto: create
        
        seedDepartments();
        seedUsers();
        migrateMaNhanVien();
    }

    private void migrateApplicationsTable() {
        try {
            // Kiểm tra xem cột decision_status còn tồn tại không
            String checkColumnSql = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'decision_status'";
            Integer count = jdbcTemplate.queryForObject(checkColumnSql, Integer.class);
            
            if (count != null && count > 0) {
                log.info("[Migration] Bắt đầu migrate bảng applications từ decision_status sang approval_status");
                
                // Map PENDING, PENDING_AI_REVIEW -> approvalStatus='PENDING'
                jdbcTemplate.execute("UPDATE applications SET approval_status = 'PENDING', needs_verification = false WHERE decision_status IN ('PENDING', 'PENDING_AI_REVIEW')");
                
                // Map NEEDS_VERIFICATION -> approvalStatus='PENDING', needsVerification=true
                jdbcTemplate.execute("UPDATE applications SET approval_status = 'PENDING', needs_verification = true WHERE decision_status = 'NEEDS_VERIFICATION'");
                
                // Map APPROVED -> approvalStatus='APPROVED'
                jdbcTemplate.execute("UPDATE applications SET approval_status = 'APPROVED' WHERE decision_status = 'APPROVED'");
                
                // Map REJECTED -> approvalStatus='REJECTED'
                jdbcTemplate.execute("UPDATE applications SET approval_status = 'REJECTED' WHERE decision_status = 'REJECTED'");
                
                // Set default for new is_priority column
                jdbcTemplate.execute("UPDATE applications SET is_priority = false WHERE is_priority IS NULL");
                
                // Xóa cột cũ
                jdbcTemplate.execute("ALTER TABLE applications DROP COLUMN decision_status");
                
                log.info("[Migration] Đã migrate và xóa cột decision_status thành công");
            }
        } catch (Exception e) {
            log.error("[Migration] Lỗi khi migrate bảng applications: ", e);
        }
    }

    private void seedDepartments() {
        if (!departmentRepository.existsByTenPhong("Nhân sự")) {
            Department nhanSu = Department.builder()
                    .tenPhong("Nhân sự")
                    .moTa("Phòng Nhân sự — quản lý tuyển dụng và chấm công")
                    .build();
            departmentRepository.save(nhanSu);
            log.info("[Seed] Tạo phòng ban: Nhân sự");
        }

        if (!departmentRepository.existsByTenPhong("Kỹ thuật")) {
            Department kyThuat = Department.builder()
                    .tenPhong("Kỹ thuật")
                    .moTa("Phòng Kỹ thuật — phát triển sản phẩm")
                    .build();
            departmentRepository.save(kyThuat);
            log.info("[Seed] Tạo phòng ban: Kỹ thuật");
        }
    }

    private void seedUsers() {
        String hashedPassword = passwordEncoder.encode(DEFAULT_PASSWORD);

        // Lấy department_id cho phòng Nhân sự
        Long nhanSuDeptId = departmentRepository.findByTenPhong("Nhân sự")
                .map(Department::getId)
                .orElse(null);

        // 1. Admin — Toàn quyền quản trị hệ thống
        if (!userRepository.existsByEmail("admin@hrm.vn")) {
            User admin = User.builder()
                    .hoTen("Hệ Thống Admin")
                    .email("admin@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.ADMIN)
                    .departmentId(null)
                    .active(true)
                    .build();
            userRepository.save(admin);
            log.info("[Seed] Tạo tài khoản: admin@hrm.vn (ADMIN)");
        }

        // 2. Tổng giám đốc (CEO) - Quản lý toàn bộ, không thuộc phòng nào
        if (!userRepository.existsByEmail("ceo@hrm.vn")) {
            User ceo = User.builder()
                    .hoTen("Trịnh Văn Tổng Giám Đốc")
                    .email("ceo@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.CEO)
                    .departmentId(null) // CEO không thuộc phòng cụ thể
                    .active(true)
                    .build();
            userRepository.save(ceo);
            log.info("[Seed] Tạo tài khoản: ceo@hrm.vn (CEO)");
        }

        // 2. Giám đốc phòng ban - Quản lý phòng Nhân sự
        if (!userRepository.existsByEmail("giamdocphongban@hrm.vn")) {
            User giamDoc = User.builder()
                    .hoTen("Nguyễn Văn Giám Đốc Phòng Ban")
                    .email("giamdocphongban@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.GIAM_DOC_PHONG_BAN)
                    .departmentId(nhanSuDeptId) // Thuộc phòng Nhân sự
                    .active(true)
                    .build();
            userRepository.save(giamDoc);
            log.info("[Seed] Tạo tài khoản: giamdocphongban@hrm.vn (GIAM_DOC_PHONG_BAN, phòng Nhân sự id={})", nhanSuDeptId);
        }

        // 3. Giám đốc phòng ban (ví dụ: phòng Kỹ thuật)
        Long kyThuatDeptId = departmentRepository.findByTenPhong("Kỹ thuật")
                .map(Department::getId)
                .orElse(null);
                
        if (!userRepository.existsByEmail("giamdocphong@hrm.vn")) {
            User giamDocPhong = User.builder()
                    .hoTen("Phạm Văn Giám Đốc Phòng")
                    .email("giamdocphong@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.GIAM_DOC_PHONG_BAN)
                    .departmentId(kyThuatDeptId)
                    .active(true)
                    .build();
            userRepository.save(giamDocPhong);
            log.info("[Seed] Tạo tài khoản: giamdocphong@hrm.vn (GIAM_DOC_PHONG_BAN, phòng Kỹ thuật id={})", kyThuatDeptId);
        }

        // 4. Trưởng phòng — thuộc phòng Nhân sự (ngoại lệ tuyển dụng theo README mục 3)
        if (!userRepository.existsByEmail("truongphong@hrm.vn")) {
            User truongPhong = User.builder()
                    .hoTen("Trần Thị Trưởng Phòng")
                    .email("truongphong@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.TRUONG_PHONG)
                    .departmentId(nhanSuDeptId)
                    .active(true)
                    .build();
            userRepository.save(truongPhong);
            log.info("[Seed] Tạo tài khoản: truongphong@hrm.vn (TRUONG_PHONG, phòng Nhân sự id={})", nhanSuDeptId);
        }

        // 5. Nhân viên — thuộc phòng Nhân sự
        if (!userRepository.existsByEmail("nhanvien@hrm.vn")) {
            User nhanVien = User.builder()
                    .hoTen("Lê Văn Nhân Viên")
                    .email("nhanvien@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.NHAN_VIEN)
                    .departmentId(nhanSuDeptId)
                    .active(true)
                    .build();
            userRepository.save(nhanVien);
            log.info("[Seed] Tạo tài khoản: nhanvien@hrm.vn (NHAN_VIEN, phòng Nhân sự id={})", nhanSuDeptId);
        }

        log.info("[Seed] Hoàn tất. Password mặc định: Admin@123 — đổi ngay trên môi trường production.");
    }

    private void migrateMaNhanVien() {
        java.util.List<User> users = userRepository.findAll();
        for (User user : users) {
            if (user.getMaNhanVien() == null || user.getMaNhanVien().length() != 8 || user.getMaNhanVien().startsWith("1000")) {
                String companyCode = "23";
                String deptCode = String.format("%02d", user.getDepartmentId() != null ? user.getDepartmentId() : 99);
                String prefix = companyCode + deptCode;
                
                String maxMaNhanVien = userRepository.findMaxMaNhanVienByPrefix(prefix);
                int nextSeq = 1;
                if (maxMaNhanVien != null && maxMaNhanVien.length() == 8) {
                    try {
                        nextSeq = Integer.parseInt(maxMaNhanVien.substring(4)) + 1;
                    } catch (Exception ignored) {}
                }
                
                String newMa = prefix + String.format("%04d", nextSeq);
                user.setMaNhanVien(newMa);
                userRepository.save(user);
                log.info("[Migration] Cập nhật user {} thành mã mới: {}", user.getEmail(), newMa);
            }
        }
    }
}
