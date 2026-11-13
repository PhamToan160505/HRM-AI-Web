package com.hrm.config;

import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.tech.dto.TechTelemetryBreakdownResponse;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import com.hrm.tech.service.TechTelemetryScoreCalculator;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final TechProjectMilestoneRepository techProjectMilestoneRepository;
    private final TechWorklogRepository techWorklogRepository;
    private final TechEvaluationCycleRepository techEvaluationCycleRepository;
    private final TechPerformanceReviewRepository techPerformanceReviewRepository;
    private final TechCareerEventRepository techCareerEventRepository;
    private final TechTelemetryScoreCalculator techTelemetryScoreCalculator;
    private final ObjectMapper objectMapper;

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
        seedTechMilestonesAndWorklogs();
        seedTechPerformanceAndCertificates();
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

    private void seedTechMilestonesAndWorklogs() {
        User tpKt = userRepository.findByEmail("truongphong_kt@hrm.vn")
                .or(() -> userRepository.findByEmail("giamdocphong@hrm.vn"))
                .orElse(null);
        if (tpKt == null) return;

        TechProject hrmPrj = techProjectRepository.findByProjectCode("PRJ-HRM-AI").orElse(null);
        TechProject ecomPrj = techProjectRepository.findByProjectCode("PRJ-ECOMMERCE").orElse(null);

        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        TechProjectMilestone hrmMs1 = null;
        TechProjectMilestone hrmMs2 = null;
        TechProjectMilestone ecomMs1 = null;

        if (techProjectMilestoneRepository.count() == 0) {
            if (hrmPrj != null) {
                hrmMs1 = techProjectMilestoneRepository.save(TechProjectMilestone.builder()
                        .project(hrmPrj)
                        .title("Phân tích nghiệp vụ & Thiết kế DB Flyway")
                        .description("Hoàn thiện ERD toàn hệ thống, chuẩn hóa Flyway migrations và cấu hình phân quyền JWT RBAC.")
                        .dueDate(today.minusDays(20))
                        .completedAt(now.minusDays(21))
                        .status(MilestoneStatus.COMPLETED)
                        .weightPercent(25)
                        .completionPercent(100)
                        .deliverableUrl("https://github.com/company/hrm-ai/releases/tag/v1.0-schema")
                        .createdBy(tpKt.getId())
                        .build());

                hrmMs2 = techProjectMilestoneRepository.save(TechProjectMilestone.builder()
                        .project(hrmPrj)
                        .title("Phát triển Core Backend API & AI Pipeline")
                        .description("Triển khai module Tuyển dụng AI, Chấm công FaceID, Bảng lương và Tích hợp WebSocket thông báo.")
                        .dueDate(today.plusDays(2))
                        .status(MilestoneStatus.IN_PROGRESS)
                        .weightPercent(40)
                        .completionPercent(80)
                        .deliverableUrl("https://jira.company.com/browse/HRM-CORE")
                        .createdBy(tpKt.getId())
                        .build());

                techProjectMilestoneRepository.save(TechProjectMilestone.builder()
                        .project(hrmPrj)
                        .title("Hoàn thiện Frontend UI & Kiểm thử UAT")
                        .description("Đồng bộ Design System Sapphire trên toàn dashboard, kiểm thử E2E và tối ưu hiệu năng.")
                        .dueDate(today.plusDays(25))
                        .status(MilestoneStatus.IN_PROGRESS)
                        .weightPercent(35)
                        .completionPercent(30)
                        .createdBy(tpKt.getId())
                        .build());
            }

            if (ecomPrj != null) {
                ecomMs1 = techProjectMilestoneRepository.save(TechProjectMilestone.builder()
                        .project(ecomPrj)
                        .title("Khởi tạo Kiến trúc NestJS & Schema PostgreSQL")
                        .description("Thiết lập monorepo NestJS + Next.js, Docker Compose và hệ thống Auth khách hàng.")
                        .dueDate(today.minusDays(2))
                        .completedAt(now.minusDays(3))
                        .status(MilestoneStatus.COMPLETED)
                        .weightPercent(30)
                        .completionPercent(100)
                        .deliverableUrl("https://github.com/company/ecom-b2c/pulls/12")
                        .createdBy(tpKt.getId())
                        .build());

                techProjectMilestoneRepository.save(TechProjectMilestone.builder()
                        .project(ecomPrj)
                        .title("Tích hợp Giỏ hàng & Thanh toán VNPay")
                        .description("Xây dựng flow đặt hàng, webhook đối soát giao dịch VNPay và quản lý tồn kho.")
                        .dueDate(today.plusDays(18))
                        .status(MilestoneStatus.IN_PROGRESS)
                        .weightPercent(40)
                        .completionPercent(25)
                        .createdBy(tpKt.getId())
                        .build());

                techProjectMilestoneRepository.save(TechProjectMilestone.builder()
                        .project(ecomPrj)
                        .title("Giao diện Storefront Next.js & Go-live")
                        .description("Hoàn thiện giao diện người mua hàng SEO SSR, stress test và triển khai Production.")
                        .dueDate(today.plusDays(45))
                        .status(MilestoneStatus.NOT_STARTED)
                        .weightPercent(30)
                        .completionPercent(0)
                        .createdBy(tpKt.getId())
                        .build());
            }
            log.info("[Seed] Đã khởi tạo các mốc tiến độ (Milestones) mẫu cho dự án Công nghệ.");
        } else {
            if (hrmPrj != null) {
                var list = techProjectMilestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(hrmPrj.getId());
                if (!list.isEmpty()) hrmMs1 = list.get(0);
                if (list.size() > 1) hrmMs2 = list.get(1);
            }
            if (ecomPrj != null) {
                var list = techProjectMilestoneRepository.findByProjectIdOrderByDueDateAscIdAsc(ecomPrj.getId());
                if (!list.isEmpty()) ecomMs1 = list.get(0);
            }
        }

        if (techWorklogRepository.count() == 0) {
            User devNam = userRepository.findByEmail("dev_nam@hrm.vn").orElse(null);
            User devLan = userRepository.findByEmail("dev_lan@hrm.vn").orElse(null);
            User testerHung = userRepository.findByEmail("tester_hung@hrm.vn").orElse(null);

            java.time.LocalDate baseDay = today.withDayOfMonth(Math.max(1, Math.min(today.getDayOfMonth(), 4)));
            java.time.LocalDate d1 = today.minusDays(3).isBefore(baseDay) ? today : today.minusDays(3);
            java.time.LocalDate d2 = today.minusDays(2).isBefore(baseDay) ? today : today.minusDays(2);
            java.time.LocalDate d3 = today.minusDays(1).isBefore(baseDay) ? today : today.minusDays(1);

            if (devNam != null && hrmPrj != null) {
                techWorklogRepository.save(TechWorklog.builder()
                        .project(hrmPrj)
                        .milestone(hrmMs2)
                        .userId(devNam.getId())
                        .workDate(d1)
                        .hoursSpent(java.math.BigDecimal.valueOf(6.00))
                        .workType(WorklogType.ARCHITECTURE)
                        .isBillable(false)
                        .taskSummary("Thiết kế và tối ưu hóa API phân hệ chấm công & payroll engine")
                        .referenceUrl("https://github.com/company/hrm-ai/pull/48")
                        .approvalStatus(WorklogApprovalStatus.APPROVED)
                        .approvedBy(tpKt.getId())
                        .approvedAt(now.minusDays(2))
                        .build());

                techWorklogRepository.save(TechWorklog.builder()
                        .project(hrmPrj)
                        .milestone(hrmMs2)
                        .userId(devNam.getId())
                        .workDate(d2)
                        .hoursSpent(java.math.BigDecimal.valueOf(5.50))
                        .workType(WorklogType.CODE_REVIEW)
                        .isBillable(false)
                        .taskSummary("Review PR bảo mật phân quyền CEO Read-Only & tối ưu query repository")
                        .referenceUrl("https://github.com/company/hrm-ai/pull/52")
                        .approvalStatus(WorklogApprovalStatus.PENDING)
                        .build());
            }

            if (devNam != null && ecomPrj != null) {
                techWorklogRepository.save(TechWorklog.builder()
                        .project(ecomPrj)
                        .milestone(ecomMs1)
                        .userId(devNam.getId())
                        .workDate(d3)
                        .hoursSpent(java.math.BigDecimal.valueOf(4.00))
                        .workType(WorklogType.DEVELOPMENT)
                        .isBillable(true)
                        .taskSummary("Xây dựng API giỏ hàng & tích hợp sandbox thanh toán VNPay IPN")
                        .referenceUrl("https://github.com/company/ecom-b2c/pull/15")
                        .approvalStatus(WorklogApprovalStatus.APPROVED)
                        .approvedBy(tpKt.getId())
                        .approvedAt(now.minusDays(1))
                        .build());
            }

            if (devLan != null && hrmPrj != null) {
                techWorklogRepository.save(TechWorklog.builder()
                        .project(hrmPrj)
                        .milestone(hrmMs1)
                        .userId(devLan.getId())
                        .workDate(d1)
                        .hoursSpent(java.math.BigDecimal.valueOf(7.50))
                        .workType(WorklogType.DEVELOPMENT)
                        .isBillable(false)
                        .taskSummary("Xây dựng hệ thống Dashboard Corporate Sapphire & biểu đồ Recharts")
                        .referenceUrl("https://github.com/company/hrm-ai/pull/49")
                        .approvalStatus(WorklogApprovalStatus.APPROVED)
                        .approvedBy(tpKt.getId())
                        .approvedAt(now.minusDays(2))
                        .build());

                techWorklogRepository.save(TechWorklog.builder()
                        .project(hrmPrj)
                        .milestone(hrmMs2)
                        .userId(devLan.getId())
                        .workDate(today)
                        .hoursSpent(java.math.BigDecimal.valueOf(6.00))
                        .workType(WorklogType.DEVELOPMENT)
                        .isBillable(false)
                        .taskSummary("Hoàn thiện UI Modal xếp chồng đa tầng & kiểm tra chuẩn accessibility")
                        .referenceUrl("https://github.com/company/hrm-ai/pull/55")
                        .approvalStatus(WorklogApprovalStatus.PENDING)
                        .build());
            }

            if (testerHung != null && hrmPrj != null) {
                techWorklogRepository.save(TechWorklog.builder()
                        .project(hrmPrj)
                        .milestone(hrmMs2)
                        .userId(testerHung.getId())
                        .workDate(d2)
                        .hoursSpent(java.math.BigDecimal.valueOf(5.00))
                        .workType(WorklogType.TESTING_QA)
                        .isBillable(false)
                        .taskSummary("Chạy bộ test phân quyền API Phòng Công nghệ & kiểm thử luồng lọc kỹ năng")
                        .referenceUrl("https://jira.company.com/browse/HRM-QA-19")
                        .approvalStatus(WorklogApprovalStatus.APPROVED)
                        .approvedBy(tpKt.getId())
                        .approvedAt(now.minusDays(1))
                        .build());

                techWorklogRepository.save(TechWorklog.builder()
                        .project(hrmPrj)
                        .milestone(hrmMs2)
                        .userId(testerHung.getId())
                        .workDate(today)
                        .hoursSpent(java.math.BigDecimal.valueOf(4.00))
                        .workType(WorklogType.BUG_FIX)
                        .isBillable(false)
                        .taskSummary("Retest xử lý lỗi escape modal & kiểm tra validation chứng chỉ")
                        .approvalStatus(WorklogApprovalStatus.PENDING)
                        .build());
            }

            log.info("[Seed] Đã khởi tạo nhật ký giờ công (Tech Worklogs) mẫu trong tháng hiện tại.");
        }
    }

    private void seedTechPerformanceAndCertificates() {
        java.time.LocalDate today = java.time.LocalDate.now();
        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        User devNam = userRepository.findByEmail("dev_nam@hrm.vn").orElse(null);
        User devLan = userRepository.findByEmail("dev_lan@hrm.vn").orElse(null);
        User testerHung = userRepository.findByEmail("tester_hung@hrm.vn").orElse(null);
        User tpKt = userRepository.findByEmail("truongphong_kt@hrm.vn").orElse(null);
        User giamDoc = userRepository.findByEmail("giamdocphong@hrm.vn").orElse(null);

        // 1. Chứng chỉ sắp hết hạn & đã hết hạn (idempotent) phục vụ Certificate Expiry Radar
        if (devLan != null) {
            boolean hasExpiringCert = userTechCertificateRepository.findByUserIdOrderByIssueDateDesc(devLan.getId())
                    .stream()
                    .anyMatch(c -> c.getExpiryDate() != null);
            if (!hasExpiringCert) {
                userTechCertificateRepository.save(UserTechCertificate.builder()
                        .userId(devLan.getId())
                        .certificateName("AWS Certified Cloud Practitioner (CLF-C02)")
                        .issuingOrganization("Amazon Web Services")
                        .issueDate(today.minusYears(3).plusDays(12))
                        .expiryDate(today.plusDays(12))
                        .credentialId("AWS-CLF-2023-8841")
                        .credentialUrl("https://aws.amazon.com/verification")
                        .build());
            }
        }
        if (testerHung != null) {
            boolean hasExpiredCert = userTechCertificateRepository.findByUserIdOrderByIssueDateDesc(testerHung.getId())
                    .stream()
                    .anyMatch(c -> c.getExpiryDate() != null);
            if (!hasExpiredCert) {
                userTechCertificateRepository.save(UserTechCertificate.builder()
                        .userId(testerHung.getId())
                        .certificateName("ISTQB Certified Tester — Agile Extension")
                        .issuingOrganization("ISTQB")
                        .issueDate(today.minusYears(3).minusDays(5))
                        .expiryDate(today.minusDays(5))
                        .credentialId("ISTQB-AGILE-2023-412")
                        .credentialUrl("https://www.istqb.org")
                        .build());
            }
        }

        if (techEvaluationCycleRepository.count() > 0) {
            return;
        }

        Long techDeptId = departmentRepository.findByTenPhong("Công nghệ")
                .or(() -> departmentRepository.findByTenPhong("Kỹ thuật"))
                .map(Department::getId)
                .orElse(devNam != null ? devNam.getDepartmentId() : null);
        Long creatorId = tpKt != null ? tpKt.getId() : (giamDoc != null ? giamDoc.getId() : null);
        if (techDeptId == null || creatorId == null) {
            return;
        }

        // 2. Kỳ đánh giá Q3-2026 (Đã chốt - APPROVED) để có Career Timeline & dữ liệu lịch sử ngay
        java.time.LocalDate q3Start = java.time.LocalDate.of(2026, 7, 1);
        java.time.LocalDate q3End = java.time.LocalDate.of(2026, 9, 30);
        TechEvaluationCycle q3Cycle = techEvaluationCycleRepository.save(TechEvaluationCycle.builder()
                .cycleCode("Q3-2026")
                .title("Đánh giá Hiệu suất Kỹ sư Quý 3/2026")
                .reviewType(TechReviewType.QUARTERLY)
                .periodStart(q3Start)
                .periodEnd(q3End)
                .selfReviewDeadline(java.time.LocalDate.of(2026, 10, 5))
                .status(TechEvaluationCycleStatus.CLOSED)
                .departmentId(techDeptId)
                .createdBy(creatorId)
                .build());

        if (devNam != null && !techPerformanceReviewRepository.existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(
                devNam.getId(), TechReviewType.QUARTERLY, q3Start, q3End)) {
            TechPerformanceReview q3Nam = techPerformanceReviewRepository.save(TechPerformanceReview.builder()
                    .cycle(q3Cycle)
                    .employeeId(devNam.getId())
                    .departmentId(techDeptId)
                    .reviewType(TechReviewType.QUARTERLY)
                    .periodLabel("Q3-2026")
                    .periodStart(q3Start)
                    .periodEnd(q3End)
                    .deliveryScore(java.math.BigDecimal.valueOf(31.50))
                    .impactScore(java.math.BigDecimal.valueOf(23.00))
                    .capabilityScore(java.math.BigDecimal.valueOf(18.50))
                    .disciplineScore(java.math.BigDecimal.valueOf(19.00))
                    .telemetryTotalScore(java.math.BigDecimal.valueOf(92.00))
                    .selfSummary("Hoàn thành kiến trúc core Backend HRM AI và tích hợp hệ thống đối soát giờ công.")
                    .selfAchievements("Đạt 100% milestone schema & core backend đúng hạn; hỗ trợ review PR toàn nhóm.")
                    .selfRatingScore(java.math.BigDecimal.valueOf(90.0))
                    .selfSubmittedAt(now.minusDays(42))
                    .evaluatorId(creatorId)
                    .qualCraftScore(java.math.BigDecimal.valueOf(23.5))
                    .qualOwnershipScore(java.math.BigDecimal.valueOf(24.0))
                    .qualCollabScore(java.math.BigDecimal.valueOf(22.5))
                    .qualGrowthScore(java.math.BigDecimal.valueOf(22.0))
                    .managerQualScore(java.math.BigDecimal.valueOf(92.0))
                    .managerComment("Kỹ sư nòng cốt dẫn dắt kiến trúc ổn định, chất lượng code và độ tin cậy cao.")
                    .managerFeedbackGoals("Tiếp tục hoàn thiện năng lực Microservices chuẩn bị mở rộng sang dự án B2C.")
                    .finalScore(java.math.BigDecimal.valueOf(92.0))
                    .finalGrade(TechRatingGrade.S)
                    .status(TechReviewStatus.APPROVED)
                    .finalApproverId(giamDoc != null ? giamDoc.getId() : creatorId)
                    .finalApprovedAt(now.minusDays(38))
                    .build());

            techCareerEventRepository.save(TechCareerEvent.builder()
                    .employeeId(devNam.getId())
                    .reviewId(q3Nam.getId())
                    .eventType(TechCareerEventType.REVIEW_COMPLETED)
                    .title("Hoàn tất Đánh giá Hiệu suất kỳ Q3-2026 — Xếp hạng S")
                    .oldValue("Telemetry 92đ")
                    .newValue("Hạng S (92đ)")
                    .actorId(giamDoc != null ? giamDoc.getId() : creatorId)
                    .note("Duy trì vai trò Tech Lead dự án PRJ-HRM-AI.")
                    .eventDate(now.minusDays(38))
                    .build());

            techCareerEventRepository.save(TechCareerEvent.builder()
                    .employeeId(devNam.getId())
                    .reviewId(q3Nam.getId())
                    .eventType(TechCareerEventType.SKILL_LEVEL_UP)
                    .title("Xác thực cấp bậc SENIOR kỹ năng Spring Boot")
                    .oldValue("MIDDLE")
                    .newValue("SENIOR")
                    .actorId(creatorId)
                    .note("Thiết kế hệ thống phân quyền RBAC & Engine tính công.")
                    .eventDate(now.minusDays(38))
                    .build());
        }

        // 3. Kỳ đánh giá Q4-2026 (Đang mở - OPEN) với đầy đủ các trạng thái chờ xử lý
        java.time.LocalDate q4Start = java.time.LocalDate.of(2026, 10, 1);
        java.time.LocalDate q4End = java.time.LocalDate.of(2026, 12, 31);
        TechEvaluationCycle q4Cycle = techEvaluationCycleRepository.save(TechEvaluationCycle.builder()
                .cycleCode("Q4-2026")
                .title("Đánh giá Hiệu suất & Xét Nâng bậc Quý 4/2026")
                .reviewType(TechReviewType.QUARTERLY)
                .periodStart(q4Start)
                .periodEnd(q4End)
                .selfReviewDeadline(today.plusDays(14))
                .status(TechEvaluationCycleStatus.OPEN)
                .departmentId(techDeptId)
                .createdBy(creatorId)
                .build());

        // 3a. Dev Nam -> DIRECTOR_APPROVAL_PENDING + PENDING_CEO (để Giám đốc / CEO test luồng leo thang & đãi ngộ)
        if (devNam != null && !techPerformanceReviewRepository.existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(
                devNam.getId(), TechReviewType.QUARTERLY, q4Start, q4End)) {
            TechTelemetryBreakdownResponse bNam = techTelemetryScoreCalculator.calculateTelemetry(devNam.getId(), q4Start, q4End);
            TechPerformanceReview revNam = TechPerformanceReview.builder()
                    .cycle(q4Cycle)
                    .employeeId(devNam.getId())
                    .departmentId(techDeptId)
                    .reviewType(TechReviewType.QUARTERLY)
                    .periodLabel("Q4-2026")
                    .periodStart(q4Start)
                    .periodEnd(q4End)
                    .deliveryScore(java.math.BigDecimal.valueOf(bNam.getDeliveryScore()))
                    .impactScore(java.math.BigDecimal.valueOf(bNam.getImpactScore()))
                    .capabilityScore(java.math.BigDecimal.valueOf(bNam.getCapabilityScore()))
                    .disciplineScore(java.math.BigDecimal.valueOf(bNam.getDisciplineScore()))
                    .telemetryTotalScore(java.math.BigDecimal.valueOf(bNam.getTelemetryTotalScore()))
                    .telemetrySnapshotJson(safeJson(bNam))
                    .selfSummary("Dẫn dắt kỹ thuật dự án HRM AI đồng thời hỗ trợ Backend cho nền tảng E-Commerce B2C.")
                    .selfAchievements("Hoàn thiện API Payroll Engine, review PR bảo mật RBAC và tích hợp thanh toán VNPay IPN.")
                    .selfChallenges("Đang cân đối tải công việc 100% giữa 2 dự án song song (70% + 30%).")
                    .selfGoalsNext("Chuẩn hóa kiến trúc Microservices và nâng năng lực hệ thống phân tán.")
                    .selfRatingScore(java.math.BigDecimal.valueOf(88.0))
                    .selfSubmittedAt(now.minusDays(3))
                    .evaluatorId(creatorId)
                    .qualCraftScore(java.math.BigDecimal.valueOf(22.5))
                    .qualOwnershipScore(java.math.BigDecimal.valueOf(23.5))
                    .qualCollabScore(java.math.BigDecimal.valueOf(22.0))
                    .qualGrowthScore(java.math.BigDecimal.valueOf(22.0))
                    .managerQualScore(java.math.BigDecimal.valueOf(90.0))
                    .managerComment("Đáp ứng xuất sắc vai trò Tech Lead đa dự án; đủ điều kiện thăng bậc Microservices lên SENIOR và xét chức danh Tech Lead.")
                    .managerFeedbackGoals("Bàn giao bớt tác vụ chi tiết để tập trung tối ưu kiến trúc và kèm cặp Junior.")
                    .finalScore(java.math.BigDecimal.valueOf(Math.round((0.60 * bNam.getTelemetryTotalScore() + 0.40 * 90.0) * 10.0) / 10.0))
                    .finalGrade(TechRatingGrade.fromScore(0.60 * bNam.getTelemetryTotalScore() + 0.40 * 90.0))
                    .recommendPromotion(true)
                    .recommendedTitle("Tech Lead & Senior Backend Engineer")
                    .recommendedSalaryIncreasePct(java.math.BigDecimal.valueOf(12.0))
                    .compensationReason("Gánh tải 100% ở 2 dự án trọng điểm, đóng góp kiến trúc lõi và đạt mức hiệu suất cao liên tiếp 2 quý.")
                    .compensationStatus(CompensationProposalStatus.PENDING_CEO)
                    .status(TechReviewStatus.DIRECTOR_APPROVAL_PENDING)
                    .build();

            techSkillRepository.findBySkillNameIgnoreCase("Microservices Architecture").ifPresent(micro -> {
                revNam.getSkillPromotionItems().add(TechSkillPromotionItem.builder()
                        .review(revNam)
                        .skill(micro)
                        .fromLevel(ProficiencyLevel.MIDDLE)
                        .targetLevel(ProficiencyLevel.SENIOR)
                        .evidenceNote("Thiết kế mô hình tích hợp đa module & IPN thanh toán B2C chịu tải cao.")
                        .evidenceUrl("https://github.com/company/hrm-ai/pull/48")
                        .status(TechPromotionItemStatus.APPROVED)
                        .reviewerNote("Trưởng phòng đồng ý nâng bậc SENIOR, trình Giám đốc/CEO phê duyệt.")
                        .build());
            });
            techPerformanceReviewRepository.save(revNam);
        }

        // 3b. Dev Lan -> MANAGER_REVIEW_PENDING (đã gửi Tự đánh giá + đề xuất nâng bậc Next.js & React)
        if (devLan != null && !techPerformanceReviewRepository.existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(
                devLan.getId(), TechReviewType.QUARTERLY, q4Start, q4End)) {
            TechTelemetryBreakdownResponse bLan = techTelemetryScoreCalculator.calculateTelemetry(devLan.getId(), q4Start, q4End);
            TechPerformanceReview revLan = TechPerformanceReview.builder()
                    .cycle(q4Cycle)
                    .employeeId(devLan.getId())
                    .departmentId(techDeptId)
                    .reviewType(TechReviewType.QUARTERLY)
                    .periodLabel("Q4-2026")
                    .periodStart(q4Start)
                    .periodEnd(q4End)
                    .deliveryScore(java.math.BigDecimal.valueOf(bLan.getDeliveryScore()))
                    .impactScore(java.math.BigDecimal.valueOf(bLan.getImpactScore()))
                    .capabilityScore(java.math.BigDecimal.valueOf(bLan.getCapabilityScore()))
                    .disciplineScore(java.math.BigDecimal.valueOf(bLan.getDisciplineScore()))
                    .telemetryTotalScore(java.math.BigDecimal.valueOf(bLan.getTelemetryTotalScore()))
                    .telemetrySnapshotJson(safeJson(bLan))
                    .selfSummary("Hoàn thiện hệ thống Dashboard Corporate Sapphire & các màn hình điều hành Phòng Công nghệ.")
                    .selfAchievements("Xây dựng bộ biểu đồ Recharts, modal xếp chồng đa tầng chuẩn accessibility WCAG.")
                    .selfChallenges("Chứng chỉ AWS Cloud Practitioner sắp hết hạn (còn 12 ngày), đang lên lịch thi gia hạn.")
                    .selfGoalsNext("Đạt chứng chỉ Cloud mới trong 30 ngày và nâng cấp chuyên sâu React lên Senior.")
                    .selfRatingScore(java.math.BigDecimal.valueOf(84.0))
                    .selfSubmittedAt(now.minusDays(1))
                    .compensationStatus(CompensationProposalStatus.NONE)
                    .status(TechReviewStatus.MANAGER_REVIEW_PENDING)
                    .build();

            techSkillRepository.findBySkillNameIgnoreCase("Next.js").ifPresent(nextSkill -> {
                revLan.getSkillPromotionItems().add(TechSkillPromotionItem.builder()
                        .review(revLan)
                        .skill(nextSkill)
                        .fromLevel(ProficiencyLevel.JUNIOR)
                        .targetLevel(ProficiencyLevel.MIDDLE)
                        .evidenceNote("Xây dựng SSR Storefront và tối ưu Core Web Vitals cho dự án E-Commerce.")
                        .evidenceUrl("https://github.com/company/hrm-ai/pull/55")
                        .status(TechPromotionItemStatus.PENDING)
                        .build());
            });
            techSkillRepository.findBySkillNameIgnoreCase("React").ifPresent(reactSkill -> {
                revLan.getSkillPromotionItems().add(TechSkillPromotionItem.builder()
                        .review(revLan)
                        .skill(reactSkill)
                        .fromLevel(ProficiencyLevel.MIDDLE)
                        .targetLevel(ProficiencyLevel.SENIOR)
                        .evidenceNote("Thiết kế kiến trúc state & UI Design System Corporate Sapphire toàn phân hệ.")
                        .evidenceUrl("https://github.com/company/hrm-ai/pull/49")
                        .status(TechPromotionItemStatus.PENDING)
                        .build());
            });
            techPerformanceReviewRepository.save(revLan);
        }

        // 3c. Tester Hung -> SELF_REVIEW_PENDING (kỹ sư chưa gửi tự đánh giá)
        if (testerHung != null && !techPerformanceReviewRepository.existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(
                testerHung.getId(), TechReviewType.QUARTERLY, q4Start, q4End)) {
            TechTelemetryBreakdownResponse bHung = techTelemetryScoreCalculator.calculateTelemetry(testerHung.getId(), q4Start, q4End);
            techPerformanceReviewRepository.save(TechPerformanceReview.builder()
                    .cycle(q4Cycle)
                    .employeeId(testerHung.getId())
                    .departmentId(techDeptId)
                    .reviewType(TechReviewType.QUARTERLY)
                    .periodLabel("Q4-2026")
                    .periodStart(q4Start)
                    .periodEnd(q4End)
                    .deliveryScore(java.math.BigDecimal.valueOf(bHung.getDeliveryScore()))
                    .impactScore(java.math.BigDecimal.valueOf(bHung.getImpactScore()))
                    .capabilityScore(java.math.BigDecimal.valueOf(bHung.getCapabilityScore()))
                    .disciplineScore(java.math.BigDecimal.valueOf(bHung.getDisciplineScore()))
                    .telemetryTotalScore(java.math.BigDecimal.valueOf(bHung.getTelemetryTotalScore()))
                    .telemetrySnapshotJson(safeJson(bHung))
                    .compensationStatus(CompensationProposalStatus.NONE)
                    .status(TechReviewStatus.SELF_REVIEW_PENDING)
                    .build());
        }

        log.info("[Seed] Đã khởi tạo dữ liệu mẫu Đánh giá Hiệu suất Kỹ sư (Q3-2026, Q4-2026) & Chứng chỉ sắp/đã hết hạn.");
    }

    private String safeJson(Object obj) {
        if (obj == null) return null;
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return null;
        }
    }
}
