# README —  HRM: Hệ Thống Tuyển Dụng & Chấm Công AI

> File này là nguồn sự thật duy nhất cho agent (Antigravity). Đọc lại bản mới nhất trước khi bắt đầu bất kỳ task nào. Không tự ý đổi kiến trúc, vai trò, hay bỏ qua bước bảo mật.

---

## 0. QUY TRÌNH LÀM VIỆC — BẮT BUỘC

### 0.1. Đề xuất trước — Duyệt mới được code

Trước khi viết code cho bất kỳ chức năng mới/thay đổi nào: dừng lại → đưa đề xuất ngắn (mục tiêu, file/module sẽ động vào, hướng kỹ thuật, ảnh hưởng module khác nếu có) → chờ duyệt → chỉ code sau khi được duyệt. Mỗi chức năng là 1 vòng đề xuất riêng, không gộp nhiều việc vào 1 đề xuất.

### 0.2. Đi từ nhỏ đến lớn

Theo đúng thứ tự mục 9 (Thứ tự triển khai). Không nhảy bước khi bước trước chưa xong và chưa xác nhận chạy đúng.

### 0.3. Tự kiểm tra 2 lớp trước khi báo "xong"

- **Lớp code:** không lỗi cú pháp/logic, nhất quán naming/response format với phần đã có, đối chiếu checklist bảo mật mục 8 nếu liên quan auth/dữ liệu.
- **Lớp trải nghiệm thật:** tự thao tác như người dùng thật (Trưởng phòng, Nhân viên, hoặc ứng viên ngoài chưa đăng nhập) qua đủ luồng: bình thường / rỗng / sai dữ liệu. Kiểm tra UI đúng tinh thần phần mềm doanh nghiệp (mục 6), thông báo hiện đúng dạng popup/trung tâm thông báo. Nêu rõ nếu có chỗ trải nghiệm chưa ổn dù code không lỗi.

### 0.4. Không báo cáo bằng lời — luôn kèm bằng chứng chạy được (log, câu lệnh test, ảnh chụp màn hình mô tả).

### 0.5. Tuyệt đối dùng DỮ LIỆU THẬT — Không được phép Hardcode giả định
- Mọi logic xử lý, AI, hay hiển thị UI đều phải dựa trên dữ liệu thật lấy từ Database, API, hoặc thao tác của người dùng.
- TUYỆT ĐỐI KHÔNG gõ cứng (hardcode) các nội dung giả định (dummy text, mock data, placeholder ảo) vào mã nguồn để lấp liếm những chức năng chưa hoàn thiện. Nếu tính năng yêu cầu đọc PDF, phải dùng thư viện đọc file PDF thực tế (ví dụ: pdfbox/pdfjs), tuyệt đối không gửi chuỗi văn bản giả.

---

## 1. TỔNG QUAN DỰ ÁN

 HRM — hệ thống vận hành số cho 2 nhánh nghiệp vụ: **Tuyển dụng AI** và **Chấm công AI**, cộng module **Tính lương** đơn giản dựa trên dữ liệu chấm công (không có KPI — đã loại khỏi phạm vi để tiết kiệm thời gian).

Đối tượng dùng thật: Giám đốc, Trưởng phòng, Nhân viên nội bộ + **ứng viên bên ngoài** (không có tài khoản, truy cập qua link công khai).

## 2. TECH STACK

| Layer                        | Công nghệ                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                     | React (Vite), TailwindCSS                                                                                                                                                                                                                                                                                     |
| Backend                      | Java Spring Boot                                                                                                                                                                                                                                                                                              |
| Database                     | MySQL                                                                                                                                                                                                                                                                                                         |
| Auth                         | JWT stateless + Spring Security (RBAC)                                                                                                                                                                                                                                                                        |
| Real-time                    | WebSocket (STOMP) qua Spring — thay thế Socket.io, dùng cho trung tâm thông báo                                                                                                                                                                                                                         |
| AI                           | Google Gemini API — bắt buộc model`gemini-3.5-flash` (dòng Gemini 3, ổn định GA). **TUYỆT ĐỐI KHÔNG dùng dòng `gemini-2.5-*`** (`gemini-2.5-flash`, `gemini-2.5-pro`) — Google đã công bố ngừng hoạt động dòng này từ 16/10/2026, dùng sẽ hỏng giữa chừng dự án |
| File upload                  | Spring`MultipartFile` (xử lý in-memory) + Cloudinary — CV, ảnh CCCD                                                                                                                                                                                                                                     |
| Face embedding (chấm công) | face-api.js chạy phía client (trình duyệt), backend Spring chỉ nhận vector                                                                                                                                                                                                                              |

## 3. MÔ HÌNH VAI TRÒ (RBAC) — 3 ROLE, ĐÃ CHỐT, KHÔNG THÊM ROLE MỚI

```
giam_doc      — toàn quyền, xem/duyệt toàn công ty
truong_phong  — quản lý phòng ban mình (department_id) cho các module nội bộ
                (VD: duyệt chấm công ngoại lệ của nhân viên phòng mình)
nhan_vien     — chỉ dữ liệu của chính mình (chấm công, phiếu lương)
```

**NGOẠI LỆ QUAN TRỌNG cho riêng module Tuyển dụng:** module này **KHÔNG lọc theo `department_id`**. Mọi tài khoản `truong_phong` đều xem/thao tác được toàn bộ dữ liệu tuyển dụng (đăng tin, xem hồ sơ ứng viên, duyệt hồ sơ) — coi như cả hệ thống dùng chung 1 "phòng Nhân sự" ảo cho mục đích tuyển dụng, không cần logic scope riêng. Đây là quyết định đơn giản hóa có chủ đích, không phải thiếu sót — **không tự ý thêm lại department scope cho module Tuyển dụng**.

Các module khác (chấm công, lương) vẫn dùng `department_id` scope bình thường cho `truong_phong` nếu sau này cần mở rộng tính năng duyệt theo phòng ban.

**Không có role "hr" hay "admin" riêng** — các chức năng đó đã gộp vào `truong_phong`/`giam_doc`.

**Ứng viên (candidate) không phải role trong hệ thống.** Họ không đăng nhập — truy cập qua link công khai duy nhất theo tin tuyển dụng (`GET /public/apply/:job_slug`), không qua `verifyToken`.

## 4. LUỒNG NGHIỆP VỤ TUYỂN DỤNG (đầu-cuối)

```
1. truong_phong tạo Tin tuyển dụng (job posting)
      → hệ thống sinh 1 link công khai duy nhất (VD: /apply/backend-dev-2026-08)
      → truong_phong copy link, đăng ở đâu tùy ý (Facebook, LinkedIn, group...)

2. Ứng viên (không đăng nhập) mở link
      → Form công khai: upload CV (PDF) + ảnh CCCD (tùy chọn) + điền/xác nhận thông tin cá nhân
      → OCR trích xuất từ CV/CCCD, tự điền sẵn vào form cho ứng viên xác nhận lại (không bắt gõ tay 100%)
      → Ứng viên xác nhận & nộp

3. Hệ thống AI xử lý ngầm:
      → Semantic Fit Score (so khớp CV với JD, không hard-reject theo role)
      → CV Fraud Detection (kiểm tra logic nội tại + trùng lặp bất thường)
      → Ghi AI Decision Log cho cả 2 bước trên (lý do cụ thể, không chỉ điểm số)
      → Sinh sẵn câu hỏi phỏng vấn tình huống động dựa trên CV

4. truong_phong vào "Quản lý hồ sơ" xem danh sách ứng viên đã nộp
      → Bấm vào 1 hồ sơ → màn hình chi tiết (xem mục 6.1, theo đúng ảnh tham chiếu):
        bên trái = form thông tin đã OCR/AI trích xuất (có thể sửa),
        bên phải = thẻ hồ sơ tóm tắt AI dựng (học vấn, mục tiêu nghề nghiệp, kinh nghiệm)
      → Xem điểm Fit Score + lý do, cờ gian lận (nếu có) + lý do, câu hỏi gợi ý phỏng vấn
      → Duyệt / Từ chối / Đánh dấu cần xác minh thêm (mọi override đều ghi log)

5. AI Recruiter Digest: job chạy định kỳ hằng ngày, tổng hợp gửi thông báo cho
   toàn bộ truong_phong: số đơn mới, số đạt ngưỡng, top ứng viên nổi bật,
   đơn cần review thủ công kèm lý do.
```

## 5. LUỒNG NGHIỆP VỤ CHẤM CÔNG AI

```
1. Nhân viên mở trang Chấm công → bật camera → chụp ảnh real-time (không cho upload ảnh có sẵn)
2. Frontend (face-api.js) trích face embedding (vector số) NGAY TẠI TRÌNH DUYỆT
3. Gửi vector lên backend (KHÔNG gửi ảnh gốc)
4. Backend so cosine similarity với embedding đã đăng ký của nhân viên đó
   → vượt ngưỡng → ghi nhận attendance thành công
5. truong_phong duyệt các trường hợp ngoại lệ (quên chấm công, đi trễ có lý do) — có checkDepartmentScope bình thường
6. Cuối kỳ, module Tính lương đọc dữ liệu attendance, áp công thức:
   Lương = Lương cơ bản × (ngày công thực tế / ngày công chuẩn) + Phụ cấp − Khấu trừ + Tăng ca
```

## 6. QUY CHUẨN UI/UX

Chi tiết đầy đủ ở `SKILL_frontend-design.md`. Tóm tắt bắt buộc:

- **Bảng màu chủ đạo: XANH DƯƠNG & TRẮNG** (đã đổi từ vàng — không dùng lại vàng ở bất kỳ đâu).
- Bố cục sidebar trái + header trên, danh sách nghiệp vụ luôn dùng `DataTable`, không card-list.
- Thông báo bắt buộc qua popup/trung tâm thông báo (chuông + panel + modal chặn cho loại khẩn), không dùng toast tự ẩn cho sự kiện nghiệp vụ.

### 6.1. Màn hình chi tiết hồ sơ ứng viên — chuẩn bắt buộc (theo ảnh tham chiếu chủ dự án cung cấp)

- Thanh tab con trong module Tuyển dụng: `Tổng quan | Đánh giá | Chiến dịch tuyển dụng | Quản lý | Phê duyệt | Báo cáo | Thiết lập`
- Layout 2 cột:
  - **Cột trái** — form dữ liệu trích xuất (có thể sửa): khối "File đính kèm" (File CV, Ảnh CCCD, Link CV — mỗi file có nút "Đính kèm"/xem), khối "Thông tin cá nhân" (Họ tên, Ngày sinh, Giới tính, Email, SĐT, CCCD, Dân tộc, Quốc tịch, Tôn giáo, Địa chỉ, Kinh nghiệm làm việc dạng textarea)
  - **Cột phải** — thẻ hồ sơ AI tóm tắt: avatar + tên + chức danh ứng tuyển, thông tin liên hệ nhanh (SĐT/email/địa chỉ/ngày sinh/giới tính dạng icon+text), khối "Học văn", khối "Mục tiêu nghề nghiệp" (đoạn văn do AI tóm tắt từ CV), khối "Kinh nghiệm làm việc" (bullet list do AI trích xuất)
- Khối điểm AI (Fit Score, cờ gian lận, câu hỏi gợi ý phỏng vấn) đặt **dưới hoặc cạnh** thẻ hồ sơ bên phải — không che layout tham chiếu, xem chi tiết vị trí cụ thể ở skill frontend.

## 7. CHỐNG SQL INJECTION & BẢO MẬT — chi tiết đầy đủ ở `SKILL_backend-patterns.md`

Nguyên tắc tối thiểu: JPA/PreparedStatement tuyệt đối (không nối chuỗi SQL), BCrypt cho password (Spring Security có sẵn), `JWT_SECRET` từ biến môi trường không hardcode, chuỗi bảo mật `JWT filter → Bean Validation → @PreAuthorize → kiểm tra scope (department_id/user_id) trong Service` cho mọi route cần phân quyền, không tin `user_id`/`role`/`department_id` gửi từ client.

## 8. CHECKLIST TRƯỚC KHI COI LÀ "XONG" (rút gọn, đầy đủ ở skill backend)

- [ ] Route trừ auth và public-apply đều có `verifyToken`
- [ ] Route tuyển dụng KHÔNG áp `checkDepartmentScope` (đúng ngoại lệ mục 3)
- [ ] Route chấm công/lương CÓ áp `checkDepartmentScope` cho `truong_phong`
- [ ] Không SQL nào nối chuỗi input
- [ ] Không route nào tin dữ liệu phân quyền từ client
- [ ] Ảnh CCCD/CV không lưu trong MySQL, chỉ lưu URL Cloudinary
- [ ] Face embedding chỉ lưu vector, không lưu ảnh gốc
- [ ] Mọi quyết định AI (Fit Score, Fraud flag) ghi vào `ai_decision_logs` kèm lý do
- [ ] Thông báo khẩn hiện đúng popup chặn màn hình

## 9. THỨ TỰ TRIỂN KHAI

1. Setup project, `.env`, kết nối MySQL
2. Tầng nền: Auth + RBAC (3 role, `department_id` cho `truong_phong` — nhớ đánh dấu module nào dùng/không dùng scope), design system (`components/common/`, theme xanh dương-trắng)
3. Hệ thống thông báo nền tảng (bảng `notifications`, WebSocket/STOMP, `NotificationCenter`)
4. Module Tuyển dụng: job posting (nội bộ) → public apply form → OCR → Semantic Fit Score → Decision Log → màn hình quản lý/duyệt hồ sơ (đúng mục 6.1) → Fraud Detection → câu hỏi tình huống động → Recruiter Digest
5. Module Chấm công: đăng ký face embedding → chấm công real-time → duyệt ngoại lệ
6. Module Tính lương: công thức đơn giản đọc từ attendance
7. Dashboard tổng hợp theo role
8. Polish UI, test bảo mật/phân quyền lần cuối

## 10. CÀI ĐẶT & CHẠY LOCAL

```bash
# Backend
cd backend && ./mvnw clean install

# Frontend
cd ../frontend && npm install
```

Cấu hình biến môi trường: backend dùng `application.yml` + biến môi trường hệ thống (không hardcode) cho `JWT_SECRET`, MySQL, `GEMINI_API_KEY`, `CLOUDINARY_*`. Frontend copy `.env.example` → `.env`, điền `VITE_API_URL`, `VITE_WS_URL`.

```bash
# Terminal 1 — Backend (Spring Boot, mặc định cổng 8080)
cd backend && ./mvnw spring-boot:run

# Terminal 2 — Frontend
cd frontend && npm run dev
```
