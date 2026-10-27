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
import com.hrm.recruitment.entity.JobPosting;
import com.hrm.recruitment.entity.JobPostingStatus;
import com.hrm.recruitment.repository.ApplicationRepository;
import com.hrm.recruitment.repository.JobPostingRepository;
import com.hrm.request.entity.RequestStatus;
import com.hrm.request.repository.EmployeeRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

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
    private final com.hrm.recruitment.service.PostingVersionLockService postingVersionLockService;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final List<Role> EMPLOYEE_ROLES = List.of(
            Role.NHAN_VIEN, Role.TRUONG_PHONG, Role.GIAM_DOC_PHONG_BAN, Role.CEO
    );
    private static final Pattern NONLATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s]");

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

        sb.append("🔴 BẮT BUỘC VÀ QUY TẮC TỐI CAO: BẠN PHẢI LUÔN LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT CÓ DẤU CHUẨN XÁC 100%. TUYỆT ĐỐI KHÔNG VIẾT TIẾNG VIỆT KHÔNG DẤU TRONG BẤT KỲ TRƯỜNG HỢP NÀO.\n\n");
        sb.append("Bạn là HRM AI Bot - trợ lý thông minh của hệ thống quản trị nhân sự HRM-AI-Web, chạy qua Telegram.\n");
        sb.append("Người dùng là CEO hoặc Giám đốc, có toàn quyền xem mọi dữ liệu trong hệ thống.\n\n");
        sb.append("NGÀY HÔM NAY: ").append(today.format(DATE_FMT)).append("\n\n");

        sb.append("=== DỮ LIỆU THỰC TE THỜI GIAN THỰC ===\n");
        try {
            long totalEmp = userRepository.countByRoleIn(EMPLOYEE_ROLES);
            long activeEmp = userRepository.countByActiveAndRoleIn(true, EMPLOYEE_ROLES);
            sb.append("- Tổng nhân viên (đang làm việc): ").append(activeEmp).append("/").append(totalEmp).append(" người\n");
            List<Object[]> deptDist = userRepository.getDepartmentDistributionRaw();
            if (!deptDist.isEmpty()) {
                sb.append("- Phân bổ phòng ban: ");
                for (Object[] row : deptDist) {
                    sb.append(row[0]).append("=").append(row[1]).append(" người, ");
                }
                sb.append("\n");
            }
        } catch (Exception ignored) {}

        try {
            long present = attendanceRepository.countByDateAndStatus(today, "PRESENT");
            long late    = attendanceRepository.countByDateAndStatus(today, "LATE");
            long absent  = attendanceRepository.countByDateAndStatus(today, "ABSENT");
            sb.append("- Chấm công hôm nay: ").append(present).append(" đúng giờ, ")
              .append(late).append(" đi muộn, ").append(absent).append(" vắng mặt\n");
        } catch (Exception ignored) {}

        try {
            long openJobs = jobPostingRepository.countByStatus(JobPostingStatus.OPEN);
            long pendingCv = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_HR_CV_REVIEW)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_TECH_CV_REVIEW);
            long pendingInterview = applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_1)
                    + applicationRepository.countByApprovalStatus(ApplicationStatus.PENDING_INTERVIEW_2);
            sb.append("- Tuyển dụng: ").append(openJobs).append(" vị trí mở, ")
              .append(pendingCv).append(" đang xét CV, ").append(pendingInterview).append(" đang phỏng vấn\n");
        } catch (Exception ignored) {}

        try {
            LocalDate now = LocalDate.now();
            var payrolls = payrollRepository.findByMonthAndYear(now.getMonthValue(), now.getYear());
            if (!payrolls.isEmpty()) {
                double totalNet = payrolls.stream().mapToDouble(p -> p.getNetSalary() != null ? p.getNetSalary() : 0).sum();
                long approved = payrolls.stream().filter(p -> "APPROVED".equals(p.getStatus())).count();
                sb.append("- Lương tháng ").append(now.getMonthValue()).append("/").append(now.getYear())
                  .append(": Tổng net=").append(String.format("%,.0f", totalNet))
                  .append(" VNĐ, ").append(approved).append("/").append(payrolls.size()).append(" đã duyệt\n");
            }
        } catch (Exception ignored) {}

        try {
            long pendingRequests = employeeRequestRepository.findAll().stream()
                    .filter(r -> r.getStatus() == RequestStatus.PENDING).count();
            if (pendingRequests > 0) {
                sb.append("- CÓ ").append(pendingRequests).append(" ĐƠN ĐANG CHỜ PHÊ DUYỆT!\n");
            } else {
                sb.append("- Không có đơn nào chờ duyệt\n");
            }
        } catch (Exception ignored) {}

        sb.append("\n=== HƯỚNG DẪN TRẢ LỜI ===\n");
        sb.append("1. LUÔN LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT CÓ DẤU CHUẨN XÁC 100%, ĐẦY ĐỦ DẤU CÂU VÀ DẤU THANH (NGHIÊM CẤM VIẾT KHÔNG DẤU).\n");
        sb.append("2. Dùng emoji phù hợp để làm nổi bật thông tin quan trọng.\n");
        sb.append("3. TẠO / ĐĂNG BÀI TUYỂN DỤNG: Khi người dùng yêu cầu tạo bài tuyển dụng, đăng bài tuyển dụng, hoặc đẩy bài tuyển dụng lên hệ thống -> Bạn BẮT BUỘC gọi hàm 'create_job_posting' để lưu vị trí tuyển dụng thực sự vào CSDL! NGHIÊM CẤM khẳng định đã tạo/đẩy bài thành công nếu KHÔNG gọi hàm 'create_job_posting'.\n");
        sb.append("4. THÔNG TIN ỨNG VIÊN VÀ TUYỂN DỤNG: Hệ thống CÓ LƯU HOÀN TOÀN ĐẦY ĐỦ HỌ TÊN, EMAIL, SĐT, VỊ TRÍ ỨNG TUYỂN CỦA TỪNG ỨNG VIÊN. KHÔNG BAO GIỜ ĐƯỢC NÓI HỆ THỐNG KHÔNG LƯU TÊN ỨNG VIÊN.\n");
        sb.append("5. Khi người dùng hỏi tên ứng viên mới nộp hồ sơ, danh sách ứng viên mới, ai nộp CV, hồ sơ tuyển dụng gần đây: BẮT BUỘC gọi hàm 'get_recent_applications' để lấy tên và thông tin thực tế từ CSDL.\n");
        sb.append("6. Khi người dùng tìm kiếm ứng viên theo tên/email/vị trí: BẮT BUỘC gọi hàm 'search_applications'.\n");
        sb.append("7. Khi người dùng hỏi về nhân viên mới gia nhập, nhân sự mới, hoặc ai mới vào: BẮT BUỘC gọi hàm 'get_recent_employees' để trả về danh sách nhân viên mới nhất từ CSDL.\n");
        sb.append("8. Khi người dùng tìm kiếm nhân viên (tìm tên, tìm mã nhân viên): BẮT BUỘC gọi hàm 'search_employee'.\n");
        sb.append("9. Khi cần số liệu chi tiết hơn (phòng ban, lương, đơn chờ duyệt, chấm công), hãy sử dụng Function Calling để truy vấn CSDL thực tế.\n");
        sb.append("10. Với câu hỏi về duyệt đơn: nhắc người dùng dùng lệnh /request rồi /duyet [ID] hoặc /tuchoi [ID].\n");
        sb.append("11. Không trả lời các câu hỏi hoàn toàn không liên quan đến công ty/nhân sự.\n");
        sb.append("12. Trả lời ngắn gọn, súc tích, tự nhiên, thân thiện và BẮT BUỘC BẰNG TIẾNG VIỆT CÓ DẤU.\n");

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

        ObjectNode f10 = funcDecls.addObject();
        f10.put("name", "get_recent_applications");
        f10.put("description", "Lay danh sach va HO TEN cac ung vien moi nop ho so / gia nhap he thong tuyen dung gan day.");
        f10.putObject("parameters").put("type", "OBJECT").putObject("properties");

        ObjectNode f11 = funcDecls.addObject();
        f11.put("name", "search_applications");
        f11.put("description", "Tim kiem ho so ung vien theo ten, email hoac vi tri ung tuyen.");
        ObjectNode p11 = f11.putObject("parameters");
        p11.put("type", "OBJECT");
        p11.putObject("properties").putObject("keyword")
                .put("type", "STRING")
                .put("description", "Tu khoa tim kiem (ten ung vien, email, vi tri)");
        p11.putArray("required").add("keyword");

        ObjectNode f12 = funcDecls.addObject();
        f12.put("name", "create_job_posting");
        f12.put("description", "Tao va dang bai tuyen dung moi thuc te vao CSDL he thong HRM. BAT BUOC goi ham nay khi nguoi dung yeu cau tao bai tuyen dung, dang tuyen dung, hoac day bai tuyen dung len he thong.");
        ObjectNode p12 = f12.putObject("parameters");
        p12.put("type", "OBJECT");
        ObjectNode props12 = p12.putObject("properties");
        props12.putObject("title").put("type", "STRING").put("description", "Ten/Tieu de vi tri tuyen dung (vi du: Nhan vien Kinh doanh, Nhan vien Nhan su)");
        props12.putObject("departmentName").put("type", "STRING").put("description", "Ten phong ban tuyen dung (vi du: Kinh doanh, Nhan su, Ky thuat)");
        props12.putObject("description").put("type", "STRING").put("description", "Mo ta chi tiet cong viec");
        props12.putObject("requirements").put("type", "STRING").put("description", "Yeu cau cong viec (Kinh nghiem, ky nang, trinh do)");
        props12.putObject("quyenLoi").put("type", "STRING").put("description", "Quyen loi ung vien");
        props12.putObject("soLuongTuyen").put("type", "INTEGER").put("description", "So luong can tuyen");
        props12.putObject("mucLuong").put("type", "STRING").put("description", "Muc luong (mac dinh Thoa thuan)");
        p12.putArray("required").add("title").add("departmentName");

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
                case "get_recent_applications" -> {
                    var apps = applicationRepository.findAll().stream()
                            .sorted((a, b) -> (b.getId() != null && a.getId() != null) ? b.getId().compareTo(a.getId()) : 0)
                            .limit(10)
                            .toList();

                    result.put("status", "success");
                    result.put("tongSoUngVienMoiNhat", apps.size());
                    ArrayNode arr = result.putArray("danhSachUngVienMoiNhat");
                    apps.forEach(app -> {
                        ObjectNode item = arr.addObject();
                        item.put("id", app.getId());
                        item.put("hoTenUngVien", app.getFullName());
                        item.put("email", app.getEmail());
                        item.put("phone", app.getPhone() != null ? app.getPhone() : "N/A");
                        item.put("viTriUngTuyen", app.getJobPosting() != null ? app.getJobPosting().getTitle() : "Chưa xác định");
                        item.put("diemPhuHopFitScore", app.getFitScore() != null ? app.getFitScore() + "/100" : "Chưa chấm");
                        item.put("trangThaiHoSo", app.getApprovalStatus() != null ? app.getApprovalStatus().name() : "N/A");
                    });
                }
                case "search_applications" -> {
                    String kw = args != null && args.has("keyword") ? args.get("keyword").asText().trim().toLowerCase() : "";
                    var matched = applicationRepository.findAll().stream()
                            .filter(a -> (a.getFullName() != null && a.getFullName().toLowerCase().contains(kw))
                                    || (a.getEmail() != null && a.getEmail().toLowerCase().contains(kw))
                                    || (a.getJobPosting() != null && a.getJobPosting().getTitle() != null && a.getJobPosting().getTitle().toLowerCase().contains(kw)))
                            .limit(10)
                            .toList();

                    result.put("status", "success");
                    result.put("tuKhoa", kw);
                    result.put("soKetQua", matched.size());
                    ArrayNode arr = result.putArray("danhSachKetQua");
                    matched.forEach(app -> {
                        ObjectNode item = arr.addObject();
                        item.put("id", app.getId());
                        item.put("hoTenUngVien", app.getFullName());
                        item.put("email", app.getEmail());
                        item.put("phone", app.getPhone() != null ? app.getPhone() : "N/A");
                        item.put("viTriUngTuyen", app.getJobPosting() != null ? app.getJobPosting().getTitle() : "Chưa xác định");
                        item.put("diemPhuHopFitScore", app.getFitScore() != null ? app.getFitScore() + "/100" : "Chưa chấm");
                        item.put("trangThaiHoSo", app.getApprovalStatus() != null ? app.getApprovalStatus().name() : "N/A");
                    });
                }
                case "create_job_posting" -> {
                    String title = args != null && args.has("title") ? args.get("title").asText().trim() : "";
                    String deptName = args != null && args.has("departmentName") ? args.get("departmentName").asText().trim() : "";
                    String desc = args != null && args.has("description") ? args.get("description").asText().trim() : "Mô tả công việc cho vị trí " + title;
                    String reqs = args != null && args.has("requirements") ? args.get("requirements").asText().trim() : "Yêu cầu kinh nghiệm và kỹ năng phù hợp vị trí " + title;
                    String benefits = args != null && args.has("quyenLoi") ? args.get("quyenLoi").asText().trim() : "Mức lương cạnh tranh, BHXH đầy đủ, chế độ đãi ngộ tốt";
                    int quantity = (args != null && args.has("soLuongTuyen")) ? args.get("soLuongTuyen").asInt() : 1;
                    String salary = (args != null && args.has("mucLuong")) ? args.get("mucLuong").asText() : "Thỏa thuận";

                    if (title.isBlank()) {
                        result.put("status", "error");
                        result.put("message", "Tiêu đề vị trí tuyển dụng không được để trống.");
                    } else {
                        var dept = departmentRepository.findFirstByTenPhongContainingIgnoreCase(deptName).orElse(null);
                        Long deptId = dept != null ? dept.getId() : null;

                        String slugStr = toSlug(title) + "-" + System.currentTimeMillis();
                        String defaultCriteriaJson = "{\"experience_min\":1,\"hard_skills\":[],\"soft_skills\":[],\"education\":\"Đại học\"}";

                        JobPosting newJob = JobPosting.builder()
                                .title(title)
                                .description(desc)
                                .requirements(reqs)
                                .quyenLoi(benefits)
                                .soLuongTuyen(quantity > 0 ? quantity : 1)
                                .diaDiem("Trụ sở chính")
                                .hinhThucLamViec("Toàn thời gian")
                                .ngayBatDau(LocalDateTime.now())
                                .hanNopHoSo(LocalDateTime.now().plusDays(30))
                                .mucLuong(salary)
                                .coThoaThuan(salary.toLowerCase().contains("thỏa thuận") || salary.toLowerCase().contains("thoa thuan"))
                                .capBac("Nhân viên")
                                .targetRole(Role.NHAN_VIEN)
                                .departmentId(deptId)
                                .status(JobPostingStatus.DRAFT)
                                .slug(slugStr)
                                .criteriaDefinition(defaultCriteriaJson)
                                .build();

                        JobPosting savedDraft = jobPostingRepository.save(newJob);
                        JobPosting lockedJob = postingVersionLockService.lockInitialPair(savedDraft, 1L);
                        lockedJob.setStatus(JobPostingStatus.OPEN);
                        JobPosting savedOpenJob = jobPostingRepository.save(lockedJob);

                        log.info("[TelegramAI] Da tao va mo tin tuyen dung thanh cong: ID={}, Title={}, Dept={}", savedOpenJob.getId(), savedOpenJob.getTitle(), deptId);

                        result.put("status", "success");
                        result.put("jobId", savedOpenJob.getId());
                        result.put("title", savedOpenJob.getTitle());
                        result.put("phongBan", dept != null ? dept.getTenPhong() : "Chưa phân công");
                        result.put("trangThai", savedOpenJob.getStatus().name());
                        result.put("message", "Đã tạo và đăng tin tuyển dụng thành công lên CSDL hệ thống với ID=" + savedOpenJob.getId());
                    }
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

    private String toSlug(String input) {
        if (input == null) return "job";
        String nowhitespace = WHITESPACE.matcher(input).replaceAll("-");
        String normalized = Normalizer.normalize(nowhitespace, Normalizer.Form.NFD);
        String slug = NONLATIN.matcher(normalized).replaceAll("");
        return slug.toLowerCase(Locale.ENGLISH);
    }
}
