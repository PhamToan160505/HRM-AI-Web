> **Luồng hợp đồng V22:** Lập nháp, rà soát và xác nhận bản ký trước khi chốt cơ hội/bàn giao. Xem [SALES_CONTRACT_WORKFLOW_GUIDE.md](SALES_CONTRACT_WORKFLOW_GUIDE.md).

> **Cập nhật V21:** Luồng phân cấp báo giá mới nằm trong [SALES_PRICING_POLICY_GUIDE.md](SALES_PRICING_POLICY_GUIDE.md). CEO cần công bố hạn mức; nháp mẫu cũ cần tạo phiên bản mới. Trưởng phòng không còn sửa bảng giá. Script bổ sung Giám đốc Kinh doanh `79000104` và Trưởng phòng Kỹ thuật `79000302` (cùng mật khẩu demo). Các bước “Gửi duyệt” bên dưới mô tả dữ liệu quy trình cũ.

# Dữ liệu và kịch bản kiểm thử phòng Kinh doanh

Bộ dữ liệu giả lập dùng cho bản local/test đã chạy migration V19 trở lên. Tên bản ghi bắt đầu bằng `[DEMO-KD]`. Email thuộc miền `example.test`, số điện thoại và mã số thuế đều là dữ liệu giả lập.

## 1. Nạp dữ liệu

1. Chạy `start.bat`, chờ backend và frontend sẵn sàng.
2. Mở MySQL Workbench, kết nối MySQL của dự án. Cấu hình local hiện tại dùng cổng **3308**.
3. Chọn database `hrm_db` làm schema mặc định. Nếu nhóm có database test riêng, chọn database đó.
4. Mở file `Backend/database/seed_sales_demo.sql`, chạy toàn bộ file. File tạo tài khoản mẫu và dữ liệu nghiệp vụ trong schema đã chọn.
5. Mở `http://localhost:5173/login`. Đăng xuất tài khoản hiện tại trước khi thử tài khoản bên dưới.

Script tạo thêm dữ liệu có đánh dấu demo và giữ nguyên tài khoản cũ. Chạy lại sẽ giữ các thao tác đã thực hiện trên bộ demo, kể cả trạng thái báo giá và bàn giao. Ngày tương đối được tính ở lần nạp đầu tiên. Nếu mã hoặc email tài khoản mẫu bị trùng với tài khoản khác, script báo lỗi và rollback dữ liệu của lần nạp đó.

## 2. Tài khoản test

Mật khẩu ban đầu của cả 5 tài khoản là **`SalesDemo@123`**.

| Mã nhân viên | Vai trò và phòng ban | Dùng để kiểm tra |
|---|---|---|
| `79000101` | Trưởng phòng Kinh doanh | Xem toàn bộ dữ liệu mẫu, phân công, sản phẩm, duyệt báo giá |
| `79000102` | Nhân viên Kinh doanh Nguyễn An | Khách hàng An Phát, Minh Tâm, Hoàng Long, GreenTech |
| `79000103` | Nhân viên Kinh doanh Trần Bình | Khách hàng Thiên Nam, Bản Việt và phạm vi dữ liệu riêng |
| `79000201` | Nhân viên Kế toán | Tiếp nhận và phản hồi bàn giao Kế toán |
| `79000301` | Nhân viên Kỹ thuật | Tiếp nhận và phản hồi bàn giao Kỹ thuật |

Nguyễn An và Trần Bình mở menu **Kinh doanh**. Kế toán và Kỹ thuật mở **Bàn giao Kinh doanh**. Tài khoản Admin dùng để quản trị tài khoản. Khi cần kiểm tra CEO, dùng tài khoản CEO đã có trong hệ thống.

## 3. Dữ liệu có sẵn

| Nhóm | Số lượng ban đầu | Nội dung |
|---|---:|---|
| Khách hàng | 6 | 5 hoạt động, 1 ngừng hoạt động |
| Người liên hệ | 8 | An Phát và Minh Tâm có 2 đầu mối mỗi khách |
| Sản phẩm, dịch vụ | 8 | 7 đang cung cấp, 1 ngừng cung cấp |
| Cơ hội | 8 | Có đủ NEW, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| Báo giá | 10 | Nháp, chờ duyệt, trả về, đã duyệt, đã gửi, chấp thuận, từ chối và đã quá hạn |
| Dòng báo giá | 18 | Có giảm giá và số lượng nhiều đơn vị |
| Hợp đồng | 2 | SaaS GreenTech 48 triệu, bảo trì An Phát 24 triệu |
| Phiếu bàn giao | 4 | 2 chờ tiếp nhận, 1 đã tiếp nhận, 1 yêu cầu bổ sung |
| Lịch chăm sóc | 6 | 2 quá hạn, 1 đến hạn hôm nay, 2 sắp tới, 1 hoàn tất |

Mỗi khách hàng có mốc lịch sử `DEMO_SEEDED` để nhận biết dữ liệu được nạp bằng fixture. Các thao tác thực hiện tiếp trên giao diện sẽ ghi lịch sử nghiệp vụ bình thường.

### Khách hàng và cơ hội

| Khách hàng | Nhân viên phụ trách | Cơ hội | Trạng thái |
|---|---|---|---|
| An Phát | Nguyễn An | CRM An Phát, 120 triệu dự kiến | Mới tiếp nhận |
| An Phát | Nguyễn An | Bảo trì An Phát, hợp đồng 24 triệu | Chốt thành công |
| Minh Tâm | Nguyễn An | ERP Minh Tâm, 240 triệu dự kiến | Đàm phán |
| Minh Tâm | Nguyễn An | Website Minh Tâm, 60 triệu dự kiến | Đề xuất giải pháp |
| Hoàng Long | Nguyễn An | Thương mại điện tử Hoàng Long, 150 triệu dự kiến | Đã xác định nhu cầu |
| GreenTech | Nguyễn An | SaaS GreenTech, hợp đồng 48 triệu | Chốt thành công |
| Thiên Nam | Trần Bình | Ứng dụng Thiên Nam, 90 triệu dự kiến | Thất bại, khách ngừng hoạt động |
| Bản Việt | Trần Bình | HRM Bản Việt, 180 triệu dự kiến | Mới tiếp nhận |

## 4. Test toàn luồng từ báo giá đến bàn giao

Luồng này sử dụng báo giá **CRM An Phát, phiên bản 1** đang ở bản nháp. Mã ID được database sinh tự động, vì vậy hãy chọn theo tên cơ hội và phiên bản.

1. Đăng nhập `79000102`, vào **Báo giá**, tìm CRM An Phát, bấm **Gửi duyệt**.
2. Đăng xuất, đăng nhập `79000101`, tìm cùng báo giá, bấm **Duyệt**.
3. Đăng nhập lại `79000102`, bấm **Ghi nhận đã gửi**.
4. Bấm **Chấp thuận**, nhập căn cứ giả lập `Khách xác nhận phương án CRM qua email trong buổi demo`.
5. Sang **Hợp đồng**, bấm **Thêm mới**, chọn báo giá CRM An Phát vừa chấp thuận.
6. Điền mẫu bên dưới và xác nhận lưu.
7. Kiểm tra cơ hội CRM An Phát đã chuyển sang **Chốt thành công**.
8. Tại hợp đồng mới, bấm **Bàn giao**, chọn Kế toán. Lặp lại để bàn giao Kỹ thuật.
9. Đăng nhập `79000201`, vào **Bàn giao Kinh doanh**, mở hồ sơ và bấm **Tiếp nhận**.
10. Đăng nhập `79000301`, chọn phiếu tương ứng và bấm **Yêu cầu bổ sung**, nhập `Cần thống nhất đầu mối nghiệm thu`.
11. Đăng nhập lại `79000102`, xem phản hồi, bấm **Gửi lại**, nhập phần giải trình. Đăng nhập Kỹ thuật để tiếp nhận lại.

| Trường hợp đồng | Giá trị mẫu |
|---|---|
| Số hợp đồng | `DEMO-KD-CRM-NEW-001` |
| Người ký | `[DEMO] Nguyễn Lan` |
| Ngày ký | Ngày đang test, nằm trong hạn báo giá |
| Ngày kết thúc | Sau ngày ký 12 tháng |
| Liên kết bản đã ký | Liên kết HTTPS đến tệp test do bạn cung cấp |
| Phạm vi | CRM cho 20 người dùng, quản lý khách hàng, cơ hội và báo giá |
| Mốc nghiệm thu | Tuần 1 khảo sát, tuần 2 cấu hình, tuần 3 đào tạo và nghiệm thu |
| Thanh toán | 40% khi ký, 60% sau nghiệm thu |

Hai hợp đồng có sẵn trong fixture dùng URL minh họa `https://example.test/contracts/...`, nên không mở được PDF thực tế từ các URL đó. Dùng liên kết HTTPS đến tệp test của bạn khi kiểm tra thao tác mở bản hợp đồng. Chức năng **tải PDF báo giá** lấy nội dung từ database và có thể kiểm tra ngay.

## 5. Test từng màn hình

| Màn hình | Thao tác | Kết quả cần thấy |
|---|---|---|
| Khách hàng | Nguyễn An tìm An Phát và mở hồ sơ | Có 2 người liên hệ, thông tin khách và lịch sử |
| Khách hàng | Quản lý đổi phụ trách Bản Việt từ Trần Bình sang Nguyễn An | Nguyễn An thấy khách sau khi làm mới, Trần Bình mất quyền với khách đó |
| Người liên hệ | Thêm `[DEMO] Đầu mối mới`, email `new-contact@sales.example.test` | Đầu mối xuất hiện và có thể chỉnh sửa |
| Cơ hội | CRM An Phát bấm Chuyển bước trước khi chạy luồng hợp đồng | Mới → Xác định nhu cầu → Đề xuất → Đàm phán, có lịch sử |
| Cơ hội | Bật Theo giai đoạn | Các cơ hội được chia đúng nhóm trạng thái |
| Chăm sóc | Nguyễn An hoàn tất việc gọi khảo sát CRM quá hạn | Chuyển sang hoàn tất và giảm số việc quá hạn |
| Chăm sóc | Tạo lịch mới cho GreenTech, nhập nội dung trao đổi | Danh sách lưu đúng hạn và người phụ trách |
| Sản phẩm | Quản lý thêm một dịch vụ và sửa giá | Danh mục và form lập báo giá dùng được dịch vụ đó |
| Sản phẩm | Xem gói ngừng cung cấp | Vẫn thấy ở danh mục, không xuất hiện trong lựa chọn hạng mục mới |
| Báo giá | Nguyễn An mở Website Minh Tâm v1 đã trả về | Thấy ghi chú cần bổ sung, tạo được phiên bản mới |
| Báo giá | Quản lý duyệt ERP Minh Tâm đang chờ duyệt | Trạng thái thành Đã duyệt |
| Báo giá | Tải PDF CRM An Phát | Đúng khách hàng, hạng mục, số tiền và điều khoản |
| Bàn giao | Kỹ thuật tiếp nhận SaaS GreenTech đang chờ | Kinh doanh thấy phiếu đã được tiếp nhận |
| Bàn giao | Nguyễn An gửi lại phiếu bảo trì An Phát đã bị trả về | Có giải trình, phiếu trở lại Chờ tiếp nhận |
| Tổng quan | Quản lý xem kết quả mọi kỳ, mọi người | Tổng hợp khớp các danh sách chi tiết |
| Gia hạn | Tìm hợp đồng SaaS GreenTech | Ngày kết thúc sau khoảng 20 ngày, có thể lập lịch chăm sóc |

Nếu chưa thực hiện thao tác khác, tài khoản quản lý thấy **5 khách hàng hoạt động**, **5 cơ hội đang theo dõi**, **1 báo giá chờ duyệt**, **2 công việc quá hạn**, **2 hợp đồng trị giá 72 triệu**, tỷ lệ chốt khoảng **67%** trên 3 cơ hội đã kết thúc. Bộ lọc kỳ ký có thể làm tổng hợp thay đổi. Dữ liệu thật có sẵn trong database cũng được tính vào báo cáo nếu nằm trong quyền xem.

## 6. Dữ liệu để nhập tay trên form

### Tạo khách hàng mới

| Trường | Giá trị |
|---|---|
| Tên | `[DEMO-KD] Sao Bắc` |
| Mã số thuế | `DEMO-KD-007` |
| Email | `saobac@sales.example.test` |
| Điện thoại | `0007900007` |
| Địa chỉ | `TP. Hồ Chí Minh` |
| Nguồn | `Giới thiệu` |
| Người phụ trách | `[DEMO-KD] Nguyễn An` |
| Ghi chú | `Cần phần mềm quản lý khách hàng cho 20 nhân viên.` |

Tạo cơ hội `[DEMO-KD] CRM Sao Bắc`, giá trị dự kiến **120.000.000 VND**, ngày chốt sau ngày test khoảng 20 ngày, nhu cầu `Quản lý khách hàng, cơ hội, báo giá và báo cáo theo nhân viên`.

### Tính tiền báo giá

| Hạng mục | Số lượng | Đơn giá | Thành tiền |
|---|---:|---:|---:|
| Bản quyền CRM | 1 | 80.000.000 | 80.000.000 |
| Triển khai phần mềm | 1 | 20.000.000 | 20.000.000 |
| Đào tạo sử dụng | 1 | 5.000.000 | 5.000.000 |
| Giảm giá toàn báo giá | | | 5.000.000 |
| **Tổng cuối** | | | **100.000.000 VND** |

## 7. Test dữ liệu sai và phân quyền

| Ca | Cách kiểm tra | Kết quả mong đợi |
|---|---|---|
| Khách trùng | Tạo khách khác nhưng email `anphat@sales.example.test` | Bị chặn trùng dữ liệu |
| Email sai | Nhập `abc@@example` | Form/API báo email không hợp lệ |
| Giá âm | Nhập đơn giá `-1000` | Bị chặn lưu |
| Số lượng 0 | Nhập số lượng `0` trên báo giá | Bị chặn lưu |
| Giảm quá tổng | Tổng 105 triệu nhưng giảm 106 triệu | Backend báo giảm giá vượt tổng |
| Tự duyệt | Quản lý tự lập báo giá, gửi duyệt rồi tìm cách duyệt chính bản đó | Nút duyệt bị ẩn, API cũng từ chối |
| Quá hạn | Nguyễn An chấp thuận báo giá Hoàng Long v1, hạn đã qua 1 ngày | Backend báo hết hạn, cần phiên bản mới |
| Từ chối thiếu lý do | Đóng thất bại một cơ hội nhưng để trống lý do | Bị yêu cầu bổ sung lý do |
| Khách ngừng hoạt động | Tạo cơ hội mới và tìm Thiên Nam | Khách không xuất hiện trong lựa chọn khách đang hoạt động |
| Phân công | Nguyễn An tìm Bản Việt trước khi quản lý chuyển phụ trách | Không thấy dữ liệu của Trần Bình |
| Danh mục | Nguyễn An mở Sản phẩm & dịch vụ | Có thể xem, các nút thêm/sửa dành cho quản lý |
| Bàn giao đúng phòng | Kế toán mở danh sách tiếp nhận | Chỉ thấy phiếu gửi Kế toán |
| Bàn giao lặp | Kinh doanh gửi lại cùng hợp đồng cho cùng phòng đã có phiếu | Số phiếu không tăng trùng |
| Bản báo giá cũ | Tải PDF rồi đổi tên khách và tải lại cùng bản báo giá | PDF giữ tên khách theo thời điểm lập báo giá |

## 8. Kiểm tra file SQL đã thực hiện

Đã nạp thành công trên database MySQL tạm dùng migrations V1–V20, chạy file hai lần và đối chiếu số lượng bản ghi. Số lượng giữ nguyên sau lần hai. Tổng của cả 10 báo giá khớp tổng dòng hàng trừ giảm giá. Chưa nạp bộ fixture này vào database `hrm_db` đang sử dụng.
