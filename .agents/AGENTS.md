# QUY TẮC PHÁT TRIỂN DỰ ÁN DÀNH CHO AI AGENT

## 1. NGUYÊN TẮC DỮ LIỆU THẬT (ABSOLUTE REAL DATA POLICY)
**TUYỆT ĐỐI KHÔNG ĐƯỢC HARDCODE DỮ LIỆU MẪU (MOCK DATA) HOẶC PLACEHOLDER CHẾT TRONG CODE!**

Mọi tính năng, hiển thị, luồng AI đều phải sử dụng dữ liệu THẬT từ người dùng, cơ sở dữ liệu, hoặc API. Nếu thiếu dữ liệu hoặc API, phải tìm cách xử lý (ví dụ: dùng thư viện trích xuất, hoặc fallback báo lỗi rõ ràng) thay vì tự ý hardcode một chuỗi văn bản giả (dummy text) vào để lấp liếm.
Ví dụ: 
- Việc phân tích CV phải đọc text thực tế từ file PDF (sử dụng thư viện thực tế như pdfbox/pdfjs) thay vì gửi một chuỗi text "Mô phỏng nội dung..." tĩnh.
- Dữ liệu hiển thị lên giao diện phải lấy từ state/props thực tế, KHÔNG tự gõ cứng tên/số điện thoại/chức danh giả định vào màn hình chỉ để cho đẹp.

Hãy coi mọi dòng hardcode giả định là một lỗi nghiệp vụ nghiêm trọng.
