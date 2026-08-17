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
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String DEFAULT_PASSWORD = "Admin@123";

    @Override
    public void run(String... args) {
        seedDepartments();
        seedUsers();
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

        // 1. Giám đốc
        if (!userRepository.existsByEmail("giamdoc@hrm.vn")) {
            User giamDoc = User.builder()
                    .hoTen("Nguyễn Văn Giám Đốc")
                    .email("giamdoc@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.GIAM_DOC)
                    .departmentId(null) // GIAM_DOC không thuộc phòng cụ thể
                    .active(true)
                    .build();
            userRepository.save(giamDoc);
            log.info("[Seed] Tạo tài khoản: giamdoc@hrm.vn (GIAM_DOC)");
        }

        // 2. Trưởng phòng — thuộc phòng Nhân sự (ngoại lệ tuyển dụng theo README mục 3)
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

        // 3. Nhân viên — thuộc phòng Nhân sự
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
}
