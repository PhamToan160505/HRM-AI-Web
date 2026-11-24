# Quy tắc phát triển dự án HRM AI

## 1. Ghi nhận tính năng hoàn thành của Phòng Công nghệ
Mỗi khi hoàn thành xong bất kỳ một tính năng hoặc nghiệp vụ nào thuộc **Phòng Công nghệ**:
- Ghi tên tính năng kèm theo mô tả ngắn gọn về tính năng vào file `cac_tinh_nang_phong_cong_nghe.txt` tại thư mục gốc của dự án (`d:\LapTrinh\Java_Backend\JavaWeb_Project\HRM-AI-Web\cac_tinh_nang_phong_cong_nghe.txt`).
- Nếu file chưa tồn tại, khởi tạo file với tiêu đề rõ ràng.
- Định dạng mỗi mục ghi nhận:
  ```text
  [Số thứ tự]. [Tên tính năng]
  - Ngày hoàn thành: [YYYY-MM-DD HH:mm]
  - Mô tả: [Mô tả ngắn gọn về chức năng và ý nghĩa nghiệp vụ]
  - Thành phần liên quan:
    + Backend: [Controller/Service/Migration/Entity]
    + Frontend: [Page/Component/Route]
  --------------------------------------------------
  ```

## 2. Nhắc nhở Chặng tiếp theo (Sau khi test xong Phòng Công nghệ ↔ Phòng Nhân sự)
Ngay khi người dùng thông báo đã test xong các tính năng liên kết **Phòng Công nghệ ↔ Phòng Nhân sự**, **BẮT BUỘC chủ động nhắc người dùng** chuyển sang chặng kế tiếp gồm 2 nội dung trọng tâm (lập bảng kế hoạch chi tiết để duyệt trước khi code):
1. **Nâng cấp luồng duyệt Yêu cầu Tuyển dụng (`JobRequisition`) đa cấp sát thực tế công ty phần mềm quy mô vừa**:
   - Từ 1 cấp thẳng lên CEO → nâng cấp thành luồng tuần tự 3 cấp: `Trưởng phòng tạo` → `Bước 1: Giám đốc Phòng ban duyệt chuyên môn/Bench` → `Bước 2: Phòng Tài chính - Kế toán thẩm định ngân sách quỹ lương` → `Bước 3: CEO phê duyệt cuối` → `HR tạo chiến dịch` (cập nhật cả phạm vi hiển thị cho Giám đốc phòng ban & Tài chính).
2. **Liên kết nghiệp vụ Phòng Công nghệ ↔ Phòng Tài chính - Kế toán**:
   - Thẩm định ngân sách tuyển dụng (`JobRequisition` → Finance).
   - Hạch toán & đối soát giờ công kỹ sư, Billable/Internal, Man-days và chi phí nhân công theo dự án (`TechWorklog` → Finance/Payroll).
   - Đồng bộ kết quả phê duyệt Tăng lương / Phụ cấp từ Đánh giá Kỹ sư sang kỳ lương do Phòng Tài chính điều phối (tôn trọng khóa kỳ lương `PayrollPeriodLock`).
   - Đề xuất tài trợ / hoàn ứng lệ phí Chứng chỉ Quốc tế (AWS, Oracle, ISTQB...) sang Tài chính duyệt chi.
*(Gỡ mục 2 này khỏi `AGENTS.md` sau khi đã bắt đầu/hoàn tất chặng này).*


