# Kết quả kiểm tra phân cấp báo giá V21

Ngày: 15/11/2026

- Backend: 72 tests, không lỗi, không bỏ qua.
- Gồm kiểm tra thực trên MySQL riêng cổng 23319: migration V1–V21, luồng hợp đồng, phân cấp duyệt, giá sàn, Kỹ thuật, ủy quyền, lịch sử bất biến, nạp demo hai lần.
- Frontend: 2 tests qua; oxlint module Sales qua; npm run build qua. Build có cảnh báo bundle lớn của ứng dụng hiện có.
- Backend local: đã áp dụng V21; khởi động thành công; đăng nhập CEO và các API đọc của Sales trả thành công.
- Chính sách local vẫn chưa kích hoạt; không tự nhập hạn mức kinh doanh hoặc nạp demo vào database thật.
- Sao lưu trước nâng cấp: Backend/database/backups/hrm_db-20261115-110928.sql và SHA256 đi kèm (không đưa lên Git).
- Kiểm tra giao diện: đã kiểm tra biên dịch và API; chưa thực hiện thao tác trình duyệt trong lần cập nhật này.

Log chi tiết trong Backend/target/sales-policy-tests.log, Backend/target/surefire-reports và Backend/target/sales-policy-live.log (các file build được Git bỏ qua).
