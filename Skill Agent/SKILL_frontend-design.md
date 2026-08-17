---
name: -hrm-frontend-design
description: "Định hướng thiết kế UI/UX cho  HRM (Tuyển dụng AI + Chấm công AI + Lương). LUÔN dùng skill này khi tạo/sửa page hoặc component — kể cả khi user chỉ nói 'làm giao diện trang X'. Bảng màu XANH DƯƠNG-TRẮNG, đúng tinh thần phần mềm doanh nghiệp thật."
risk: safe
source: project-specific
date_added: "2026-08-17"
---
# Thiết Kế Frontend —  HRM

Người dùng thật: Giám đốc, Trưởng phòng, Nhân viên nội bộ (dùng máy tính là chính) + ứng viên bên ngoài truy cập form public qua điện thoại/máy tính (không đăng nhập). Đây là phần mềm quản trị nội bộ, KHÔNG phải app tiêu dùng.

## 0. Ràng buộc cứng — không tự đổi

- **Bảng màu chủ đạo: XANH DƯƠNG & TRẮNG** (đã đổi từ vàng, quyết định cuối). Nền chính trắng (`#FFFFFF`), primary xanh dương (gợi ý `#2563EB`–`#1D4ED8` cho nút/active/highlight, `#1E3A8A` cho text/icon quan trọng cần độ tương phản cao trên nền trắng). Không dùng xanh dương quá chói/neon. Không dùng lại vàng ở bất kỳ đâu trong hệ thống.
- Bố cục: sidebar trái (điều hướng module) + header trên (tài khoản, chuông thông báo) + vùng nội dung. Riêng **trang public apply KHÔNG có sidebar/header nội bộ** — là trang độc lập, đơn giản, tập trung vào form.
- Danh sách nghiệp vụ (ứng viên, chấm công, phiếu lương) luôn dùng `DataTable`, không card-list.
- Nút hành động quan trọng (Duyệt, Từ chối, Lưu) luôn có chữ, icon chỉ hỗ trợ đi kèm. 1 bộ icon duy nhất (Tabler Icons hoặc Lucide).
- Thông báo bắt buộc qua chuông + panel + modal chặn cho loại khẩn — không toast tự ẩn cho sự kiện nghiệp vụ.
- Stack: React (Vite) + TailwindCSS. Không dùng Next.js.
- Trước khi thiết kế màn hình mới: đề xuất (mô tả/wireframe đơn giản) → chờ duyệt, theo README mục 0.

## 1. Màn hình chi tiết hồ sơ ứng viên — CHUẨN BẮT BUỘC (theo ảnh tham chiếu chủ dự án cung cấp)

Đây là màn hình quan trọng nhất của module Tuyển dụng, cấu trúc **cố định, không tự sáng tạo lại layout**:

### 1.1. Thanh tab con (trong module Tuyển dụng)

```
Tổng quan | Đánh giá | Chiến dịch tuyển dụng | Quản lý | Phê duyệt | Báo cáo | Thiết lập
```

### 1.2. Bố cục 2 cột (tỉ lệ ~60/40)

**Cột trái — Form dữ liệu trích xuất (editable):**
- Khối "File đính kèm": 3 ô ngang hàng (File CV, Ảnh CCCD, Link CV), mỗi ô có tên file + nút "Đính kèm"/xem lại
- Khối "Thông tin cá nhân": lưới 2 cột — Họ và tên / Ngày sinh, Giới tính / Email, SĐT / CCCD, Dân tộc / Quốc tịch, Tôn giáo / Địa chỉ, rồi "Kinh nghiệm làm việc" dạng textarea full-width bên dưới
- **Field có `confidence` thấp (từ Gemini extraction, xem `SKILL_backend-patterns.md` mục 6.1) phải có viền/nền cảnh báo nhẹ (vàng nhạt) + icon nhỏ "cần xác minh"** — không hiển thị y hệt field đã chắc chắn, để Trưởng phòng biết cần kiểm tra lại trước khi duyệt.

**Cột phải — Thẻ hồ sơ AI tóm tắt (chỉ đọc, do AI dựng từ CV):**
- Avatar tròn + Họ tên + chức danh ứng tuyển (căn giữa, phía trên)
- Danh sách liên hệ nhanh dạng icon + text: SĐT, Email, Địa chỉ, Ngày sinh, Giới tính
- Khối "Học vấn" (trường + ngành, có thể là link)
- Khối "Mục tiêu nghề nghiệp" — đoạn văn AI tóm tắt từ CV
- Khối "Kinh nghiệm làm việc" — bullet list AI trích xuất từ CV

### 1.3. Khối điểm AI (thêm mới, không có trong ảnh gốc nhưng bắt buộc theo yêu cầu nghiệp vụ)

Đặt thành 1 khối riêng **dưới thẻ hồ sơ AI (cột phải)**, không chèn xen vào giữa layout tham chiếu:
- Semantic Fit Score (số điểm lớn + thanh progress + nút "Xem lý do" mở chi tiết từ AI Decision Log)
- Cờ gian lận (nếu có) — badge cảnh báo màu vàng/đỏ + lý do ngắn, có nút "Xem chi tiết"
- Câu hỏi phỏng vấn gợi ý — danh sách ngắn, có thể copy từng câu

## 2. Trang Public Apply (form cho ứng viên ngoài)

- Không sidebar/header nội bộ. Header đơn giản: logo công ty + tên vị trí đang ứng tuyển.
- Bố cục 1 cột, các bước rõ ràng: (1) Upload CV → (2) Hệ thống tự điền thông tin trích xuất, ứng viên xác nhận/sửa → (3) Xác nhận nộp.
- Dùng lại đúng bộ field ở mục 1.2 (cột trái) cho bước xác nhận thông tin — nhất quán với màn hình nội bộ.
- Có trạng thái loading rõ ràng khi đang OCR/trích xuất (vài giây), không để màn hình trắng.
- Sau khi nộp: màn hình xác nhận rõ ràng ("Đã nhận hồ sơ của bạn"), không redirect đột ngột.

## 3. Điều được tự do quyết định (trong khung trên)

- Font: 1 font chính rõ tiếng Việt (Be Vietnam Pro hoặc tương đương), font số liệu tabular-nums cho bảng lương/chấm công.
- Sắc độ mở rộng trong tông xanh dương-trắng: xanh rất nhạt cho background card/hover, viền dùng xám nhạt trung tính. Màu trạng thái phụ (success xanh lá, danger đỏ, warning cam) giữ chuẩn thông thường, không đổi thành xanh dương vì đó là màu primary/thương hiệu.
- Dashboard tổng (Giám đốc): tự do bố trí widget, miễn giữ sidebar + header.

## 4. Quy tắc thực thi chung

- CSS variables định nghĩa 1 lần (`--color-primary`, `--color-bg`, `--color-text`, `--color-success`, `--color-danger`, `--color-warning`), không hardcode màu rải rác.
- Badge trạng thái luôn có chữ kèm màu (VD: "● Đã duyệt", "● Cần xác minh").
- Component dùng chung bắt buộc: `Button`, `Input`, `Select`, `DataTable`, `Modal`, `Card`, `Badge`, `ConfirmModal`, `NotificationBell`, `NotificationPanel`, `NotificationModal` trong `components/common/` — không viết lại riêng từng module.
- Không dùng `window.confirm()`/`alert()` — luôn qua `ConfirmModal`.
- Đủ 4 trạng thái cho màn hình có dữ liệu server: loading, error, empty (có hướng dẫn hành động), có dữ liệu.

## 5. Output khi đề xuất thiết kế màn hình mới

1. Mục đích, thuộc portal nào (nội bộ Giám đốc/Trưởng phòng/Nhân viên hay public ứng viên)
2. Layout tổng quan (mô tả/wireframe đơn giản)
3. Các state cần xử lý
4. Cách xử lý thông báo liên quan (nếu có)
5. Icon dùng (nếu có), có kèm chữ hay không

## 6. Anti-pattern — tránh tuyệt đối

- ❌ Dùng lại màu vàng ở bất kỳ đâu
- ❌ Giao diện kiểu app tiêu dùng (card lớn, nhiều màu, animation dạo chơi)
- ❌ Toast tự ẩn cho thông báo nghiệp vụ quan trọng
- ❌ Nút hành động quan trọng chỉ icon, không chữ
- ❌ Bỏ trạng thái loading/error/empty
- ❌ Đổi layout màn hình chi tiết hồ sơ ứng viên khác với mục 1 mà không đề xuất trước
- ❌ Thêm sidebar/header nội bộ vào trang public apply
