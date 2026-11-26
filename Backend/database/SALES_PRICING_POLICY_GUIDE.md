> **Luồng hợp đồng V22:** Lập nháp, rà soát và xác nhận bản ký trước khi chốt cơ hội/bàn giao. Xem [SALES_CONTRACT_WORKFLOW_GUIDE.md](SALES_CONTRACT_WORKFLOW_GUIDE.md).

# Phân quyền báo giá dịch vụ phần mềm

## Thiết lập lần đầu

1. Chạy backend để Flyway áp dụng V21; không chạy lại hoặc sửa V19/V20 đã áp dụng.
2. Đăng nhập CEO → **Kinh doanh → Chính sách giá → Công bố phiên bản mới**.
3. Nhập hạn mức gửi chuẩn, Trưởng phòng, Giám đốc; tỷ lệ chiết khấu và điều khoản chuẩn đã được công ty thống nhất. Chọn **Kích hoạt** và nhập lý do công bố.
4. Giám đốc Kinh doanh hoặc CEO vào **Sản phẩm & dịch vụ**, thiết lập giá niêm yết, giá sàn, phạm vi của một đơn vị và đánh dấu gói đã chuẩn hóa. Dịch vụ chưa chuẩn hóa sẽ qua Kỹ thuật.

Hệ thống khởi tạo chính sách **chưa kích hoạt**, không tự áp các mức 5%, 10% hoặc số tiền giả định. Nhân viên vẫn lưu được nháp. Mỗi lần công bố tạo phiên bản mới; báo giá đã trình giữ nguyên bản chính sách đã lưu.

## Quyền theo vai trò

| Vai trò | Quyền trong luồng báo giá |
|---|---|
| Nhân viên Kinh doanh | Lập phiên bản cho khách hàng mình phụ trách; gửi trực tiếp báo giá đủ chuẩn; trình duyệt ngoại lệ; ghi nhận phản hồi khách hàng |
| Trưởng phòng Kinh doanh | Xử lý dữ liệu trong phòng; duyệt báo giá trong hạn mức Trưởng phòng; không sửa bảng giá hoặc chính sách |
| Giám đốc Kinh doanh | Quản lý bảng giá, giá sàn, gói chuẩn; duyệt trong hạn mức Giám đốc và các cấp thấp hơn |
| CEO | Công bố chính sách; duyệt ngoại lệ cấp CEO và các cấp thấp hơn; có thể chỉ định một Giám đốc Kinh doanh duyệt thay cấp CEO |
| Trưởng phòng / Giám đốc Kỹ thuật | Xem hàng chờ được giao cho phòng mình; thẩm định tính khả thi, ngày công, tiến độ và nguồn lực trước bước thương mại |
| Nhân viên Kỹ thuật / Kế toán | Tiếp nhận bàn giao như trước; không được duyệt báo giá |

Không ai tự duyệt ngoại lệ do mình lập. Báo giá do Giám đốc lập vẫn có thể thuộc hạn mức Trưởng phòng và do một người khác đủ quyền duyệt. Nếu không có người duyệt độc lập cùng cấp, cấp cao hơn có thể xử lý. CEO có thể cấu hình người được ủy quyền; người này vẫn không được tự duyệt và chỉ xử lý hồ sơ trong phạm vi phòng mình. Ủy quyền được lưu theo phiên bản chính sách của báo giá.

## Hệ thống xác định tuyến như thế nào?

- **Chuẩn:** đúng đơn giá niêm yết, không giảm giá, đúng mô tả/phạm vi gói chuẩn, điều khoản trùng mẫu, không có ngoại lệ và trong hạn mức gửi trực tiếp. Hệ thống ghi nhận đủ điều kiện; `approved_by` để trống. Có thể chọn **Gửi trực tiếp theo giá chuẩn** để ghi nhận đã gửi qua kênh ngoài hệ thống.
- **Trưởng phòng / Giám đốc:** phải thỏa đồng thời hạn mức giá trị, mức chiết khấu và giá sàn. Nếu một tiêu chí vượt cấp, hệ thống dùng cấp cao hơn.
- **CEO:** vượt hạn mức Giám đốc; giá dưới sàn; miễn phí; điều khoản khác mẫu; độc quyền nền tảng/thư viện dùng chung; hoặc ngoại lệ chiến lược, nguồn lực/chi phí ngoài thẩm quyền.
- **Kỹ thuật trước:** gói chưa chuẩn hóa, mô tả khác phạm vi chuẩn, khai báo tùy chỉnh phạm vi/tiến độ, công nghệ mới hoặc ngoại lệ nguồn lực. Khi lập nháp cần chọn phòng Kỹ thuật. Kỹ thuật có thể yêu cầu CEO quyết định phần nguồn lực phát sinh.

Giá trị xét hạn mức là số lớn nhất trong: tổng giá niêm yết, tổng giá chào trước giảm và tổng thanh toán. Chiết khấu hiệu dụng lấy mức lớn hơn giữa tỷ lệ giảm so với giá niêm yết và tỷ lệ giảm toàn báo giá so với giá chào. Việc hạ đơn giá từng hạng mục không tránh được kiểm tra chiết khấu. Kiểm tra giá sàn áp dụng cho từng đơn giá và tổng tiền sau giảm.

Bàn giao mã nguồn của dự án nếu đã nằm trong gói chuẩn là nghiệp vụ bình thường. Chỉ chọn ngoại lệ độc quyền khi chuyển quyền đối với nền tảng/thư viện/mã dùng chung ngoài nội dung chuẩn. Người lập phải khai báo đúng nội dung đàm phán; hệ thống đối chiếu giá và nội dung đã nhập, không đọc hiểu tự động hợp đồng đính kèm.

## Thao tác và lịch sử

**Lưu nháp → Xác định tuyến duyệt → (Kỹ thuật nếu cần) → Duyệt thương mại → Ghi nhận đã gửi → Khách hàng chấp thuận → Hợp đồng.**

Trong chi tiết báo giá có cấp duyệt, lý do chuyển cấp, bản chính sách đã áp dụng và kết quả thẩm định Kỹ thuật. Đổi giá, giảm giá, phạm vi, điều khoản hoặc sửa nội dung bị trả về cần **Tạo phiên bản**. Bản cũ, chính sách và thẩm định được giữ nguyên. Giá sản phẩm thay đổi trước khi trình cũng yêu cầu tạo phiên bản mới để lấy lại khung giá.

PDF của báo giá chưa đủ điều kiện có dòng cảnh báo bản tham khảo nội bộ. Nút gửi chỉ ghi nhận việc gửi qua kênh trao đổi bên ngoài, không tự gửi email cho khách hàng.

## Hồ sơ cũ và dữ liệu demo

Báo giá đang chờ duyệt theo quy trình cũ tiếp tục ở cấp Trưởng phòng; hồ sơ đã duyệt/đã gửi/đã chấp thuận tiếp tục xử lý. Nháp cũ cần tạo phiên bản mới để chụp khung giá. Các quyết định lịch sử không bị đánh giá lại theo hạn mức mới.

`seed_sales_demo.sql` chỉ dùng khi chủ động nạp vào môi trường local/test. Script không kích hoạt chính sách, không tự thay đổi giá sàn của sản phẩm demo đã tồn tại và không ghi đè tiến trình đã thao tác. Thêm hai tài khoản kiểm thử mới, mật khẩu `SalesDemo@123`:

| Mã nhân viên | Vai trò |
|---|---|
| 79000104 | Giám đốc Kinh doanh |
| 79000302 | Trưởng phòng Kỹ thuật |

Các hồ sơ demo đã dựng sẵn mô phỏng quy trình cũ. Dùng **Tạo phiên bản** để thử quy trình mới. Đăng nhập Giám đốc để thiết lập gói chuẩn và giá sàn trước khi thử gửi trực tiếp.

Ví dụ **chỉ để kiểm thử**, không phải hạn mức mặc định: gửi chuẩn 100 triệu; Trưởng phòng 200 triệu / 5%; Giám đốc 1 tỷ / 10%; gói niêm yết 100 triệu, sàn 80 triệu. Với phạm vi/điều khoản chuẩn, lần lượt thử giá 100, 95, 94, 89, 79 và 0 triệu: tuyến chuẩn, Trưởng phòng, Giám đốc, CEO, CEO, CEO. Thêm tích hợp ngoài gói để kiểm tra bước Kỹ thuật. Giá 79 triệu vẫn phải CEO ngay cả khi tăng hạn mức chiết khấu của Giám đốc.

## Kiểm tra tự động

Chạy từ thư mục dự án với MySQL kiểm thử riêng (root không mật khẩu), không dùng database thật:

```powershell
mvn -f Backend/pom.xml test '-Dsales.test.url=jdbc:mysql://127.0.0.1:23319/' '-Dsales.test.mysql=C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe'
```

Mỗi test tích hợp tạo schema `sales_it_...` ngẫu nhiên và xóa schema đó sau khi xong. Các kiểm tra bao phủ phân cấp, chống tự duyệt, ủy quyền, Kỹ thuật, chính sách bất biến, giá sàn, nháp dùng khung giá cũ và nạp dữ liệu demo hai lần.
