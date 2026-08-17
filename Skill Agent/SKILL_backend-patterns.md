---
name: -hrm-backend-patterns
description: "Chuẩn kiến trúc & bảo mật backend Java Spring Boot cho  HRM (Tuyển dụng AI + Chấm công AI + Lương). LUÔN dùng skill này khi viết/sửa Controller, Service, Repository, Entity, hoặc Security config — kể cả khi user chỉ nói 'thêm API cho X'. Đây là chuẩn bắt buộc."
risk: safe
source: project-specific
date_added: "2026-08-17"
---
# Backend Patterns —  HRM (Spring Boot)

## 1. Kiến trúc layered, tổ chức theo module nghiệp vụ

```
backend/src/main/java/com//hrm/
├── config/
│   ├── SecurityConfig.java        # Spring Security filter chain, CORS, session STATELESS
│   ├── WebSocketConfig.java       # STOMP endpoint cho trung tâm thông báo
│   └── GeminiConfig.java          # WebClient/RestTemplate bean gọi Gemini API
├── security/
│   ├── JwtAuthFilter.java         # tương đương verifyToken cũ — filter chạy trước Controller
│   ├── JwtUtil.java               # sinh/verify token, đọc JWT_SECRET từ biến môi trường
│   └── CustomUserDetails.java     # chứa role + department_id lấy từ claim JWT
├── common/
│   ├── recruitment/
│   │   ├── controller/ service/ repository/ entity/ dto/
│   ├── attendance/
│   │   ├── controller/ service/ repository/ entity/ dto/
│   └── payroll/
│       ├── controller/ service/ repository/ entity/ dto/
├── ai/
│   ├── GeminiClientService.java         # gọi Gemini API dùng chung, KHÔNG gọi trực tiếp từ Controller
│   ├── CvExtractionService.java         # OCR/trích xuất CV+CCCD qua Gemini multimodal
│   ├── SemanticFitScoreService.java     # so khớp CV vs JD
│   ├── FraudDetectionService.java       # kiểm tra logic nội tại + trùng lặp
│   ├── InterviewQuestionService.java    # sinh câu hỏi tình huống động
│   ├── RecruiterDigestService.java      # tổng hợp hằng ngày (@Scheduled)
│   └── DecisionLogService.java          # DUY NHẤT nơi ghi ai_decision_logs
├── notification/
│   ├── NotificationService.java   # tạo + đẩy thông báo (DB + WebSocket)
│   ├── NotificationController.java
│   └── entity/ dto/
└── exception/
    └── GlobalExceptionHandler.java  # @ControllerAdvice, không leak stack trace
```

**Cấm:** viết logic nghiệp vụ trong Controller. Controller chỉ nhận request → validate (`@Valid`) → gọi Service → trả response. Không tự tạo cấu trúc khác đi (VD: gộp module logistics không thuộc phạm vi dự án này — chỉ có recruitment/attendance/payroll).

## 2. Quy trình bắt buộc trước khi code

Đề xuất ngắn (mục tiêu, package/class sẽ động vào, hướng kỹ thuật, ảnh hưởng module khác) → chờ duyệt → mới code. Xem đầy đủ README mục 0.

## 3. Bảo mật — chuỗi bắt buộc, tương đương/mạnh hơn middleware Node cũ

| Bước cũ (Node)                           | Cơ chế Spring Boot bắt buộc                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `verifyToken`                             | `JwtAuthFilter` (extends `OncePerRequestFilter`) + `SessionCreationPolicy.STATELESS`                                                                                                                                           |
| `validateRequest`                         | Bean Validation (`@Valid`, `@NotNull`, `@Size`...) trên DTO ngay ở Controller                                                                                                                                                |
| `authorizeRole`                           | `@PreAuthorize("hasRole('MANAGER')")` khai báo trực tiếp trên method — rõ ràng, khó bị quên hơn check thủ công                                                                                                        |
| `checkOwnership`/`checkDepartmentScope` | Kiểm tra tường minh trong Service: so`departmentId` của resource với `departmentId` lấy từ `CustomUserDetails` (JWT đã verify) — KHÔNG BAO GIỜ tin `departmentId`/`userId`/`role` gửi từ client body/query |

```java
@JwtAuthFilter (tóm tắt ý tưởng, không phải code đầy đủ)
public class JwtAuthFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) {
        String token = extractToken(req);
        if (token != null && jwtUtil.isValid(token)) {
            CustomUserDetails user = jwtUtil.parseUser(token); // chứa role + departmentId
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities())
            );
        }
        chain.doFilter(req, res);
    }
}
```

JWT payload bắt buộc chứa `role` (1 trong 3: `NHAN_VIEN` | `TRUONG_PHONG` | `GIAM_DOC`) và `departmentId` — để Service kiểm tra scope mà không cần query lại DB cho việc xác thực.

### 3.1. Ngoại lệ bắt buộc — module Tuyển dụng KHÔNG kiểm tra department scope

```java
// Recruitment: chỉ cần @PreAuthorize theo role, KHÔNG có bước so departmentId
@PreAuthorize("hasAnyRole('TRUONG_PHONG', 'GIAM_DOC')")
@GetMapping("/api/recruitment/applications")
public ResponseEntity<?> getApplications() { ... }

// Attendance/Payroll: PHẢI kiểm tra departmentId trong Service
public void approveAttendanceException(Long id, CustomUserDetails currentUser) {
    if (currentUser.getRole() == Role.GIAM_DOC) { /* toàn quyền */ }
    else if (currentUser.getRole() == Role.TRUONG_PHONG) {
        Attendance record = repository.findById(id).orElseThrow();
        Employee emp = employeeRepository.findById(record.getEmployeeId()).orElseThrow();
        if (!emp.getDepartmentId().equals(currentUser.getDepartmentId())) {
            throw new AccessDeniedException("Không có quyền với dữ liệu ngoài phòng ban");
        }
    }
}
```

Nếu thấy code nào tự thêm kiểm tra `departmentId` vào Service/Controller của module Tuyển dụng — đó là lỗi, phải sửa lại, không "thêm cho chắc".

### 3.2. Route public apply — KHÔNG qua JwtAuthFilter

```java
// SecurityConfig.java
.requestMatchers("/public/apply/**").permitAll()
```

Endpoint public chỉ cần Bean Validation + rate limiting (Spring `Bucket4j` hoặc tương đương) + honeypot field + CAPTCHA nếu đã có sẵn từ trước — không JWT.

## 4. Bảng mapping quyền theo route (tham chiếu bắt buộc)

| Route                                                 | Auth   | `@PreAuthorize`                                           | Kiểm tra department scope |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------- | -------------------------- |
| `POST /public/apply/{jobSlug}`                      | Không | — (public)                                                 | Không                     |
| `POST /api/recruitment/job-postings`                | Có    | `TRUONG_PHONG`, `GIAM_DOC`                              | **Không**           |
| `GET /api/recruitment/applications`                 | Có    | `TRUONG_PHONG`, `GIAM_DOC`                              | **Không**           |
| `PATCH /api/recruitment/applications/{id}/decision` | Có    | `TRUONG_PHONG`, `GIAM_DOC`                              | **Không**           |
| `POST /api/attendance/check-in`                     | Có    | mọi role đã đăng nhập (chính chủ)                   | Không cần (tạo mới)    |
| `PATCH /api/attendance/{id}/approve-exception`      | Có    | `TRUONG_PHONG`, `GIAM_DOC`                              | **Có**              |
| `GET /api/payroll/{id}`                             | Có    | chủ bản ghi,`TRUONG_PHONG` (cùng phòng), `GIAM_DOC` | **Có**              |
| `POST /api/payroll/generate`                        | Có    | `TRUONG_PHONG`, `GIAM_DOC`                              | **Có**              |

Route mới chưa có trong bảng → đề xuất bổ sung theo quy trình mục 2, không tự suy đoán quyền.

## 5. Chống SQL Injection

Dùng JPA (Spring Data) hoặc `PreparedStatement` — tuyệt đối không nối chuỗi SQL/JPQL với input client.

```java
// SAI
entityManager.createQuery("SELECT u FROM User u WHERE u.email = '" + email + "'");
// ĐÚNG — Spring Data JPA tự parameterize
Optional<User> findByEmail(String email); // trong UserRepository extends JpaRepository
```

Password hash bằng `BCryptPasswordEncoder` (bean có sẵn của Spring Security), không tự viết hàm hash.

## 6. Gemini API — cấu hình dùng chung, model bắt buộc

```java
// ai/GeminiConfig.java
@Bean
public WebClient geminiWebClient(@Value("${gemini.api-key}") String apiKey) {
    return WebClient.builder()
        .baseUrl("https://generativelanguage.googleapis.com/v1beta")
        .defaultHeader("x-goog-api-key", apiKey)
        .build();
}
```

- **Model bắt buộc: `gemini-3.5-flash`.** Tuyệt đối không dùng `gemini-2.5-flash`/`gemini-2.5-pro` (Google ngừng hoạt động dòng 2.5 từ 16/10/2026 — dùng sẽ hỏng giữa chừng dự án hoặc lúc demo/bảo vệ).
- `GEMINI_API_KEY` bắt buộc từ biến môi trường, throw lỗi khi khởi động nếu thiếu — không hardcode.
- Mọi service AI (`ai/*Service.java`) gọi qua `GeminiClientService` dùng chung, không tự tạo `WebClient` riêng ở từng service.
- **Gemini nhận trực tiếp file PDF/ảnh (multimodal) — CHỐT làm theo hướng này, không dùng OCR truyền thống (Tesseract):** lý do chính xác hơn hẳn cho CV có layout tự do và ảnh CCCD chụp thực tế (ánh sáng/góc nghiêng), đồng thời gộp OCR + tách field thành 1 bước, giảm lỗi cộng dồn so với pipeline 2 bước cũ.
- `GEMINI_API_KEY` bắt buộc từ biến môi trường, throw lỗi khi khởi động nếu thiếu — không hardcode.
- Mọi service AI (`ai/*Service.java`) gọi qua `GeminiClientService` dùng chung, không tự tạo `WebClient` riêng ở từng service.
- Timeout + retry: mọi call Gemini phải có xử lý lỗi/timeout, không để cả luồng nghiệp vụ crash chỉ vì AI không phản hồi kịp — luôn có fallback trạng thái "chờ xử lý thủ công".

### 6.1. `CvExtractionService` — pipeline hybrid theo ngưỡng tin cậy (bắt buộc, không bỏ qua bước validate)

Chính xác nhất KHÔNG có nghĩa là tin tuyệt đối vào Gemini — bắt buộc 2 lớp:

1. **Lớp trích xuất (Gemini multimodal):** gửi thẳng file CV (PDF) và ảnh CCCD kèm prompt yêu cầu trả về **JSON có cấu trúc cố định schema**, mỗi field đi kèm 1 điểm `confidence` (0-1). Prompt phải yêu cầu rõ: nếu không chắc/không đọc được, trả `null` + confidence thấp, **cấm tự suy đoán/bịa giá trị** cho field không rõ.

```java
// ai/CvExtractionService.java — ý tưởng, không phải code đầy đủ
public ExtractedCvData extractFromCv(byte[] cvFileBytes, byte[] cccdImageBytes) {
    String prompt = """
        Trích xuất thông tin từ CV và CCCD sau, trả về JSON đúng schema:
        {"hoTen": {"value": "", "confidence": 0.0}, "ngaySinh": {...}, "cccd": {...}, ...}
        Nếu không đọc rõ hoặc không có thông tin, để value = null và confidence thấp.
        TUYỆT ĐỐI không tự suy đoán/bịa giá trị khi không chắc chắn.
        """;
    // gọi geminiClientService.generateContent(prompt, cvFileBytes, cccdImageBytes)
    // parse JSON response thành ExtractedCvData
}
```

2. **Lớp validate xác định (deterministic, không AI):** sau khi có JSON, chạy quy tắc cố định cho field có format rõ ràng — CCCD đúng 12 số, email đúng regex, SĐT đúng định dạng VN. Field nào Gemini trả nhưng sai format → tự động hạ `confidence` xuống thấp bất kể Gemini báo gì.
3. Field nào có `confidence` dưới ngưỡng cấu hình (VD: 0.7) → đánh dấu "cần xác minh thủ công" trên UI (ô input tô vàng/cảnh báo), không tự động chấp nhận giá trị đó vào hồ sơ chính thức cho tới khi người dùng (Trưởng phòng hoặc chính ứng viên ở bước xác nhận public apply) xác nhận lại.

## 7. AI Decision Log — cơ chế dùng chung, không phải bảng log riêng từng tính năng

```java
// ai/DecisionLogService.java — nơi DUY NHẤT ghi ai_decision_logs
@Service
public class DecisionLogService {
    public void logDecision(Long applicationId, String decisionType, Double score,
                             String reasoning, String source, Long overriddenBy) {
        AiDecisionLog log = new AiDecisionLog(applicationId, decisionType, score, reasoning, source, overriddenBy);
        repository.save(log);
    }
}
```

`SemanticFitScoreService` và `FraudDetectionService` đều gọi `DecisionLogService.logDecision(...)` để ghi kết quả — không tự `save` trực tiếp vào bảng log ở nơi khác. Khi `TRUONG_PHONG`/`GIAM_DOC` override quyết định AI, gọi lại với `source = "MANUAL"` và `overriddenBy = currentUser.getId()`.

**Triết lý AI-as-advisor:** AI không bao giờ tự động loại/từ chối hồ sơ — chỉ chấm điểm + gắn cờ + giải thích, người có thẩm quyền luôn quyết định cuối.

**Khuyến nghị nâng cao (tận dụng thế mạnh Java):** cân nhắc dùng **AOP (`@Aspect`)** để tự động ghi log quanh các method nhạy cảm (duyệt hồ sơ, đổi quyền) thay vì gọi `logDecision` thủ công rải rác — giảm khả năng bỏ sót. Chỉ làm nếu còn thời gian, không bắt buộc cho MVP.

## 8. Chấm công AI — backend chỉ xử lý vector, không xử lý ảnh

```java
// attendance/service/FaceMatchService.java
public double cosineSimilarity(double[] vecA, double[] vecB) {
    double dot = 0, magA = 0, magB = 0;
    for (int i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        magA += vecA[i] * vecA[i];
        magB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
// threshold đọc từ application.yml, KHÔNG hardcode số trong code
```

Backend chỉ nhận `embeddingVector` (mảng số) từ client, KHÔNG bao giờ nhận/lưu file ảnh khuôn mặt. Nếu endpoint nào nhận file ảnh cho chấm công, đó là sai kiến trúc — dừng lại và báo cáo.

## 9. File upload — Cloudinary, không lưu BLOB

- `MultipartFile` nhận trong Controller → chuyển buffer → upload Cloudinary SDK Java → lưu `secureUrl` + `publicId` vào entity tương ứng (`ApplicationFile`).
- Giới hạn 5MB/file (`spring.servlet.multipart.max-file-size`), chỉ nhận `application/pdf`, `image/jpeg`, `image/png`.
- Folder Cloudinary: `/cv/`, `/cccd/`.

## 10. Hệ thống thông báo — WebSocket (STOMP) thay Socket.io

```java
// notification/NotificationService.java
@Service
public class NotificationService {
    public void createNotification(Long userId, String loai, String tieuDe, String noiDung,
                                    String mucDo, String lienKet) {
        Notification n = notificationRepository.save(new Notification(userId, loai, tieuDe, noiDung, mucDo, lienKet));
        messagingTemplate.convertAndSendToUser(
            userId.toString(), "/queue/notifications", n
        );
    }
}
```

Mọi sự kiện cần thông báo (hồ sơ mới nộp, Recruiter Digest hằng ngày, cờ gian lận, chấm công ngoại lệ cần duyệt) gọi qua `NotificationService` — không tự gửi WebSocket rời rạc từ Controller. Sự kiện nghiêm trọng (cờ gian lận CV) dùng `mucDo = "khan"` → frontend bắt buộc hiện popup chặn màn hình.

```sql
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  loai VARCHAR(50) NOT NULL,
  tieu_de VARCHAR(255) NOT NULL,
  noi_dung TEXT,
  muc_do VARCHAR(20) DEFAULT 'binh_thuong',
  da_doc BOOLEAN DEFAULT FALSE,
  lien_ket VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 11. Response format chuẩn

```json
{ "success": true, "data": {}, "message": "..." }
```

Dùng `@ControllerAdvice` (`GlobalExceptionHandler`) xử lý lỗi tập trung — không tự `try/catch` trả lỗi rải rác từng Controller, không leak stack trace/thông tin DB ra response.

## 12. Checklist tự kiểm tra sau khi code xong 1 API

- [ ] Route có `JwtAuthFilter` áp dụng trừ `/public/apply/**`?
- [ ] Route tuyển dụng KHÔNG kiểm tra `departmentId`, route chấm công/lương CÓ?
- [ ] Dùng đúng Spring Data JPA/PreparedStatement, không nối chuỗi SQL/JPQL?
- [ ] Quyền lấy từ `CustomUserDetails` (JWT đã verify), không tin client?
- [ ] DTO có `@Valid`/Bean Validation trước khi vào Service?
- [ ] Response đúng format `{success, data, message}`?
- [ ] File đính kèm qua Cloudinary, không lưu BLOB?
- [ ] Face embedding chỉ lưu vector, không lưu ảnh?
- [ ] Gọi Gemini dùng đúng model `gemini-3.5-flash`, không phải dòng `2.5-*`?
- [ ] Quyết định AI ghi qua `DecisionLogService`, không tự insert nơi khác?
- [ ] Thông báo qua `NotificationService` (WebSocket), không tự gửi rời rạc?
