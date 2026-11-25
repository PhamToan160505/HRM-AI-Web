# Luồng hợp đồng Kinh doanh từ V22

## Luồng chính

**Báo giá đã chấp thuận → Lập nháp hợp đồng → Gửi rà soát → Sẵn sàng ký → Nộp bản ký → Đối chiếu và xác nhận → Bàn giao.**

Nhân viên được lập hồ sơ cho khách hàng mình phụ trách. Quản lý xử lý trong phạm vi phòng; CEO xem toàn bộ. Không tạo hợp đồng từ báo giá chưa được khách chấp thuận.

| Trạng thái | Thao tác |
|---|---|
| Nháp / Cần bổ sung | Sửa thông tin bổ sung, gửi rà soát hoặc yêu cầu đổi báo giá |
| Chờ rà soát hợp đồng | Người quản lý khác đủ cấp thông qua để ký hoặc trả về kèm lý do |
| Sẵn sàng ký | Hai bên ký ngoài hệ thống; nhân viên nộp thông tin và liên kết bản ký |
| Chờ đối chiếu bản ký | Người quản lý độc lập kiểm tra nội dung, thẩm quyền người ký và bản ký đầy đủ |
| Cần bổ sung bản ký | Nộp lại bản đúng; bản đã nộp trước vẫn được giữ trong lịch sử |
| Đã xác nhận bản ký | Khóa nội dung, ghi nhận chốt thành công và cho phép bàn giao |
| Đã hủy nháp | Hồ sơ được giữ để tra cứu, không tính vào kết quả kinh doanh |

## Lập nháp

Vào **Kinh doanh → Hợp đồng → Lập nháp hợp đồng**:

- Chọn phiên bản báo giá đã được khách hàng chấp thuận, chưa có hợp đồng.
- Nhập người ký phía khách hàng dự kiến, ngày kết thúc/gia hạn và ghi chú đầu mối phối hợp.
- Số hợp đồng được cấp tự động theo năm, dạng `KD-2026-000001`; số đã cấp không bị dùng lại cho hồ sơ khác.
- Giá trị lấy từ báo giá nguồn. Phạm vi lấy từ hạng mục, số lượng và đơn vị của báo giá. Điều khoản/thanh toán lấy từ nội dung đã duyệt. Tiến độ lấy từ thẩm định Kỹ thuật được chấp thuận; nếu không có thẩm định riêng, áp dụng nội dung điều khoản báo giá.
- Ghi chú phối hợp không phải phần bổ sung phạm vi hoặc thay đổi điều khoản thương mại.

Không cần ngày ký hay bản ký khi tạo nháp. Lưu nháp không chuyển cơ hội thành chốt thành công, không được bàn giao và không được tính vào chỉ tiêu giá trị hợp đồng đã ký.

## Rà soát và xác nhận độc lập

Cấp rà soát kế thừa tuyến của báo giá: gói chuẩn và cấp Trưởng phòng cần tối thiểu Trưởng phòng; cấp Giám đốc cần Giám đốc; ngoại lệ CEO cần CEO hoặc Giám đốc được ủy quyền trong chính sách đã lưu của báo giá. Cấp cao hơn được xử lý cấp thấp hơn trong phạm vi dữ liệu được phép.

Người lập và người sửa cuối không tự rà soát hồ sơ. Người xác nhận bản ký còn phải khác người nộp bản ký hiện tại. Ví dụ Trưởng phòng tự lập hợp đồng thì Giám đốc hoặc một quản lý khác đủ quyền phải xử lý; vai trò người lập không tự làm thay đổi cấp của báo giá.

Sau khi thông qua để ký, thông tin nháp không được sửa trực tiếp. Khi hai bên đã ký, người nộp nhập ngày ký thực tế, tên người ký của hai bên và liên kết HTTPS đến bản ký. Ngày ký không ở tương lai, không sau hạn báo giá và không sau ngày kết thúc hợp đồng.

Người xác nhận phải đánh dấu đủ ba nội dung: khớp hồ sơ đã duyệt; đã kiểm tra thẩm quyền hai bên; bản ký đúng và đầy đủ. Các xác nhận được lưu cùng phiên bản và lịch sử thao tác. Hệ thống này quản lý hồ sơ ký bên ngoài, **không thực hiện ký điện tử, không tự đọc nội dung tệp, không cấp quyền ký chỉ bằng cách nhập tên**.

Chỉ sau bước xác nhận, cơ hội chuyển sang **Chốt thành công**, hợp đồng được tính trong kết quả kinh doanh, nhắc gia hạn và có thể bàn giao sang Kế toán/Kỹ thuật. Giá trị hợp đồng đã ký không đồng nghĩa số tiền đã thu.

## Đổi giá, phạm vi hoặc điều khoản trước khi ký

Chọn **Cần đổi báo giá**, nhập lý do. Hệ thống hủy nháp hợp đồng hiện tại và đánh dấu báo giá nguồn đã được thay thế, giữ nguyên toàn bộ nội dung/lịch sử cũ. Vào tab **Báo giá**, chọn **Tạo phiên bản**, nhập thay đổi, đi lại tuyến Kỹ thuật/phê duyệt nếu cần và ghi nhận khách chấp thuận trước khi lập hợp đồng mới.

Thao tác quay lại báo giá chỉ áp dụng trước khi nộp bản ký. Khi đã có bản ký, quản lý phải kiểm tra hồ sơ thực tế; hệ thống không tự hủy cam kết đã ký. Hợp đồng đã xác nhận bị khóa; chưa có chức năng lập phụ lục/chấm dứt hợp đồng trong đợt thay đổi này.

## Hồ sơ lịch sử và kiểm tra

Migration V22 giữ nguyên hợp đồng đã ghi nhận trước đây ở trạng thái đã xác nhận, đánh dấu **hồ sơ lịch sử**, không tự gán người đã duyệt hoặc xác nhận. Dữ liệu demo cũ cũng được đánh dấu hồ sơ lịch sử khi nạp. Nháp mới luôn đi qua quy trình mới.

Mở số hợp đồng trong bảng để xem nội dung nguồn, từng lần nộp bản ký và lịch sử hồ sơ. Bản ký, lịch sử và hợp đồng đã xác nhận được bảo vệ bằng kiểm tra backend và ràng buộc database.

Kiểm thử dùng MySQL riêng, không dùng database cấu hình thật:

```powershell
mvn -f Backend/pom.xml test '-Dsales.test.url=jdbc:mysql://127.0.0.1:23319/' '-Dsales.test.mysql=C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe'
```

Các ca kiểm tra gồm: lập nháp không chốt cơ hội; không bàn giao trước xác nhận; chặn tự duyệt/tự xác nhận; kế thừa thẩm quyền; ngày ký/HTTPS; trả hồ sơ; nộp lại bản ký; khóa lịch sử; tạo trùng đồng thời; quay lại báo giá và nâng cấp hợp đồng cũ từ V21.
