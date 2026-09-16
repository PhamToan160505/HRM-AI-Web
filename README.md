# HRM AI - Hệ thống Quản trị Nhân sự & Tuyển dụng Thông minh

![HRM AI Banner](https://via.placeholder.com/1200x300.png?text=HRM+AI+-+Smart+Human+Resource+Management)

**HRM AI** là một hệ thống phần mềm quản trị nhân sự tổng thể chuẩn doanh nghiệp (Enterprise), được tích hợp sâu các công nghệ Trí tuệ nhân tạo (AI) hiện đại. Hệ thống giúp tự động hóa tối đa quy trình nghiệp vụ HR từ khâu tuyển dụng, chấm công, đến liên lạc nội bộ và tính toán lương thưởng.

---

## 🌟 Các tính năng nổi bật

### 1. Tuyển dụng Thông minh (AI Recruitment)
- **OCR & Trích xuất thông tin tự động:** Phân tích bóc tách dữ liệu ứng viên từ file PDF CV một cách tự động (Học vấn, Kinh nghiệm, Kỹ năng).
- **AI Phân tích mức độ phù hợp (Fit Score):** Đánh giá ứng viên dựa trên yêu cầu của vị trí tuyển dụng, sinh ra báo cáo tóm tắt, đề xuất câu hỏi phỏng vấn và cắm cờ (flag) các dấu hiệu gian lận tiềm ẩn.
- **Báo cáo tổng hợp tự động:** Bot AI định kỳ tổng hợp số lượng đơn, các ứng viên nổi bật để gửi cho Trưởng phòng phê duyệt.

### 2. Chấm công AI (AI Attendance)
- **Nhận diện khuôn mặt (Face Recognition):** Tích hợp công nghệ nhận diện khuôn mặt Real-time ngay tại trình duyệt thông qua thuật toán trích xuất face embedding vector và so khớp Cosine Similarity tại backend.
- **Chống gian lận:** Không cho phép upload ảnh có sẵn, yêu cầu luồng chụp ảnh trực tiếp từ camera.
- **Quản lý ngoại lệ:** Duyệt các yêu cầu quên chấm công, đi trễ, về sớm.

### 3. Liên lạc & Phối hợp Nội bộ (Real-time Chat)
- **Hệ thống tin nhắn tức thời:** Sử dụng WebSockets (STOMP) mang lại trải nghiệm chat mượt mà, thời gian thực.
- **Gắn thẻ (Tagging) & AI Assistant:** Khả năng `@tag` đồng nghiệp hoặc gọi `@AI` vào hỗ trợ giải đáp trực tiếp trong nhóm chat.
- **Quản lý tin nhắn:** Tính năng thu hồi tin nhắn, trạng thái chưa đọc, tự động làm mới giao diện tối ưu hóa UX/UI chuẩn doanh nghiệp.

### 4. Quản lý Nhân sự & Tính Lương (Core HR)
- **Quản lý phòng ban & nhân viên:** Phân quyền chặt chẽ (Giám đốc, Trưởng phòng, Nhân viên), quản lý luân chuyển, hồ sơ chi tiết.
- **Quản lý đơn từ:** Xin nghỉ phép, đi công tác, phê duyệt đa cấp độ.
- **Tính lương tự động:** Đồng bộ hóa dữ liệu từ hệ thống chấm công để tính toán lương cơ bản, phụ cấp, giảm trừ một cách chính xác.

---

## 🛠 Tech Stack (Công nghệ sử dụng)

### Frontend
- **Framework:** React 18, Vite
- **Styling:** Tailwind CSS, Lucide Icons
- **Real-time:** SockJS, StompJS
- **AI/ML:** face-api.js (Trích xuất Embedding khuôn mặt)
- **Định dạng & Routing:** React Router DOM

### Backend
- **Framework:** Spring Boot 3.x, Spring Security (JWT)
- **Database:** MySQL
- **Real-time:** Spring WebSocket Message Broker
- **AI Integration:** Google Gemini AI API
- **Xử lý tài liệu:** PDFBox (Extract Text)

---

## 🚀 Cài đặt & Khởi chạy (Dành cho Developer)

### 1. Yêu cầu môi trường
- Java 17+
- Node.js 18+
- MySQL 8.0+

### 2. Cài đặt Backend (Spring Boot)
```bash
cd Backend
# Cấu hình lại username/password và API_KEY trong src/main/resources/application.yml
mvn clean install
mvn spring-boot:run
```

### 3. Cài đặt Frontend (React)
```bash
cd Frontend
npm install
npm run dev
```
Hệ thống Frontend sẽ chạy tại: `http://localhost:5173`

---

## 📜 Bản quyền và Tác giả

Hệ thống được thiết kế và xây dựng tuân thủ quy chuẩn phần mềm doanh nghiệp, đáp ứng hiệu suất cao và giao diện người dùng chuyên nghiệp.

**Được phát triển bởi Nguyễn Đức Mạnh - Lê Hữu Tường - Phạm Nguyễn Bảo Toàn**
