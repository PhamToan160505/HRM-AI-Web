package com.hrm.config;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.tech.entity.ProjectRole;
import com.hrm.tech.entity.ProjectStatus;
import com.hrm.tech.entity.ProjectType;
import com.hrm.tech.entity.TechProject;
import com.hrm.tech.entity.TechProjectMember;
import com.hrm.tech.entity.ProficiencyLevel;
import com.hrm.tech.entity.UserTechSkill;
import com.hrm.tech.entity.UserTechCertificate;
import com.hrm.tech.repository.TechProjectMemberRepository;
import com.hrm.tech.repository.TechProjectRepository;
import com.hrm.tech.repository.TechSkillRepository;
import com.hrm.tech.repository.UserTechSkillRepository;
import com.hrm.tech.repository.UserTechCertificateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seed dữ liệu mẫu khi khởi động — idempotent (kiểm tra
 * existsByEmail/existsByTenPhong trước).
 *
 * 3 tài khoản mẫu:
 * - giamdoc@hrm.vn → GIAM_DOC (không thuộc phòng)
 * - truongphong@hrm.vn → TRUONG_PHONG → phòng "Nhân sự"
 * - nhanvien@hrm.vn → NHAN_VIEN → phòng "Nhân sự"
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
    private final TechProjectRepository techProjectRepository;
    private final TechProjectMemberRepository techProjectMemberRepository;
    private final TechSkillRepository techSkillRepository;
    private final UserTechSkillRepository userTechSkillRepository;
    private final UserTechCertificateRepository userTechCertificateRepository;

    private static final String DEFAULT_PASSWORD = "Admin@123";

    @Override
    public void run(String... args) {
        // Removed legacy cleanup as we are using ddl-auto: create

        seedDepartments();
        seedUsers();
        migrateMaNhanVien();
        updateDemoMaNhanVien();
        seedTechProjects();
        seedTechSkillsAndCertificates();
    }

    private void migrateApplicationsTable() {
        try {
            // Kiểm tra xem cột decision_status còn tồn tại không
            String checkColumnSql = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'decision_status'";
            Integer count = jdbcTemplate.queryForObject(checkColumnSql, Integer.class);

            if (count != null && count > 0) {
                log.info("[Migration] Bắt đầu migrate bảng applications từ decision_status sang approval_status");

                // Map PENDING, PENDING_AI_REVIEW -> approvalStatus='PENDING'
                jdbcTemplate.execute(
                        "UPDATE applications SET approval_status = 'PENDING', needs_verification = false WHERE decision_status IN ('PENDING', 'PENDING_AI_REVIEW')");

                // Map NEEDS_VERIFICATION -> approvalStatus='PENDING', needsVerification=true
                jdbcTemplate.execute(
                        "UPDATE applications SET approval_status = 'PENDING', needs_verification = true WHERE decision_status = 'NEEDS_VERIFICATION'");

                // Map APPROVED -> approvalStatus='APPROVED'
                jdbcTemplate.execute(
                        "UPDATE applications SET approval_status = 'APPROVED' WHERE decision_status = 'APPROVED'");

                // Map REJECTED -> approvalStatus='REJECTED'
                jdbcTemplate.execute(
                        "UPDATE applications SET approval_status = 'REJECTED' WHERE decision_status = 'REJECTED'");

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

        if (!departmentRepository.existsByTenPhong("Công nghệ")) {
            Department kyThuat = Department.builder()
                    .tenPhong("Công nghệ")
                    .moTa("Phòng Công nghệ — phát triển sản phẩm")
                    .build();
            departmentRepository.save(kyThuat);
            log.info("[Seed] Tạo phòng ban: Công nghệ");
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
            log.info("[Seed] Tạo tài khoản: giamdocphongban@hrm.vn (GIAM_DOC_PHONG_BAN, phòng Nhân sự id={})",
                    nhanSuDeptId);
        }

        // 3. Giám đốc phòng ban (ví dụ: phòng Công nghệ)
        Long congNgheDeptId = departmentRepository.findByTenPhong("Công nghệ")
                .map(Department::getId)
                .orElse(null);

        if (!userRepository.existsByEmail("giamdocphong@hrm.vn")) {
            User giamDocPhong = User.builder()
                    .hoTen("Phạm Văn Giám Đốc Phòng")
                    .email("giamdocphong@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.GIAM_DOC_PHONG_BAN)
                    .departmentId(congNgheDeptId)
                    .active(true)
                    .build();
            userRepository.save(giamDocPhong);
            log.info("[Seed] Tạo tài khoản: giamdocphong@hrm.vn (GIAM_DOC_PHONG_BAN, phòng Công nghệ id={})",
                    congNgheDeptId);
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

        // 6. Trưởng phòng Công nghệ / Công nghệ
        if (!userRepository.existsByEmail("truongphong_kt@hrm.vn")) {
            User tpKt = User.builder()
                    .hoTen("Trần Văn Trưởng Phòng Công nghệ")
                    .email("truongphong_kt@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.TRUONG_PHONG)
                    .departmentId(congNgheDeptId)
                    .chucVu("Trưởng phòng Công nghệ")
                    .active(true)
                    .build();
            userRepository.save(tpKt);
            log.info("[Seed] Tạo tài khoản: truongphong_kt@hrm.vn (TRUONG_PHONG, phòng Công nghệ)");
        }

        // 7. Senior Backend Dev
        if (!userRepository.existsByEmail("dev_nam@hrm.vn")) {
            User devNam = User.builder()
                    .hoTen("Nguyễn Hoàng Nam")
                    .email("dev_nam@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.NHAN_VIEN)
                    .departmentId(congNgheDeptId)
                    .chucVu("Senior Backend Engineer")
                    .active(true)
                    .build();
            userRepository.save(devNam);
            log.info("[Seed] Tạo tài khoản: dev_nam@hrm.vn");
        }

        // 8. Frontend Dev
        if (!userRepository.existsByEmail("dev_lan@hrm.vn")) {
            User devLan = User.builder()
                    .hoTen("Phạm Hương Lan")
                    .email("dev_lan@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.NHAN_VIEN)
                    .departmentId(congNgheDeptId)
                    .chucVu("Frontend Developer")
                    .active(true)
                    .build();
            userRepository.save(devLan);
            log.info("[Seed] Tạo tài khoản: dev_lan@hrm.vn");
        }

        // 9. QA Tester
        if (!userRepository.existsByEmail("tester_hung@hrm.vn")) {
            User testerHung = User.builder()
                    .hoTen("Đỗ Mạnh Hùng")
                    .email("tester_hung@hrm.vn")
                    .passwordHash(hashedPassword)
                    .role(Role.NHAN_VIEN)
                    .departmentId(congNgheDeptId)
                    .chucVu("QA Automation Engineer")
                    .active(true)
                    .build();
            userRepository.save(testerHung);
            log.info("[Seed] Tạo tài khoản: tester_hung@hrm.vn");
        }

        log.info("[Seed] Hoàn tất. Password mặc định: Admin@123 — đổi ngay trên môi trường production.");
    }

    private void migrateMaNhanVien() {
        java.util.List<User> users = userRepository.findAll();
        for (User user : users) {
            if (user.getMaNhanVien() == null || user.getMaNhanVien().startsWith("23")
                    || user.getMaNhanVien().length() != 8) {
                String prefix;
                if (user.getRole() == com.hrm.common.entity.Role.ADMIN
                        || user.getRole() == com.hrm.common.entity.Role.CEO) {
                    prefix = "99";
                } else if (user.getRole() == com.hrm.common.entity.Role.GIAM_DOC_PHONG_BAN) {
                    prefix = "88";
                } else {
                    prefix = String.format("%02d", user.getDepartmentId() != null ? user.getDepartmentId() : 0);
                }

                String newMaNhanVien;
                java.util.Random random = new java.util.Random();
                do {
                    int randomNum = 100000 + random.nextInt(900000);
                    newMaNhanVien = prefix + String.valueOf(randomNum);
                } while (userRepository.findByMaNhanVien(newMaNhanVien).isPresent());

                user.setMaNhanVien(newMaNhanVien);
                userRepository.save(user);
                log.info("[Migration] Cập nhật user {} thành mã mới: {}", user.getEmail(), newMaNhanVien);
            }
        }
    }

    private void updateDemoMaNhanVien() {
        userRepository.findByEmail("admin@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("99000001");
            userRepository.save(u);
        });
        userRepository.findByEmail("ceo@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("99000002");
            userRepository.save(u);
        });
        userRepository.findByEmail("giamdocphongban@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("88000001");
            userRepository.save(u);
        });
        userRepository.findByEmail("giamdocphong@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("88000002");
            userRepository.save(u);
        });
        userRepository.findByEmail("truongphong@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("01000001");
            userRepository.save(u);
        });
        userRepository.findByEmail("nhanvien@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("01000002");
            userRepository.save(u);
        });
        userRepository.findByEmail("truongphong_kt@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("02000001");
            userRepository.save(u);
        });
        userRepository.findByEmail("dev_nam@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("02000002");
            userRepository.save(u);
        });
        userRepository.findByEmail("dev_lan@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("02000003");
            userRepository.save(u);
        });
        userRepository.findByEmail("tester_hung@hrm.vn").ifPresent(u -> {
            u.setMaNhanVien("02000004");
            userRepository.save(u);
        });
        log.info("[Seed] Đã cập nhật mã nhân viên tĩnh cho các tài khoản demo.");
    }

    private void seedTechProjects() {
        if (techProjectRepository.count() > 0) {
            return;
        }

        User creator = userRepository.findByEmail("giamdocphong@hrm.vn")
                .or(() -> userRepository.findByEmail("ceo@hrm.vn"))
                .orElse(null);

        if (creator == null)
            return;

        User devNam = userRepository.findByEmail("dev_nam@hrm.vn").orElse(null);
        User devLan = userRepository.findByEmail("dev_lan@hrm.vn").orElse(null);
        User testerHung = userRepository.findByEmail("tester_hung@hrm.vn").orElse(null);

        // Dự án 1: HRM AI System
        TechProject hrmPrj = TechProject.builder()
                .projectCode("PRJ-HRM-AI")
                .projectName("Hệ thống Quản trị Nhân sự HRM AI")
                .projectType(ProjectType.INTERNAL)
                .status(ProjectStatus.IN_PROGRESS)
                .techStack("[\"Java\", \"Spring Boot 3\", \"React 19\", \"MySQL\", \"Redis\", \"Docker\"]")
                .startDate(java.time.LocalDate.now().minusMonths(2))
                .endDate(java.time.LocalDate.now().plusMonths(4))
                .gitRepoUrl("https://github.com/company/hrm-ai")
                .jiraUrl("https://jira.company.com/browse/HRM")
                .figmaUrl("https://figma.com/file/hrm-ui")
                .description(
                        "Số hóa toàn diện vòng đời nhân sự, tuyển dụng thông minh bằng AI, chấm công và quản lý dự án công nghệ.")
                .createdBy(creator.getId())
                .build();
        hrmPrj = techProjectRepository.save(hrmPrj);

        if (devNam != null) {
            techProjectMemberRepository.save(TechProjectMember.builder()
                    .project(hrmPrj)
                    .userId(devNam.getId())
                    .projectRole(ProjectRole.TECH_LEAD)
                    .allocationPercent(70)
                    .joinedAt(java.time.LocalDate.now().minusMonths(2))
                    .isActive(true)
                    .build());
        }
        if (devLan != null) {
            techProjectMemberRepository.save(TechProjectMember.builder()
                    .project(hrmPrj)
                    .userId(devLan.getId())
                    .projectRole(ProjectRole.FRONTEND_DEV)
                    .allocationPercent(100)
                    .joinedAt(java.time.LocalDate.now().minusMonths(2))
                    .isActive(true)
                    .build());
        }
        if (testerHung != null) {
            techProjectMemberRepository.save(TechProjectMember.builder()
                    .project(hrmPrj)
                    .userId(testerHung.getId())
                    .projectRole(ProjectRole.QA_TESTER)
                    .allocationPercent(50)
                    .joinedAt(java.time.LocalDate.now().minusMonths(1))
                    .isActive(true)
                    .build());
        }

        // Dự án 2: E-Commerce Platform
        TechProject ecomPrj = TechProject.builder()
                .projectCode("PRJ-ECOMMERCE")
                .projectName("Nền tảng Thương mại Điện tử B2C")
                .projectType(ProjectType.CLIENT)
                .status(ProjectStatus.PLANNING)
                .techStack("[\"NodeJS\", \"NestJS\", \"Next.js\", \"PostgreSQL\", \"Tailwind CSS\"]")
                .startDate(java.time.LocalDate.now().minusWeeks(1))
                .endDate(java.time.LocalDate.now().plusMonths(6))
                .gitRepoUrl("https://github.com/company/ecom-b2c")
                .jiraUrl("https://jira.company.com/browse/ECOM")
                .description("Hệ thống bán hàng trực tuyến tích hợp thanh toán VnPay, quản lý kho và giao vận tự động.")
                .createdBy(creator.getId())
                .build();
        ecomPrj = techProjectRepository.save(ecomPrj);

        if (devNam != null) {
            techProjectMemberRepository.save(TechProjectMember.builder()
                    .project(ecomPrj)
                    .userId(devNam.getId())
                    .projectRole(ProjectRole.BACKEND_DEV)
                    .allocationPercent(30)
                    .joinedAt(java.time.LocalDate.now().minusWeeks(1))
                    .isActive(true)
                    .build());
        }

        log.info("[Seed] Đã khởi tạo 2 dự án công nghệ mẫu: PRJ-HRM-AI và PRJ-ECOMMERCE kèm phân bổ thành viên.");
    }

    private void seedTechSkillsAndCertificates() {
        if (userTechSkillRepository.count() > 0) return;

        User devNam = userRepository.findByEmail("dev_nam@hrm.vn").orElse(null);
        User devLan = userRepository.findByEmail("dev_lan@hrm.vn").orElse(null);
        User testerHung = userRepository.findByEmail("tester_hung@hrm.vn").orElse(null);
        User tpKt = userRepository.findByEmail("truongphong_kt@hrm.vn").orElse(null);
        Long verifierId = tpKt != null ? tpKt.getId() : null;

        // Dev Nam
        if (devNam != null) {
            addSkillIfPresent(devNam.getId(), "Java", ProficiencyLevel.SENIOR, 5.0, true, verifierId, "Hệ thống Quản trị Nhân sự HRM AI");
            addSkillIfPresent(devNam.getId(), "Spring Boot", ProficiencyLevel.SENIOR, 4.5, true, verifierId, "Core Architecture HRM AI");
            addSkillIfPresent(devNam.getId(), "Docker", ProficiencyLevel.MIDDLE, 3.0, true, verifierId, "Containerized CI/CD");
            addSkillIfPresent(devNam.getId(), "MySQL", ProficiencyLevel.SENIOR, 4.0, true, verifierId, "Database schema & query tuning");
            addSkillIfPresent(devNam.getId(), "Microservices Architecture", ProficiencyLevel.MIDDLE, 2.0, false, null, "R&D Prototype");

            userTechCertificateRepository.save(UserTechCertificate.builder()
                    .userId(devNam.getId())
                    .certificateName("Oracle Certified Professional: Java SE 17 Developer")
                    .issuingOrganization("Oracle Corporation")
                    .issueDate(java.time.LocalDate.now().minusYears(1))
                    .credentialId("OCP-JAVA-17-9824")
                    .credentialUrl("https://www.credly.com/org/oracle")
                    .build());
        }

        // Dev Lan
        if (devLan != null) {
            addSkillIfPresent(devLan.getId(), "React", ProficiencyLevel.MIDDLE, 3.0, true, verifierId, "HRM AI Admin Portal");
            addSkillIfPresent(devLan.getId(), "TypeScript", ProficiencyLevel.MIDDLE, 2.5, true, verifierId, "Type-safe UI components");
            addSkillIfPresent(devLan.getId(), "Tailwind CSS", ProficiencyLevel.SENIOR, 3.5, true, verifierId, "Design System & UI Components");
            addSkillIfPresent(devLan.getId(), "Next.js", ProficiencyLevel.JUNIOR, 1.0, false, null, "E-Commerce Frontend");

            userTechCertificateRepository.save(UserTechCertificate.builder()
                    .userId(devLan.getId())
                    .certificateName("Meta Certified Front-End Developer")
                    .issuingOrganization("Meta / Coursera")
                    .issueDate(java.time.LocalDate.now().minusMonths(8))
                    .credentialId("META-FE-7741")
                    .credentialUrl("https://www.coursera.org/verify/professional-cert")
                    .build());
        }

        // Tester Hung
        if (testerHung != null) {
            addSkillIfPresent(testerHung.getId(), "Automation Testing", ProficiencyLevel.MIDDLE, 3.0, true, verifierId, "Selenium & Playwright Automation Suite");
            addSkillIfPresent(testerHung.getId(), "Manual Testing", ProficiencyLevel.SENIOR, 4.5, true, verifierId, "UAT & Performance Testing");
            addSkillIfPresent(testerHung.getId(), "API Testing (Postman)", ProficiencyLevel.MIDDLE, 2.5, true, verifierId, "Integration API testing");
            addSkillIfPresent(testerHung.getId(), "Python", ProficiencyLevel.JUNIOR, 1.0, false, null, "Automation test scripting");

            userTechCertificateRepository.save(UserTechCertificate.builder()
                    .userId(testerHung.getId())
                    .certificateName("ISTQB Certified Tester Foundation Level (CTFL)")
                    .issuingOrganization("ISTQB - International Software Testing Qualifications Board")
                    .issueDate(java.time.LocalDate.now().minusYears(2))
                    .credentialId("ISTQB-CTFL-5510")
                    .credentialUrl("https://www.istqb.org")
                    .build());
        }

        log.info("[Seed] Đã khởi tạo hồ sơ kỹ năng (Skills Matrix) và chứng chỉ mẫu cho kỹ sư phòng Công nghệ.");
    }

    private void addSkillIfPresent(Long userId, String skillName, ProficiencyLevel level, Double years, boolean verified, Long verifierId, String project) {
        techSkillRepository.findBySkillNameIgnoreCase(skillName).ifPresent(skill -> {
            userTechSkillRepository.save(UserTechSkill.builder()
                    .userId(userId)
                    .skill(skill)
                    .proficiencyLevel(level)
                    .yearsOfExperience(years)
                    .isVerified(verified)
                    .verifiedBy(verified ? verifierId : null)
                    .verifiedAt(verified ? java.time.LocalDateTime.now().minusWeeks(2) : null)
                    .highlightProject(project)
                    .build());
        });
    }
}
