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

