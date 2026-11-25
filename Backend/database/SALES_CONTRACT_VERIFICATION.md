# Kết quả kiểm tra quy trình hợp đồng V22

Ngày 15/11/2026.

- Backend: 76 tests, 0 failures, 0 errors, 0 skipped; toàn bộ chạy với MySQL kiểm thử riêng cổng 23319.
- Gồm quy trình nháp/rà soát/bản ký/xác nhận, phạm vi hai nhân viên, chống tự duyệt, lịch sử bất biến, hủy nháp để quay về báo giá, tạo trùng đồng thời, nạp demo hai lần và nâng cấp hợp đồng cũ từ V21.
- Frontend: 2 tests qua; oxlint module Sales qua; npm run build thành công. Còn cảnh báo kích thước bundle chung của ứng dụng.
- Trình duyệt IAB: đăng nhập CEO, mở danh sách và biểu mẫu nháp mới; trạng thái rỗng có hướng dẫn; không lưu được khi thiếu báo giá; tải lại sau khi backend lên V22, không có console error.
- Luồng hợp đồng có dữ liệu và các nhánh sai quyền được kiểm tra qua integration tests; chưa tạo hồ sơ kinh doanh thử trong database local thật.
- API local: đăng nhập CEO thành công; context/contracts/quotations/handovers/pricing-policy thành công; payload nháp và bản ký thiếu dữ liệu đều HTTP 400.
- Backend local đã áp dụng V22 và khởi động thành công, cấu hình nghiệp vụ được kiểm tra thành công.
- Sao lưu trước nâng cấp: Backend/database/backups/hrm_db-20261115-123418.sql và SHA256 đi kèm. Không đưa bản sao lưu lên Git.
- Bằng chứng giao diện: Backend/target/sales-contract-draft.jpg.
- Log: Backend/target/sales-contract-tests.log, Backend/target/surefire-reports, Backend/target/sales-contract-live.log.
