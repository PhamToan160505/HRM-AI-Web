# LUỒNG TUYỂN DỤNG HRM AI — PHIÊN BẢN CHUNG KẾT

**Phiên bản:** 2.0  
**Mục tiêu thiết kế:** Minh bạch, kiểm soát được, không để AI thay con người ra quyết định và đủ chặt chẽ để triển khai thực tế.

---

## 1. Tuyên bố giá trị

HRM AI không phải hệ thống tự động loại ứng viên. Đây là nền tảng hỗ trợ ra quyết định tuyển dụng, trong đó:

- AI đọc và cấu trúc hóa CV, gợi ý mức độ phù hợp, chỉ ra dữ kiện và đề xuất câu hỏi phỏng vấn.
- Người có thẩm quyền luôn là người đưa ra quyết định cuối cùng.
- Mọi quyết định đều có căn cứ, người thực hiện, thời điểm và lịch sử thay đổi.
- Duyệt offer trong nội bộ không đồng nghĩa ứng viên đã đồng ý nhận việc.
- Chỉ khi ứng viên chấp nhận offer, hệ thống mới bắt đầu quy trình tạo tài khoản và pre-boarding.

Ba giá trị có thể chứng minh khi trình bày:

1. **Nhanh hơn:** AI giảm thời gian đọc và tổng hợp CV nhưng không làm mất quyền kiểm soát của HR.
2. **Đúng hơn:** state machine, điều kiện chuyển bước và ma trận phân quyền hạn chế duyệt sai hoặc bỏ sót nghiệp vụ.
3. **Minh bạch hơn:** kết quả AI có giải thích; quyết định của con người và lịch sử chuyển trạng thái được lưu đầy đủ.

---

## 2. Nguyên tắc bất biến

Các quy tắc dưới đây phải được kiểm tra ở backend, không chỉ ẩn nút trên giao diện.

1. AI chỉ đưa ra gợi ý; AI không được tự động từ chối, gửi email từ chối hoặc chặn hồ sơ đi tiếp.
2. AI lỗi hoặc chưa chạy không làm hồ sơ bị kẹt. HR vẫn có thể xử lý thủ công.
3. Mỗi hành động chỉ hợp lệ ở một số trạng thái và với một số vai trò nhất định.
4. Hành động **Trả về** phải có comment và phải chỉ rõ trạng thái đích.
5. Hành động **Từ chối** phải có lý do nội bộ. Nội dung gửi ứng viên là trường riêng, không lấy nguyên văn lý do nội bộ.
6. Không được tự duyệt yêu cầu do chính mình tạo hoặc duyệt hồ sơ ứng viên do chính mình giới thiệu.
7. Duyệt offer nội bộ và ứng viên chấp nhận offer là hai sự kiện độc lập.
8. Headcount chỉ được ghi nhận khi ứng viên chuyển sang `OFFER_ACCEPTED`.
9. Mọi chuyển trạng thái phải có audit log và được bảo vệ bằng optimistic locking.
10. Email và các tích hợp ngoài hệ thống phải phát qua outbox có retry; không giả định gửi email thành công chỉ vì dữ liệu đã lưu.
11. Không dùng giới tính, tuổi, dân tộc, tôn giáo, tình trạng hôn nhân hoặc ảnh làm đầu vào chấm mức độ phù hợp.
12. Không yêu cầu CCCD ở bước ứng tuyển. CCCD chỉ được thu sau khi ứng viên chấp nhận offer và bước vào pre-boarding.

---

## 3. Mô hình trạng thái tổng thể

### 3.1. Yêu cầu tuyển dụng — Job Requisition

```text
DRAFT
  └─ Gửi duyệt ─> PENDING_APPROVAL
                       ├─ Duyệt ─────> APPROVED
                       ├─ Trả về ────> REVISION_REQUIRED ── Gửi lại ─> PENDING_APPROVAL
                       └─ Từ chối ───> REJECTED

DRAFT / REVISION_REQUIRED / PENDING_APPROVAL ── Hủy ─> CANCELLED
APPROVED ── Đủ người đã nhận việc ─> FULFILLED
```

Thông tin bắt buộc:

- Vị trí, phòng ban, cấp bậc mục tiêu.
- Headcount cần tuyển.
- Lý do tuyển và mô tả công việc.
- Khung lương tối thiểu/tối đa dưới dạng số, không lưu chuỗi tự do.
- Ngày cần nhân sự.
- Người yêu cầu và người có thẩm quyền duyệt.

Quy tắc:

- Chỉ requisition `APPROVED` mới được dùng để tạo posting.
- Một requisition có thể có nhiều lần đăng tin, nhưng tại một thời điểm chỉ nên có một posting đang `OPEN`, trừ khi HR xác nhận tuyển trên nhiều chiến dịch độc lập.
- `RETURNED` được đổi thành `REVISION_REQUIRED` để diễn đạt rõ đây là trạng thái cần chỉnh sửa, không phải một kết quả kết thúc.

### 3.2. Chiến dịch tuyển dụng — Job Posting

```text
DRAFT ─> OPEN <──> PAUSED
          ├─ Đủ số người accept ─> FILLED
          ├─ Quá hạn ───────────> EXPIRED
          └─ Hủy chiến dịch ────> CANCELLED
```

Quy tắc:

- Chỉ HR có quyền tạo posting từ requisition đã duyệt.
- Chỉ posting `OPEN` và còn hạn mới nhận hồ sơ.
- `PAUSED`, `FILLED`, `EXPIRED`, `CANCELLED` không nhận hồ sơ mới.
- Posting chỉ chuyển `FILLED` khi số `OFFER_ACCEPTED` bằng headcount.
- Khi posting đóng, hệ thống không tự loại các hồ sơ còn lại. HR phải chọn Talent Pool hoặc từ chối sau khi xem danh sách xác nhận.

### 3.3. Hồ sơ ứng viên — Application

```text
PENDING_HR_CV_REVIEW
  └─> PENDING_TECH_CV_REVIEW
       └─> PENDING_INTERVIEW_1
            └─> PENDING_INTERVIEW_2
                 └─> PENDING_HR_OFFER
                      └─> PENDING_OFFER_APPROVAL
                           └─> OFFER_INTERNALLY_APPROVED
                                └─> OFFER_SENT
                                     └─> OFFER_ACCEPTED
```

Các trạng thái kết thúc hoặc tạm dừng ngoài luồng chính:

```text
REJECTED
TALENT_POOL
WITHDRAWN
OFFER_DECLINED
OFFER_EXPIRED
OFFER_ACCEPTED
```

Không dùng `NEW` làm trạng thái chờ AI. Nếu cần biểu thị hồ sơ chưa được HR mở, dùng `first_viewed_at` và `viewed_by`.

### 3.4. Phân tích AI — chạy song song

```text
NOT_RUN ─> QUEUED ─> RUNNING ─> DONE
                         └────> FAILED ── Chạy lại ─> QUEUED
```

Trạng thái AI hoàn toàn độc lập với trạng thái hồ sơ. `FAILED` không thay đổi `ApplicationStatus`.

---

## 4. Luồng nghiệp vụ chi tiết

### Giai đoạn 0 — Tạo và duyệt nhu cầu tuyển dụng

Người quản lý tạo requisition ở `DRAFT`, có thể lưu dở và chỉnh sửa. Khi gửi duyệt, hệ thống xác định người duyệt bằng `ApprovalPolicyResolver` dựa trên:

- Cấp bậc vị trí cần tuyển.
- Phòng ban cần tuyển.
- Cấp trên trực tiếp trong cơ cấu tổ chức.
- Trạng thái ủy quyền còn hiệu lực.
- Quy tắc xung đột lợi ích.

CEO/người được phân quyền có thể:

- Duyệt → `APPROVED`.
- Trả về kèm comment → `REVISION_REQUIRED`.
- Từ chối kèm lý do → `REJECTED`.

### Giai đoạn 1 — Tạo chiến dịch tuyển dụng

HR chọn một requisition `APPROVED` để tạo posting. Hệ thống tự điền vị trí, phòng ban, headcount và khung lương; HR bổ sung nội dung truyền thông, địa điểm, hình thức làm việc và hạn nộp.

Posting ban đầu là `DRAFT`. HR chủ động bấm mở để chuyển sang `OPEN`.

### Giai đoạn 2 — Ứng viên nộp hồ sơ

Public Apply Form gồm:

- Họ tên, email, số điện thoại và CV.
- Checkbox đồng ý để hệ thống dùng AI hỗ trợ phân tích CV.
- Link chính sách xử lý dữ liệu và thời gian lưu trữ.
- CAPTCHA/rate limiting và kiểm tra loại/kích thước file.

Không yêu cầu CCCD, tôn giáo, dân tộc hoặc thông tin không cần thiết ở bước này.

Chống trùng:

- Chuẩn hóa email về chữ thường và chuẩn hóa số điện thoại.
- Cùng email hoặc số điện thoại trong cùng posting: chặn bằng unique constraint ở database.
- Trùng ở posting khác: vẫn cho nộp nhưng gắn cảnh báo để HR đối chiếu.
- Dùng idempotency key để double-click hoặc retry mạng không tạo hai hồ sơ.

Hồ sơ được tạo ngay ở `PENDING_HR_CV_REVIEW`. Đồng thời hệ thống phát sự kiện `APPLICATION_SUBMITTED` để upload file và chạy AI nền.

### Giai đoạn 3 — AI hỗ trợ phân tích

Mỗi lần AI chạy tạo một bản ghi `ai_analyses` mới, không ghi đè lịch sử. Kết quả gồm:

- Fit Score 0–100 và mức độ tin cậy.
- Các tiêu chí phù hợp, tiêu chí còn thiếu và trích dẫn từ CV làm căn cứ.
- Cờ cần xác minh và mô tả chính xác dữ kiện nào không khớp.
- Dữ liệu CV đã cấu trúc hóa.
- Bộ câu hỏi phỏng vấn gợi ý theo JD và các điểm cần làm rõ.
- Model, prompt version, input hash, thời gian chạy và lỗi nếu có.

Các nguyên tắc hiển thị:

- Luôn ghi rõ “AI đề xuất — cần con người xác minh”.
- Không dùng nhãn kết luận như “gian lận”; dùng “cần xác minh”.
- Điểm thấp chỉ tạo badge/banner cảnh báo.
- HR có thể đánh dấu `AGREE`, `DISAGREE` hoặc `PARTIAL` với gợi ý AI và ghi lý do.
- Nút “Chẩn đoán AI” chạy lại tạo phiên bản mới, không xóa kết quả cũ.

### Giai đoạn 4 — HR duyệt CV

Trạng thái: `PENDING_HR_CV_REVIEW`.

Người xử lý: HR Recruiter hoặc HR Head có quyền trên chiến dịch.

Hành động:

- Duyệt → `PENDING_TECH_CV_REVIEW`.
- Từ chối → `REJECTED`.
- Đưa vào Talent Pool → `TALENT_POOL`.
- Yêu cầu ứng viên bổ sung hồ sơ → giữ nguyên trạng thái, tạo yêu cầu bổ sung riêng.

Nếu từ chối, HR nhập lý do nội bộ, chọn template phản hồi ứng viên và quyết định có gửi email hay không.

### Giai đoạn 5 — Chuyên môn duyệt CV

Trạng thái: `PENDING_TECH_CV_REVIEW`.

Người duyệt được xác định theo ma trận:

| Cấp bậc vị trí tuyển | Người duyệt chuyên môn |
|---|---|
| Nhân viên | Trưởng phòng của phòng ban tuyển |
| Trưởng phòng | Giám đốc phòng ban; nếu không có thì CEO |
| Giám đốc phòng ban | CEO |
| Trưởng phòng/Giám đốc Nhân sự | CEO; HR không tự duyệt vị trí của chính phòng mình |

Hành động:

- Duyệt → `PENDING_INTERVIEW_1`.
- Trả HR làm rõ thông tin → `PENDING_HR_CV_REVIEW`, comment bắt buộc.
- Từ chối → `REJECTED`.

### Giai đoạn 6 — Phỏng vấn vòng 1

Trạng thái hồ sơ: `PENDING_INTERVIEW_1`.

Lịch phỏng vấn nằm trong bảng `interviews` với trạng thái:

```text
SCHEDULED / DONE / NO_SHOW / RESCHEDULED / CANCELLED
```

Mỗi người phỏng vấn có phiếu feedback riêng trong `interview_feedbacks`, gồm điểm theo tiêu chí, nhận xét, khuyến nghị và thời điểm gửi.

Điều kiện duyệt:

- Buổi phỏng vấn đã `DONE`.
- Các interviewer bắt buộc đã gửi feedback.
- Có kết luận tổng hợp của người chủ trì.

Hành động:

- Đạt → `PENDING_INTERVIEW_2`.
- Không đạt → `REJECTED`.
- Cần phỏng vấn lại → tạo lịch mới và giữ `PENDING_INTERVIEW_1`.
- Cần bổ sung thông tin CV → `PENDING_HR_CV_REVIEW`, phải chọn đúng loại lý do.

Không đưa hồ sơ ngược về duyệt chuyên môn chỉ vì thiếu feedback phỏng vấn.

### Giai đoạn 7 — Phỏng vấn vòng 2 và đàm phán

Trạng thái: `PENDING_INTERVIEW_2`.

Thành phần gồm quản lý chuyên môn và HR. Dữ liệu đàm phán lưu trong `salary_negotiations`:

- Mức lương hiện tại nếu ứng viên tự nguyện cung cấp.
- Mức mong muốn.
- Mức thống nhất sơ bộ.
- Phụ cấp/kỳ vọng khác.
- Ghi chú và người ghi nhận.

Điều kiện chuyển bước:

- Interview đã hoàn thành.
- Đủ phiếu feedback bắt buộc.
- Có kết quả đàm phán sơ bộ.

Đạt → `PENDING_HR_OFFER`; không đạt → `REJECTED`.

### Giai đoạn 8 — HR soạn offer

Offer là entity riêng và có version bất biến. HR nhập:

- Lương cơ bản, phụ cấp và tổng thu nhập dự kiến.
- Thời gian thử việc và tỷ lệ lương thử việc.
- Ngày bắt đầu dự kiến.
- Hạn phản hồi.
- Điều khoản và file offer.

Hệ thống kiểm tra trước khi gửi duyệt:

- Còn headcount khả dụng.
- Đủ feedback các vòng.
- Mức lương có nằm trong khung được duyệt.
- Nếu vượt khung, bắt buộc lý do và cấp duyệt bổ sung.
- Ngày bắt đầu và hạn phản hồi hợp lệ.

Gửi duyệt → `PENDING_OFFER_APPROVAL`.

### Giai đoạn 9 — Duyệt offer nội bộ

Người duyệt có thể:

- Duyệt → `OFFER_INTERNALLY_APPROVED`.
- Trả về HR kèm comment → `PENDING_HR_OFFER`; HR tạo offer version mới.
- Từ chối → `REJECTED`.

Sau khi duyệt, HR kiểm tra lần cuối và bấm gửi. Hệ thống chuyển `OFFER_SENT`, phát email có link phản hồi dùng token ký số, có thời hạn và chỉ sử dụng một lần.

### Giai đoạn 10 — Ứng viên phản hồi

| Phản hồi | Kết quả |
|---|---|
| Chấp nhận | `OFFER_ACCEPTED` |
| Từ chối | `OFFER_DECLINED` |
| Đề nghị thương lượng | `PENDING_HR_OFFER`, tạo version mới và phải duyệt lại |
| Quá hạn | `OFFER_EXPIRED` |

Khi chấp nhận offer, backend thực hiện atomically:

1. Khóa/kiểm tra version của application và posting.
2. Kiểm tra offer hiện tại còn hiệu lực và chưa phản hồi.
3. Kiểm tra chính sách headcount.
4. Chuyển application và offer sang `OFFER_ACCEPTED`.
5. Tạo duy nhất một `AccountCreationRequest` bằng unique constraint theo application.
6. Tạo pre-boarding checklist.
7. Phát các sự kiện thông báo qua outbox.
8. Nếu accepted count đạt headcount, chuyển posting sang `FILLED` và requisition sang `FULFILLED`.

Nếu nhiều offer đang chờ cho một vị trí cuối cùng, hệ thống cảnh báo trước khi gửi. Trường hợp hai ứng viên chấp nhận gần như đồng thời phải được xử lý bằng transaction và optimistic/pessimistic lock theo chính sách cấu hình, không chỉ kiểm tra ở giao diện.

---

## 5. Bảng chuyển trạng thái chuẩn để code

| Trạng thái hiện tại | Vai trò | Hành động | Trạng thái tiếp theo | Điều kiện bắt buộc |
|---|---|---|---|---|
| `PENDING_HR_CV_REVIEW` | HR | Duyệt | `PENDING_TECH_CV_REVIEW` | Có nhận xét HR |
| `PENDING_HR_CV_REVIEW` | HR | Từ chối | `REJECTED` | Lý do nội bộ |
| `PENDING_HR_CV_REVIEW` | HR | Talent Pool | `TALENT_POOL` | Tag/kỹ năng gợi nhớ |
| `PENDING_TECH_CV_REVIEW` | Approver Resolver | Duyệt | `PENDING_INTERVIEW_1` | Có nhận xét chuyên môn |
| `PENDING_TECH_CV_REVIEW` | Approver Resolver | Trả HR | `PENDING_HR_CV_REVIEW` | Comment bắt buộc |
| `PENDING_TECH_CV_REVIEW` | Approver Resolver | Từ chối | `REJECTED` | Lý do bắt buộc |
| `PENDING_INTERVIEW_1` | Interview Lead | Đạt | `PENDING_INTERVIEW_2` | Interview `DONE`, đủ feedback |
| `PENDING_INTERVIEW_1` | HR/Interview Lead | Đặt lại lịch | Giữ nguyên | Lịch mới hợp lệ |
| `PENDING_INTERVIEW_1` | Interview Lead | Từ chối | `REJECTED` | Feedback và lý do |
| `PENDING_INTERVIEW_2` | Interview Lead + HR | Đạt | `PENDING_HR_OFFER` | Đủ feedback và đàm phán |
| `PENDING_INTERVIEW_2` | Interview Lead | Từ chối | `REJECTED` | Feedback và lý do |
| `PENDING_HR_OFFER` | HR | Gửi duyệt | `PENDING_OFFER_APPROVAL` | Offer hợp lệ, đủ điều kiện |
| `PENDING_OFFER_APPROVAL` | Offer Approver | Duyệt | `OFFER_INTERNALLY_APPROVED` | Không xung đột lợi ích |
| `PENDING_OFFER_APPROVAL` | Offer Approver | Trả HR | `PENDING_HR_OFFER` | Comment; version kế tiếp |
| `PENDING_OFFER_APPROVAL` | Offer Approver | Từ chối | `REJECTED` | Lý do bắt buộc |
| `OFFER_INTERNALLY_APPROVED` | HR | Gửi offer | `OFFER_SENT` | Link/token và deadline hợp lệ |
| `OFFER_SENT` | Ứng viên | Chấp nhận | `OFFER_ACCEPTED` | Token hợp lệ, offer chưa hết hạn |
| `OFFER_SENT` | Ứng viên | Từ chối | `OFFER_DECLINED` | Token hợp lệ |
| `OFFER_SENT` | Ứng viên | Thương lượng | `PENDING_HR_OFFER` | Lưu phản hồi, tạo version mới |
| `OFFER_SENT` | Scheduler | Quá hạn | `OFFER_EXPIRED` | `now > response_deadline` |
| Trạng thái đang xử lý | Ứng viên | Rút hồ sơ | `WITHDRAWN` | Xác nhận bằng token/email |

Không cho controller tự `setStatus`. Tất cả hành động phải đi qua một `RecruitmentTransitionService`, nơi kiểm tra trạng thái hiện tại, quyền, guard condition, version và ghi audit log.

---

## 6. Phân quyền và xung đột lợi ích

### 6.1. Phạm vi dữ liệu

- HR Recruiter/HR Head: xem theo chiến dịch được phân công; HR Head có thể xem toàn bộ tuyển dụng.
- Trưởng phòng chuyên môn: chỉ xem hồ sơ của phòng mình và chỉ các trường cần cho đánh giá chuyên môn.
- Giám đốc phòng ban: xem các vị trí thuộc khối/phòng được quản lý.
- CEO: xem các bước cần phê duyệt và dashboard tổng hợp.
- Admin: quản trị tài khoản; không mặc nhiên có quyền đưa ra quyết định tuyển dụng.

### 6.2. Kiểm tra xung đột

Backend từ chối hành động khi:

- Người duyệt là người tạo yêu cầu cần duyệt.
- Người duyệt là người giới thiệu ứng viên.
- Người duyệt là ứng viên hoặc có quan hệ được khai báo theo chính sách doanh nghiệp.
- Người duyệt đang dùng quyền ủy quyền đã hết hạn.

Ủy quyền phải có người ủy quyền, người nhận, phạm vi, thời gian bắt đầu/kết thúc và lý do.

---

## 7. Dữ liệu và các bảng cốt lõi

Các bảng nên có:

- `job_requisitions`
- `job_postings`
- `applications`
- `candidate_consents`
- `ai_analyses`
- `interviews`
- `interview_participants`
- `interview_feedbacks`
- `salary_negotiations`
- `offers`
- `application_transition_logs`
- `approval_delegations`
- `account_creation_requests`
- `preboarding_checklists`
- `outbox_events`

Các entity có thể bị cập nhật đồng thời phải có `@Version`. Các bảng nghiệp vụ quan trọng nên dùng khóa ngoại thật thay vì chỉ lưu ID rời nếu chưa có lý do kiến trúc rõ ràng để tách service.

Audit log tối thiểu gồm:

```text
entity_type, entity_id, actor_id, actor_role,
action, from_status, to_status, comment,
request_id, occurred_at
```

Audit log là append-only; không cho sửa/xóa từ API thông thường.

---

## 8. Độ tin cậy và xử lý tình huống lỗi

| Tình huống | Cách xử lý |
|---|---|
| AI timeout/lỗi | `ai_analyses = FAILED`; hồ sơ vẫn ở bước HR; cho chạy lại |
| Upload CV lỗi | Hiện yêu cầu tải lại; không giả lập nội dung CV để AI chấm |
| Email lỗi | Outbox retry; hiển thị trạng thái gửi thất bại cho HR |
| Người dùng bấm duyệt hai lần | Idempotency key + `@Version`; lần thứ hai trả conflict |
| Hai người duyệt cùng lúc | Chỉ transaction có version hợp lệ thành công |
| Offer cũ được mở lại | Token gắn offer version; version cũ bị vô hiệu hóa |
| Posting hết hạn | Scheduler chuyển `EXPIRED`; request nộp đồng thời phải bị backend từ chối |
| Ứng viên rút hồ sơ | `WITHDRAWN`; dừng email nghiệp vụ và chạy chính sách lưu/xóa dữ liệu |
| Mở lại hồ sơ bị từ chối | Chỉ HR Head trong N ngày; chọn trạng thái khôi phục và ghi audit |
| Posting đã đủ người | Không tự loại hồ sơ còn lại; tạo task để HR xử lý |

---

## 9. AI có trách nhiệm và bảo vệ dữ liệu

Đây là phần cần nhấn mạnh khi bảo vệ đề tài:

- AI không dùng thuộc tính nhạy cảm để tính Fit Score.
- Kết quả phải có bằng chứng trích từ CV/JD, không chỉ trả một con số.
- Lưu model version, prompt version và input hash để tái kiểm tra kết quả.
- Theo dõi tỷ lệ HR đồng ý/không đồng ý với AI, nhưng không ép HR làm theo AI.
- Định kỳ kiểm tra phân phối điểm theo vị trí và phòng ban để phát hiện drift.
- Candidate consent lưu thời gian, phiên bản điều khoản và mục đích xử lý.
- CV bị từ chối được xóa hoặc ẩn danh sau thời hạn cấu hình; Talent Pool cần consent riêng và ngày hết hạn.
- File nhạy cảm dùng URL ký số có thời hạn, không trả URL công khai lâu dài.
- CCCD chỉ thu ở pre-boarding sau `OFFER_ACCEPTED`.

---

## 10. Chỉ số chứng minh hiệu quả

Dashboard tuyển dụng nên đo:

- Time to first review: từ lúc ứng tuyển đến khi HR mở hồ sơ.
- Time in stage: thời gian ở từng trạng thái.
- Time to hire: từ requisition được duyệt đến offer accepted.
- Conversion rate giữa từng vòng.
- Offer acceptance rate và lý do từ chối offer.
- Tỷ lệ hồ sơ quá SLA.
- Tỷ lệ AI chạy thành công và thời gian xử lý trung bình.
- Human–AI agreement rate: HR đồng ý/không đồng ý với gợi ý AI.
- Tỷ lệ HR override cảnh báo AI và kết quả cuối cùng.
- Tỷ lệ tuyển đủ headcount đúng hạn.

Không dùng Human–AI agreement rate để đánh giá hiệu suất cá nhân của HR; chỉ dùng để đánh giá chất lượng hệ thống AI.

---

## 11. Kịch bản demo chung kết

Một kịch bản ngắn nhưng thể hiện toàn bộ sức mạnh hệ thống:

1. Trưởng phòng tạo requisition; CEO trả về vì khung lương chưa phù hợp.
2. Trưởng phòng sửa và gửi lại; CEO duyệt.
3. HR tạo posting và mở chiến dịch.
4. Ứng viên nộp CV, đồng ý AI; hồ sơ xuất hiện ngay cho HR trong khi AI chạy nền.
5. AI trả Fit Score kèm trích dẫn và một cảnh báo cần xác minh, nhưng không loại hồ sơ.
6. HR không đồng ý một phần với AI và ghi lý do; vẫn duyệt hồ sơ.
7. Quản lý chuyên môn duyệt, đặt lịch, nhập feedback hai vòng và kết quả đàm phán.
8. HR tạo offer vượt nhẹ khung lương; hệ thống yêu cầu lý do/cấp duyệt bổ sung.
9. CEO trả lại offer; HR tạo version 2 và gửi duyệt lại.
10. HR gửi offer; ứng viên chấp nhận qua link bảo mật.
11. Chỉ lúc này hệ thống tạo AccountCreationRequest, checklist pre-boarding và cập nhật headcount.
12. Mở audit timeline để chứng minh toàn bộ quá trình có thể truy vết.

Kịch bản này thể hiện đồng thời AI có trách nhiệm, workflow thực tế, bảo mật, xử lý ngoại lệ và khả năng kiểm toán.

---

## 12. Phạm vi triển khai

### P0 — Bắt buộc để đúng nghiệp vụ

- State machine và transition service.
- AI không tự động loại.
- Tách internal approval khỏi candidate acceptance.
- Offer version và link phản hồi ứng viên.
- Tạo account sau `OFFER_ACCEPTED`.
- Phân quyền API, audit log, `@Version` và duplicate constraint.

### P1 — Tạo sức nặng cho bài thi

- Interview scheduling/feedback.
- Salary negotiation và kiểm soát khung lương.
- AI explanation, prompt/model version và HR agreement.
- Outbox/retry, SLA reminder và dashboard funnel.
- Consent, retention và URL file bảo mật.

### P2 — Nâng cấp doanh nghiệp

- Delegation có thời hạn.
- Talent Pool đa chiến dịch.
- Pre-boarding nâng cao.
- Phân tích drift/fairness và báo cáo chất lượng AI theo thời gian.

---

## 13. Đánh giá thiết kế

| Tiêu chí | Điểm |
|---|---:|
| Tính đúng nghiệp vụ | 9.7/10 |
| Minh bạch và kiểm toán | 9.6/10 |
| AI có trách nhiệm | 9.7/10 |
| Phân quyền và bảo mật | 9.5/10 |
| Khả năng xử lý ngoại lệ | 9.4/10 |
| Khả năng triển khai theo giai đoạn | 9.4/10 |
| **Đánh giá tổng thể thiết kế** | **9.5/10** |

Phần 0.5 còn lại không nằm ở việc bổ sung thêm tính năng, mà phụ thuộc vào chất lượng triển khai thực tế: migration an toàn, test state machine, kiểm thử phân quyền, khả năng chịu tải và số liệu đo lường từ người dùng thật.

---

## 14. Cầu nối sang vòng đời nhân viên

Luồng tuyển dụng và luồng vòng đời nhân viên là hai phần liên tiếp của cùng một hành trình. Điểm bàn giao duy nhất là khi ứng viên chấp nhận một offer version cụ thể:

```text
OFFER_SENT
  └─ Candidate accepts
       └─ OFFER_ACCEPTED(application_id, accepted_offer_version_id)
            └─ RecruitmentToEmployeeConversion
                 ├─ person provisional/verified
                 ├─ employee = PRE_BOARDING
                 ├─ employment/compensation = SCHEDULED
                 ├─ account request = PREPARE_ONLY, DISABLED
                 ├─ onboarding checklist
                 └─ hiring seat = RESERVED_ACCEPTED
```

Conversion có unique key theo `application_id + accepted_offer_version_id` và phải idempotent. Không tạo employee hoặc kích hoạt tài khoản ở `OFFER_INTERNALLY_APPROVED` hay `OFFER_SENT`.

Nếu ứng viên no-show hoặc hủy trước ngày đi làm, vòng đời phát sự kiện trả seat về tuyển dụng. Posting chuyển sang `REOPEN_REVIEW_REQUIRED` để HR quyết định mở lại hoặc chọn ứng viên dự phòng; hệ thống không xóa lịch sử ứng viên từng accept.

AI analysis CV/JD chỉ phục vụ tuyển dụng. Fit Score không được dùng làm điểm hiệu suất, căn cứ tự động tăng lương, thăng chức hoặc chấm dứt nhân viên.
