package com.hrm.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hrm.ai.entity.ChatMessage;
import com.hrm.ai.repository.ChatMessageRepository;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.PayrollReport;
import com.hrm.common.payroll.repository.PayrollReportRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.ai.entity.FaqCache;
import com.hrm.ai.repository.FaqCacheRepository;
import com.hrm.common.entity.SystemSetting;
import com.hrm.common.repository.SystemSettingRepository;
import com.hrm.chat.repository.ChatGroupRepository;
import com.hrm.chat.repository.ChatGroupMemberRepository;
import com.hrm.chat.repository.GroupMessageRepository;
import com.hrm.chat.entity.ChatGroup;
import com.hrm.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatbotService {

    private final GeminiClientService geminiClientService;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PayrollReportRepository payrollReportRepository;
    private final SystemSettingRepository systemSettingRepository;
    private final FaqCacheRepository faqCacheRepository;
    private final ChatGroupRepository chatGroupRepository;
    private final ChatGroupMemberRepository chatGroupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ChatMessage> getChatHistory(Long userId) {
        return chatMessageRepository.findByUserIdOrderByCreatedAtAsc(userId);
    }

    @Transactional
    public void clearHistory(Long userId) {
        chatMessageRepository.deleteByUserId(userId);
    }

    public String handleGroupMessage(Long groupId, Long senderId, String userMessage) {
        try {
            User user = userRepository.findById(senderId).orElse(null);
            if (user == null) {
                return "Xin lỗi, không tìm thấy thông tin người gửi.";
            }

            ChatGroup group = chatGroupRepository.findById(groupId).orElse(null);
            long memberCount = chatGroupMemberRepository.countByGroupId(groupId);

            // Fetch history from groupMessageRepository
            List<com.hrm.chat.entity.GroupMessage> rawGroupHistory = 
                    groupMessageRepository.findTop30ByGroupIdOrderByCreatedAtDesc(groupId);
            java.util.Collections.reverse(rawGroupHistory);
            
            List<ChatMessage> history = new java.util.ArrayList<>();
            java.time.format.DateTimeFormatter timeFormatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            for (com.hrm.chat.entity.GroupMessage gm : rawGroupHistory) {
                if (gm.isDeletedBySender() && gm.getSenderId() != null && gm.getSenderId().equals(senderId)) {
                    continue;
                }

                String role = gm.isAi() ? "model" : "user";
                String content = gm.isRecalled() ? "Tin nhắn đã bị thu hồi" : gm.getContent();
                if (!gm.isAi()) {
                    String senderNameCache = "Thành viên";
                    if (gm.getSenderId() != null) {
                        User sUser = userRepository.findById(gm.getSenderId()).orElse(null);
                        if (sUser != null) senderNameCache = sUser.getHoTen();
                    }
                    String timeStr = gm.getCreatedAt() != null ? gm.getCreatedAt().format(timeFormatter) : "N/A";
                    content = "[" + timeStr + "] [" + senderNameCache + "]: " + content;
                }
                history.add(ChatMessage.builder().role(role).content(content).build());
            }

            // Thêm tin nhắn hiện tại
            String currentTimeStr = java.time.LocalDateTime.now().format(timeFormatter);
            history.add(ChatMessage.builder().role("user").content("[" + currentTimeStr + "] [" + user.getHoTen() + "]: " + userMessage).build());

            String groupSystemPrompt = buildGroupSystemPrompt(user, group, memberCount);
            JsonNode tools = buildToolsDeclaration();

            return executeMultiTurnGemini(groupSystemPrompt, history, tools, user);
        } catch (Exception e) {
            log.error("Group AI Error", e);
            return "Xin lỗi, đã xảy ra lỗi khi AI xử lý.";
        }
    }

    @Transactional
    public String handleUserMessage(CustomUserDetails userDetails, String messageContent) {
        User user = userRepository.findById(userDetails.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 1. Lưu tin nhắn của user vào DB
        ChatMessage userMsg = ChatMessage.builder()
                .user(user)
                .role("user")
                .content(messageContent)
                .build();
        chatMessageRepository.save(userMsg);

        // Lấy lịch sử (giới hạn 30 tin nhắn gần nhất để không quá tải token)
        List<ChatMessage> rawHistory = chatMessageRepository.findByUserIdOrderByCreatedAtAsc(user.getId());
        if (rawHistory.size() > 30) {
            rawHistory = rawHistory.subList(rawHistory.size() - 30, rawHistory.size());
        }
        List<ChatMessage> history = new java.util.ArrayList<>(rawHistory);

        // --- BẮT ĐẦU: SEMANTIC CACHE ---
        String sensitiveKeywordsStr = "tôi,lương,phòng ban,duyệt,người,bao nhiêu,nghỉ phép";
        SystemSetting setting = systemSettingRepository.findByKey("chatbot_sensitive_keywords").orElse(null);
        if (setting != null) {
            sensitiveKeywordsStr = setting.getValue();
        }
        
        String[] sensitiveKeywords = sensitiveKeywordsStr.split(",");
        boolean isSensitive = false;
        String lowerMsg = messageContent.toLowerCase();
        for (String kw : sensitiveKeywords) {
            if (lowerMsg.contains(kw.trim().toLowerCase())) {
                isSensitive = true;
                break;
            }
        }

        String questionEmbedding = null;
        if (!isSensitive) {
            List<FaqCache> allCaches = faqCacheRepository.findAll();

            // 1. Tối ưu hóa & Dự phòng: Kiểm tra khớp chính xác tuyệt đối (Exact Match) bằng chuỗi trước
            FaqCache exactMatch = null;
            for (FaqCache cache : allCaches) {
                if (cache.getQuestion().trim().equalsIgnoreCase(messageContent.trim())) {
                    exactMatch = cache;
                    break;
                }
            }

            if (exactMatch != null) {
                log.info("🎯 [Exact Cache Hit] So khớp chính xác 100%% - Câu hỏi: {}", exactMatch.getQuestion());
                exactMatch.setHitCount(exactMatch.getHitCount() + 1);
                faqCacheRepository.save(exactMatch);

                ChatMessage assistantMsg = ChatMessage.builder()
                        .user(user)
                        .role("model")
                        .content(exactMatch.getAnswer())
                        .build();
                chatMessageRepository.save(assistantMsg);

                return exactMatch.getAnswer();
            }

            // 2. Nếu không khớp chính xác, dùng Semantic Search (Lấy embedding của câu hỏi hiện tại)
            questionEmbedding = geminiClientService.getEmbedding(messageContent);
            if (questionEmbedding != null) {
                float[] queryVector = parseEmbedding(questionEmbedding);
                if (queryVector != null) {
                    FaqCache bestMatch = null;
                    double bestScore = -1.0;

                    for (FaqCache cache : allCaches) {
                        float[] cacheVector = parseEmbedding(cache.getQuestionEmbedding());
                        
                        // Self-healing: Nếu cacheVector bị null (do người dùng thêm tay vào DB mà không có embedding, hoặc copy nhầm chuỗi)
                        if (cacheVector == null) {
                            String newEmbeddingStr = geminiClientService.getEmbedding(cache.getQuestion());
                            if (newEmbeddingStr != null) {
                                cache.setQuestionEmbedding(newEmbeddingStr);
                                faqCacheRepository.save(cache);
                                cacheVector = parseEmbedding(newEmbeddingStr);
                            }
                        }

                        if (cacheVector != null) {
                            double score = cosineSimilarity(queryVector, cacheVector);
                            // Giảm ngưỡng từ 0.85 xuống 0.72 để bắt được các câu hỏi có ngữ nghĩa tương đương nhưng dùng từ ngữ khác nhau
                            if (score > 0.72 && score > bestScore) {
                                bestScore = score;
                                bestMatch = cache;
                            }
                        }
                    }

                    if (bestMatch != null) {
                        log.info("🎯 [Semantic Cache Hit] Tỉ lệ khớp: {} - Câu hỏi: {}", bestScore, bestMatch.getQuestion());
                        
                        // Cập nhật hit count
                        bestMatch.setHitCount(bestMatch.getHitCount() + 1);
                        faqCacheRepository.save(bestMatch);

                        // Lưu câu trả lời từ Cache vào DB
                        ChatMessage assistantMsg = ChatMessage.builder()
                                .user(user)
                                .role("model")
                                .content(bestMatch.getAnswer())
                                .build();
                        chatMessageRepository.save(assistantMsg);

                        return bestMatch.getAnswer();
                    }
                }
            }
        }
        // --- KẾT THÚC: SEMANTIC CACHE ---

        // 2. Tạo System Prompt theo phân quyền
        String systemPrompt = buildSystemPrompt(user);

        // 3. Chuẩn bị mảng Tools (Function Calling)
        JsonNode tools = buildToolsDeclaration();

        // 4. Gọi Gemini
        String finalAnswer = executeMultiTurnGemini(systemPrompt, history, tools, user);

        // --- BẮT ĐẦU: LƯU CACHE TỰ ĐỘNG ---
        if (!isSensitive && finalAnswer != null && !finalAnswer.isEmpty() && questionEmbedding != null) {
            // Không lưu cache nếu AI từ chối trả lời do phân quyền hoặc không biết
            if (!finalAnswer.toLowerCase().contains("xin lỗi") && 
                !finalAnswer.toLowerCase().contains("không thể cung cấp") && 
                !finalAnswer.toLowerCase().contains("quyền hạn")) {
                
                FaqCache newCache = FaqCache.builder()
                        .question(messageContent)
                        .questionEmbedding(questionEmbedding)
                        .answer(finalAnswer)
                        .hitCount(0)
                        .build();
                faqCacheRepository.save(newCache);
                log.info("✅ [Semantic Cache Saved] Đã lưu câu hỏi vào FAQ Cache.");
            }
        }
        // --- KẾT THÚC: LƯU CACHE TỰ ĐỘNG ---

        // 7. Lưu tin nhắn của Assistant vào DB
        ChatMessage assistantMsg = ChatMessage.builder()
                .user(user)
                .role("model")
                .content(finalAnswer)
                .build();
        chatMessageRepository.save(assistantMsg);

        return finalAnswer;
    }

    private String buildSystemPrompt(User user) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bạn là AI Assistant thông minh của hệ thống quản trị nhân sự HRM-AI-Web. ");
        sb.append("Nhiệm vụ của bạn là hỗ trợ nhân viên giải đáp thắc mắc liên quan đến công ty, nhân sự, quy trình. ");
        sb.append("TUYỆT ĐỐI KHÔNG trả lời các câu hỏi không liên quan đến công ty hoặc hệ thống này. ");
        
        sb.append("THÔNG TIN VỀ NGƯỜI DÙNG HIỆN TẠI (Đang chat với bạn):\n");
        sb.append("- Tên: ").append(user.getHoTen()).append("\n");
        sb.append("- Cấp bậc (Role): ").append(user.getRole().name()).append("\n");
        
        if (user.getDepartmentId() != null) {
            Department dept = departmentRepository.findById(user.getDepartmentId()).orElse(null);
            if (dept != null) {
                sb.append("- Phòng ban (Department ID): ").append(user.getDepartmentId())
                  .append(" (").append(dept.getTenPhong()).append(")\n");
            }
        }

        sb.append("\nRÀNG BUỘC QUYỀN HẠN (QUAN TRỌNG):\n");
        sb.append("1. Bạn phải từ chối trả lời nếu người dùng hỏi thông tin nội bộ của các phòng ban khác (khác Department ID của họ), NGOẠI TRỪ role là CEO hoặc ADMIN.\n");
        sb.append("2. Không được cung cấp các thông tin nhạy cảm của cấp trên (VD: nhân viên không được hỏi lương giám đốc).\n");
        sb.append("3. Nếu người dùng muốn biết các dữ liệu động (như số nhân viên phòng mình), hãy sử dụng function (tools) để truy vấn.\n");
        sb.append("4. Nếu dữ liệu trả về từ tools báo 'Truy cập bị từ chối', hãy xin lỗi và nói rằng họ không có quyền.\n");
        sb.append("5. LƯU Ý VỀ PHÂN CẤP ROLE: CEO > DIRECTOR (Giám đốc) > MANAGER (Trưởng phòng) > EMPLOYEE (Nhân viên). Khi trả lời về số lượng 'nhân viên dưới quyền', BẠN PHẢI nhìn vào roleDistribution và CHỈ tính tổng số lượng của các Role có cấp bậc thấp hơn Role của người hỏi (Ví dụ: MANAGER hỏi thì chỉ đếm số lượng EMPLOYEE, tuyệt đối không tính chính họ hoặc DIRECTOR).\n");

        return sb.toString();
    }

    private String buildGroupSystemPrompt(User user, ChatGroup group, long memberCount) {
        String groupName = group != null ? group.getName() : "Không xác định";
        StringBuilder sb = new StringBuilder();
        sb.append("Bạn là AI Assistant hỗ trợ trong nhóm chat công việc. ");
        sb.append("Tên nhóm: ").append(groupName).append(". Số lượng thành viên: ").append(memberCount).append(" người.\n");
        sb.append("Lịch sử chat của nhóm đã được cung cấp trong danh sách tin nhắn. Bạn hãy dựa vào ngữ cảnh của nhóm chat để trả lời.\n\n");
        
        sb.append("RÀNG BUỘC (QUAN TRỌNG):\n");
        sb.append("1. BẠN CHỈ TRẢ LỜI CÁC CÂU HỎI LIÊN QUAN ĐẾN CÔNG TY, NHÂN SỰ VÀ NGỮ CẢNH NHÓM CHAT.\n");
        sb.append("2. TỪ CHỐI TẤT CẢ CÁC CÂU HỎI NGOÀI LỀ (ví dụ: thời tiết, giải trí, kiến thức phổ thông, hoặc các vấn đề không liên quan đến hệ thống quản trị nhân sự). Hãy trả lời ngắn gọn: 'Xin lỗi, tôi chỉ hỗ trợ các nghiệp vụ liên quan đến công ty và nhóm chat này'.\n");
        
        sb.append("\nTHÔNG TIN VỀ NGƯỜI ĐANG TRỰC TIẾP HỎI BẠN:\n");
        sb.append("- Tên: ").append(user.getHoTen()).append("\n");
        sb.append("- Cấp bậc (Role): ").append(user.getRole().name()).append("\n");
        
        if (user.getDepartmentId() != null) {
            Department dept = departmentRepository.findById(user.getDepartmentId()).orElse(null);
            if (dept != null) {
                sb.append("- Phòng ban (Department ID): ").append(user.getDepartmentId())
                  .append(" (").append(dept.getTenPhong()).append(")\n");
            }
        }

        sb.append("\nRÀNG BUỘC QUYỀN HẠN:\n");
        sb.append("1. Bạn phải từ chối trả lời nếu người dùng hỏi thông tin nội bộ của các phòng ban khác (khác Department ID của họ), NGOẠI TRỪ role là CEO hoặc ADMIN.\n");
        sb.append("2. Nếu người dùng muốn biết số lượng nhân sự, hãy sử dụng function (tools) để truy vấn.\n");
        sb.append("3. LƯU Ý VỀ PHÂN CẤP ROLE: CEO > DIRECTOR (Giám đốc) > MANAGER (Trưởng phòng) > EMPLOYEE (Nhân viên). Khi trả lời về số lượng 'nhân viên dưới quyền', CHỈ tính tổng số lượng của các Role thấp hơn Role của người hỏi.\n");

        return sb.toString();
    }

    private JsonNode buildToolsDeclaration() {
        // Build JSON Tools declaration for Gemini
        ObjectMapper mapper = new ObjectMapper();
        ArrayNode tools = mapper.createArrayNode();
        
        ObjectNode toolItem = tools.addObject();
        ArrayNode funcDecls = toolItem.putArray("function_declarations");

        // Tool 1: Lấy số lượng nhân viên của 1 phòng ban
        ObjectNode func1 = funcDecls.addObject();
        func1.put("name", "get_department_employee_count");
        func1.put("description", "Truy vấn số lượng nhân viên hiện tại của một phòng ban cụ thể dựa vào Department ID.");
        ObjectNode params1 = func1.putObject("parameters");
        params1.put("type", "OBJECT");
        ObjectNode props1 = params1.putObject("properties");
        ObjectNode deptNameProp = props1.putObject("departmentName");
        deptNameProp.put("type", "STRING");
        deptNameProp.put("description", "Tên phòng ban cần tra cứu (ví dụ: Tài chính, Kế toán, IT, Nhân sự...)");
        params1.putArray("required").add("departmentName");

        // Tool 2: Lấy trạng thái báo cáo lương
        ObjectNode func2 = funcDecls.addObject();
        func2.put("name", "check_payroll_status");
        func2.put("description", "Kiểm tra xem báo cáo lương tháng và năm cụ thể của phòng ban người dùng đã được duyệt chưa.");
        ObjectNode params2 = func2.putObject("parameters");
        params2.put("type", "OBJECT");
        ObjectNode props2 = params2.putObject("properties");
        
        ObjectNode monthProp = props2.putObject("month");
        monthProp.put("type", "INTEGER");
        monthProp.put("description", "Tháng cần tra cứu (1-12)");
        
        ObjectNode yearProp = props2.putObject("year");
        yearProp.put("type", "INTEGER");
        yearProp.put("description", "Năm cần tra cứu (ví dụ: 2026)");
        
        params2.putArray("required").add("month").add("year");

        // Tool 3: Lấy danh sách phòng ban
        ObjectNode func3 = funcDecls.addObject();
        func3.put("name", "get_all_departments");
        func3.put("description", "Truy vấn số lượng và danh sách tất cả các phòng ban hiện có trong công ty.");
        ObjectNode params3 = func3.putObject("parameters");
        params3.put("type", "OBJECT");
        params3.putObject("properties");

        return tools;
    }

    private String executeMultiTurnGemini(String systemPrompt, List<ChatMessage> history, JsonNode tools, User user) {
        String rawResponse1;
        try {
            rawResponse1 = geminiClientService.callGeminiChat(systemPrompt, history, tools).block();
        } catch (Exception e) {
            log.error("Lỗi khi gọi Gemini Lượt 1: ", e);
            return "Xin lỗi, tôi đang gặp sự cố kết nối tới máy chủ AI (Lỗi: " + e.getMessage() + "). Vui lòng thử lại sau!";
        }
        
        String finalAnswer = "";

        // Kiểm tra xem Gemini có gọi Function hay không
        try {
            JsonNode root = objectMapper.readTree(rawResponse1);
            JsonNode candidates = root.get("candidates");
            if (candidates != null && candidates.isArray() && candidates.size() > 0) {
                JsonNode parts = candidates.get(0).get("content").get("parts");
                
                boolean hasFunctionCall = false;
                if (parts != null && parts.isArray() && parts.size() > 0) {
                    JsonNode functionCallPart = null;
                    JsonNode textPart = null;
                    
                    // Tìm kiếm functionCall hoặc text trong tất cả các parts
                    for (JsonNode part : parts) {
                        if (part.has("functionCall")) {
                            functionCallPart = part;
                            hasFunctionCall = true;
                            break;
                        } else if (part.has("text") && textPart == null) {
                            textPart = part;
                        }
                    }

                    if (hasFunctionCall) {
                        JsonNode functionCall = functionCallPart.get("functionCall");
                        String functionName = functionCall.get("name").asText();
                        JsonNode args = functionCall.get("args");
                        
                        log.info("Gemini requested function: {} with args: {}", functionName, args);
                        
                        // 5. Thực thi Function cục bộ
                        JsonNode functionResult = executeFunction(functionName, args, user);
                        
                        // 6. Đóng gói kết quả Function Response và tạo History mới cho lượt 2
                        ChatMessage modelToolMsg = ChatMessage.builder()
                                .role("model")
                                .content("Đã gọi hàm " + functionName + " để truy vấn.")
                                .build();
                        history.add(modelToolMsg);
                        
                        String toolOutputStr = String.format("Hệ thống đã truy vấn Database với hàm '%s'. Kết quả JSON là: %s", 
                                functionName, functionResult.toString());
                        
                        ChatMessage systemToolMsg = ChatMessage.builder()
                                .role("user") 
                                .content(toolOutputStr)
                                .build();
                        history.add(systemToolMsg);
                        
                        // Gọi Gemini Lượt 2 để tóm tắt kết quả
                        String rawResponse2 = geminiClientService.callGeminiChat(systemPrompt, history, null).block();
                        finalAnswer = geminiClientService.extractTextFromGeminiResponse(rawResponse2);
                    } else if (textPart != null) {
                        finalAnswer = textPart.get("text").asText();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Lỗi khi parse response từ Gemini: ", e);
            finalAnswer = "Xin lỗi, tôi gặp sự cố khi xử lý câu trả lời. Chi tiết lỗi: " + e.getMessage();
        }
        
        if (finalAnswer == null || finalAnswer.trim().isEmpty()) {
            finalAnswer = geminiClientService.extractTextFromGeminiResponse(rawResponse1);
        }
        
        return finalAnswer;
    }

    /**
     * Hàm thực thi logic cục bộ khi AI yêu cầu
     */
    private JsonNode executeFunction(String functionName, JsonNode args, User user) {
        ObjectNode result = objectMapper.createObjectNode();
        try {
            if ("get_department_employee_count".equals(functionName)) {
                if (args == null || !args.has("departmentName")) {
                    result.put("status", "error");
                    result.put("message", "Thiếu tham số departmentName");
                    return result;
                }
                String targetDeptName = args.get("departmentName").asText();
                Department dept = departmentRepository.findFirstByTenPhongContainingIgnoreCase(targetDeptName).orElse(null);
                
                if (dept == null) {
                    result.put("status", "error");
                    result.put("message", "Không tìm thấy phòng ban nào có tên chứa từ khóa: " + targetDeptName);
                    return result;
                }
                
                Long targetDeptId = dept.getId();
                
                // Kiểm tra quyền hạn
                boolean isAdmin = "ADMIN".equals(user.getRole().name()) || "CEO".equals(user.getRole().name());
                boolean isSameDept = user.getDepartmentId() != null && user.getDepartmentId().equals(targetDeptId);
                
                if (isAdmin || isSameDept) {
                        int count = (int) userRepository.countByDepartmentId(targetDeptId);
                        result.put("status", "success");
                        result.put("departmentName", dept.getTenPhong());
                        result.put("employeeCount", count);
                        
                        // Chi tiết số lượng theo cấp bậc (role)
                        ObjectNode rolesNode = result.putObject("roleDistribution");
                        java.util.List<Object[]> roleDist = userRepository.getRoleDistributionByDepartmentId(targetDeptId);
                        for (Object[] row : roleDist) {
                            if (row[0] != null && row[1] != null) {
                                rolesNode.put(row[0].toString(), (Long) row[1]);
                            }
                        }
                } else {
                    result.put("status", "access_denied");
                    result.put("message", "User không có quyền xem thông tin của phòng ban này.");
                }
            } else if ("check_payroll_status".equals(functionName)) {
                if (args == null || !args.has("month") || !args.has("year")) {
                    result.put("status", "error");
                    result.put("message", "Thiếu tham số month hoặc year");
                    return result;
                }
                int month = args.get("month").asInt();
                int year = args.get("year").asInt();
                
                if (user.getDepartmentId() == null) {
                    result.put("status", "error");
                    result.put("message", "User không thuộc phòng ban nào.");
                } else {
                    Long deptId = user.getDepartmentId();
                    // Lấy báo cáo cấp phòng ban
                    var reports = payrollReportRepository.findByDepartmentIdAndMonthAndYearAndReportLevel(deptId, month, year, "DEPARTMENT");
                    PayrollReport report = reports.isEmpty() ? null : reports.get(0);
                    if (report == null) {
                        result.put("status", "success");
                        result.put("reportStatus", "Chưa có báo cáo nào được tạo");
                    } else {
                        result.put("status", "success");
                        result.put("reportStatus", report.getStatus());
                    }
                }
            } else if ("get_all_departments".equals(functionName)) {
                java.util.List<Department> depts = departmentRepository.findAll();
                result.put("status", "success");
                result.put("count", depts.size());
                ArrayNode deptArray = result.putArray("departments");
                for (Department d : depts) {
                    deptArray.add(d.getTenPhong());
                }
            } else {
                result.put("status", "error");
                result.put("message", "Unknown function.");
            }
        } catch (Exception e) {
            result.put("status", "error");
            result.put("message", "Lỗi thực thi: " + e.getMessage());
        }
        return result;
    }

    private float[] parseEmbedding(String embeddingJsonStr) {
        if (embeddingJsonStr == null || embeddingJsonStr.isEmpty()) return null;
        try {
            JsonNode arrayNode = objectMapper.readTree(embeddingJsonStr);
            if (arrayNode.isArray()) {
                float[] result = new float[arrayNode.size()];
                for (int i = 0; i < arrayNode.size(); i++) {
                    result[i] = (float) arrayNode.get(i).asDouble();
                }
                return result;
            }
        } catch (Exception e) {
            log.error("Lỗi parse array float từ JSON embedding: ", e);
        }
        return null;
    }

    private double cosineSimilarity(float[] vectorA, float[] vectorB) {
        if (vectorA == null || vectorB == null || vectorA.length != vectorB.length) return 0.0;
        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += Math.pow(vectorA[i], 2);
            normB += Math.pow(vectorB[i], 2);
        }
        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
