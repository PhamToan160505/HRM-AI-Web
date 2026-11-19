# BÁO CÁO QC: LUỒNG LƯƠNG PHÒNG TÀI CHÍNH - KẾ TOÁN

> Phiên bản test: commit `7c04dc2` (main) · Ngày test: 19/11/2026
> Môi trường: backend local (Spring Boot, MySQL 8 `hrm_db`), frontend Vite, dữ liệu seed
> Kỳ test: tháng 9/2026 (có dữ liệu chấm công). Dữ liệu test đã được dọn và khôi phục sau mỗi lần chạy.
>
> **Cập nhật (retest lần 2):** đã sửa **toàn bộ 8 lỗi và 2 quan sát**. Bộ QC mở rộng lên **64 ca: 64/64 đạt**. Unit test backend: **77/77 đạt**.

## 1. Tóm tắt

| Hạng mục | Kết quả |
|----------|---------|
| Tổng số ca test tự động (API) | 56 |
| Đạt | 49 (ca D1 ban đầu báo FAIL, đã điều tra: công thức đúng, xem BUG-03) |
| Không đạt | 6 |
| Quan sát (cần nghiệp vụ quyết định) | 1 |
| Kiểm tra giao diện | Chốt công, tính lương, chi tiết, gửi duyệt, xác nhận, **từ chối (kể cả để trống lý do)**, CEO chốt, chi trả, phiếu lương cá nhân |
| Lỗi tìm thấy | **8 lỗi** (2 Cao, 4 Trung bình, 2 Thấp) + 2 quan sát |
| Đã sửa và retest đạt | **Tất cả**: BUG-01 → BUG-08, OBS-01, OBS-02 |
| Còn mở | Không |
| Retest lần 2 | **64/64 ca đạt** trên app thật · 77/77 unit test |

**Đánh giá chung:**
- **Ổn định:** phân quyền và máy trạng thái của luồng. Toàn bộ 30+ ca về quyền, đúng phòng, đúng bước, từ chối và gửi lại đều đạt.
- **Rủi ro chính:** nằm ở **ranh giới với các module khác**, gồm bảng công không bị khóa và OT không vào lương, cùng với **thao tác đồng thời**.
- **Khuyến nghị:** sửa 2 lỗi Cao (BUG-01, BUG-02) trước khi demo hoặc nghiệm thu.

---

## 2. Danh sách lỗi

### BUG-01: Chốt công đồng thời tạo ra nhiều kỳ lương trùng nhau
- **Trạng thái:** ✅ **ĐÃ SỬA**. Migration `V24__payroll_period_unique.sql` thêm cột `period_key` với ràng buộc UNIQUE; request thứ hai trở đi nhận lỗi 409 "vừa được chốt bởi một thao tác khác". Retest D16: 5 request đồng thời tạo đúng 1 kỳ lương.
- **Mức độ:** Cao
- **Ca test:** D16
- **Các bước:** Trưởng phòng CSKH gửi 5 request `POST /api/payroll/attendance/close?month=8&year=2026` cùng lúc (giả lập bấm đúp hoặc mạng chập chờn).
- **Kỳ vọng:** chỉ có 1 kỳ lương, các request còn lại nhận lỗi 409.
- **Thực tế:** **5 kỳ lương** cho cùng phòng, cùng tháng được tạo ra.
- **Ảnh hưởng:** dữ liệu rác; khi tính lương chỉ dùng 1 bản, các bản còn lại treo mãi ở trạng thái "đã chốt công"; số liệu tổng hợp có thể sai.
- **Đề xuất:** thêm ràng buộc `UNIQUE (department_id, month, year, report_level)` cho `payroll_reports` qua migration mới, và bắt lỗi trùng để trả 409. Có thể khóa thêm nút ở frontend trong lúc gửi.

### BUG-02: Bảng công không bị khóa sau khi chốt công hoặc đã chi lương
- **Trạng thái:** ✅ **ĐÃ SỬA**. Thêm `PayrollPeriodLock`: khi phòng đã chốt công một tháng thì **tạo đơn lùi ngày**, **duyệt đơn từ** và **duyệt ngoại lệ chấm công** của tháng đó đều bị chặn (409). Nếu bảng lương chưa gửi duyệt, thông báo hướng dẫn đề nghị Trưởng phòng mở lại công. Retest D15, D18, D19, D20 đều đạt.
- **Lưu ý:** chấm công khuôn mặt hằng ngày (punch) không bị khóa, vì chỉ ghi cho hôm nay. Nên sửa thêm BUG-05 để không chốt được tháng chưa kết thúc.
- **Mức độ:** Cao
- **Ca test:** D15
- **Các bước:**
  1. Lương tháng 9 của phòng Kinh doanh đã ở trạng thái `PAID`.
  2. Nhân viên tạo đơn nghỉ không lương lùi ngày vào 14/09/2026.
  3. Trưởng phòng duyệt đơn.
- **Kỳ vọng:** đơn bị chặn vì tháng đã chốt công, hoặc bắt buộc mở lại công trước.
- **Thực tế:** duyệt thành công, bảng công 14/09 đổi thành `ABSENT / UNPAID_LEAVE`. Bảng lương đã chi không còn khớp với bảng công.
- **Ảnh hưởng:** sai lệch số liệu kế toán, không truy vết được.
- **Đề xuất:** khi duyệt đơn hoặc chấm công ngoại lệ, nếu ngày đó thuộc tháng mà phòng đã chốt công (`ATTENDANCE_CLOSED` trở đi) thì từ chối và hướng dẫn "đề nghị Trưởng phòng mở lại công". Kỳ lương đã gửi duyệt hoặc đã chi thì không cho sửa.

### BUG-03: Tiền làm thêm giờ (OT) không được đưa vào lương
- **Trạng thái:** ✅ **ĐÃ SỬA** (phương án A). Mỗi ngày OT đã duyệt = lương 1 ngày × **150%** ngày thường / **200%** cuối tuần / **300%** ngày lễ (Điều 98 BLLĐ 2019). Phần trả thêm so với lương bình thường **được miễn thuế TNCN**. OT cũ không còn bị giữ lại. Dòng chữ trên trang đơn từ đã đổi thành 150–300%. Retest D1, D22: thứ 7 + thứ 2 của nhân viên lương 16tr ra 2.666.667 đ, đúng kỳ vọng.
- **Mức độ:** Trung bình đến Cao. Lỗi có từ trước, nhưng nay thuộc trách nhiệm phòng TC-KT.
- **Ca test:** D1 (điều tra thêm)
- **Hiện tượng:** gross của Phạm Quốc Huy = 3.250.000, trong khi theo công 1/20 ngày chỉ là 1.750.000. Phần chênh 1.500.000 là `overtime_pay` **còn sót trong phiếu lương mẫu cũ**; code giữ lại giá trị này khi tính lại.
- **Nguyên nhân:**
  - Không có đoạn code nào ghi `overtimePay` từ các đơn OT đã duyệt (`RequestType.OVERTIME`).
  - Cấu hình `payroll.overtime-multiplier: 1.5` không được dùng ở đâu.
- **Ảnh hưởng:** OT hoặc bị bỏ sót, hoặc lấy giá trị cũ không rõ nguồn.
- **Đề xuất:** khi kế toán tính lương, cộng giờ OT từ đơn OT đã duyệt trong tháng × đơn giá giờ × hệ số 1.5. Không giữ giá trị OT cũ.

### BUG-04: Đơn nghỉ phép đang chờ duyệt không chặn chốt công
- **Trạng thái:** ✅ **ĐÃ SỬA**. Chốt công (và tính lương) kiểm tra thêm đơn từ ở trạng thái `PENDING` hoặc `FORWARDED` trong tháng, liệt kê tên người còn đơn. Retest D14, D23, D24, gồm cả đơn chờ duyệt có sẵn trong seed của Phạm Quốc Huy.
- **Mức độ:** Trung bình
- **Ca test:** D14
- **Các bước:** Trưởng phòng Sản phẩm có một đơn nghỉ ngày 10/09 đang `PENDING`, rồi bấm chốt công tháng 9.
- **Kỳ vọng:** bị chặn giống như khi còn ngoại lệ chấm công chờ duyệt.
- **Thực tế:** chốt công thành công. Hàm chốt công chỉ kiểm tra `attendances.exception_status = PENDING`, **không kiểm tra bảng `employee_requests`**.
- **Đề xuất:** kiểm tra thêm `employee_requests` ở trạng thái `PENDING` hoặc `FORWARDED` có ngày nằm trong tháng.

### BUG-05: Cho phép chốt công tháng tương lai
- **Trạng thái:** ✅ **ĐÃ SỬA** (phương án A). Chỉ chốt công khi tháng đã kết thúc; giao diện ẩn nút và hiện "Chốt công được sau khi hết tháng". Retest C6, C7.
- **Mức độ:** Trung bình
- **Ca test:** C6
- **Các bước:** Trưởng phòng Vận hành chốt công tháng 12/2027.
- **Kỳ vọng:** bị chặn (tháng chưa diễn ra hoặc chưa kết thúc).
- **Thực tế:** thành công, thông báo được gửi tới kế toán.
- **Đề xuất:** chỉ cho chốt khi tháng đã kết thúc. Nếu cần chốt sớm, có thể cho phép từ ngày `payroll_cutoff_day` (seed đang để 25).

### BUG-06: Phân tách nhiệm vụ chưa chặt trong chính phòng TC-KT
- **Trạng thái:** ✅ **ĐÃ SỬA**. Mỗi người chỉ làm 1 bước trên 1 kỳ lương: GĐ không xác nhận kỳ lương do chính mình gửi; kế toán trưởng không duyệt nếu đã gửi hoặc đã xác nhận ở bước GĐ (nút cũng bị ẩn). Retest D21.
- **Mức độ:** Trung bình
- **Ca test:** quan sát trên giao diện của GĐ TC-KT, đối chiếu với code.
- **Hiện tượng:**
  - GĐ phòng TC-KT vừa là "Giám đốc phòng" vừa là "Kế toán trưởng". Với bảng lương **của phòng TC-KT**, một người có thể làm liên tiếp bước xác nhận của GĐ và bước kiểm tra của kế toán trưởng, trên bảng lương có cả lương của chính mình.
  - Kế toán viên tự tính lương cho chính mình.
- **Đề xuất:** với kỳ lương của phòng TC-KT, không cho người đã xác nhận ở bước GĐ duyệt tiếp bước kế toán trưởng (hoặc bỏ bước kế toán trưởng và chuyển thẳng CEO).

### BUG-07: Mã chứng từ quá dài trả thông báo lỗi khó hiểu
- **Trạng thái:** ✅ **ĐÃ SỬA**. Tối đa 100 ký tự, lỗi 400 "Mã chứng từ tối đa 100 ký tự"; ô nhập có `maxLength`. Retest C1.
- **Mức độ:** Thấp
- **Ca test:** C1
- **Các bước:** xác nhận chi trả với mã chứng từ 300 ký tự.
- **Thực tế:** lỗi 409 "Dữ liệu bị trùng hoặc không còn hợp lệ…" (do cột chỉ chứa được 255 ký tự).
- **Đề xuất:** kiểm tra độ dài ≤ 255 ở backend và đặt `maxLength` cho ô nhập ở frontend.

### BUG-08: Tham số sai kiểu gây lỗi 500
- **Trạng thái:** ✅ **ĐÃ SỬA**. `GlobalExceptionHandler` trả 400 "Tham số không hợp lệ hoặc bị thiếu" cho toàn app. Retest C5.
- **Mức độ:** Thấp (ảnh hưởng toàn app)
- **Ca test:** C5
- **Các bước:** `GET /api/payroll/batches?month=abc&year=2026`.
- **Thực tế:** lỗi 500.
- **Đề xuất:** `GlobalExceptionHandler` xử lý thêm `MethodArgumentTypeMismatchException` và `MissingServletRequestParameterException`, trả về 400.

### Quan sát (cần nghiệp vụ quyết định)
- **OBS-01:** ✅ **ĐÃ SỬA** theo yêu cầu nghiệp vụ: nhân viên nghỉ việc giữa tháng (`active = false`) **vẫn được tính lương những ngày đã làm**. Hệ thống lấy nhân viên đang làm, cộng thêm nhân viên đã nghỉ nhưng có ngày công trong tháng. Kế toán thấy ghi chú "Đã nghỉ việc, chỉ tính lương N ngày công đã làm". Retest D17: nhân viên có 2 ngày công được tính 425.200 đ. Giới hạn: người đã bị gỡ khỏi phòng ban (`department_id = NULL`) thì không xác định được phòng để tính.
- **OBS-02:** ✅ **ĐÃ SỬA**. Ô nào bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc CR sẽ được thêm dấu `'` phía trước, để Excel không hiểu là công thức (có unit test).

---

## 3. Chi tiết ca test

### A. Phân quyền (8/8 đạt)
| Ca | Nội dung | KQ |
|----|----------|----|
| A1 | Nhân viên thường không xem được kỳ lương phòng (403) | ✅ |
| A2 | ADMIN không xem được kỳ lương (403) | ✅ |
| A3 | Trưởng phòng ngoài TC-KT không tính được lương (403) | ✅ |
| A4 | CEO không tính lương thay kế toán (403) | ✅ |
| A5 | Nhân viên thường không chốt công (403) | ✅ |
| A6 | Kế toán viên (role nhân viên) không chốt công (403) | ✅ |
| A7 | Trưởng phòng chỉ thấy phòng mình | ✅ |
| A8 | Kế toán thấy đủ 10 phòng | ✅ |

### B. Vòng đời và trạng thái (25/25 đạt)
| Ca | Nội dung | KQ |
|----|----------|----|
| B1–B2 | Chốt công; chốt lần 2 bị chặn (409) | ✅ |
| B3–B5 | Gửi duyệt, chi trả, xuất file ngân hàng trước khi đủ điều kiện đều bị chặn | ✅ |
| B6–B7 | Tính lương; chỉ phòng đã chốt công được tính | ✅ |
| B8–B9 | Gửi duyệt; mở lại công sau khi gửi bị chặn | ✅ |
| B10 | GĐ phòng khác không xác nhận được (403) | ✅ |
| B11–B13 | Từ chối với lý do rỗng bị chặn; từ chối có lý do; lý do và bước từ chối hiển thị, kế toán được tính lại | ✅ |
| B14 | Sau khi bị từ chối, Trưởng phòng được mở lại công | ✅ |
| B15–B16 | Gửi lại; lý do từ chối cũ được xóa | ✅ |
| B17–B18 | CEO không chốt khi chưa qua kế toán trưởng; kế toán viên không duyệt thay kế toán trưởng | ✅ |
| B19–B20 | Kế toán trưởng duyệt; CEO chốt | ✅ |
| B21–B22 | Nhân viên thường không tải được file ngân hàng; file có BOM UTF-8, đủ dòng nhân viên và dòng tổng | ✅ |
| B23–B25 | Chi trả; chi lần 2 bị chặn; tính lại sau khi đã chi bị bỏ qua | ✅ |

### C. Dữ liệu biên (3/6 đạt)
| Ca | Nội dung | KQ |
|----|----------|----|
| C1 | Mã chứng từ 300 ký tự báo lỗi rõ ràng | ✅ (retest) |
| C2–C3 | Tháng 13, tháng 0 bị từ chối (400) | ✅ |
| C4 | Kỳ lương không tồn tại trả 404 | ✅ |
| C5 | Tham số sai kiểu không gây lỗi 500 | ✅ (retest) |
| C6 | Không cho chốt công tháng tương lai | ✅ (retest) |
| C7 | Không chốt công được tháng hiện tại (chưa kết thúc) | ✅ (retest) |

### D. Nghiệp vụ và đồng thời (13/17 đạt)
| Ca | Nội dung | KQ |
|----|----------|----|
| D1 | Công thức gross / bảo hiểm (ngưỡng 14 ngày) / thuế / net, không còn OT cũ | ✅ (retest) |
| D2 | Trưởng phòng không thấy lương Giám đốc phòng mình | ✅ |
| D3 | Trưởng phòng phòng khác không xem được chi tiết (403) | ✅ |
| D4 | Giám đốc thấy đủ nhân sự phòng | ✅ |
| D5–D6 | Nhân viên nhận đúng 1 thông báo chi trả; thấy phiếu lương đã chi | ✅ |
| D7 | Phòng không có GĐ chuyển thẳng tới kế toán trưởng | ✅ |
| D8–D10 | Kế toán trưởng tự gửi không tự duyệt được; nút duyệt bị ẩn; người khác duyệt được | ✅ |
| D11–D12 | Phòng TC-KT tính lương cho chính mình; cảnh báo 0 ngày công | ✅ |
| D13 | Cảnh báo nhân viên chưa cấu hình lương | ✅ |
| D14 | Còn đơn nghỉ chờ duyệt thì không cho chốt công | ✅ (retest) |
| D21 | GĐ TC-KT đã xác nhận thì không duyệt tiếp bước kế toán trưởng | ✅ (retest) |
| D22 | OT thật: thứ 7 200% + thứ 2 150% | ✅ (retest) |
| D23 | Còn đơn OT chờ duyệt thì không chốt công | ✅ (retest) |
| D24 | Seed: đơn chờ duyệt của Phạm Quốc Huy chặn chốt công tháng 9 | ✅ (retest) |
| D15 | Bảng công tháng đã chốt hoặc đã chi không bị sửa (tạo đơn lùi ngày bị chặn, duyệt đơn cũ bị chặn) | ✅ (retest) |
| D18 | Duyệt ngoại lệ chấm công của tháng đã chốt bị chặn | ✅ (retest) |
| D19 | Mở lại công thì tạo đơn tháng đó được trở lại | ✅ (retest) |
| D20 | Tháng chưa chốt không bị ảnh hưởng | ✅ (retest) |
| D16 | Chốt công đồng thời chỉ tạo 1 kỳ lương | ✅ (retest) |
| D17 | Nhân viên nghỉ việc giữa tháng vẫn được tính lương những ngày đã làm | ✅ (retest) |

### E. Giao diện (đạt)
- Menu đúng theo vai trò: nhân viên TC-KT thấy "Kế toán lương"; Trưởng phòng và GĐ thấy "Phiếu lương của tôi".
- Mỗi vai trò chỉ thấy đúng các nút mình được bấm, khớp với danh sách `actions` từ backend.
- Hộp từ chối: báo cảnh báo khi để trống lý do; sau khi từ chối, lý do hiện đỏ trên dòng của phòng.
- Hộp xác nhận, hộp chi tiết, hộp chi trả hiển thị đúng giữa màn hình kể cả khi trang đã cuộn (lỗi modal lệch trước đó đã được sửa).
- Màn hình hẹp hiển thị dạng thẻ, màn hình rộng dạng bảng; không bị che nút.

---

## 4. Kết luận

Toàn bộ lỗi đã được sửa và kiểm thử lại trên app thật (64/64 ca) cùng 77/77 unit test.

**Lưu ý khi demo:** do BUG-05, chỉ chốt công được các tháng đã kết thúc (ví dụ tháng 10 trở về trước khi đang ở tháng 11). Trưởng phòng phải xử lý hết đơn từ chờ duyệt của tháng trước khi chốt công (dữ liệu seed tháng 9 đang có 6 đơn chờ duyệt).
