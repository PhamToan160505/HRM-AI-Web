package com.hrm.telegram;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hrm.ai.entity.ChatMessage;
import com.hrm.ai.service.GeminiClientService;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.common.entity.Role;
import com.hrm.common.payroll.repository.PayrollRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.recruitment.entity.ApplicationStatus;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.repository.EmployeeRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AI hoi thoai thong minh cho Telegram Bot.
 * - System Prompt phong phu voi du lieu thuc theo thoi gian thuc
 * - Function Calling thuc te: query DB real-time khi AI can so lieu
 * - Lich su hoi thoai per-chatId (LRU, toi da 20 luot)
 * - Dung lai GeminiClientService (cung model, cung co che retry/timeout)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramAiConversationService {

    private final GeminiClientService geminiClientService;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final PayrollRepository payrollRepository;
    private final JobPostingRepository jobPostingRepository;
    private final ApplicationRepository applicationRepository;
    private final EmployeeRequestRepository employeeRequestRepository;
    private final DepartmentRepository departmentRepository;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<Role> EMPLOYEE_ROLES = List.of(
            Role.NHAN_VIEN, Role.TRUONG_PHONG, Role.GIAM_DOC_PHONG_BAN, Role.CEO
    );

    private final Map<String, List<ChatMessage>> conversationHistory =
            new ConcurrentHashMap<>(new LinkedHashMap<>(50, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, List<ChatMessage>> eldest) {
                    return size() > 50;
                }
            });

    @Transactional
    public String chat(String chatId, String senderName, String message) {
        try {
            List<ChatMessage> history = conversationHistory
                    .computeIfAbsent(chatId, k -> new ArrayList<>());
            history.add(ChatMessage.builder().role("user").content(message).build());
            if (history.size() > 40) {
                history = new ArrayList<>(history.subList(history.size() - 40, history.size()));
                conversationHistory.put(chatId, history);
            }
            String systemPrompt = buildSystemPrompt();
            JsonNode tools = buildToolsDeclaration();
            String rawResponse1 = geminiClientService.callGeminiChat(systemPrompt, history, tools).block();
            String finalAnswer = handleGeminiResponse(rawResponse1, history, systemPrompt);
            history.add(ChatMessage.builder().role("model").content(finalAnswer).build());
            return finalAnswer;
        } catch (Exception e) {
            log.error("[TelegramAI] Loi xu ly tin nhan tu chatId={}: {}", chatId, e.getMessage(), e);
            return "Xin loi, toi dang gap su co ket noi. Vui long thu lai sau hoac dung lenh /dashboard.";
        }
    }

    public void clearHistory(String chatId) {
        conversationHistory.remove(chatId);
        log.info("[TelegramAI] Da xoa lich su hoi thoai chatId={}", chatId);
    }

    private String buildSystemPrompt() {
        LocalDate today = LocalDate.now();
        StringBuilder sb = new StringBuilder();

        sb.append("Ban la HRM AI Bot - tro ly thong minh cua he thong quan tri nhan su HRM-AI-Web, chay qua Telegram.\n");
        sb.append("Nguoi dung la CEO hoac Giam doc, co toan quyen xem moi du lieu trong he thong.\n\n");
        sb.append("NGAY HOM NAY: ").append(today.format(DATE_FMT)).append("\n\n");

        sb.append("=== DU LIEU THUC THEO THOI GIAN THUC ===\n");
        try {
            long totalEmp = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long activeEmp = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
            sb.append("- Tong nhan vien (dang lam): ").append(activeEmp).append("/").append(totalEmp).append(" nguoi\n");
            List<Object[]> deptDist = userRepository.getDepartmentDistributionRaw();
            if (!deptDist.isEmpty()) {
                sb.append("- Phan bo phong ban: ");
                for (Object[] row : deptDist) {
                    sb.append(row[0]).append("=").append(row[1]).append("ng, ");
                }
                sb.append("\n");
            }
        } catch (Exception ignored) {}

        try {
            long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
            long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
            long absent  = attendanceRepository.countByDateAndStatus(today, "ABSENT");
            sb.append("- Cham cong hom nay: ").append(present).append(" dung gio, ")
              .append(late).append(" muon, ").append(absent).append(" vang\n");
        } catch (Exception ignored) {}

        try {
            long openJobs = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long pendingCv = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long pendingInterview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_1)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
            sb.append("- Tuyen dung: ").append(openJobs).append(" vi tri mo, ")
              .append(pendingCv).append(" dang xet CV, ").append(pendingInterview).append(" dang phong van\n");
        } catch (Exception ignored) {}

        try {
            LocalDate now = LocalDate.now();
            var payrolls = payrollRepository.findByMonthAndYear(now.getMonthValue(), now.getYear());
            if (!payrolls.isEmpty()) {
                double totalNet = payrolls.stream().mapToDouble(p -> p.getNetSalary() != null ? p.getNetSalary() : 0).sum();
                long approved = payrolls.stream().filter(p -> "APPROVED".equals(p.getStatus())).count();
                sb.append("- Luong thang ").append(now.getMonthValue()).append("/").append(now.getYear())
                  .append(": Tong net=").append(String.format("%,.0f", totalNet))
                  .append(" VND, ").append(approved).append("/").append(payrolls.size()).append(" da duyet\n");
            }
        } catch (Exception ignored) {}

        try {
            long pendingRequests = employeeRequestRepository.findAll().stream()
                    .filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            if (pendingRequests > 0) {
                sb.append("- CO ").append(pendingRequests).append(" DON DANG CHO DUYET!\n");
            } else {
                sb.append("- Khong co don nao cho duyet\n");
            }
        } catch (Exception ignored) {}

        sb.append("\n=== HUONG DAN TRA LOI ===\n");
        sb.append("1. Tra loi bang tieng Viet co dau, ro rang, chuyen nghiep.\n");
        sb.append("2. Dung emoji phu hop de lam noi bat thong tin quan trong.\n");
        sb.append("3. Khi nguoi dung hoi ve nhan vien moi gia nhap, nhan su moi, hoac ai moi vao: BAT BUOC goi ham 'get_recent_employees' de tra ve danh sach nhan vien moi nhat tu CSDL.\n");
        sb.append("4. Khi nguoi dung tim kiem nhan vien (tim ten, tim ma nhan vien): BAT BUOC goi ham 'search_employee'.\n");
        sb.append("5. Khi can so lieu chi tiet hon (phong ban, luong, don cho duyet, cham cong), hay su dung Function Calling de truy van CSDL thuc te.\n");
        sb.append("6. Voi cau hoi ve duyet don: nhac nguoi dung dung lenh /request roi /duyet [ID] hoac /tuchoi [ID].\n");
        sb.append("7. Khong tra loi cac cau hoi hoan toan khong lien quan den cong ty/nhan su.\n");
        sb.append("8. Tra loi ngan gon, suc tich - toi da 300 tu neu khong can thiet liet ke nhieu.\n");
        sb.append("9. KHONG dung markdown (**, ##) - chi dung emoji va dau phan cach thuan text.\n");

        return sb.toString();
    }

    private JsonNode buildToolsDeclaration() {
        ArrayNode tools = objectMapper.createArrayNode();
        ObjectNode toolItem = tools.addObject();
        ArrayNode funcDecls = toolItem.putArray("function_declarations");

        ObjectNode f1 = funcDecls.addObject();
        f1.put("name", "get_department_stats");
        f1.put("description", "Lay so luong nhan vien va phan cap role cua mot phong ban cu the.");
        ObjectNode p1 = f1.putObject("parameters");
        p1.put("type", "OBJECT");
        p1.putObject("properties").putObject("departmentName")
                .put("type", "STRING")
                .put("description", "Ten phong ban (vi du: Nhan su, Ky thuat, Marketing)");
        p1.putArray("required").add("departmentName");

        ObjectNode f2 = funcDecls.addObject();
        f2.put("name", "get_all_departments");
        f2.put("description", "Lay danh sach tat ca phong ban va so nhan vien cua tung phong ban.");
        f2.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f3 = funcDecls.addObject();
        f3.put("name", "get_employee_overview");
        f3.put("description", "Lay tong quan nhan su: tong so, dang lam viec, da nghi viec, phan bo theo phong ban.");
        f3.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f4 = funcDecls.addObject();
        f4.put("name", "get_pending_requests_detail");
        f4.put("description", "Lay danh sach chi tiet cac don xin phep/nghi phep/tang ca dang cho phe duyet, kem ID de duyet/tu choi.");
        f4.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f5 = funcDecls.addObject();
        f5.put("name", "get_payroll_detail");
        f5.put("description", "Lay thong tin chi tiet bang luong thang hien tai hoac thang chi dinh.");
        ObjectNode p5 = f5.putObject("parameters");
        p5.put("type", "OBJECT");
        ObjectNode props5 = p5.putObject("properties");
        props5.putObject("month").put("type", "INTEGER").put("description", "Thang (1-12)");
        props5.putObject("year").put("type", "INTEGER").put("description", "Nam (vi du 2026)");

        ObjectNode f6 = funcDecls.addObject();
        f6.put("name", "get_recruitment_detail");
        f6.put("description", "Lay thong tin chi tiet tinh hinh tuyen dung: so vi tri mo, so ung vien tung giai doan.");
        f6.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f7 = funcDecls.addObject();
        f7.put("name", "get_today_attendance");
        f7.put("description", "Lay thong tin cham cong hom nay: so nguoi dung gio, di muon, vang mat, nghi phep.");
        f7.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f8 = funcDecls.addObject();
        f8.put("name", "get_recent_employees");
        f8.put("description", "Lay danh sach cac nhan vien moi gia nhập / moi duoc tao gan day nhat trong he thong.");
        f8.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f9 = funcDecls.addObject();
        f9.put("name", "search_employee");
        f9.put("description", "Tim kiem thong tin nhan vien theo ten, ma nhan vien hoac email.");
        ObjectNode p9 = f9.putObject("parameters");
        p9.put("type", "OBJECT");
        p9.putObject("properties").putObject("keyword")
                .put("type", "STRING")
                .put("description", "Tu khoa tim kiem (ten, ma nhan vien, email)");
        p9.putArray("required").add("keyword");

        return tools;
    }

    private String handleGeminiResponse(String rawResponse, List<ChatMessage> history, String systemPrompt) {
        if (rawResponse == null) return "Xin loi, khong nhan duoc phan hoi tu AI. Vui long thu lai.";
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            JsonNode candidates = root.get("candidates");
            if (candidates == null || !candidates.isArray() || candidates.size() == 0) {
                return geminiClientService.extractTextFromGeminiResponse(rawResponse);
            }
            JsonNode parts = candidates.get(0).get("content").get("parts");
            if (parts == null || !parts.isArray()) {
                return geminiClientService.extractTextFromGeminiResponse(rawResponse);
            }
            for (JsonNode part : parts) {
                if (part.has("functionCall")) {
                    JsonNode fc = part.get("functionCall");
                    String funcName = fc.get("name").asText();
                    JsonNode args = fc.get("args");
                    log.info("[TelegramAI] AI yeu cau function: {} voi args: {}", funcName, args);
                    JsonNode funcResult = executeFunction(funcName, args);
                    log.info("[TelegramAI] Function result: {}", funcResult);
                    history.add(ChatMessage.builder()
                            .role("model")
                            .content("Da goi ham " + funcName + " de tra cuu du lieu.")
                            .build());
                    history.add(ChatMessage.builder()
                            .role("user")
                            .content("Ket qua tu he thong DB sau khi goi ham '" + funcName + "': " + funcResult.toString()
                                    + "\n\nHay dung du lieu nay de tra loi cau hoi cua nguoi dung mot cach tu nhien, chinh xac va ro rang bang tieng Viet co dau. Khong dung markdown.")
                            .build());
                    String rawResponse2 = geminiClientService.callGeminiChat(systemPrompt, history, null).block();
                    String answer2 = geminiClientService.extractTextFromGeminiResponse(rawResponse2);
                    history.remove(history.size() - 1);
                    history.remove(history.size() - 1);
                    return answer2 != null && !answer2.isBlank() ? answer2 : "AI khong the xu ly ket qua. Vui long thu lai.";
                }
            }
            return geminiClientService.extractTextFromGeminiResponse(rawResponse);
        } catch (Exception e) {
            log.error("[TelegramAI] Loi parse Gemini response: {}", e.getMessage(), e);
            return geminiClientService.extractTextFromGeminiResponse(rawResponse);
        }
    }

    private JsonNode executeFunction(String functionName, JsonNode args) {
        ObjectNode result = objectMapper.createObjectNode();
        try {
            switch (functionName) {
                case "get_employee_overview" -> {
                    long total    = userRepository.countByRoleIn(EMPLOYEE_ROLES);
                    long active   = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
                    long inactive = total - active;
                    result.put("status", "success");
                    result.put("tongNhanVien", total);
                    result.put("dangLamViec", active);
                    result.put("daNghiViec", inactive);
                    ObjectNode deptNode = result.putObject("phanBoPHongBan");
                    userRepository.getDepartmentDistributionRaw().forEach(row -> {
                        if (row[0] != null) deptNode.put(row[0].toString(), ((Number) row[1]).longValue());
                    });
                }
                case "get_all_departments" -> {
                    result.put("status", "success");
                    ArrayNode depts = result.putArray("phongBan");
                    userRepository.getDepartmentDistributionRaw().forEach(row -> {
                        ObjectNode d = depts.addObject();
                        d.put("ten", row[0] != null ? row[0].toString() : "Chua phan cong");
                        d.put("soNguoi", ((Number) row[1]).longValue());
                    });
                }
                case "get_department_stats" -> {
                    String deptName = args != null && args.has("departmentName")
                            ? args.get("departmentName").asText() : "";
                    var dept = departmentRepository.findFirstByTenPhongContainingIgnoreCase(deptName).orElse(null);
                    if (dept == null) {
                        result.put("status", "error");
                        result.put("message", "Khong tim thay phong ban: " + deptName);
                    } else {
                        result.put("status", "success");
                        result.put("tenPhong", dept.getTenPhong());
                        result.put("soNhanVien", userRepository.countByDepartmentId(dept.getId()));
                        ObjectNode roleNode = result.putObject("phanCapRole");
                        userRepository.getRoleDistributionByDepartmentId(dept.getId())
                                .forEach(row -> roleNode.put(row[0].toString(), (Long) row[1]));
                    }
                }
                case "get_pending_requests_detail" -> {
                    var pending = employeeRequestRepository.findAll().stream()
                            .filter(r -> r.getStatus() == RequestStatus.PENDING
                                    || r.getStatus() == RequestStatus.FORWARDED)
                            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                            .toList();
                    result.put("status", "success");
                    result.put("tongSo", pending.size());
                    ArrayNode arr = result.putArray("danhSach");
                    pending.forEach(req -> {
                        ObjectNode item = arr.addObject();
                        item.put("id", req.getId());
                        item.put("nhanVien", req.getUser().getHoTen());
                        item.put("loai", req.getRequestType().name());
                        item.put("tuNgay", req.getStartDate().format(DATE_FMT));
                        item.put("denNgay", req.getEndDate().format(DATE_FMT));
                        item.put("lyDo", req.getReason().length() > 80
                                ? req.getReason().substring(0, 80) + "..." : req.getReason());
                        item.put("trangThai", req.getStatus().name());
                    });
                    result.put("huongDan", "Dung /duyet [ID] de duyet, /tuchoi [ID] [ly do] de tu choi.");
                }
                case "get_payroll_detail" -> {
                    LocalDate now = LocalDate.now();
                    int month = (args != null && args.has("month")) ? args.get("month").asInt() : now.getMonthValue();
                    int year  = (args != null && args.has("year"))  ? args.get("year").asInt()  : now.getYear();
                    var payrolls = payrollRepository.findByMonthAndYear(month, year);
                    if (payrolls.isEmpty() && (month == now.getMonthValue() && year == now.getYear())) {
                        LocalDate prev = now.minusMonths(1);
                        payrolls = payrollRepository.findByMonthAndYear(prev.getMonthValue(), prev.getYear());
                        if (!payrolls.isEmpty()) { month = prev.getMonthValue(); year = prev.getYear(); }
                    }
                    result.put("status", "success");
                    result.put("thang", month);
                    result.put("nam", year);
                    if (payrolls.isEmpty()) {
                        result.put("thongBao", "Chua co du lieu luong thang " + month + "/" + year);
                    } else {
                        double net   = payrolls.stream().mapToDouble(p -> p.getNetSalary() != null ? p.getNetSalary() : 0).sum();
                        double gross = payrolls.stream().mapToDouble(p -> p.getGrossSalary() != null ? p.getGrossSalary() : 0).sum();
                        double avg   = payrolls.stream().mapToDouble(p -> p.getNetSalary() != null ? p.getNetSalary() : 0).average().orElse(0);
                        double max   = payrolls.stream().mapToDouble(p -> p.getNetSalary() != null ? p.getNetSalary() : 0).max().orElse(0);
                        long approved = payrolls.stream().filter(p -> "APPROVED".equals(p.getStatus())).count();
                        result.put("soNhanVien", payrolls.size());
                        result.put("daDuyet", approved);
                        result.put("tongGross", String.format("%,.0f VND", gross));
                        result.put("tongNet", String.format("%,.0f VND", net));
                        result.put("luongTrungBinh", String.format("%,.0f VND", avg));
                        result.put("luongCaoNhat", String.format("%,.0f VND", max));
                    }
                }
                case "get_recruitment_detail" -> {
                    long open    = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
                    long totalApp = applicationRepository.count();
                    long cv      = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                            + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
                    long interview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_1)
                            + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
                    long offer   = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_OFFER)
                            + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_OFFER_APPROVAL)
                            + applicationRepository.countByApprovalStatus(ApplicationStatus.OFFER_INTERNALLY_APPROVED);
                    result.put("status", "success");
                    result.put("viTriDangTuyen", open);
                    result.put("tongUngVien", totalApp);
                    result.put("dangXetCV", cv);
                    result.put("dangPhongVan", interview);
                    result.put("giaiDoanOffer", offer);
                }
                case "get_today_attendance" -> {
                    LocalDate today = LocalDate.now();
                    long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
                    long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
                    long absent  = attendanceRepository.countByDateAndStatus(today, "ABSENT");
                    long onLeave = attendanceRepository.countByDateAndStatus(today, "ON_LEAVE");
                    long totalActive = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
                    result.put("status", "success");
                    result.put("ngay", today.format(DATE_FMT));
                    result.put("dungGio", present);
                    result.put("diMuon", late);
                    result.put("vangMat", absent);
                    result.put("nghiPhep", onLeave);
                    result.put("tongNhanVienActive", totalActive);
                    result.put("chuaChamCong", Math.max(0, totalActive - present - late - absent - onLeave));
                }
                case "get_recent_employees" -> {
                    var users = userRepository.findAll().stream()
                            .filter(u -> EMPLOYEE_ROLES.contains(u.getRole()))
                            .sorted((a, b) -> (b.getId() != null && a.getId() != null) ? b.getId().compareTo(a.getId()) : 0)
                            .limit(10)
                            .toList();

                    result.put("status", "success");
                    result.put("tongSoNhanVienMoiGoiY", users.size());
                    ArrayNode arr = result.putArray("danhSachNhanVienMoiNhat");
                    var deptMap = departmentRepository.findAll().stream()
                            .collect(java.util.stream.Collectors.toMap(com.hrm.common.entity.Department::getId, com.hrm.common.entity.Department::getTenPhong, (a, b) -> a));

                    users.forEach(u -> {
                        ObjectNode item = arr.addObject();
                        item.put("maNhanVien", u.getMaNhanVien() != null ? u.getMaNhanVien() : "NV" + u.getId());
                        item.put("hoTen", u.getHoTen());
                        item.put("chucVu", u.getChucVu() != null ? u.getChucVu() : u.getRole().name());
                        item.put("phongBan", u.getDepartmentId() != null ? deptMap.getOrDefault(u.getDepartmentId(), "Chưa phân công") : "Ban Giám Đốc");
                        item.put("email", u.getEmail());
                        item.put("ngayTaoTaikhoan", u.getCreatedAt() != null ? u.getCreatedAt().format(DATE_FMT) : "Chưa ghi nhận");
                        item.put("trangThai", u.getActive() ? "Đang làm việc" : "Đã nghỉ việc");
                    });
                }
                case "search_employee" -> {
                    String kw = args != null && args.has("keyword") ? args.get("keyword").asText().trim().toLowerCase() : "";
                    var deptMap = departmentRepository.findAll().stream()
                            .collect(java.util.stream.Collectors.toMap(com.hrm.common.entity.Department::getId, com.hrm.common.entity.Department::getTenPhong, (a, b) -> a));

                    var matched = userRepository.findAll().stream()
                            .filter(u -> EMPLOYEE_ROLES.contains(u.getRole()))
                            .filter(u -> u.getHoTen().toLowerCase().contains(kw)
                                    || (u.getMaNhanVien() != null && u.getMaNhanVien().toLowerCase().contains(kw))
                                    || (u.getEmail() != null && u.getEmail().toLowerCase().contains(kw)))
                            .limit(10)
                            .toList();

                    result.put("status", "success");
                    result.put("tuKhoa", kw);
                    result.put("soKetQua", matched.size());
                    ArrayNode arr = result.putArray("danhSachKetQua");
                    matched.forEach(u -> {
                        ObjectNode item = arr.addObject();
                        item.put("maNhanVien", u.getMaNhanVien() != null ? u.getMaNhanVien() : "NV" + u.getId());
                        item.put("hoTen", u.getHoTen());
                        item.put("chucVu", u.getChucVu() != null ? u.getChucVu() : u.getRole().name());
                        item.put("phongBan", u.getDepartmentId() != null ? deptMap.getOrDefault(u.getDepartmentId(), "Chưa phân công") : "Ban Giám Đốc");
                        item.put("email", u.getEmail());
                        item.put("phone", u.getPhone() != null ? u.getPhone() : "N/A");
                        item.put("trangThai", u.getActive() ? "Đang làm việc" : "Đã nghỉ việc");
                    });
                }
                default -> {
                    result.put("status", "error");
                    result.put("message", "Ham khong ton tai: " + functionName);
                }
            }
        } catch (Exception e) {
            log.error("[TelegramAI] Loi thuc thi function {}: {}", functionName, e.getMessage(), e);
            result.put("status", "error");
            result.put("message", "Loi truy van DB: " + e.getMessage());
        }
        return result;
    }
}
