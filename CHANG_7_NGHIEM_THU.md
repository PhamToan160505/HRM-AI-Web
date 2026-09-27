# Chặng 7 — Frontend và nghiệm thu

## Phạm vi giao diện đã nối dữ liệu thật

- Requisition: `DRAFT`, gửi duyệt, trả về, sửa và gửi lại; timeline hiển thị từng approval request và từng approval step.
- Posting: hiển thị `criteria_version_id` và `scoring_profile_version_id`; nhắc rõ chỉ so sánh AI cùng cặp version.
- Danh sách ứng viên: mặc định giữ thứ tự thời gian từ backend; “Sắp theo bằng chứng AI” là nút bật tay.
- AI: hiển thị riêng “Độ phủ lời khai theo JD” và “Mức bằng chứng”; không dùng một điểm tổng để tự quyết định.
- Interview: lịch theo vòng/lần, đặt lại lịch, feedback từng thành viên, kết luận của lead và đàm phán sơ bộ vòng 2.
- Offer: soạn version, gửi duyệt, duyệt/từ chối, gửi ứng viên và trang phản hồi công khai.
- Seat ledger: màn hình riêng theo requisition, trạng thái từng suất và timeline append-only.
- Nhân viên mới: pre-boarding, checklist, xác nhận `JOINED`, hủy nhận việc và timeline vòng đời.
- Trạng thái tài khoản hiển thị độc lập với trạng thái nhân viên; `EMPLOYED` vẫn có thể là “Chờ cấp quyền” hoặc “Cấp quyền lỗi”.

## Kiểm tra tự động đã chạy

| Nhóm | Kết quả |
|---|---|
| Backend unit test | 34/34 đạt |
| Frontend production build | Đạt |
| Lint các file Chặng 7 | Không có lỗi; còn cảnh báo hook/unused cũ ở `ApplicationListPage` |
| Migration V1–V11 trên database MySQL tạm | Đạt; database tạm đã tự xóa |
| Offer immutable | Đạt |
| Seat event append-only | Đạt |
| Chặn hai dispatch active và hai seat active cho một holder | Đạt |
| Employee `event_id` + `conversion_key` guards | Đạt |
| AI/Interview tables và DB check constraints | Đạt |
| Phân quyền Interview | Có test chặn nhân viên liệt kê hội đồng và quản lý phòng khác đặt lịch |
| Idempotency header | Bắt buộc trên các transition quan trọng của requisition, application, offer và lifecycle |

## Ma trận T/W/E

Các ca có test tự động trực tiếp hiện tại:

- AI: T3, T5, T6, T11, T15; kiểm tra magic bytes của file giả PDF.
- Workflow: default-deny state machine, vòng đời Offer, vòng đời Seat, token Offer, approval stale/idempotency và scoring profile bất biến.
- Lifecycle/database: unique `event_id`, unique `conversion_key`, append-only lifecycle event, khoảng dữ liệu và constraint chính của V9–V11.

Các ca còn cần chạy end-to-end trên môi trường demo có dữ liệu và Gemini thật trước khi chốt chung kết:

- T1, T2, T4, T7–T10, T12–T14 với bộ CV chuẩn hóa.
- W1–W18 dưới hai phiên đăng nhập thật; đặc biệt W1, W11 và W18 cần bắn hai request đồng thời.
- E1–E16 với poller chạy thật; đặc biệt E2, E13, E14 và E16 cần hai consumer hoặc replay event.
- Ma trận role HR Recruiter / HR Head / Director / CEO / Admin trên UI và API.
- Email Offer thật và retry outbox trên môi trường có SMTP.

Không được ghi “T1–T15, W1–W18, E1–E16 đều PASS” trong tài liệu thi cho đến khi nhóm ca end-to-end trên được chạy và lưu evidence.

## Kịch bản demo đề xuất

1. Tạo requisition headcount 1, CEO trả về, sửa rồi gửi lại; mở timeline để chứng minh audit không bị ghi đè.
2. Duyệt requisition; mở Seat ledger thấy một seat `AVAILABLE`.
3. Mở posting; chỉ ra cặp criteria/scoring version đã khóa.
4. Nộp ba CV: mạnh, sao chép JD, prompt injection/chữ ẩn.
5. Danh sách mặc định theo thời gian; bật “Sắp theo bằng chứng AI” và giải thích đây chỉ là chế độ hỗ trợ.
6. Mở hồ sơ, trình bày hai trục AI và verify points; người thật quyết định chuyển vòng.
7. Tạo lịch phỏng vấn, gửi feedback từng người, lead kết luận; vòng 2 lưu đàm phán.
8. Soạn Offer, duyệt rồi gửi; Seat chuyển `AVAILABLE → RESERVED`.
9. Ứng viên mở link công khai và chấp nhận; Seat chuyển `RESERVED → ACCEPTED`.
10. Màn nhân viên mới xuất hiện `PRE_BOARDING`; HR xác nhận đi làm, Employee thành `EMPLOYED`, Seat thành `JOINED`, tài khoản hiển thị trạng thái cấp quyền độc lập.
