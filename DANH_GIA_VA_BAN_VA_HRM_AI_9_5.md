# ĐÁNH GIÁ VÀ BẢN VÁ ĐẶC TẢ WEB HRM AI

**Phạm vi:** A — Chấm CV theo JD chống thao túng; B — Theo dõi vòng đời nhân viên sau tuyển dụng  
**Ngày rà soát:** 21/09/2026  
**Cách chấm:** Chấm bản 1.0 trước khi vá, sau đó chấm lại khi áp dụng toàn bộ P0 và P1 được chỉ rõ.

> Kết luận ngắn: đây là **hai luồng liên thông trong cùng một hành trình nhân sự end-to-end**. Chúng được tách ranh giới trách nhiệm để tránh lẫn trạng thái, nhưng dùng chung định danh, audit, approval policy và các sự kiện nghiệp vụ. Phần chấm CV/JD là một nhánh hỗ trợ chạy bên trong tuyển dụng; phần vòng đời nhân viên bắt đầu khi một **offer version cụ thể** được ứng viên chấp nhận. AI analysis không phải hồ sơ nhân viên và không được dùng ngược lại để tự động quyết định lương, thăng chức hoặc chấm dứt lao động.

## 0. Quan hệ giữa luồng tuyển dụng và vòng đời nhân viên

```text
JOB REQUISITION
    ↓ APPROVED
JOB POSTING ────────────────────────────────┐
    ↓ APPLICATION_SUBMITTED                │ headcount / hiring seat
APPLICATION                               │
    ├── AI ANALYSIS CV ↔ JD (chạy song song, chỉ gợi ý)
    └── HR/TECH REVIEW → INTERVIEW → OFFER VERSION
                                      ↓ CANDIDATE ACCEPTED
                         RECRUITMENT_TO_EMPLOYEE_CONVERSION
                                      ↓
               PERSON + EMPLOYEE(PRE_BOARDING) + RESERVED SEAT
                                      ↓ JOINED
                 EMPLOYED → PROBATION/ACTIVE/LEAVE/CHANGE REQUEST
                                      ↓
                         OFFBOARDING → TERMINATED
```

### 0.1. Điểm nối bắt buộc

Điểm nối duy nhất từ tuyển dụng sang vòng đời nhân viên là sự kiện:

```text
OFFER_ACCEPTED(application_id, accepted_offer_version_id)
```

Không được tạo employee từ `OFFER_INTERNALLY_APPROVED` hoặc `OFFER_SENT`. Conversion phải có unique key theo `application_id + accepted_offer_version_id`, vì retry hoặc double-click không được tạo hai nhân viên.

### 0.2. Dữ liệu được kế thừa

| Nguồn tuyển dụng | Đích vòng đời | Quy tắc |
|---|---|---|
| `application.id` | `employee.application_id` | Unique; truy ngược được hồ sơ tuyển dụng gốc |
| Accepted `offer_version.id` | `employee.offer_id` và dữ liệu scheduled | Chỉ dùng đúng version ứng viên đã chấp nhận |
| Họ tên/liên hệ ứng viên | `person` provisional | Không auto-merge với person cũ chỉ bằng email/SĐT |
| Vị trí/phòng ban/quản lý dự kiến | `employment_record` scheduled | Có hiệu lực từ ngày bắt đầu, không ghi đè lịch sử |
| Lương thử việc đã chấp nhận | `compensation_record` scheduled | Chỉ activate theo effective date và sự kiện đi làm |
| Headcount của requisition/posting | `hiring_seat` | `AVAILABLE → RESERVED_ACCEPTED → JOINED/RELEASED` |
| Sự kiện tuyển dụng | `lifecycle_events` projection | Giữ ref đến application/offer, không sao chép mất nguồn |

### 0.3. Thành phần dùng chung

- `ApprovalPolicyResolver` và `approval_steps` dùng chung cơ chế, nhưng policy tuyển dụng và policy thay đổi nhân sự có loại riêng.
- Audit log, delegation, conflict-of-interest, outbox, idempotency và optimistic locking dùng chung hạ tầng.
- `person_id` tạo dòng thời gian thống nhất sau khi identity được xác minh; sự kiện trước đó vẫn giữ liên kết nguồn qua `application_id`.
- Posting/headcount nhận phản hồi từ vòng đời: nếu người đã accept không đến nhận việc, seat được release và tuyển dụng nhận sự kiện `REOPEN_REVIEW_REQUIRED`.

### 0.4. Ranh giới không được vượt

- AI CV/JD chỉ hỗ trợ tuyển dụng; không tái sử dụng Fit Score để chấm hiệu suất, tăng lương, thăng chức hoặc dự đoán nghỉ việc cá nhân.
- Dữ liệu nhân viên phát sinh sau tuyển dụng không được đưa ngược vào model chấm ứng viên nếu chưa có mục đích, căn cứ và kiểm soát riêng.
- Không sao chép toàn bộ CV/AI analysis sang hồ sơ nhân viên. Hồ sơ nhân viên chỉ nhận dữ liệu tối thiểu cần cho quan hệ lao động; bản tuyển dụng vẫn là nguồn audit riêng theo retention policy.

---

## 1. Bảng điểm

### 1.1. Điểm bản đặc tả 1.0 trước khi vá

#### Đặc tả A — Chấm CV theo JD

| Tiêu chí | Trọng số | Điểm | Lỗi đã trừ |
|---|---:|---:|---|
| A1. Chống thao túng | 25% | 9.0 | A-04 Lớn −1 |
| A2. Tách code/LLM và kiểm chứng | 20% | 8.0 | A-01 Lớn −1; A-02 Lớn −1 |
| A3. AI chỉ hỗ trợ | 15% | 9.0 | A-03 Lớn −1 |
| A4. Công bằng, riêng tư | 15% | 8.0 | A-03 Lớn −1; A-05 Lớn −1 |
| A5. Kiểm thử và hiệu chỉnh | 15% | 8.7 | A-06 Lớn −1; A-07 Nhỏ −0.3 |
| A6. Khả thi và phân pha | 10% | 9.0 | A-08 Lớn −1 |
| **Tổng A trước vá** | **100%** | **8.6/10** | Không có lỗi Nghiêm trọng, nhưng còn nhiều lỗi Lớn |

#### Đặc tả B — Vòng đời nhân viên

| Tiêu chí | Trọng số | Điểm | Lỗi đã trừ |
|---|---:|---:|---|
| B1. Nghiệp vụ và pháp lý | 25% | 7.0 | B-01 Nghiêm trọng −2; B-06 Lớn −1 |
| B2. Toàn vẹn dữ liệu | 20% | 7.0 | B-02 Nghiêm trọng −2; B-09 Lớn −1 |
| B3. Phân quyền và bảo mật | 20% | 8.0 | B-05 Lớn −1; B-10 Lớn −1 |
| B4. Cầu nối tuyển dụng | 15% | 7.0 | B-03 Nghiêm trọng −2; B-08 Lớn −1 |
| B5. Ngoại lệ và đồng thời | 10% | 7.0 | B-04 Nghiêm trọng −2; B-07 Lớn −1 |
| B6. Khả thi và phân pha | 10% | 9.0 | B-11 Lớn −1 |
| **Tổng B trước vá** | **100%** | **7.4/10** | Bị giới hạn vì còn lỗi Nghiêm trọng |

Điểm thấp của B không có nghĩa ý tưởng vòng đời sai. Nguyên nhân là bản 1.0 đang gộp trạng thái quan hệ lao động với trạng thái quy trình, trong khi các module chấm công, lương và phân quyền cần biết chính xác nhân viên còn đang làm việc hay không.

### 1.2. Điểm sau khi áp dụng bản vá

| Tiêu chí | Điểm sau vá | Cơ chế làm tăng độ tin cậy |
|---|---:|---|
| A1 | 9.7 | Kiểm tra file trước parser; loại span injection; overlap không tự kết tội toàn tiêu chí |
| A2 | 9.7 | Xác minh mọi citation sau tất cả lần gọi LLM; server tự gắn weight/multiplier và tính điểm |
| A3 | 9.8 | Không xếp hạng AI mặc định; hồ sơ AI lỗi/chưa chạy vẫn hiện đầy đủ cho HR |
| A4 | 9.5 | Tiêu chí được đóng băng theo posting; xử lý CV dài không thiên vị; bổ sung khung pháp lý 2026 |
| A5 | 9.7 | Thêm test tấn công, version-mixing, long-CV, parser và fairness sampling |
| A6 | 9.2 | Tách rõ P0/P1/P2 và có chế độ suy giảm khi thiếu hạ tầng |
| **Tổng A sau vá** | **9.6/10** | |

| Tiêu chí | Điểm sau vá | Cơ chế làm tăng độ tin cậy |
|---|---:|---|
| B1 | 9.5 | Tách employee status, leave, probation và offboarding; hỗ trợ không thử việc |
| B2 | 9.7 | Khoảng hiệu lực nửa mở, không chồng theo dimension; không tạo trước lương chính thức |
| B3 | 9.5 | Capability-based access, account chưa kích hoạt trước ngày đi làm, audit cả export |
| B4 | 9.7 | Conversion idempotent, identity provisional, seat ledger xử lý no-show |
| B5 | 9.6 | Checklist không chặn ngày nghỉ; approval và apply job chống chạy lặp |
| B6 | 9.1 | P0 đủ cho demo; các chức năng doanh nghiệp được đẩy sang P1/P2 |
| **Tổng B sau vá** | **9.5/10** | |

Điểm sau vá là điểm thiết kế đặc tả, không phải điểm chất lượng code. Để tuyên bố 9.5 cho sản phẩm triển khai cần có migration, test phân quyền, test state machine và minh chứng demo tương ứng.

---

## 2. Danh sách lỗi

### 2.1. Mức Nghiêm trọng

| ID | Mức | Vị trí | Mô tả | Vì sao sai hoặc rủi ro | Cách sửa cụ thể | Ưu tiên |
|---|---|---|---|---|---|---|
| B-01 | Nghiêm trọng | 4.3 | `ON_LEAVE` và `OFFBOARDING` được dùng như trạng thái nhân viên | Một người đang nghỉ dài hạn hoặc đang trong thời gian báo trước vẫn có quan hệ lao động. Đổi khỏi `ACTIVE` có thể làm chấm công, lương hoặc quyền truy cập hiểu sai | Tách `employee_status`, `leave_period`, `probation_status`, `onboarding_case` và `offboarding_case`; UI dùng trạng thái tổng hợp | P0 |
| B-02 | Nghiêm trọng | 4.2, 4.5 | Tạo lương thử việc và lương chính thức dự kiến cùng từ ngày bắt đầu | Có thể sinh hai bản ghi compensation cùng hiệu lực, mâu thuẫn trực tiếp với quy tắc không chồng | Chỉ tạo bản ghi lương thử việc `SCHEDULED`; lương chính thức giữ trong offer hoặc scheduled change và chỉ tạo/activate khi xác nhận đạt thử việc | P0 |
| B-03 | Nghiêm trọng | 4.1, 4.2 | “Tạo hoặc tái sử dụng person theo định danh đã xác thực” chưa có cơ chế định danh | Ở `OFFER_ACCEPTED` chưa có CCCD; email/SĐT có thể đổi hoặc được tái sử dụng. Auto-merge sai làm lộ lương và lịch sử của người khác | Tạo `person` provisional; chỉ auto-link khi có định danh mạnh đã xác minh; trường hợp mơ hồ phải manual match, hỗ trợ merge/unmerge có audit | P0 |
| B-04 | Nghiêm trọng | 4.3, 4.10 | Chỉ được `TERMINATED` khi toàn bộ checklist hoàn tất | Laptop chưa trả hoặc một task chậm không thể kéo dài quan hệ lao động trên hệ thống sau ngày chấm dứt; payroll và access sẽ sai | Chuyển `employee_status=TERMINATED` theo ngày hiệu lực; offboarding case/task còn mở ở `OVERDUE/PARTIAL` và tiếp tục xử lý | P0 |

### 2.2. Mức Lớn

| ID | Mức | Vị trí | Mô tả | Vì sao sai hoặc rủi ro | Cách sửa cụ thể | Ưu tiên |
|---|---|---|---|---|---|---|
| A-01 | Lớn | 3.5 bước 8–9 | Kiểm citation trước bước LLM phân loại bằng chứng | Citation do bước phân loại sinh ra có thể chưa từng được backend xác minh | LLM hoàn tất output → validate schema → xác minh mọi quote → áp luật hạ mức → code tính điểm | P0 |
| A-02 | Lớn | 3.4 | `criteria_version` có version nhưng chưa khóa theo posting/cohort | HR có thể đổi tiêu chí giữa đợt và các ứng viên bị so theo bộ tiêu chí khác nhau | Bind version bất biến trước khi `OPEN`; đổi version phải tạo analysis mới cho toàn bộ cohort hoặc tách cohort rõ ràng | P0 |
| A-03 | Lớn | 3.6, 3.10 | Mặc định sắp hồ sơ theo `evidence_score` | Không chặn về kỹ thuật nhưng tạo automation bias và khiến hồ sơ điểm thấp ít được mở | Mặc định theo thời gian nộp/SLA; AI sort là tùy chọn có nhãn; định kỳ bắt mẫu hồ sơ điểm thấp để HR audit | P0 |
| A-04 | Lớn | 3.3, 3.5 | Thiếu threat model cho file PDF/DOCX/ảnh không tin cậy | Parser có thể gặp file giả MIME, macro, decompression bomb, số trang quá lớn hoặc parser exploit | Kiểm magic bytes, size/page/uncompressed limit, cấm macro, sandbox parser, malware scan và timeout | P0 |
| A-05 | Lớn | 3.5 | Cắt CV quá dài rồi vẫn chấm/xếp hạng | Kinh nghiệm quan trọng ở phần bị cắt làm điểm sai có hệ thống theo cách trình bày CV | Chunk theo section và merge; nếu vẫn bỏ nội dung thiết yếu thì `NEEDS_MANUAL_REVIEW` và không đưa vào AI ranking | P0 |
| A-06 | Lớn | 3.7, 3.13 | Thiếu test cho template CV phổ biến, câu phủ định và evidence độc lập cạnh câu chép JD | Dễ cảnh báo sai hoặc tính “không biết Java” như có Java | Thêm test và luật context/negation; near-duplicate phải bỏ header/template trước khi so | P1 |
| A-08 | Lớn | Toàn phần A | Phân pha chưa đủ rõ; một lần giao hàng gồm OCR đối chứng, MinHash, fairness và calibration | Dễ hứa quá nhiều nhưng demo không có phần lõi ổn định | P0 chỉ gồm pipeline, evidence score, citation, consent và human review; OCR đối chứng/MinHash/fairness dashboard là P1 | P0 |
| B-05 | Lớn | 4.2 | Tạo account request ngay sau accept nhưng không nói account phải disabled | Admin có thể kích hoạt quyền truy cập trước ngày nhân viên thực sự đi làm | Tạo account ở `PREPARED_DISABLED`; chỉ kích hoạt khi có sự kiện `JOINED`, hoặc theo thời điểm được duyệt riêng | P0 |
| B-06 | Lớn | 4.3 | Bắt buộc mọi người đi qua `PROBATION`; thiếu ca quá hạn đánh giá | Có trường hợp không áp dụng thử việc `[CẦN XÁC MINH]`; thiếu review có thể làm hồ sơ kẹt vô hạn | Thêm `probation_status=NOT_APPLICABLE`; quá hạn chỉ escalation, không tự pass/fail | P0 |
| B-07 | Lớn | 4.4 | Status `PENDING_MANAGER/PENDING_HR/PENDING_HIGHER` mâu thuẫn approval policy động | Nếu manager là người đề xuất và không được tự duyệt thì state đầu tiên không đúng; số bước có thể thay đổi | Change request chỉ dùng `PENDING_APPROVAL`; bước hiện tại nằm trong `approval_steps` được resolver sinh ra | P0 |
| B-08 | Lớn | 4.2, 4.3 | No-show trả headcount nhưng application vẫn `OFFER_ACCEPTED` và posting có thể `FILLED` | Số người đã accept lịch sử khác số ghế đang được chiếm; trạng thái các module mâu thuẫn | Thêm hiring seat ledger: `RESERVED_ACCEPTED/JOINED/RELEASED`; no-show release ghế và tạo `REOPEN_REVIEW_REQUIRED` | P0 |
| B-09 | Lớn | 4.5 | Quy tắc mọi khoảng hiệu lực “không hở” áp dụng quá rộng | Leave, contract hoặc dữ liệu tùy chọn có thể có khoảng trống hợp lệ; rehire là employment khác | Dùng khoảng `[from,to)`; cấm overlap theo từng dimension; chỉ bắt liên tục cho dimension bắt buộc trong thời gian đang employed | P0 |
| B-10 | Lớn | 4.8 | “HR và CEO xem toàn bộ lương” quá rộng | Không phải mọi nhân sự HR đều cần thấy lương; tăng rủi ro nội gián và lộ dữ liệu | Dùng capability và scope: self/scope/full read, edit, export; mask mặc định; mọi read/export của người khác ghi audit | P0 |
| B-11 | Lớn | Toàn phần B | P0 đang gồm cả hợp đồng, lương, performance, change requests, leave, offboarding | Rủi ro không hoàn thiện được luồng nào đủ sâu trong thời gian thi | Demo P0 chỉ từ offer accepted → preboarding → joined → probation/not-applicable → active, kèm một change request và một offboarding case | P0 |

### 2.3. Mức Nhỏ

| ID | Mức | Vị trí | Mô tả | Vì sao sai hoặc rủi ro | Cách sửa cụ thể | Ưu tiên |
|---|---|---|---|---|---|---|
| A-07 | Nhỏ | 3.6 | Tên `claim_coverage` dễ bị hiểu là ứng viên thật sự có năng lực | Đây chỉ là độ phủ lời khai/từ khóa | Đổi nhãn UI thành “Độ phủ lời khai theo JD”; tooltip giải thích không phải xác minh năng lực | P1 |
| A-09 | Nhỏ | 3.7 | Near-duplicate có thể bắt nhầm CV dùng cùng template | Template không chứng minh hồ sơ bị sao chép | Loại phần layout/header/footer và chỉ so nội dung kinh nghiệm/dự án | P1 |
| B-12 | Nhỏ | 4.11 | Timeline append-only chỉ có `person_id`, trong khi trước accept chưa chắc có person đáng tin | Sự kiện APPLIED có thể không gắn đúng timeline sau này | Cho event dùng `subject_type/subject_id`; projection nối qua verified identity link mà không sửa event gốc | P1 |

---

## 3. Bản vá có thể dán trực tiếp

### [BỔ SUNG SAU 3.4] Khóa phiên bản tiêu chí và tính so sánh công bằng

Mỗi posting phải được liên kết với đúng một `criteria_version_id` bất biến trước khi chuyển sang `OPEN`. Bộ tiêu chí gồm ID, type, weight, synonyms và evidence expected; server kiểm tra ID không trùng, weight dương và tổng weight bằng 100. Model không được phép tự tạo hoặc thay đổi weight trong kết quả phân tích.

Khi HR thay tiêu chí sau khi đã có hồ sơ, hệ thống tạo version mới và bắt buộc chọn một trong hai chế độ:

1. Chạy lại toàn bộ hồ sơ đang hoạt động của posting bằng version mới; giao diện chỉ so sánh các kết quả cùng version.
2. Tạo cohort mới có thời điểm bắt đầu rõ ràng; không xếp chung ứng viên khác criteria version.

Mọi lần thay criteria version phải có người thay đổi, lý do, thời điểm và diff. Không cho sửa trực tiếp version đã dùng để chấm.

### [THAY 3.5] Quy trình xử lý an toàn và kiểm chứng đúng thứ tự

```text
1. Nhận file và consent; không consent → SKIPPED_NO_CONSENT, hồ sơ vẫn vào HR review.
2. Kiểm magic bytes, MIME thực, kích thước, số trang, dung lượng giải nén; cấm macro; malware scan và sandbox parser.
3. Trích text layer/OCR theo timeout; đánh giá extraction quality.
4. Phát hiện hidden text và các span có dạng chỉ dẫn/prompt injection; loại các span này khỏi scoring text nhưng lưu flag.
5. Kiểm tra định danh trên text sạch trước khi che dữ liệu nhạy cảm.
6. Che thuộc tính nhạy cảm; tạo model input chỉ gồm dữ liệu tối thiểu cần thiết.
7. LLM trích xuất cấu trúc và evidence candidate theo JSON schema; model không trả weight hoặc điểm cuối.
8. Backend validate schema, enum, criteria ID và giới hạn số lượng/độ dài.
9. Backend xác minh MỌI quote sau tất cả lần gọi LLM; quote không khớp bị loại.
10. Backend áp dụng luật hạ mức, context/negation và copied-span rule.
11. Backend tự gắn weight/multiplier từ criteria version đã khóa và tự tính điểm.
12. Code tính overlap JD, near-duplicate sau khi loại template và timeline consistency.
13. Ghi ai_analysis append-only và phát domain event qua outbox.
```

Parser không được có quyền truy cập mạng hoặc file hệ thống ngoài vùng tạm. Raw model response chỉ lưu ở vùng audit giới hạn quyền, không trả về public API.

CV dài được chia theo section và xử lý chunk-and-merge. Nếu giới hạn hệ thống vẫn khiến nội dung kinh nghiệm/dự án bị bỏ, analysis chuyển `NEEDS_MANUAL_REVIEW`, không có AI ranking score và hiển thị rõ phần nào chưa được xử lý.

### [THAY LUẬT 3 TRONG 3.6] Bằng chứng trùng JD

Overlap chỉ làm vô hiệu hoặc hạ mức **span bị trùng**, không tự động hạ toàn bộ tiêu chí. Nếu CV có một quote độc lập khác chứa vai trò/phạm vi/kết quả không nằm trong JD và quote đó được xác minh, hệ thống vẫn chấm theo quote độc lập. Chỉ khi toàn bộ bằng chứng hợp lệ của tiêu chí là các span sao chép đáng kể từ JD thì tiêu chí mới bị giới hạn ở `LISTED_ONLY` và gắn `EVIDENCE_COPIED_FROM_JD`.

Overlap tự thân chỉ là tín hiệu cần xác minh, không phải kết luận ứng viên thao túng. Near-duplicate giữa CV phải loại phần template, header/footer và boilerplate trước khi so sánh.

### [THAY 3.10] Trình bày kết quả để giảm automation bias

- Mặc định danh sách theo thời gian nộp hoặc SLA, không theo AI score.
- HR có thể chủ động bật “Sắp theo bằng chứng AI”; giao diện hiển thị nhãn đang dùng AI để sắp xếp.
- Không ẩn hồ sơ điểm thấp và không thay pagination count.
- Mỗi kỳ lấy mẫu ngẫu nhiên một tỷ lệ cấu hình từ nhóm điểm thấp để HR kiểm tra chéo.
- UI dùng nhãn “Độ phủ lời khai theo JD”, không dùng “độ phù hợp thực tế”.
- Câu trả lời sàng lọc hiển thị riêng và chỉ sinh verify point; mặc định không cộng vào evidence score của CV.

### [BỔ SUNG 3.13] Ca nghiệm thu bắt buộc sau bản vá

- Criteria version đổi giữa đợt: không có bảng xếp hạng trộn version.
- CV ghi “không có kinh nghiệm Java”: không được tính như có Java.
- CV dùng cùng template nhưng nội dung khác: không gắn near-duplicate.
- Một câu chép JD và một quote độc lập có metric thật: chỉ span chép bị hạ.
- CV dài có kinh nghiệm quan trọng ở cuối: chunk-and-merge giữ được bằng chứng; nếu không thì manual review.
- DOCX có macro hoặc file giả MIME: bị từ chối trước parser và không tạo AI run.
- Model trả criteria ID/weight lạ: backend reject output, không ghi điểm.
- Hồ sơ AI score thấp vẫn xuất hiện đầy đủ khi HR dùng chế độ mặc định.

### [BỔ SUNG SAU 3.12] Cập nhật căn cứ tuân thủ

Ngoài Nghị định 13/2023/NĐ-CP, cần đối chiếu **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15**, có hiệu lực từ 01/01/2026, và **Luật Trí tuệ nhân tạo số 134/2025/QH15**, có hiệu lực từ 01/03/2026. Phạm vi nghĩa vụ cụ thể đối với hệ thống AI hỗ trợ tuyển dụng, xử lý dữ liệu bởi nhà cung cấp bên ngoài, chuyển dữ liệu xuyên biên giới, hồ sơ đánh giá tác động, quyền của ứng viên và thời hạn lưu giữ phải được tư vấn pháp lý xác nhận `[CẦN XÁC MINH]`.

### [THAY 4.1, NGUYÊN TẮC 1] Một người, một định danh có kiểm soát

Ứng viên, nhân viên và người tái tuyển có thể liên kết về cùng một `person`, nhưng hệ thống không được auto-merge chỉ dựa trên họ tên, email hoặc số điện thoại. Trước khi có định danh mạnh đã xác minh, person ở trạng thái `PROVISIONAL`. Match mơ hồ tạo `IDENTITY_REVIEW`; HR được phép link/merge hoặc tách lại bằng thao tác có audit. Merge không xóa record gốc mà tạo mapping và lịch sử quyết định.

Dữ liệu application là snapshot tuyển dụng phục vụ audit; person là master data cho quan hệ lao động. Chỉ copy các trường tối thiểu cần thiết và ghi nguồn, không đồng bộ hai chiều tùy tiện.

### [THAY 4.2] Cầu nối idempotent từ tuyển dụng sang vòng đời

Khi một offer version cụ thể chuyển sang `ACCEPTED`, backend dùng `conversion_key = application_id + accepted_offer_version_id` có unique constraint và thực hiện trong một database transaction:

1. Tạo hoặc liên kết `person` theo quy tắc định danh; nếu chưa xác minh thì tạo provisional person, không merge tự động.
2. Tạo đúng một `employee` ở `PRE_BOARDING`, liên kết application và accepted offer version.
3. Tạo `employment_record` trạng thái `SCHEDULED`, hiệu lực từ ngày bắt đầu dự kiến.
4. Tạo compensation thử việc trạng thái `SCHEDULED` nếu có thử việc. Không tạo compensation chính thức đang hiệu lực ở bước này; mức chính thức dự kiến vẫn nằm ở accepted offer hoặc scheduled change.
5. Tạo AccountCreationRequest ở chế độ `PREPARE_ONLY`; account tạo ra phải `DISABLED` cho đến sự kiện `JOINED` hoặc thời điểm kích hoạt đã được phê duyệt.
6. Tạo onboarding case/checklist và hiring seat `RESERVED_ACCEPTED`.
7. Ghi lifecycle event/outbox event với idempotency key.

Email, provision tài khoản và tích hợp ngoài hệ thống không chạy trong DB transaction; chúng được xử lý từ outbox và có retry/idempotency riêng.

### [THAY 4.3] Tách quan hệ lao động khỏi quy trình

Không dùng một enum duy nhất để điều khiển tất cả module. Dữ liệu chuẩn gồm:

```text
employee_status:
  PRE_BOARDING | EMPLOYED | TERMINATED | ONBOARD_CANCELLED

onboarding_case_status:
  NOT_STARTED | IN_PROGRESS | COMPLETED | CANCELLED

probation_status:
  NOT_APPLICABLE | PLANNED | IN_PROGRESS | PASSED | FAILED | CANCELLED

offboarding_case_status:
  NONE | DRAFT | IN_NOTICE | READY_TO_CLOSE | COMPLETED | CANCELLED

leave_period.status:
  REQUESTED | APPROVED | IN_PROGRESS | COMPLETED | CANCELLED
```

UI có thể suy ra nhãn thân thiện `PRE_BOARDING`, `ONBOARDING`, `PROBATION`, `ACTIVE`, `ON_LEAVE`, `OFFBOARDING`, `TERMINATED`, nhưng các module lương/chấm công/quyền truy cập phải đọc các trường chuẩn tương ứng.

Quy tắc chuyển chính:

| Sự kiện | Thay đổi dữ liệu | Guard |
|---|---|---|
| Xác nhận ngày đầu đi làm | `employee_status=EMPLOYED`, onboarding `IN_PROGRESS`; activate account theo policy | Ngày bắt đầu hợp lệ, hồ sơ bắt buộc đủ hoặc có exception |
| Không đến/hủy trước ngày làm | `ONBOARD_CANCELLED`, seat `RELEASED` | Lý do bắt buộc; account chưa activate hoặc phải revoke |
| Không áp dụng thử việc | probation `NOT_APPLICABLE`; onboarding có thể hoàn tất sang trạng thái làm việc chính thức | Có căn cứ/chính sách `[CẦN XÁC MINH]` |
| Bắt đầu thử việc | probation `IN_PROGRESS` | Thỏa thuận/hợp đồng hợp lệ `[CẦN XÁC MINH]` |
| Đạt thử việc | probation `PASSED`; tạo/activate compensation chính thức từ effective date | Có review và văn bản quan hệ lao động hợp lệ |
| Quá hạn review | Giữ nguyên, tạo SLA escalation | Không tự pass hoặc tự fail |
| Nộp đơn nghỉ | Mở offboarding `IN_NOTICE`; employee vẫn `EMPLOYED` đến end date | Last working date được tính và xác nhận |
| Rút đơn được chấp thuận | offboarding `CANCELLED` | Trước effective end date, có quyết định |
| Đến ngày chấm dứt | `employee_status=TERMINATED`; offboarding có thể `COMPLETED` hoặc còn task `OVERDUE` | Không bị chặn bởi tài sản/chứng từ chưa hoàn tất |

Leave là khoảng thời gian riêng; nhân viên trong leave vẫn `EMPLOYED`. Chức danh, lương, hợp đồng và nhắc hạn tiếp tục tuân thủ effective date và policy.

### [THAY 4.4] State machine yêu cầu thay đổi

```text
DRAFT
  └─> PENDING_APPROVAL
        ├─> REVISION_REQUIRED ── sửa/gửi lại ─> PENDING_APPROVAL
        ├─> REJECTED
        └─> APPROVED ─> SCHEDULED ─> APPLYING ─> APPLIED
                                         └─────> APPLY_FAILED

DRAFT / REVISION_REQUIRED / PENDING_APPROVAL ─> CANCELLED
APPROVED / SCHEDULED ─> SUPERSEDED (khi có request thay thế hợp lệ)
```

Không dùng `PENDING_MANAGER/PENDING_HR/PENDING_HIGHER` làm trạng thái business. `ApprovalPolicyResolver` tạo danh sách `approval_steps`; bước hiện tại được xác định từ step chưa quyết định đầu tiên. Người đề xuất và chính nhân viên bị tác động không được làm approver trừ policy ngoại lệ được phê duyệt và audit.

Mỗi apply job có `application_key = change_request_id + version`, unique constraint, lock version và transaction. `APPLIED` chỉ được đặt sau khi history record và current projection cùng được cập nhật thành công.

### [THAY ĐOẠN CUỐI 4.5] Quy tắc dữ liệu có ngày hiệu lực

- Khoảng thời gian dùng dạng nửa mở `[effective_from, effective_to)`; `effective_to = null` nghĩa là còn hiệu lực.
- Cấm overlap trong cùng một employee và cùng dimension, ví dụ employment assignment hoặc base salary type.
- Chỉ bắt buộc không có khoảng hở đối với dimension bắt buộc trong khoảng `employee_status=EMPLOYED`. Leave, contract phụ, allowance tùy chọn và các employment khác nhau khi tái tuyển có thể có gap hợp lệ.
- Future-dated record có `record_status=SCHEDULED` và không xuất hiện trong current projection trước effective date.
- Phân biệt business change với correction. Correction có `supersedes_id`, `correction_reason`, `recorded_at`, `recorded_by`; không xóa record gốc.
- Payroll đã chốt dùng snapshot. Thay đổi hồi tố tạo adjustment line, không tính lại và ghi đè kỳ đã khóa.

### [BỔ SUNG SAU 4.5] Hiring seat và headcount

Headcount không chỉ đếm `OFFER_ACCEPTED`. Mỗi suất có trạng thái:

```text
AVAILABLE → RESERVED_ACCEPTED → JOINED
                         └────→ RELEASED
```

- `OFFER_ACCEPTED` reserve một seat trong transaction.
- `JOINED` chuyển seat sang occupied.
- Candidate rút nhận việc hoặc no-show chuyển seat `RELEASED` nhưng không xóa lịch sử offer accepted.
- Nếu posting đang `FILLED` mà seat bị release, tạo `REOPEN_REVIEW_REQUIRED`; HR quyết định mở lại posting hoặc chọn ứng viên dự phòng.
- Requisition `FULFILLED` chỉ là kết quả hiện tại và có thể chuyển về trạng thái cần tuyển bổ sung qua một domain event có audit, không âm thầm sửa lịch sử.

### [THAY 4.8] Quyền dữ liệu lương

Không cấp quyền lương theo role chung `HR`. Dùng capability có scope:

```text
SALARY_SELF_READ
SALARY_SCOPE_READ
SALARY_FULL_READ
SALARY_EDIT
SALARY_APPROVE
SALARY_EXPORT
```

HR Recruiter không mặc nhiên có quyền đọc lương nhân viên. HR Compensation/Payroll được cấp scope theo nhiệm vụ. CEO có thể xem dashboard tổng hợp; quyền xem chi tiết cần capability riêng. Admin kỹ thuật không có quyền nghiệp vụ mặc định.

API trả field đã mask nếu không có full-read. Mọi read, export, report và thay đổi quyền đối với dữ liệu lương của người khác ghi append-only access log gồm actor, subject, purpose, request ID, timestamp và result. Không ghi lương thô vào application log, notification hoặc error trace.

### [BỔ SUNG SAU 4.10] Thời điểm thu hồi quyền và kết thúc quan hệ lao động

- Nghỉ theo thông báo: lên lịch revoke theo last working timestamp đã duyệt.
- Chấm dứt khẩn cấp: policy có thể yêu cầu revoke ngay sau quyết định có hiệu lực `[CẦN XÁC MINH quy trình]`.
- Nếu IAM/revoke thất bại, employee vẫn chuyển trạng thái theo effective date nhưng tạo security incident P0 và retry/escalate; không giả vờ đã thu hồi thành công.
- Checklist tài sản, xác nhận, bảo hiểm và quyết toán có thể còn `OVERDUE` sau ngày nghỉ; chúng không kéo dài employee status.

### [BỔ SUNG 4.13] Phân pha triển khai

**P0 — đủ để đúng và demo:**

- Conversion idempotent từ accepted offer.
- Provisional identity, employee, account disabled và onboarding checklist.
- Employee status tách khỏi probation/offboarding/leave.
- Effective-dated employment và compensation không overlap.
- Một probation/not-applicable flow, một change request và một offboarding flow.
- Backend authorization, `@Version`, audit và outbox.

**P1 — tăng sức nặng:**

- Contract reminders, leave periods, salary access audit, seat ledger UI.
- Performance review làm căn cứ change request.
- Retrospective payroll adjustment và identity merge/unmerge UI.

**P2 — sau cuộc thi:**

- Tích hợp IAM/thiết bị/bảo hiểm/chữ ký điện tử thực tế.
- Policy designer nâng cao, analytics cohort và retention automation toàn hệ thống.

---

## 4. Phản ví dụ mới và kết quả kỳ vọng

| Mã | Kịch bản | Kết quả kỳ vọng |
|---|---|---|
| X1 | CV ghi “Tôi chưa từng làm Spring Boot” | Không tăng claim/evidence cho Spring Boot; có thể tạo verify point, không kết luận gian lận |
| X2 | Hai CV dùng cùng template Canva nhưng kinh nghiệm khác | Không gắn `NEAR_DUPLICATE_CV` sau khi bỏ template/boilerplate |
| X3 | CV chép một câu JD nhưng có đoạn độc lập mô tả dự án, vai trò và metric | Chỉ câu chép bị loại/hạ; quote độc lập vẫn được chấm |
| X4 | CV dài, kinh nghiệm phù hợp nằm ở trang cuối | Chunk-and-merge xử lý được; nếu không thì `NEEDS_MANUAL_REVIEW`, không xếp hạng bằng điểm thiếu |
| X5 | DOCX đổi đuôi PDF hoặc chứa macro/decompression bomb | Từ chối trước parser, ghi security event; không gọi LLM |
| X6 | Prompt injection dùng ký tự Unicode gần giống để né regex | Schema/code-score vẫn không cho model tự đặt điểm; span đáng ngờ có thể sót nên quote và criteria vẫn phải được xác minh |
| X7 | HR đổi criteria khi đã có 30 hồ sơ | Không trộn kết quả; hoặc chạy lại cả cohort, hoặc tạo cohort mới hiển thị riêng |
| X8 | Model trả `weight=100` cho một tiêu chí hoặc criteria ID không tồn tại | Backend reject output/đánh dấu run failed; weight luôn lấy từ server |
| X9 | Hai offer cùng được accept gần đồng thời khi còn một seat | Chỉ transaction giữ seat thành công; transaction còn lại nhận conflict và chuyển manual resolution, không tạo hai employee |
| X10 | Ứng viên accept, posting FILLED, sau đó no-show | Employee `ONBOARD_CANCELLED`, seat `RELEASED`, posting tạo `REOPEN_REVIEW_REQUIRED`; lịch sử offer không bị xóa |
| X11 | Nhân viên đã nộp đơn nghỉ nhưng còn 30 ngày làm việc | Employee vẫn `EMPLOYED`; offboarding `IN_NOTICE`; payroll/chấm công tiếp tục theo policy |
| X12 | Đến ngày nghỉ nhưng laptop chưa trả | Employee chuyển `TERMINATED`; asset task `OVERDUE` và escalation, không kéo dài quan hệ lao động |
| X13 | Người tái tuyển dùng email mới; một người khác dùng lại số điện thoại cũ | Không auto-merge bằng email/SĐT; tạo identity review, cho phép link/unlink có audit |
| X14 | Tăng lương hồi tố sau khi kỳ lương đã khóa | Không sửa payroll cũ; tạo compensation correction và adjustment line ở kỳ tiếp theo |
| X15 | Vị trí không áp dụng thử việc | probation `NOT_APPLICABLE`; vẫn hoàn tất onboarding và chuyển employee sang luồng active hợp lệ |
| X16 | Apply job chạy lại sau khi timeout | Unique application key trả lại kết quả đã áp dụng; không tạo history record thứ hai |

---

## 5. Rủi ro tồn dư

1. **CV bịa chi tiết vẫn có thể đạt điểm cao.** Evidence trong CV chỉ chứng minh câu đó có trong CV, không chứng minh sự việc là thật. Giảm nhẹ bằng verify points, phỏng vấn cấu trúc và reference check có consent.
2. **OCR và redaction không hoàn hảo.** Có thể bỏ sót thuộc tính nhạy cảm hoặc đọc sai. Giảm nhẹ bằng quality gate, manual review và golden set đa định dạng/ngôn ngữ.
3. **Model có drift và không hoàn toàn tái lập.** Lưu model/prompt/input version, chạy regression trước khi đổi model và có kill switch về manual-only.
4. **HR vẫn có automation bias.** Không thể loại bỏ chỉ bằng giao diện. Giảm nhẹ bằng sort trung lập, sample điểm thấp, đào tạo và đo override theo nhóm tổng hợp.
5. **Identity resolution có false match/false split.** Không auto-merge trên định danh yếu; hỗ trợ manual review và reversible merge.
6. **Quy định pháp luật và chính sách lương thay đổi theo thời gian.** Dùng policy có effective date và bắt buộc legal owner phê duyệt version.
7. **Outbox bảo đảm giao lại ít nhất một lần, không bảo đảm side effect bên ngoài tuyệt đối chỉ một lần.** Consumer phải idempotent và có reconciliation job.
8. **Người có quyền hợp lệ vẫn có thể lạm dụng dữ liệu.** Giảm nhẹ bằng least privilege, access log, cảnh báo truy cập bất thường và review định kỳ.

---

## 6. Điểm cần xác minh bên ngoài

| Nội dung | Trạng thái | Nguồn/người cần đối chiếu |
|---|---|---|
| Nghĩa vụ của hệ thống AI hỗ trợ tuyển dụng, phân loại rủi ro, thông báo và giám sát con người | `[CẦN XÁC MINH]` | Luật Trí tuệ nhân tạo 134/2025/QH15; tư vấn pháp lý/đơn vị tuân thủ AI |
| Consent, xử lý bởi Gemini, chuyển dữ liệu xuyên biên giới, DPIA và retention CV/employee | `[CẦN XÁC MINH]` | Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, Nghị định 13/2023/NĐ-CP và văn bản hướng dẫn hiện hành; DPO/pháp chế |
| Mức lương tối thiểu vùng áp dụng tại thời điểm effective date | `[CẦN XÁC MINH]` | Nghị định 293/2025/NĐ-CP đang áp dụng từ 01/01/2026 và văn bản thay thế sau đó |
| Thời gian thử việc, lương thử việc, số lần thử việc, loại hợp đồng và báo trước | `[CẦN XÁC MINH]` | Văn bản hợp nhất Bộ luật Lao động hiện hành; luật sư lao động/HR compliance |
| Trường hợp không thử việc hoặc thử việc nằm trong hợp đồng lao động | `[CẦN XÁC MINH]` | Bộ luật Lao động và chính sách hợp đồng của doanh nghiệp |
| Thời điểm kích hoạt/thu hồi quyền khi nhân viên nghỉ hoặc bị chấm dứt | `[CẦN XÁC MINH]` | Pháp chế, HR, Information Security và quy chế nội bộ |
| Lưu trữ/xóa hồ sơ sau `TERMINATED`, dữ liệu cần giữ cho thuế, lương và bảo hiểm | `[CẦN XÁC MINH]` | Pháp chế, kế toán, BHXH và chính sách retention của doanh nghiệp |

Không hardcode giá trị pháp lý trong source code. Lưu policy version có `effective_from`, nguồn phê duyệt, người xác nhận và test theo ngày hiệu lực.

---

## 7. Câu hỏi mở cần chốt

1. P0 có chấp nhận dùng **sắp xếp theo thời gian/SLA làm mặc định**, còn AI ranking chỉ là tùy chọn hay không?
2. Khi chỉ còn một headcount, doanh nghiệp cho phép gửi nhiều offer đồng thời hay phải reserve seat ngay từ lúc gửi offer?
3. Định danh mạnh dùng để link/tái tuyển sẽ là CCCD đã xác minh, mã nhân viên cũ hay quy trình manual của HR?
4. Tài khoản được kích hoạt đúng sự kiện `JOINED`, hay doanh nghiệp cần quyền truy cập giới hạn trước ngày đi làm?
5. Trong demo chung kết, ưu tiên thể hiện sâu **AI chống thao túng** hay **timeline vòng đời + change request** nếu thời gian chỉ đủ hoàn thiện một điểm nhấn nâng cao?
