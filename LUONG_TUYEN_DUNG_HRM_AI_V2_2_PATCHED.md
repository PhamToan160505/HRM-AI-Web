# LUỒNG TUYỂN DỤNG V2.2 VÀ AI CHẤM CV V1.2

**Hệ thống:** HRM AI
**Phiên bản:** 2.2 (luồng tuyển dụng) và 1.2 (AI chấm CV) — cập nhật sau vòng rà soát thứ hai
**Phạm vi:** Requisition → Posting → Application → Phỏng vấn → Offer → Suất tuyển (seat) → `OFFER_ACCEPTED`.
Vòng đời nhân viên sau khi ứng viên chấp nhận offer nằm ở tài liệu riêng: `VONG_DOI_NHAN_VIEN_HRM_AI_P0_1.md`.

**Ký hiệu:** `P0` là bắt buộc để đúng nghiệp vụ và demo; `P1` là tăng sức nặng nếu còn thời gian; `P2` là hướng phát triển. `[CẦN XÁC MINH]` là khẳng định pháp lý hoặc số liệu phải đối chiếu bên ngoài trước khi cố định.

**Nguyên tắc không hardcode (đọc trước khi triển khai bất kỳ mục nào dưới đây):** xem mục 0. Mọi con số, ngưỡng, hệ số, ma trận duyệt và tham số pháp lý xuất hiện trong tài liệu này (ví dụ 0.25, 0.6, 1.0, "5 MB", "10 trang", "N ngày") là **giá trị khởi tạo mẫu** để minh họa, không phải giá trị được phép gán cứng trong code. Toàn bộ phải được đọc từ cấu hình qua service/API mô tả ở mục 0.

---

## 0. Nguyên tắc không hardcode (bắt buộc, áp dụng cho toàn bộ tài liệu)

**Yêu cầu:** không có giá trị nghiệp vụ nào — dù chỉ một số hay một chữ — được viết cứng trong mã nguồn Java, TypeScript hay bất kỳ file cấu hình build nào. Mọi giá trị nghiệp vụ đọc từ database qua một lớp cấu hình, tại thời điểm chạy.

### 0.1. Phân loại "cấu trúc" và "cấu hình"

Có hai loại giá trị khác nhau về bản chất, và tài liệu này chỉ yêu cầu loại thứ hai phải cấu hình hóa:

| Loại | Ví dụ | Cách xử lý |
|---|---|---|
| **Cấu trúc (structural)** | Tên trạng thái trong state machine (`PENDING_HR_CV_REVIEW`, `OFFER_SENT`…), tên bảng, tên cột, tên sự kiện | Đây là **hợp đồng của kiến trúc phần mềm**, biểu diễn bằng enum hoặc hằng số trong code như bình thường. Biến chúng thành dữ liệu nghĩa là xây một workflow engine động hoàn toàn — đây là hướng P2 riêng (mục 0.4), không phải yêu cầu của bản P0/P1 |
| **Cấu hình nghiệp vụ (business config)** | Ngưỡng điểm, hệ số, ma trận ai duyệt ai, giới hạn dung lượng file, số ngày SLA, tham số pháp luật, danh sách mẫu regex, danh sách nhãn thuộc tính nhạy cảm | **Bắt buộc nằm trong database**, đọc qua `ConfigurationService`/API, có `effective_from`, người sửa, lý do |

Nói cách khác: **code trả lời "luồng đi theo hình nào", cấu hình trả lời "con số và ai là ai trong hình đó là bao nhiêu"**. Yêu cầu "không hardcode" trong tài liệu này áp dụng cho cột bên phải.

### 0.2. Cơ chế bắt buộc

- **Bảng cấu hình:** `system_configurations` (khóa, giá trị, kiểu dữ liệu, mô tả, `effective_from`, `updated_by`, `updated_at`), `scoring_profiles` (phiên bản cấu hình chấm điểm bất biến), `scoring_parameters` (tham số AI thuộc đúng một `scoring_profile_id`), `legal_parameters` (tham số pháp lý, bắt buộc `effective_from`, `source_reference`, `verified_by`), `approval_policies` (đã có ở mục 4), `redaction_rules`, `injection_patterns`, `common_phrases` (mục 12).
- **`ConfigurationService`:** lớp service duy nhất đọc các bảng trên, có cache trong bộ nhớ và làm mới cache khi có thay đổi (qua sự kiện hoặc TTL ngắn). Toàn bộ nơi khác trong code gọi qua service này, **không** có class nào tự định nghĩa `private static final double WEIGHT_LISTED_ONLY = 0.25`.
- **API quản trị cấu hình:** endpoint cho phép người có quyền (HR Head, CEO, hoặc vai trò System Config Admin) xem và sửa giá trị cấu hình, có xác nhận, lưu lịch sử phiên bản. Đây cũng là màn hình để demo tính "không hardcode" trước giám khảo: sửa một ngưỡng trên UI, thấy hành vi hệ thống đổi ngay mà không cần deploy lại.
- **Không có giá trị mặc định ẩn trong code khi thiếu cấu hình.** Nếu một khóa cấu hình bắt buộc chưa có trong database, service trả lỗi rõ ràng ("Thiếu cấu hình: scoring.evidence_grade.high_ratio_threshold") thay vì âm thầm dùng một số cứng.
- **Cấu hình chấm điểm có version bất biến.** Mọi lần sửa hệ số hoặc ngưỡng tạo một `scoring_profile` mới ở `DRAFT`; chỉ profile đã `ACTIVE` mới được chọn cho posting mới hoặc cho một đợt chạy lại có chủ đích. Không sửa trực tiếp các tham số thuộc profile đã được dùng để chấm.
- Mọi giá trị số hoặc mẫu regex xuất hiện trong các mục dưới đây được đánh dấu bằng ký hiệu `⚙` và liệt kê tên khóa cấu hình tương ứng ở mục 0.3.

### 0.3. Danh mục khóa cấu hình (không đầy đủ, bổ sung khi triển khai)

| Khóa | Dùng ở đâu | Bảng |
|---|---|---|
| `seat.max_overbook_per_requisition` | Mục 7.3 | `system_configurations` |
| `application.reopen_window_days` | Mở lại hồ sơ bị từ chối (R30) | `system_configurations` |
| `upload.max_file_size_mb`, `upload.max_pages` | Mục 5 Giai đoạn 2, mục 11.8 | `system_configurations` |
| `scoring.evidence_multiplier.listed_only`, `.mentioned`, `.demonstrated` | Mục 11.5 | `scoring_parameters` |
| `scoring.evidence_grade.low_ratio`, `.high_ratio`, `.high_score_min`, `.low_score_max` | Mục 11.5 | `scoring_parameters` |
| `scoring.ngram_n` | Mục 11.6 | `scoring_parameters` |
| `scoring.copy_span_threshold` | Mục 11.5 luật 6 | `scoring_parameters` |
| `scoring.mirroring_warn_threshold` | Mục 11.6 | `scoring_parameters` |
| `scoring.confidence.unverified_citation_ratio_max` | Mục 11.9 | `scoring_parameters` |
| `redaction.sensitive_field_labels` | Mục 11.12 | `redaction_rules` |
| `ai_safety.injection_patterns` | Mục 11.7 | `injection_patterns` |
| `scoring.common_phrases` | Mục 11.6 | `common_phrases` |
| `legal.probation.max_days_by_level` | Roadmap vòng đời, tham chiếu ở đây để nhất quán | `legal_parameters` |
| `legal.minimum_regional_wage` | Kiểm tra offer | `legal_parameters` |
| `approval.offer_over_budget_requires_extra_step` | Mục 4.3 | `approval_policies` |

Đây là danh mục khởi điểm. Khi triển khai, mọi hằng số mới phát sinh phải được thêm vào bảng này trước khi viết code dùng nó.

### 0.4. Giới hạn thẳng thắn

Biến **toàn bộ state machine** (tên trạng thái, thứ tự bước) thành dữ liệu động là một hướng kiến trúc khác hẳn (workflow engine cấu hình được, kiểu Camunda hoặc tự viết), tốn nhiều thời gian hơn nhiều so với những gì còn lại trong cuộc thi. Tài liệu này **không** đề xuất làm việc đó ở P0 hoặc P1. Nếu giám khảo hỏi sâu về "không hardcode", câu trả lời chính xác là: mọi tham số và ma trận nghiệp vụ được cấu hình hóa qua database (đã làm), còn cấu trúc quy trình là kiến trúc phần mềm được thiết kế tường minh, có thể mở rộng thêm bước qua cấu hình `approval_policies` mà không cần sửa code (đã có ở mục 4), và việc biến cả state machine thành dữ liệu là hướng P2 nếu sản phẩm phát triển thành nền tảng cấu hình được cho nhiều doanh nghiệp khác nhau.

---



## 1. Tuyên bố giá trị

HRM AI không phải hệ thống tự động loại ứng viên. Đây là nền tảng hỗ trợ ra quyết định tuyển dụng:

- AI đọc và cấu trúc hóa CV, chỉ ra bằng chứng và những điểm cần xác minh, đề xuất câu hỏi phỏng vấn.
- Người có thẩm quyền luôn là người quyết định cuối cùng.
- Mọi quyết định có căn cứ, người thực hiện, thời điểm và lịch sử thay đổi.
- Duyệt offer trong nội bộ không đồng nghĩa ứng viên đã đồng ý nhận việc.
- Suất tuyển được giữ từ lúc gửi offer, nên ứng viên đã nhận offer không bao giờ bị báo "hết suất" khi bấm chấp nhận.

Ba giá trị có thể chứng minh bằng dữ liệu khi trình bày:

1. **Nhanh hơn:** AI giảm thời gian đọc và tổng hợp CV nhưng HR giữ toàn quyền kiểm soát.
2. **Đúng hơn:** state machine, điều kiện chuyển bước, cơ chế duyệt nhiều bước và ma trận phân quyền hạn chế duyệt sai, bỏ sót và xung đột lợi ích.
3. **Minh bạch hơn:** điểm AI đi kèm trích dẫn đã xác minh, quyết định của con người và lịch sử chuyển trạng thái được lưu đầy đủ.

Điểm khác biệt của phần AI: **chấm theo bằng chứng chứ không chấm theo từ khóa**. Một CV sao chép ngôn từ của JD đạt độ phủ lời khai cao nhưng mức bằng chứng thấp, và hệ thống hiển thị cả hai trục để HR nhìn thấy khoảng chênh đó.

---

## 2. Nguyên tắc bất biến

Mọi quy tắc dưới đây phải được kiểm tra ở backend, không chỉ ẩn nút trên giao diện.

1. AI chỉ đưa ra gợi ý. AI không tự từ chối, không gửi email từ chối, không chặn hồ sơ đi tiếp.
2. AI lỗi, chưa chạy hoặc ứng viên không đồng ý dùng AI không làm hồ sơ bị kẹt. HR vẫn xử lý thủ công.
3. Mọi chuyển trạng thái đi qua `RecruitmentTransitionService`. Controller không được tự `setStatus`. Hành động không có trong bảng chuyển trạng thái (mục 6) mặc định bị từ chối.
4. Hành động **Trả về** phải có comment và chỉ rõ trạng thái đích.
5. Hành động **Từ chối** phải có lý do nội bộ. Nội dung gửi ứng viên là trường riêng, không lấy nguyên văn lý do nội bộ.
6. Không tự duyệt yêu cầu do chính mình tạo, và không duyệt hồ sơ ứng viên do chính mình giới thiệu.
7. Duyệt offer nội bộ và ứng viên chấp nhận offer là hai sự kiện độc lập.
8. **Suất tuyển được giữ (reserve) từ `OFFER_SENT`**, tiếp tục được giữ trong lúc thương lượng, và được nhả khi ứng viên từ chối, offer quá hạn, offer bị thu hồi, hồ sơ bị từ chối hoặc ứng viên rút.
9. Gửi offer khi không còn suất khả dụng chỉ được phép khi **HR Head xác nhận rõ đó là offer dự phòng (overbook)**, có lý do, và không vượt giới hạn cấu hình.
10. Mọi chuyển trạng thái có audit log append-only và được bảo vệ bằng optimistic locking.
11. Tác vụ ngoài hệ thống (email, tích hợp) phát qua bảng outbox có retry. Không giả định gửi thành công chỉ vì dữ liệu đã lưu.
12. Không dùng giới tính, tuổi, dân tộc, tôn giáo, tình trạng hôn nhân, ảnh làm đầu vào chấm CV.
13. Không yêu cầu CCCD ở bước ứng tuyển. CCCD chỉ được thu sau `OFFER_ACCEPTED`, ở giai đoạn pre-boarding.
14. Tiêu chí và cấu hình chấm CV được khóa theo posting bằng cặp `(criteria_version_id, scoring_profile_version_id)`. Đổi một trong hai sau khi posting `OPEN` thì tạo version mới và chỉ chạy lại tập hồ sơ còn ở giai đoạn đánh giá CV/phỏng vấn được định nghĩa tại mục 5, Giai đoạn 1. Không so sánh hoặc xếp hạng kết quả thuộc hai cặp version khác nhau.
15. Kết quả AI dùng nhãn "cần xác minh", không dùng nhãn kết luận như "gian lận". Điểm AI chỉ để cảnh báo và sắp xếp tùy chọn, không bao giờ là cổng chặn.

---

## 3. Mô hình trạng thái

### 3.1. Yêu cầu tuyển dụng (Job Requisition)

```text
DRAFT ── Gửi duyệt ──> PENDING_APPROVAL
                          ├─ Duyệt (bước cuối) ─> APPROVED ── đủ suất ACCEPTED/JOINED ─> FULFILLED
                          ├─ Trả về ────────────> REVISION_REQUIRED ── Gửi lại ─> PENDING_APPROVAL
                          └─ Từ chối ───────────> REJECTED

FULFILLED ── có suất trở về AVAILABLE ─> APPROVED (hệ thống, có audit)
DRAFT / REVISION_REQUIRED ── Hủy ─> CANCELLED
PENDING_APPROVAL ── Người tạo thu hồi ─> DRAFT
APPROVED ── Hủy (CEO/HR Head, có lý do) ─> CANCELLED
```

Thông tin bắt buộc: vị trí, phòng ban, cấp bậc, headcount, lý do tuyển, mô tả công việc, khung lương tối thiểu/tối đa dưới dạng số, ngày cần nhân sự, người yêu cầu.

Khi requisition chuyển `APPROVED`, hệ thống sinh đúng `headcount` bản ghi `hiring_seats` ở trạng thái `AVAILABLE` (mục 7).

### 3.2. Chiến dịch tuyển dụng (Job Posting)

```text
DRAFT ─> OPEN <──> PAUSED
          ├─ đủ suất ACCEPTED/JOINED ─> FILLED ── HR mở lại (khi có suất trống) ─> OPEN
          ├─ quá hạn ────────────────> EXPIRED ── HR gia hạn ─> OPEN
          └─ HR Head hủy ────────────> CANCELLED
```

- Chỉ requisition `APPROVED` mới tạo được posting.
- Posting chỉ chuyển `OPEN` khi **bộ tiêu chí và scoring profile đã được người có quyền xác nhận, rồi khóa thành cặp version** (mục 11.3).
- Một requisition có thể có nhiều lần đăng tin, nhưng tại một thời điểm chỉ một posting `OPEN`, trừ khi HR xác nhận tuyển trên nhiều chiến dịch độc lập.
- Posting đóng (`FILLED`, `EXPIRED`, `CANCELLED`) không tự loại các hồ sơ còn lại. Hệ thống tạo task để HR chọn Talent Pool hoặc từ chối hàng loạt sau khi xem danh sách xác nhận.

### 3.3. Hồ sơ ứng viên (Application)

Luồng chính:

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

Trạng thái kết thúc hoặc tạm dừng ngoài luồng chính:

| Trạng thái | Ý nghĩa | Có thể mở lại |
|---|---|---|
| `REJECTED` | Bị từ chối bởi người có thẩm quyền | HR Head mở lại trong ⚙ `application.reopen_window_days` |
| `TALENT_POOL` | Lưu để dùng cho posting sau, cần consent riêng và ngày hết hạn | HR kích hoạt lại |
| `WITHDRAWN` | Ứng viên rút hồ sơ | Không |
| `OFFER_DECLINED` | Ứng viên từ chối offer | Đưa vào Talent Pool |
| `OFFER_EXPIRED` | Offer quá hạn phản hồi | HR gia hạn hoặc Talent Pool |
| `OFFER_REVOKED` | HR Head thu hồi offer đã gửi | Đưa vào Talent Pool |
| `OFFER_ACCEPTED` | Ứng viên chấp nhận, kết thúc phạm vi tuyển dụng | Không (chuyển sang vòng đời nhân viên) |

Không dùng `NEW` làm trạng thái chờ AI. Nếu cần biết HR đã mở hồ sơ chưa, dùng `first_viewed_at` và `viewed_by`.

### 3.4. Offer (điều khoản bất biến) và Offer Dispatch (lần gửi)

**Tách hai khái niệm khác nhau về bản chất thay đổi:**

- **`offers`**: điều khoản offer — lương cơ bản, phụ cấp, thời gian và tỷ lệ lương thử việc, ngày bắt đầu dự kiến, điều khoản hợp đồng. **Bất biến khi đã ở trạng thái từ `APPROVED` trở đi.** Đổi bất kỳ điều khoản nào tạo `offer` version mới, phải duyệt lại từ đầu.
- **`offer_dispatches`**: một lần gửi cụ thể của một `offer` version — token phản hồi, thời điểm gửi, hạn phản hồi (`response_deadline`), trạng thái phản hồi. **Gia hạn hạn phản hồi chỉ tạo dispatch mới, không đổi `offers`.**

```text
offers:            DRAFT ─> PENDING_APPROVAL ─┬─> APPROVED ─> CANCELLED
                        │                     └─> SUPERSEDED (bị trả về, hoặc ứng viên thương lượng)
                        └─> CANCELLED

 offer_dispatches:  (được tạo khi offer APPROVED, hoặc khi gia hạn)
                     ACTIVE ─┬─> ACCEPTED   (ứng viên chấp nhận, offer → ACCEPTED)
                             ├─> DECLINED
                             ├─> NEGOTIATION_CLOSED
                             ├─> SUPERSEDED ──> (dispatch mới ACTIVE khi gia hạn trước hạn)
                             ├─> EXPIRED ─────> (có thể tạo dispatch mới ACTIVE sau khi giữ lại suất)
                             └─> REVOKED
```

Quy tắc:
- Mỗi `offer` có nhiều `offer_dispatches` theo thời gian (ví dụ gia hạn nhiều lần), nhưng chỉ một dispatch `ACTIVE` tại một thời điểm.
- **Nếu gia hạn kèm đổi điều khoản** (ví dụ tăng lương thêm), đó không còn là gia hạn — phải tạo `offer` version mới ở `DRAFT` và duyệt lại từ đầu (không dùng cơ chế dispatch).
- Token phản hồi gắn với `dispatch_id`, không gắn với `offer_id`, để gia hạn luôn phát hành token mới và vô hiệu token cũ.
- Suất tuyển (seat) được giữ (`RESERVED`) khi `offer_dispatches` chuyển `ACTIVE` lần đầu. Gia hạn **trước hạn** thay dispatch cũ trong cùng transaction và giữ nguyên seat. Khi dispatch đã `EXPIRED`, seat luôn được nhả; muốn gửi lại phải giữ lại một seat `AVAILABLE` hoặc được HR Head xác nhận `OVERBOOK` trong cùng transaction tạo dispatch mới.
- Trạng thái `application.status = OFFER_SENT` phản ánh việc có một dispatch `ACTIVE`; `OFFER_ACCEPTED` phản ánh dispatch đã `ACCEPTED`.

### 3.5. Suất tuyển (Hiring Seat)

```text
AVAILABLE ─ gửi offer ─> RESERVED ─ ứng viên chấp nhận ─> ACCEPTED ─ nhận việc thực tế ─> JOINED
    ↑                        │                                  │
    └── nhả (declined/expired/revoked/rejected/withdrawn) ──────┘
    └── nhả (ONBOARD_CANCELLED từ vòng đời nhân viên) ─────────────
```

### 3.6. Phân tích AI (chạy song song, độc lập với trạng thái hồ sơ)

```text
NOT_RUN ─> QUEUED ─> RUNNING ─> DONE
                        ├──> FAILED ── chạy lại ─> QUEUED
                        └──> NEEDS_MANUAL_REVIEW (CV không đọc được hoặc vượt giới hạn)
SKIPPED_NO_CONSENT (ứng viên không đồng ý dùng AI)
```

`FAILED`, `NEEDS_MANUAL_REVIEW` và `SKIPPED_NO_CONSENT` không thay đổi trạng thái hồ sơ.

---

## 4. Cơ chế duyệt (Approval Engine)

Dùng chung cho requisition, duyệt chuyên môn CV và offer. Nhờ vậy chỉ phải viết một engine, và audit log nhất quán.

### 4.1. Dữ liệu

| Bảng | Vai trò |
|---|---|
| `approval_policies` | Quy tắc cấu hình: `entity_type`, `condition` (ví dụ cấp bậc, lương vượt khung), `steps_template`, `effective_from`, `version` |
| `approval_requests` | Một lần gửi duyệt: `entity_type`, `entity_id`, `entity_version`, `policy_id`, `status` (`OPEN`, `APPROVED`, `RETURNED`, `REJECTED`, `CANCELLED`) |
| `approval_steps` | Từng bước: `request_id`, `step_order`, `approver_role`, `resolved_approver_id`, `status` (`PENDING`, `APPROVED`, `RETURNED`, `REJECTED`, `SKIPPED`), `decided_by`, `decided_at`, `comment`, `delegated_from` |

### 4.2. Cách hoạt động

1. Khi gửi duyệt, `ApprovalPolicyResolver` chọn policy theo điều kiện và sinh danh sách `approval_steps`.
2. Với mỗi bước, resolver xác định người duyệt cụ thể từ cơ cấu tổ chức, loại bỏ người xung đột lợi ích (4.4) và áp dụng ủy quyền còn hiệu lực (P1). Không tìm được người hợp lệ thì **leo lên cấp trên kế tiếp** và ghi log.
3. Các bước chạy tuần tự. Bước hiện tại là bước `PENDING` có `step_order` nhỏ nhất.
4. Quyết định của một bước:
   - **Duyệt:** sang bước kế; bước cuối duyệt xong thì `approval_request = APPROVED` và thực thể chuyển trạng thái tương ứng.
   - **Trả về:** kèm comment, request `RETURNED`, thực thể quay về trạng thái chỉnh sửa.
   - **Từ chối:** kèm lý do, request `REJECTED`, thực thể chuyển `REJECTED`.
5. Mỗi request gắn với `entity_version`. Nếu thực thể đã đổi version (ví dụ offer được sửa) thì mọi quyết định trên request cũ bị từ chối.
6. Người gửi thu hồi được request khi chưa có bước nào hoàn tất quyết định.

### 4.3. Ma trận người duyệt mặc định (cấu hình được)

**Duyệt yêu cầu tuyển dụng:** mặc định CEO. Cho phép cấu hình theo cấp bậc.

**Duyệt chuyên môn CV và người chủ trì phỏng vấn:**

| Cấp bậc vị trí tuyển | Người duyệt chuyên môn |
|---|---|
| Nhân viên | Trưởng phòng của phòng ban tuyển |
| Trưởng phòng | Giám đốc phòng ban; nếu không có thì CEO |
| Giám đốc phòng ban | CEO |
| Trưởng phòng/Giám đốc Nhân sự | CEO. HR không tự duyệt vị trí của chính phòng mình |

**Duyệt offer:** mặc định CEO. Nếu mức lương vượt khung của requisition, bắt buộc có lý do vượt khung, hiển thị cờ "vượt khung" cho người duyệt, và policy có thể thêm bước duyệt bổ sung. Người soạn offer không bao giờ là người duyệt.

### 4.4. Xung đột lợi ích

Backend từ chối hành động khi người duyệt:
- là người tạo yêu cầu cần duyệt hoặc người soạn offer;
- là người giới thiệu ứng viên;
- là chính ứng viên, hoặc có quan hệ được khai báo theo chính sách doanh nghiệp;
- đang dùng quyền ủy quyền đã hết hạn.

### 4.5. Ủy quyền (P1)

Có người ủy quyền, người nhận, phạm vi, thời gian bắt đầu và kết thúc, lý do. Bước duyệt ghi `delegated_from`.

---

## 5. Luồng nghiệp vụ chi tiết

### Giai đoạn 0. Tạo và duyệt nhu cầu tuyển dụng

Người quản lý tạo requisition ở `DRAFT`, có thể lưu dở. Khi gửi duyệt, hệ thống kiểm tra đủ thông tin và tạo `approval_request` (mục 4). Người duyệt có thể Duyệt, Trả về (`REVISION_REQUIRED`) hoặc Từ chối (`REJECTED`). Khi được duyệt, hệ thống sinh các `hiring_seats`.

### Giai đoạn 1. Tạo chiến dịch và khóa tiêu chí chấm

HR chọn requisition `APPROVED` để tạo posting. Hệ thống tự điền vị trí, phòng ban, headcount, khung lương. HR bổ sung nội dung truyền thông, địa điểm, hình thức làm việc, hạn nộp.

**Tiêu chí và cấu hình chấm CV:** AI đề xuất bản nháp tiêu chí từ JD, HR chỉnh sửa và xác nhận. Khi HR bấm mở posting, hệ thống khóa `criteria_version_id` cùng `scoring_profile_version_id` đang `ACTIVE` thành một cặp bất biến gắn với posting.

Đổi tiêu chí hoặc cấu hình chấm sau khi posting `OPEN`:
1. Hệ thống tạo `criteria_version` mới khi tiêu chí thay đổi và/hoặc chọn một `scoring_profile_version` mới đã được duyệt; ghi người đổi, lý do, thời điểm và bản diff. Posting chuyển sang cặp version mới theo một thao tác có audit.
2. Hệ thống **chạy lại AI cho đúng tập hồ sơ còn ở giai đoạn đánh giá**, định nghĩa chính xác là mọi `application` của posting đang ở một trong các trạng thái: `PENDING_HR_CV_REVIEW`, `PENDING_TECH_CV_REVIEW`, `PENDING_INTERVIEW_1`, `PENDING_INTERVIEW_2`.
3. **Đóng băng snapshot AI đã dùng cho quyết định offer** từ lúc hồ sơ chuyển sang `PENDING_HR_OFFER`. Không tự động chạy lại các trạng thái `PENDING_HR_OFFER`, `PENDING_OFFER_APPROVAL`, `OFFER_INTERNALLY_APPROVED`, `OFFER_SENT`, hoặc các trạng thái kết thúc `REJECTED`, `WITHDRAWN`, `TALENT_POOL`, `OFFER_ACCEPTED`, `OFFER_DECLINED`, `OFFER_EXPIRED`, `OFFER_REVOKED`. Nếu HR chủ động yêu cầu phân tích lại ở giai đoạn offer, kết quả mới chỉ là tham khảo, không thay snapshot và quyết định lịch sử.
4. Trong lúc chạy lại (có thể mất vài phút với posting nhiều hồ sơ), giao diện hiển thị trạng thái posting là "Đang đồng bộ cấu hình chấm" và tạm khóa việc so sánh xếp hạng cho đến khi mọi hồ sơ thuộc tập trên đã có kết quả theo cặp version mới.
5. Giao diện chỉ so sánh và sắp xếp các kết quả cùng cặp `(criteria_version_id, scoring_profile_version_id)`. Kết quả version cũ được giữ, không bị xóa.

### Giai đoạn 2. Ứng viên nộp hồ sơ

Public Apply Form gồm họ tên, email, số điện thoại, CV, checkbox đồng ý cho AI hỗ trợ phân tích CV, link chính sách xử lý dữ liệu, CAPTCHA và rate limiting. Không yêu cầu CCCD, tôn giáo, dân tộc hoặc thông tin không cần thiết.

Kiểm tra file tại thời điểm tải lên (chi tiết mục 11.8): chỉ nhận PDF và DOCX, kiểm tra loại file thật, giới hạn dung lượng và số trang, chặn file có macro hoặc đặt mật khẩu.

Chống trùng:
- Chuẩn hóa email về chữ thường và chuẩn hóa số điện thoại.
- Cùng email hoặc số điện thoại trong cùng posting: chặn bằng unique constraint.
- Trùng ở posting khác: vẫn cho nộp nhưng gắn cảnh báo để HR đối chiếu.
- Dùng idempotency key để double-click hoặc retry mạng không tạo hai hồ sơ.

Hồ sơ được tạo ngay ở `PENDING_HR_CV_REVIEW` và phát sự kiện `APPLICATION_SUBMITTED` để chạy AI nền. Không đồng ý dùng AI thì `ai_analyses = SKIPPED_NO_CONSENT` và HR đọc CV thủ công.

### Giai đoạn 3. AI hỗ trợ phân tích

Chi tiết ở mục 11. Tóm tắt: AI trích cấu trúc CV, chấm theo bằng chứng trên từng tiêu chí, cảnh báo những điểm cần xác minh, và gợi ý câu hỏi phỏng vấn. Mỗi lần chạy tạo một bản ghi `ai_analyses` mới, không ghi đè lịch sử.

### Giai đoạn 4. HR duyệt CV

Trạng thái `PENDING_HR_CV_REVIEW`. HR Recruiter hoặc HR Head có quyền trên chiến dịch có thể Duyệt, Từ chối, Đưa vào Talent Pool, hoặc Yêu cầu ứng viên bổ sung hồ sơ (giữ nguyên trạng thái, tạo `info_requests` có hạn). Khi Từ chối, HR nhập lý do nội bộ, chọn template phản hồi ứng viên và quyết định có gửi email hay không.

### Giai đoạn 5. Chuyên môn duyệt CV

Trạng thái `PENDING_TECH_CV_REVIEW`. Người duyệt theo ma trận 4.3, thông qua một `approval_request` một bước. Có thể Duyệt, Trả HR (comment bắt buộc) hoặc Từ chối.

### Giai đoạn 6. Phỏng vấn vòng 1

Trạng thái `PENDING_INTERVIEW_1`. Lịch phỏng vấn nằm ở bảng `interviews` với trạng thái `SCHEDULED`, `DONE`, `NO_SHOW`, `RESCHEDULED`, `CANCELLED`. Mỗi người phỏng vấn có phiếu `interview_feedbacks` riêng: điểm theo tiêu chí, nhận xét, khuyến nghị, thời điểm gửi.

Điều kiện bấm Đạt: buổi phỏng vấn đã `DONE`, mọi interviewer bắt buộc đã gửi feedback, người chủ trì đã nhập kết luận tổng hợp. Danh sách câu hỏi gợi ý của AI (`verify_points`) hiển thị cho người phỏng vấn nhưng không bắt buộc dùng.

### Giai đoạn 7. Phỏng vấn vòng 2 và đàm phán

Trạng thái `PENDING_INTERVIEW_2`. Thành phần gồm quản lý chuyên môn và HR. Kết quả đàm phán lưu ở `salary_negotiations`: mức hiện tại (nếu ứng viên tự nguyện cung cấp), mức mong muốn, mức thống nhất sơ bộ, phụ cấp và kỳ vọng khác, ghi chú, người ghi nhận. Điều kiện bấm Đạt: interview `DONE`, đủ feedback, có kết quả đàm phán sơ bộ.

### Giai đoạn 8. HR soạn offer

Trạng thái `PENDING_HR_OFFER`. Offer là thực thể riêng có version bất biến. HR nhập lương cơ bản, phụ cấp, thời gian thử việc và tỷ lệ lương thử việc, ngày bắt đầu dự kiến, điều khoản, file offer. Form tự điền từ kết quả đàm phán. HR có thể nhập **hạn phản hồi dự kiến** để chuẩn bị gửi, nhưng giá trị này chỉ được kiểm tra và lưu vào `offer_dispatches.response_deadline` khi dispatch được tạo; nó không thuộc điều khoản bất biến của `offers`.

Kiểm tra trước khi gửi duyệt:
- Đủ feedback các vòng.
- Mức lương nằm trong khung của requisition. Vượt khung thì bắt buộc lý do và cờ "vượt khung".
- Ngày bắt đầu hợp lệ; nếu đã nhập hạn phản hồi dự kiến thì hạn phải nằm trong tương lai.
- Hiển thị (không khóa) số suất còn khả dụng, để HR biết trước khi gửi.

Gửi duyệt tạo `approval_request` gắn `entity_version` của offer, hồ sơ chuyển `PENDING_OFFER_APPROVAL`.

### Giai đoạn 9. Duyệt offer nội bộ

Người duyệt theo ma trận 4.3 có thể Duyệt, Trả HR (offer version cũ chuyển `SUPERSEDED`, HR tạo version mới) hoặc Từ chối. Duyệt xong bước cuối thì offer chuyển `APPROVED` và hồ sơ chuyển `OFFER_INTERNALLY_APPROVED`.

### Giai đoạn 10. Gửi offer và giữ suất

HR bấm Gửi offer. Trong **cùng một transaction**, hệ thống:
1. Khóa một `hiring_seat` đang `AVAILABLE` (row lock hoặc optimistic version) và chuyển `RESERVED`, gắn `application_id` và `offer_id`.
2. Tạo một `offer_dispatches` mới ở `ACTIVE`, gắn `offer_id`, kèm token phản hồi ký số và hạn phản hồi (⚙ `seat` không có khóa cấu hình riêng ở bước này, nhưng hạn phản hồi mặc định đề xuất do HR nhập, không phải giá trị cứng trong code).
3. Chuyển hồ sơ `OFFER_SENT`.
4. Ghi outbox để gửi email.

Nếu không còn suất `AVAILABLE`, HR thấy lỗi "Không còn suất khả dụng". HR Head có thể xác nhận gửi **offer dự phòng** theo mục 7.3.

**Gia hạn hạn phản hồi** có hai trường hợp tách biệt:

- **Trước khi hết hạn:** trong cùng transaction, khóa dispatch và seat, chuyển dispatch cũ `ACTIVE → SUPERSEDED`, tạo dispatch mới `ACTIVE` với hạn và token mới; seat tiếp tục `RESERVED`, không có khoảng thời gian tồn tại hai dispatch `ACTIVE`.
- **Sau khi đã hết hạn:** dispatch cũ đã `EXPIRED` và seat đã được nhả. Khi HR gửi lại, hệ thống phải giữ lại một seat `AVAILABLE` hoặc được HR Head xác nhận `OVERBOOK` trong cùng transaction tạo dispatch mới. Nếu không lấy được suất thì không tạo dispatch và báo lỗi cho HR.

Cả hai trường hợp đều gắn cùng `offer_id` và **không sửa `offers`**. Nếu đồng thời đổi điều khoản (lương, ngày bắt đầu…), phải tạo `offer` version mới ở `DRAFT` và duyệt lại từ Giai đoạn 8.

### Giai đoạn 11. Ứng viên phản hồi

Link phản hồi mở ra **trang xem offer bằng GET, không có tác dụng phụ**. Các hành động Chấp nhận, Từ chối, Đề nghị thương lượng là **POST có bước xác nhận**, để phần mềm quét mail hoặc preview link không vô tình tiêu token. Mọi phản hồi tác động lên `offer_dispatches` đang `ACTIVE` tương ứng với token.

| Phản hồi | Kết quả trên dispatch | Kết quả trên hồ sơ |
|---|---|---|
| Chấp nhận | `ACCEPTED` | `OFFER_ACCEPTED` (xem 7.4) |
| Từ chối | `DECLINED` | `OFFER_DECLINED`, nhả suất |
| Đề nghị thương lượng | `NEGOTIATION_CLOSED` | `PENDING_HR_OFFER`; offer hiện tại `SUPERSEDED`; suất vẫn được giữ |
| Quá hạn (scheduler) | `EXPIRED` | `OFFER_EXPIRED`; luôn nhả suất |

### Giai đoạn 12. Sau khi chấp nhận

Backend thực hiện atomically (chi tiết 7.4): chuyển application và offer sang chấp nhận, chuyển seat sang `ACCEPTED`, kiểm tra điều kiện `FILLED`/`FULFILLED`, ghi outbox sự kiện `OFFER_ACCEPTED` mang `conversion_key`. Việc tạo Person, Employee, tài khoản và pre-boarding do module vòng đời nhân viên xử lý theo tài liệu `VONG_DOI_NHAN_VIEN_HRM_AI_P0_1_PATCHED.md`.

---

## 6. Bảng chuyển trạng thái

Nguyên tắc: **hành động không có trong bảng thì bị từ chối**. Cột "Vai trò" là vai trò được phép, không phải người nhất định. Mọi dòng đều kiểm tra thêm quyền phạm vi dữ liệu và xung đột lợi ích, và ghi `application_transition_logs`.

### 6.1. Application

| # | Trạng thái hiện tại | Vai trò | Hành động | Trạng thái tiếp theo | Điều kiện bắt buộc |
|---|---|---|---|---|---|
| R1 | `PENDING_HR_CV_REVIEW` | HR | Duyệt | `PENDING_TECH_CV_REVIEW` | Có nhận xét HR; tạo approval_request cho người duyệt chuyên môn |
| R2 | `PENDING_HR_CV_REVIEW` | HR | Từ chối | `REJECTED` | Lý do nội bộ |
| R3 | `PENDING_HR_CV_REVIEW` | HR | Yêu cầu bổ sung hồ sơ | Giữ nguyên | Tạo `info_requests` có hạn |
| R4 | `PENDING_TECH_CV_REVIEW` | Người duyệt chuyên môn | Duyệt | `PENDING_INTERVIEW_1` | Có nhận xét chuyên môn |
| R5 | `PENDING_TECH_CV_REVIEW` | Người duyệt chuyên môn | Trả HR | `PENDING_HR_CV_REVIEW` | Comment bắt buộc |
| R6 | `PENDING_TECH_CV_REVIEW` | Người duyệt chuyên môn | Từ chối | `REJECTED` | Lý do bắt buộc |
| R7 | `PENDING_INTERVIEW_1` | HR, Interview Lead | Tạo hoặc đặt lại lịch | Giữ nguyên | Lịch hợp lệ, gửi mời |
| R8 | `PENDING_INTERVIEW_1` | HR | Ghi nhận vắng mặt (`NO_SHOW`) | Giữ nguyên | Interview đánh dấu `NO_SHOW`; sau đó HR đặt lại lịch (R7) hoặc từ chối (G1) |
| R9 | `PENDING_INTERVIEW_1` | Interview Lead | Đạt | `PENDING_INTERVIEW_2` | Interview `DONE`, đủ feedback, có kết luận |
| R10 | `PENDING_INTERVIEW_1` | Interview Lead | Không đạt | `REJECTED` | Feedback và lý do |
| R11 | `PENDING_INTERVIEW_1` | Interview Lead | Cần bổ sung thông tin CV | `PENDING_HR_CV_REVIEW` | Comment, chọn đúng loại lý do |
| R12 | `PENDING_INTERVIEW_2` | HR, Interview Lead | Tạo hoặc đặt lại lịch | Giữ nguyên | Lịch hợp lệ, gửi mời |
| R13 | `PENDING_INTERVIEW_2` | Interview Lead + HR | Đạt | `PENDING_HR_OFFER` | Interview `DONE`, đủ feedback, có kết quả đàm phán sơ bộ |
| R14 | `PENDING_INTERVIEW_2` | Interview Lead | Không đạt | `REJECTED` | Feedback và lý do |
| R15 | `PENDING_INTERVIEW_2` | Interview Lead | Trả về vòng 1 | `PENDING_INTERVIEW_1` | Comment bắt buộc |
| R16 | `PENDING_HR_OFFER` | HR | Gửi duyệt offer | `PENDING_OFFER_APPROVAL` | Offer hợp lệ (mục Giai đoạn 8), tạo approval_request |
| R17 | `PENDING_HR_OFFER` | HR | Trả về phỏng vấn 2 | `PENDING_INTERVIEW_2` | Comment bắt buộc (cần đàm phán lại) |
| R18 | `PENDING_OFFER_APPROVAL` | Người duyệt offer (từng bước) | Duyệt bước | Giữ nguyên, hoặc `OFFER_INTERNALLY_APPROVED` nếu là bước cuối | Không xung đột lợi ích; `entity_version` khớp |
| R19 | `PENDING_OFFER_APPROVAL` | Người duyệt offer | Trả HR | `PENDING_HR_OFFER` | Comment; version offer cũ `SUPERSEDED`; HR tạo version mới |
| R20 | `PENDING_OFFER_APPROVAL` | Người duyệt offer | Từ chối | `REJECTED` | Lý do bắt buộc |
| R21 | `PENDING_OFFER_APPROVAL` | HR | Thu hồi yêu cầu duyệt | `PENDING_HR_OFFER` | Chưa có bước nào chốt quyết định; request `CANCELLED` |
| R22 | `OFFER_INTERNALLY_APPROVED` | HR | Gửi offer | `OFFER_SENT` | Giữ suất thành công trong cùng transaction (hoặc offer dự phòng đã được HR Head xác nhận); tạo `offer_dispatches` mới `ACTIVE`; token và hạn phản hồi hợp lệ |
| R23 | `OFFER_INTERNALLY_APPROVED` | HR | Hủy trước khi gửi, soạn lại | `PENDING_HR_OFFER` | Lý do; offer version `CANCELLED` |
| R24 | `OFFER_SENT` | Ứng viên | Chấp nhận | `OFFER_ACCEPTED` | Token hợp lệ; dispatch đang `ACTIVE`; còn hạn; suất đang giữ cho hồ sơ này |
| R25 | `OFFER_SENT` | Ứng viên | Từ chối | `OFFER_DECLINED` | Token hợp lệ; dispatch → `DECLINED`; nhả suất |
| R26 | `OFFER_SENT` | Ứng viên | Đề nghị thương lượng | `PENDING_HR_OFFER` | Lưu phản hồi; offer hiện tại `SUPERSEDED`; suất vẫn giữ |
| R27 | `OFFER_SENT` | Scheduler | Quá hạn | `OFFER_EXPIRED` | `now > offer_dispatches.response_deadline`; dispatch → `EXPIRED`; nhả suất |
| R28 | `OFFER_SENT` | HR Head | Thu hồi offer | `OFFER_REVOKED` | Lý do bắt buộc; dispatch → `REVOKED`, token vô hiệu; thông báo ứng viên; nhả suất |
| R29 | `OFFER_EXPIRED` | HR | Gửi lại với hạn mới | `OFFER_SENT` | Trong cùng transaction: giữ lại seat `AVAILABLE` hoặc xác nhận `OVERBOOK`, rồi tạo dispatch mới `ACTIVE`; có thể thất bại nếu không còn suất |
| R29A | `OFFER_SENT` | HR | Gia hạn trước khi hết hạn | `OFFER_SENT` | Trong cùng transaction: dispatch cũ `ACTIVE → SUPERSEDED`, tạo dispatch mới `ACTIVE`; seat vẫn `RESERVED` |
| R30 | `REJECTED` | HR Head | Mở lại | `PENDING_HR_CV_REVIEW` hoặc trạng thái trước khi từ chối | Trong hạn ⚙ `application.reopen_window_days`; lý do; audit; posting chưa `CANCELLED`/`EXPIRED` hoặc HR Head override |
| R31 | `TALENT_POOL` | HR | Kích hoạt lại | `PENDING_HR_CV_REVIEW` (cùng posting) hoặc tạo application mới ở posting khác | Consent Talent Pool còn hạn |
| R32 | `OFFER_DECLINED`, `OFFER_EXPIRED`, `OFFER_REVOKED` | HR | Đưa vào Talent Pool | `TALENT_POOL` | Consent riêng |
| R33 | `OFFER_ACCEPTED` | Hệ thống | Nhận sự kiện `ONBOARD_CANCELLED` từ vòng đời nhân viên | Giữ nguyên | Seat `ACCEPTED` → `AVAILABLE`; tạo task `REOPEN_REVIEW_REQUIRED` |

### 6.2. Hành động chung

| # | Áp dụng cho trạng thái | Vai trò | Hành động | Trạng thái tiếp theo | Điều kiện |
|---|---|---|---|---|---|
| G1 | Mọi `PENDING_*` và `OFFER_INTERNALLY_APPROVED` | HR (mọi giai đoạn); HR Head bắt buộc từ `PENDING_HR_OFFER` trở đi | Từ chối | `REJECTED` | Lý do nội bộ; hủy approval_request đang mở; nhả suất nếu đang giữ |
| G2 | Mọi `PENDING_*` | HR | Đưa vào Talent Pool | `TALENT_POOL` | Consent riêng; nhả suất nếu đang giữ |
| G3 | Mọi `PENDING_*`, `OFFER_INTERNALLY_APPROVED`, `OFFER_SENT` | Ứng viên | Rút hồ sơ | `WITHDRAWN` | Xác nhận bằng token hoặc email; nhả suất nếu đang giữ; dừng email nghiệp vụ |

Hồ sơ đang ở `OFFER_SENT` **không** dùng G1. Muốn dừng phải Thu hồi offer (R28) để có lý do và thông báo cho ứng viên.

### 6.3. Requisition

| # | Từ | Vai trò | Hành động | Đến | Điều kiện |
|---|---|---|---|---|---|
| Q1 | `DRAFT` | Người tạo | Gửi duyệt | `PENDING_APPROVAL` | Đủ trường bắt buộc; khung lương là số |
| Q2 | `PENDING_APPROVAL` | Người duyệt (bước cuối) | Duyệt | `APPROVED` | Sinh `hiring_seats` bằng headcount |
| Q3 | `PENDING_APPROVAL` | Người duyệt | Trả về | `REVISION_REQUIRED` | Comment bắt buộc |
| Q4 | `PENDING_APPROVAL` | Người duyệt | Từ chối | `REJECTED` | Lý do bắt buộc |
| Q5 | `REVISION_REQUIRED` | Người tạo | Gửi lại | `PENDING_APPROVAL` | Version tăng; tạo approval_request mới |
| Q6 | `DRAFT`, `REVISION_REQUIRED` | Người tạo | Hủy | `CANCELLED` | |
| Q7 | `PENDING_APPROVAL` | Người tạo | Thu hồi | `DRAFT` | Chưa có bước nào chốt; request `CANCELLED` |
| Q8 | `APPROVED` | Hệ thống | Đủ seat `STANDARD` ở `ACCEPTED`/`JOINED` bằng headcount (mục 7.1) | `FULFILLED` | |
| Q9 | `FULFILLED` | Hệ thống | Có suất quay về `AVAILABLE` | `APPROVED` | Audit và task xử lý |
| Q10 | `APPROVED` | CEO, HR Head | Hủy | `CANCELLED` | Lý do; xử lý các hồ sơ đang `OFFER_SENT`/`OFFER_ACCEPTED` trước |

### 6.4. Posting

| # | Từ | Vai trò | Hành động | Đến | Điều kiện |
|---|---|---|---|---|---|
| P1 | `DRAFT` | HR | Mở | `OPEN` | Requisition `APPROVED`; bộ tiêu chí đã xác nhận và khóa; hạn nộp hợp lệ |
| P2 | `OPEN` | HR | Tạm dừng | `PAUSED` | |
| P3 | `PAUSED` | HR | Mở lại | `OPEN` | Chưa quá hạn |
| P4 | `OPEN`, `PAUSED` | Scheduler | Quá hạn | `EXPIRED` | |
| P5 | `EXPIRED` | HR | Gia hạn | `OPEN` | Hạn mới; requisition còn `APPROVED` |
| P6 | `OPEN`, `PAUSED` | HR Head | Hủy | `CANCELLED` | Lý do; tạo task xử lý hồ sơ dở |
| P7 | `OPEN` | Hệ thống | Đủ seat `STANDARD` ở `ACCEPTED`/`JOINED` bằng headcount (mục 7.1) | `FILLED` | Tạo task xử lý hồ sơ dở, không tự loại |
| P8 | `FILLED` | HR | Mở lại | `OPEN` | Có suất trống sau khi nhả |

### 6.5. Offer (điều khoản, bất biến từ APPROVED) và Offer Dispatch (từng lần gửi)

**Bảng `offers`:**

| # | Từ | Vai trò | Hành động | Đến |
|---|---|---|---|---|
| O1 | `DRAFT` | HR | Gửi duyệt | `PENDING_APPROVAL` |
| O2 | `PENDING_APPROVAL` | Chuỗi duyệt | Duyệt xong bước cuối | `APPROVED` |
| O3 | `PENDING_APPROVAL` | Người duyệt | Trả về | `SUPERSEDED` (HR tạo version mới `DRAFT`) |
| O4 | `APPROVED` | Ứng viên | Thương lượng qua dispatch đang gửi | `SUPERSEDED` (HR tạo version mới `DRAFT`) |
| O5 | `DRAFT`, `PENDING_APPROVAL` | HR | Hủy | `CANCELLED` |
| O6 | `APPROVED` | Ứng viên | Chấp nhận qua dispatch đang gửi | `ACCEPTED` |

**Bảng `offer_dispatches`** (mỗi dòng gắn một `offer_id`):

| # | Từ | Vai trò | Hành động | Đến | Ghi chú |
|---|---|---|---|---|---|
| D1 | (mới) | HR | Gửi offer (`offers.status = APPROVED`) | `ACTIVE` | Token mới, hạn phản hồi mới; giữ suất (S1) |
| D2 | `ACTIVE` | Ứng viên | Chấp nhận | `ACCEPTED` | `offers.status → ACCEPTED` |
| D3 | `ACTIVE` | Ứng viên | Từ chối | `DECLINED` | Nhả suất |
| D4 | `ACTIVE` | Ứng viên | Đề nghị thương lượng | `NEGOTIATION_CLOSED` | `offers.status → SUPERSEDED`; suất vẫn giữ |
| D5 | `ACTIVE` | Scheduler | Quá hạn | `EXPIRED` | Luôn nhả suất trong cùng transaction |
| D6 | `ACTIVE` | HR Head | Thu hồi | `REVOKED` | Token vô hiệu; nhả suất |
| D7 | `ACTIVE` | HR | Gia hạn trước hạn | `SUPERSEDED`; tạo dispatch mới `ACTIVE` | Atomic; cùng `offer_id`; token mới; giữ nguyên seat `RESERVED` |
| D8 | `EXPIRED` | HR | Gửi lại với hạn mới | Tạo dispatch mới `ACTIVE` | Atomic với việc giữ lại seat `AVAILABLE` hoặc tạo seat `OVERBOOK`; không sửa `offers` |

### 6.6. Suất tuyển

| # | Từ | Sự kiện | Đến | Ghi chú |
|---|---|---|---|---|
| S1 | `AVAILABLE` | Dispatch mới chuyển `ACTIVE` lần đầu hoặc gửi lại sau `EXPIRED` (D1, D8) | `RESERVED` | Row lock; gắn application và offer |
| S2 | `RESERVED` | Dispatch chuyển `ACCEPTED` (D2) | `ACCEPTED` | |
| S3 | `RESERVED` | D3, D5 (không gia hạn), D6, G1, G2, G3 | `AVAILABLE` | Ghi `seat_events` với lý do nhả |
| S4 | `ACCEPTED` | Vòng đời: nhận việc thực tế | `JOINED` | |
| S5 | `ACCEPTED` | Vòng đời: `ONBOARD_CANCELLED` | `AVAILABLE` | Tạo `REOPEN_REVIEW_REQUIRED`; lịch sử offer chấp nhận không bị xóa |

---

## 7. Suất tuyển (headcount) và offer dự phòng

### 7.1. Seat ledger

- `hiring_seats`: mỗi dòng là một suất của một requisition. Cột chính: `requisition_id`, `status`, `kind` (`STANDARD` hoặc `OVERBOOK`), `application_id`, `offer_id`, `version`.
- `seat_events`: append-only, ghi mọi chuyển trạng thái của suất kèm lý do, người hoặc hệ thống thực hiện, thời điểm.
- Đếm suất bằng dữ liệu seat, không bằng cách đếm trạng thái hồ sơ. Nhờ vậy lịch sử "đã từng chấp nhận" khác với "đang chiếm suất".
- **Cách tính `FILLED`/`FULFILLED` (quan trọng): chỉ đếm seat `kind = STANDARD`.** Điều kiện: `COUNT(hiring_seats WHERE kind = STANDARD AND status IN (ACCEPTED, JOINED)) >= headcount`. Seat `OVERBOOK` **không** được cộng vào phép so sánh này, dù đã `ACCEPTED` hay `JOINED`. Seat `OVERBOOK` được theo dõi ở một bộ đếm riêng (`overbook_accepted_count`) chỉ để phát hiện tình huống cần xử lý (điểm 5 dưới đây), không bao giờ làm sai lệch việc xác định đã đủ headcount chuẩn hay chưa.

### 7.2. Giữ suất khi gửi offer

Trong transaction gửi offer, khóa một seat `AVAILABLE` và chuyển `RESERVED`. Hai HR cùng gửi offer cho suất cuối cùng: chỉ một transaction thành công, người còn lại nhận lỗi ngay ở phía HR ("không còn suất khả dụng"), **không bao giờ để lỗi xảy ra ở phía ứng viên**.

### 7.3. Offer dự phòng (overbook)

Khi không còn suất `AVAILABLE` mà HR vẫn muốn gửi offer thêm:
1. HR Head phải xác nhận rõ "gửi offer vượt suất (dự phòng)", nhập lý do.
2. Hệ thống tạo một seat `kind = OVERBOOK`, `RESERVED`, ghi `overbook_confirmed_by`, `overbook_confirmed_at`, `overbook_reason`.
3. Số seat `OVERBOOK` đang hoạt động không vượt giá trị cấu hình ⚙ `seat.max_overbook_per_requisition` (đọc qua `ConfigurationService`, không hardcode).
4. Ứng viên nhận offer bình thường, **không biết đó là offer dự phòng**, và không bao giờ bị báo xung đột khi chấp nhận.
5. Nếu cả suất `STANDARD` và `OVERBOOK` cùng được chấp nhận, số người chấp nhận thực tế vượt headcount chuẩn. Vì phép tính `FILLED`/`FULFILLED` ở 7.1 chỉ dựa trên seat `STANDARD`, việc này **không** tự động đóng posting sai. Hệ thống tạo task `OVERBOOK_RESOLUTION_REQUIRED` cho HR Head và CEO (tăng headcount qua requisition điều chỉnh, hoặc xử lý theo chính sách). Đây là quyết định của con người đã được cân nhắc từ lúc xác nhận overbook.
6. Seat `OVERBOOK` bị nhả thì đóng hẳn (`CLOSED`), không quay về `AVAILABLE`.

### 7.4. Chấp nhận offer (atomic)

Khi ứng viên POST xác nhận chấp nhận, trong một transaction:
1. Kiểm tra token hợp lệ, dispatch đang `ACTIVE`, còn hạn, chưa phản hồi.
2. Khóa version của application, offer, dispatch và seat đang giữ.
3. Chuyển application `OFFER_ACCEPTED`, dispatch `ACCEPTED` (offer `ACCEPTED`), seat `ACCEPTED`.
4. Tính lại điều kiện `FILLED`/`FULFILLED` theo công thức seat `STANDARD` ở 7.1. Nếu seat này là `OVERBOOK`, chạy thêm kiểm tra điểm 5 ở mục 7.3.
5. Ghi outbox: email xác nhận cho ứng viên, thông báo HR, và sự kiện `OFFER_ACCEPTED` theo envelope chuẩn ở mục 9. Các trường `conversion_key`, `application_id`, `accepted_offer_id`, `requisition_id`, `seat_id` nằm trong `payload`; mỗi bản ghi outbox có một `event_id` duy nhất.

Nếu HR thu hồi offer đúng lúc ứng viên chấp nhận: optimistic locking quyết định bên nào thành công. Bên thua nhận thông báo rõ ràng (ứng viên thấy "offer đã bị thu hồi" hoặc HR thấy "ứng viên vừa chấp nhận").

### 7.5. Khi nào nhả suất

| Sự kiện | Nhả suất | Ghi chú |
|---|---|---|
| Ứng viên từ chối offer | Có | |
| Offer quá hạn | Có | Nếu HR gửi lại sau khi hết hạn thì phải giữ lại suất; có thể cần offer dự phòng nếu suất đã bị chiếm |
| HR Head thu hồi offer | Có | |
| Hồ sơ bị từ chối (G1) hoặc đưa Talent Pool (G2) khi đang giữ suất | Có | |
| Ứng viên rút (G3) | Có | |
| Ứng viên thương lượng | Không | Suất vẫn giữ trong lúc HR soạn version mới |
| `ONBOARD_CANCELLED` sau khi đã chấp nhận | Có (`ACCEPTED` → `AVAILABLE`) | Tạo `REOPEN_REVIEW_REQUIRED` |

Khi một suất được nhả mà posting đang `FILLED` hoặc requisition đang `FULFILLED`, hệ thống tạo task `REOPEN_REVIEW_REQUIRED`. HR quyết định mở lại posting (P8), chọn ứng viên dự phòng hoặc giữ đóng. Hệ thống không tự làm.

---

## 8. Phân quyền và xung đột lợi ích

### 8.1. Phạm vi dữ liệu

- **HR Recruiter:** xem theo chiến dịch được phân công.
- **HR Head:** xem toàn bộ tuyển dụng; là người xác nhận offer dự phòng, thu hồi offer, mở lại hồ sơ bị từ chối.
- **Trưởng phòng chuyên môn:** chỉ xem hồ sơ của phòng mình và các trường cần cho đánh giá chuyên môn.
- **Giám đốc phòng ban:** xem các vị trí thuộc khối hoặc phòng được quản lý.
- **CEO:** xem các bước cần phê duyệt và dashboard tổng hợp.
- **Admin:** quản trị tài khoản, không mặc nhiên có quyền ra quyết định tuyển dụng.
- **Dữ liệu offer và lương đề xuất:** chỉ HR Head, người duyệt offer và người soạn offer được xem.

### 8.2. Kiểm tra xung đột

Áp dụng mục 4.4. Backend chặn ở tầng dịch vụ và trả lỗi có mã rõ ràng.

---

## 9. Dữ liệu cốt lõi

| Nhóm | Bảng |
|---|---|
| Nhu cầu và chiến dịch | `job_requisitions`, `job_postings` (khóa `criteria_version_id` và `scoring_profile_version_id`), `screening_criteria_sets`, `screening_criteria` |
| Hồ sơ | `applications`, `application_documents`, `candidate_consents`, `info_requests` |
| AI | `ai_analyses` (lưu cả `model_output`, `computed_result`, `criteria_version_id`, `scoring_profile_version_id`; xem mục 11.9), `hr_ai_feedback` |
| Phỏng vấn | `interviews`, `interview_participants`, `interview_feedbacks`, `salary_negotiations` |
| Offer | `offers` (điều khoản, bất biến từ `APPROVED`), `offer_dispatches` (token, hạn phản hồi, mỗi lần gửi) |
| Suất tuyển | `hiring_seats`, `seat_events` |
| Duyệt | `approval_policies`, `approval_requests`, `approval_steps`, `approval_delegations` (P1) |
| Cấu hình | `system_configurations`, `scoring_profiles`, `scoring_parameters`, `legal_parameters`, `redaction_rules`, `injection_patterns`, `common_phrases` (mục 0) |
| Vận hành | `application_transition_logs`, `outbox_events`, `inbox_events` (chống xử lý trùng ở phía consumer), `account_creation_requests` (thuộc module vòng đời) |

**Envelope sự kiện chuẩn** dùng cho mọi sự kiện phát qua outbox (không riêng `OFFER_ACCEPTED`):

```json
{
  "event_id": "uuid",
  "event_type": "OFFER_ACCEPTED",
  "schema_version": 1,
  "occurred_at": "2026-01-01T10:00:00+07:00",
  "correlation_id": "uuid-theo-request-gốc",
  "producer": "recruitment",
  "aggregate_type": "APPLICATION",
  "aggregate_id": "application-id",
  "payload": {
    "conversion_key": "<application_id>:<accepted_offer_id>",
    "application_id": 0,
    "accepted_offer_id": 0,
    "requisition_id": 0,
    "seat_id": 0
  }
}
```

Các trường ngoài `payload` là metadata dùng chung. Mỗi `event_type` có schema `payload` riêng và được validate theo `schema_version`; ví dụ `EMPLOYEE_JOINED` có `employee_id`, `application_id`, `seat_id`, `join_date`, còn `ONBOARD_CANCELLED` có `employee_id`, `application_id`, `seat_id`, `reason_code`.

Mọi consumer (kể cả module vòng đời nhân viên) có bảng `inbox_events` với **unique constraint trên `event_id`**, độc lập với unique constraint nghiệp vụ như `conversion_key`. Hai lớp bảo vệ này khác nhau: `event_id` chống xử lý trùng do outbox phát lại (at-least-once delivery); `conversion_key` chống tạo trùng thực thể nghiệp vụ dù sự kiện đến từ nguồn nào. Consumer claim sự kiện bằng insert-if-absent ở tầng database, không dựa vào “SELECT rồi INSERT”. Bên không claim được chờ transaction thắng commit rồi đọc `result_ref`. Nếu ORM/database đánh dấu transaction rollback-only sau unique conflict, consumer phải rollback và đọc kết quả trong transaction mới; không tiếp tục transaction đã lỗi và không trả HTTP 500.

Ràng buộc quan trọng:
- Các entity bị cập nhật đồng thời có `@Version`.
- Unique constraint: email hoặc số điện thoại trong cùng posting; `conversion_key`; `event_id` trong `inbox_events`; một seat chỉ có một application đang giữ; một `offer_id` chỉ có một `offer_dispatches` đang `ACTIVE`.
- Dùng khóa ngoại thật cho các bảng nghiệp vụ.
- Audit log tối thiểu: `entity_type, entity_id, actor_id, actor_role, action, from_status, to_status, comment, request_id, occurred_at`. Append-only, không có API sửa hoặc xóa.
- `scoring_profiles` có `id`, `version`, `status` (`DRAFT`, `ACTIVE`, `RETIRED`), `effective_from`, `created_by`, `reason`; `scoring_parameters` thuộc đúng một `scoring_profile_id`. Profile đã được dùng là bất biến.
- `ai_analyses` lưu `criteria_version_id`, `scoring_profile_version_id`, `model`, `prompt_version`, `input_hash`; không bao giờ ghi đè. `input_hash` bao phủ nội dung CV đã chuẩn hóa, JD, criteria version, scoring profile version và prompt version để có thể tái kiểm tra.
- Không có bảng nào ở nhóm "Cấu hình" bị đọc trực tiếp bằng SQL rải rác trong code nghiệp vụ; mọi truy cập đi qua `ConfigurationService` (mục 0.2).

---

## 10. Xử lý tình huống lỗi và ngoại lệ

| Tình huống | Cách xử lý |
|---|---|
| AI timeout hoặc lỗi | `ai_analyses = FAILED`; hồ sơ vẫn ở bước HR; cho chạy lại |
| CV không đọc được hoặc quá dài | `NEEDS_MANUAL_REVIEW`; không chấm, không ranking; HR đọc thủ công |
| Ứng viên không đồng ý dùng AI | `SKIPPED_NO_CONSENT`; hồ sơ đi tiếp bình thường |
| Upload CV lỗi hoặc file không hợp lệ | Báo ứng viên tải lại; không tạo hồ sơ với nội dung giả lập |
| Email lỗi | Outbox retry; HR thấy trạng thái gửi thất bại |
| Bấm duyệt hai lần | Idempotency key và `@Version`; lần hai trả conflict |
| Hai người duyệt cùng lúc | Chỉ transaction có version hợp lệ thành công |
| Offer cũ được mở lại | Token gắn version offer; version cũ vô hiệu |
| Hai HR gửi offer cho suất cuối cùng | Một thành công, một nhận lỗi phía HR; không ảnh hưởng ứng viên |
| Ứng viên chấp nhận đúng lúc HR thu hồi | Optimistic locking; bên thua nhận thông báo rõ |
| Không tìm được người duyệt hợp lệ | Resolver leo lên cấp trên và ghi log |
| Người duyệt sửa offer khi đang chờ duyệt | Request cũ vô hiệu vì `entity_version` đổi |
| Đổi tiêu chí chấm sau khi `OPEN` | Version mới; chạy lại đúng tập hồ sơ đang xử lý (Giai đoạn 1); không trộn kết quả, không hồi tố hồ sơ đã kết thúc |
| Posting hết hạn | Scheduler chuyển `EXPIRED`; request nộp đồng thời bị backend từ chối |
| Ứng viên rút hồ sơ | `WITHDRAWN`; dừng email nghiệp vụ; chạy chính sách lưu và xóa dữ liệu |
| Mở lại hồ sơ bị từ chối | Chỉ HR Head, trong hạn ⚙ `application.reopen_window_days`; ghi audit |
| Posting đã đủ người | Không tự loại hồ sơ còn lại; tạo task cho HR |
| Ứng viên không đến nhận việc sau khi chấp nhận | Vòng đời phát `ONBOARD_CANCELLED`; nhả suất; task mở lại |


---

## 11. AI chấm CV chống thao túng (v1.2)

### 11.1. Vấn đề và giới hạn

AI chấm CV bằng cách so với JD do HR tạo. Nếu chỉ so từ khóa, ứng viên chép ngôn từ của JD vào CV là được điểm cao. **Không có cách nào xác minh tuyệt đối một CV chỉ bằng cách đọc CV**, vì CV là lời tự khai. Mục tiêu thiết kế:

1. Việc sao chép JD **không đủ để được điểm cao**.
2. HR nhìn thấy rõ phần nào là "khai" và phần nào là "có bằng chứng".
3. Phần xác minh thật được chuyển sang phỏng vấn và kiểm tra tham chiếu, bằng cách chỉ ra chính xác điểm cần hỏi.

### 11.2. Nguyên tắc thiết kế

- **Tách code khỏi LLM.** Những gì đo được bằng code (trùng cụm từ, mốc thời gian, khớp định danh, kiểm tra trích dẫn có thật, tính điểm) làm bằng code, vì kết quả lặp lại được và không bị thao túng bằng prompt. LLM chỉ trích xuất cấu trúc, phân loại mức bằng chứng theo tiêu chí và phát hiện mâu thuẫn ngữ nghĩa.
- **Hai schema tách biệt hoàn toàn**, để không thể nhầm lẫn "model nói gì" với "hệ thống kết luận gì" (chi tiết ở 11.9):
  - `AiModelOutputV1`: đúng những gì LLM được phép trả — trích xuất cấu trúc CV, và với mỗi tiêu chí là danh sách trích dẫn ứng viên kèm `section`, `polarity`, `detail_types`. **Không có trường `weight`, `multiplier`, `score`, `grade` hay bất kỳ dạng điểm số nào.**
  - `AiAnalysisResultV1`: do backend tạo ra sau khi validate và xử lý `AiModelOutputV1` — chứa `weight`, `multiplier`, `evidence_level` (đã áp luật hạ mức), `scores`, `flags`. Đây là bản ghi thật sự lưu vào `ai_analyses.computed_result` và hiển thị cho HR.
  - Nếu `AiModelOutputV1` chứa bất kỳ trường nào thuộc về `AiAnalysisResultV1` (model tự ý trả `weight` hay `score`), hoặc chứa `criteria_id` không tồn tại trong `criteria_version` đang dùng, backend **từ chối toàn bộ output đó**, đánh dấu `run = FAILED`, không dùng một phần nào của output để tính điểm.
- Output của LLM bắt buộc theo `AiModelOutputV1` và được backend validate schema nghiêm ngặt trước khi xử lý tiếp. **Model không bao giờ được trả weight hay điểm cuối.** Server gắn weight từ bộ tiêu chí đã khóa và tự tính điểm.
- **Nội dung CV là dữ liệu không đáng tin**, không bao giờ được xử lý như chỉ dẫn.
- Điểm chỉ dùng để cảnh báo và sắp xếp tùy chọn, không phải cổng chặn.

### 11.3. Đầu vào và bộ tiêu chí chấm

| Đầu vào | Mô tả |
|---|---|
| CV | File PDF hoặc DOCX do ứng viên nộp |
| JD công khai | Văn bản đã đăng cho ứng viên |
| Bộ tiêu chí chấm nội bộ | Danh sách có cấu trúc do HR xác nhận, ứng viên không thấy |
| Dữ liệu form | Họ tên, email, số điện thoại, cờ đồng ý dùng AI |

Mỗi tiêu chí gồm: `id`, `name`, `type` (`MUST` hoặc `NICE`), `weight` (số nguyên dương), `synonyms` (tên gọi khác, cả tiếng Việt và tiếng Anh), `evidence_expected` (loại bằng chứng mong đợi, ví dụ "đã vận hành hệ thống trên môi trường thật", "quy mô dữ liệu hoặc người dùng", "vai trò cá nhân trong dự án").

Quy tắc:
- Server kiểm tra: `id` không trùng, mọi `weight` dương, tổng `weight` bằng 100.
- AI có thể **đề xuất bản nháp** tiêu chí từ JD, nhưng chỉ HR mới chốt.
- Bộ tiêu chí và bộ tham số chấm được khóa thành cặp `(criteria_version_id, scoring_profile_version_id)` khi posting chuyển `OPEN`. Đổi sau đó thì tạo version mới và chạy lại đúng tập hồ sơ còn ở giai đoạn đánh giá theo mục 5, Giai đoạn 1; không tự động tính lại snapshot đã dùng từ giai đoạn offer trở đi.
- Khuyến nghị HR thêm `evidence_expected` không có nguyên văn trong JD công khai. Nhận định thẳng thắn: nếu tiêu chí chỉ là bản sao từ khóa của JD thì việc giấu tiêu chí không giúp nhiều. Cơ chế phòng thủ chính là thang bằng chứng (11.5) và phát hiện bám JD (11.6).

### 11.4. Quy trình xử lý

```text
 1. Nhận file và consent. Không consent → SKIPPED_NO_CONSENT, dừng (hồ sơ vẫn đi tiếp).
 2. Trích văn bản (text layer, nếu thiếu thì OCR có timeout). Ghi extraction.quality.
    Văn bản quá ít hoặc quá dài so với giới hạn → NEEDS_MANUAL_REVIEW, dừng. Không cắt bớt để chấm.
 3. Quét mẫu prompt injection trên văn bản gốc, kể cả chữ ẩn. Ghi cờ.
 4. Phát hiện và loại chữ ẩn khỏi văn bản dùng để chấm. Ghi cờ và số ký tự đã loại.
 5. Kiểm tra định danh (code): form so với CV, trên văn bản đã loại chữ ẩn, trước khi che.
 6. Che thuộc tính nhạy cảm. Tạo văn bản đầu vào tối thiểu cho model.
 7. Gọi LLM: trích xuất cấu trúc CV và ứng viên trích dẫn bằng chứng cho từng tiêu chí, trả về đúng theo `AiModelOutputV1` (mục 11.9) — không có weight, không có score.
 8. Backend validate `AiModelOutputV1`: đúng schema, enum hợp lệ, `criteria_id` khớp `criteria_version` đang dùng, giới hạn số lượng và độ dài.
    Có `criteria_id` lạ, hoặc output chứa bất kỳ trường nào thuộc `AiAnalysisResultV1` (model tự trả weight/score/grade) → từ chối toàn bộ output, `run = FAILED`, không dùng một phần nào để tính điểm.
 9. Backend xác minh MỌI trích dẫn trong `AiModelOutputV1` có thật trong văn bản (sau chuẩn hóa). Trích dẫn không khớp bị loại.
10. Backend tính độ trùng JD cho từng trích dẫn và cho cả văn bản (mục 11.6).
11. Backend áp dụng luật hạ mức (mục 11.5): mục CV, chi tiết cụ thể, phủ định, span chép từ JD.
12. Backend gắn `weight` từ `criteria_version` và lấy multiplier/ngưỡng từ `scoring_profile_version` đã khóa, tự tính `scores` và `grade`, đóng gói thành `AiAnalysisResultV1`.
13. Code tính cờ nhất quán (mốc thời gian) và tổng hợp verify_points, thêm vào `AiAnalysisResultV1`.
14. Ghi `ai_analyses` (lưu cả `model_output` = `AiModelOutputV1` gốc và `computed_result` = `AiAnalysisResultV1`, bản ghi mới, append-only) và phát sự kiện qua outbox theo envelope chuẩn (mục 9).
```

Chạy nền, có timeout, retry tối đa 2 lần. Lỗi thì `FAILED` và cho chạy lại. Kiểm tra trích dẫn (bước 9) luôn nằm **sau** mọi lần gọi LLM, để không có trích dẫn nào do model sinh ra mà chưa được backend xác minh.

### 11.5. Chấm điểm theo bằng chứng

**Mức bằng chứng** cho mỗi tiêu chí. LLM đề xuất, code có thể hạ mức nhưng không được nâng:

| Mức | Định nghĩa | Hệ số ⚙ (đọc qua `scoring_parameters`, không hardcode) |
|---|---|---|
| `NONE` | Không thấy dấu hiệu, hoặc chỉ có câu phủ định | 0 (cố định theo định nghĩa, không cấu hình) |
| `LISTED_ONLY` | Chỉ có trích dẫn hợp lệ ở danh sách kỹ năng hoặc tiêu đề | ⚙ `scoring.evidence_multiplier.listed_only` |
| `MENTIONED_IN_EXPERIENCE` | Có trích dẫn hợp lệ ở mục Kinh nghiệm hoặc Dự án nhưng thiếu chi tiết | ⚙ `scoring.evidence_multiplier.mentioned` |
| `DEMONSTRATED` | Mô tả việc đã làm kèm chi tiết cụ thể (vai trò cá nhân, phạm vi, thời lượng, con số hoặc kết quả) | ⚙ `scoring.evidence_multiplier.demonstrated` |

**Luật do code thực thi:**

1. **Trích dẫn phải thật.** Trích dẫn không khớp văn bản thì bị loại và ghi cờ `UNVERIFIED_CITATION`. Tiêu chí không còn trích dẫn hợp lệ thì mức là `NONE`.
2. **Trích dẫn phải nói về tiêu chí đó.** Trích dẫn gắn với tiêu chí phải chứa tên hoặc một `synonym` của tiêu chí, trong cùng đoạn (bullet hoặc paragraph).
3. **Từ khóa không được nâng mức.** Sự hiện diện của từ khóa trong văn bản không tự tạo ra `LISTED_ONLY`. Mức `LISTED_ONLY` chỉ đến từ một trích dẫn hợp lệ, khẳng định (không phủ định) ở mục Kỹ năng hoặc tiêu đề, hoặc từ một span chép từ JD theo luật 6.
4. **Phủ định.** Mỗi trích dẫn có `polarity` (`AFFIRMED`, `NEGATED`, `UNCLEAR`). Trích dẫn `NEGATED` không tính là bằng chứng. Code bổ sung kiểm tra các cụm phủ định phổ biến quanh trích dẫn (ví dụ "chưa từng", "không có kinh nghiệm", "chưa có", "no experience", "never") và hạ `polarity` về `NEGATED` hoặc `UNCLEAR` nếu phát hiện.
5. **`DEMONSTRATED` yêu cầu:** ít nhất một trích dẫn hợp lệ, khẳng định, nằm ở mục Kinh nghiệm hoặc Dự án (không phải mục Kỹ năng), không phải span chép từ JD, và chứa ít nhất một loại chi tiết cụ thể (`role`, `scope`, `duration`, `metric`, `outcome`). Riêng `metric` và `duration` do code kiểm tra bằng mẫu số, đơn vị và khoảng thời gian có mặt thật trong trích dẫn. `role`, `scope`, `outcome` do LLM xác định nên độ tin cậy thấp hơn và được ghi nhận nguồn xác định. Thiếu điều kiện nào thì hạ xuống `MENTIONED_IN_EXPERIENCE` hoặc `LISTED_ONLY` tùy vị trí.
6. **Span chép từ JD chỉ mất giá trị của chính nó.** Một trích dẫn có độ trùng với JD từ ngưỡng ⚙ `scoring.copy_span_threshold` trở lên là "span chép": nó chỉ được tính tối đa `LISTED_ONLY` và gắn cờ `EVIDENCE_COPIED_FROM_JD`. Mức của tiêu chí là mức cao nhất trong các trích dẫn hợp lệ **không phải span chép**. Nếu CV có thêm một trích dẫn độc lập, được xác minh, không trùng JD, thì tiêu chí vẫn được chấm theo trích dẫn đó. Chỉ khi toàn bộ bằng chứng hợp lệ đều là span chép thì tiêu chí bị giới hạn ở `LISTED_ONLY`.
7. **Kỹ năng ngoài bộ tiêu chí không cộng điểm**, nên nhồi thêm công nghệ không liên quan không có tác dụng.

**Điểm số:**

- `claim_coverage = Σ(weight của tiêu chí có mức ≥ LISTED_ONLY) / Σ(weight) × 100`. Đây là độ phủ lời khai theo JD, kiểu so từ khóa.
- `evidence_score = Σ(weight × hệ số) / Σ(weight) × 100`.
- `evidence_ratio = evidence_score / claim_coverage` (bằng 0 nếu `claim_coverage = 0`).
- `evidence_grade`: `LOW` nếu ratio < ⚙ `scoring.evidence_grade.low_ratio` hoặc `evidence_score` < ⚙ `scoring.evidence_grade.low_score_max`; `HIGH` nếu ratio ≥ ⚙ `scoring.evidence_grade.high_ratio` và `evidence_score` ≥ ⚙ `scoring.evidence_grade.high_score_min`; còn lại `MEDIUM`. Giá trị khởi tạo mẫu (0.4 / 30 / 0.7 / 50) chỉ minh họa cách tính; giá trị thật nằm trong `scoring_parameters` và phải hiệu chỉnh (11.13).
- Tiêu chí `MUST` có mức `NONE` chỉ hiện huy hiệu "Thiếu MUST: …". **Không loại hồ sơ.**

**Ví dụ tính (5 tiêu chí, trọng số 30/25/20/15/10):**

| Ứng viên | C1 (30) | C2 (25) | C3 (20) | C4 (15) | C5 (10) | claim | evidence | ratio | grade |
|---|---|---|---|---|---|---|---|---|---|
| A: sao chép JD, chỉ liệt kê hoặc chép nguyên câu | LISTED | LISTED | LISTED | LISTED | LISTED | 100 | 25 | 0.25 | LOW |
| B: trung thực, có kinh nghiệm thật | DEMO | DEMO | MENTIONED | NONE | MENTIONED | 85 | 73 | 0.86 | HIGH |
| C: diễn đạt lại JD bằng lời khác, không chi tiết | MENTIONED | MENTIONED | MENTIONED | MENTIONED | MENTIONED | 100 | 60 | 0.60 | MEDIUM |

Cách tính B: 30×1 + 25×1 + 20×0.6 + 0 + 10×0.6 = 73. Dòng C cho thấy giới hạn có thật: CV diễn đạt lại JD mà không có chi tiết vẫn đạt MEDIUM, chứ không bị hạ xuống LOW. Đây là lý do `verify_points` và phỏng vấn là bắt buộc, không phải phần trang trí (xem 11.14).

### 11.6. Phát hiện CV bám sát JD (code, xác định)

- **Chuẩn hóa:** Unicode NFC, chữ thường, bỏ dấu câu, gộp khoảng trắng. So sánh cả bản có dấu và bản bỏ dấu (xử lý "đ"). Loại các cụm chung chung hay gặp ("làm việc nhóm", "tinh thần trách nhiệm"…) theo danh sách cấu hình ⚙ `scoring.common_phrases` để giảm cảnh báo sai.
- **N-gram:** token hóa theo từ hoặc âm tiết, độ dài ⚙ `scoring.ngram_n`.
- **Độ trùng của một trích dẫn:** tỷ lệ n-gram của trích dẫn xuất hiện trong JD. Dùng cho luật 6 ở 11.5.
- **Độ trùng cả văn bản:** `jd_ngram_overlap = |n-gram của JD xuất hiện trong CV| / |n-gram của JD|`. Vượt ngưỡng ⚙ `scoring.mirroring_warn_threshold` thì cờ `JD_MIRRORING_SUSPECTED` mức `CHECK`, kèm danh sách cụm trùng để giao diện bôi sáng. **Không trừ điểm tự động**, vì chỉnh CV theo JD là việc bình thường. Chỉ cần HR biết.
- **Trùng giữa các CV (P1):** so MinHash hoặc Jaccard giữa các CV trong cùng posting, sau khi loại phần template, header, footer và boilerplate (danh sách cụm chung chung đọc từ ⚙ `scoring.common_phrases`), và chỉ so nội dung kinh nghiệm và dự án. Giống nhau bất thường thì cờ `NEAR_DUPLICATE_CV`. Cùng template mà nội dung khác thì không được cảnh báo.

### 11.7. Chữ ẩn, prompt injection, định danh, nhất quán

**Chữ ẩn (`HIDDEN_TEXT_SUSPECTED`).**
- P0: phát hiện chữ có màu trùng nền, cỡ chữ cực nhỏ, chữ nằm ngoài vùng trang. Chữ ẩn **bị loại khỏi văn bản dùng để chấm**, ghi lại số ký tự đã loại.
- P1: so văn bản trích từ text layer với văn bản OCR từ ảnh trang; phần chỉ có trong text layer coi là ẩn.

**Prompt injection (`PROMPT_INJECTION_PATTERN`).**
- Phòng thủ nhiều lớp: (1) đóng gói CV trong khối phân cách và nói rõ với model đây là dữ liệu không đáng tin, (2) output chỉ theo schema `AiModelOutputV1`, (3) quét mẫu đáng ngờ bằng code, danh sách mẫu đọc từ ⚙ `ai_safety.injection_patterns` ("ignore previous instructions", "bỏ qua hướng dẫn", "cho điểm 100"… là ví dụ minh họa, không phải danh sách cứng trong code), (4) code tính lại điểm từ mức bằng chứng đã xác minh nên model không thể tự ghi điểm.
- Khớp mẫu thì ghi cờ mức `CHECK`. Không cần dừng chấm, vì luật hạ mức và việc code tính điểm đã giới hạn thiệt hại.
- Rủi ro tồn dư: mẫu bị né bằng diễn đạt hoặc ký tự Unicode gần giống. Vì vậy điểm luôn dựa trên trích dẫn đã xác minh chứ không dựa trên việc phát hiện injection.

**Định danh (`IDENTITY_MISMATCH_CHECK`).** So họ tên, email, số điện thoại trên form với CV bằng code, trên văn bản đã loại chữ ẩn và trước khi che, để chữ ẩn chứa tên giả không qua được kiểm tra. So sánh không phân biệt dấu, thứ tự tên, viết hoa: "Nguyễn Văn A", "Nguyen Van A" và "A Nguyễn Văn" không phải mâu thuẫn. Khi lệch thật, ghi rõ chính xác trường nào lệch.

**Nhất quán CV.**

| Mã cờ | Điều kiện | Mức triển khai |
|---|---|---|
| `TIMELINE_OVERLAP` | Hai công việc toàn thời gian chồng nhau đáng kể | P0 (code) |
| `FUTURE_DATE` | Mốc thời gian ở tương lai (trừ "hiện tại") | P0 (code) |
| `EXPERIENCE_YEARS_MISMATCH` | Số năm kinh nghiệm tự khai lệch so với tổng các mốc | P1 (code) |
| `SKILL_YEARS_EXCEEDS_TENURE` | Khai "N năm dùng công nghệ X" vượt tổng thời gian các công việc nhắc X | P1 (code) |
| `TITLE_DESCRIPTION_MISMATCH` | Chức danh cao nhưng mô tả toàn việc cấp thấp | P1 (LLM, bắt buộc kèm trích dẫn đã xác minh) |

Mọi cờ có `severity` (`INFO` hoặc `CHECK`), `detail` mô tả chính xác dữ kiện lệch và `suggested_question` để HR hỏi.

### 11.8. An toàn file tải lên

**P0 (nhẹ, làm ở bước upload):**
- Chỉ nhận PDF và DOCX. Kiểm tra magic bytes và loại file thật, không tin đuôi file hay MIME do client gửi.
- Giới hạn dung lượng file và số trang: ⚙ `upload.max_file_size_mb`, ⚙ `upload.max_pages` (giá trị khởi tạo mẫu: 5 MB, 10 trang; sửa qua API quản trị, không sửa code).
- Từ chối DOCM, file có macro, file đặt mật khẩu.
- Timeout khi trích văn bản. Tên file lưu trên server là tên ngẫu nhiên, không dùng tên do ứng viên đặt.
- File nhạy cảm truy cập bằng URL ký số có thời hạn, không trả URL công khai lâu dài.

**P1:** parser chạy trong sandbox không có quyền mạng, quét malware, giới hạn dung lượng sau giải nén.

Raw response của model chỉ lưu ở vùng audit giới hạn quyền, không trả ra public API.

### 11.9. Kết quả trả về: hai schema tách biệt

**`AiModelOutputV1` — đúng và chỉ những gì LLM được phép trả (bước 7-8 ở mục 11.4):**

```json
{
  "schema_version": "1.0",
  "structured_cv": {"experiences": [], "education": [], "skills_listed": [], "projects": []},
  "criteria_evidence": [{
    "criteria_id": "C1",
    "candidates": [{
      "quote": "...", "section": "EXPERIENCE", "polarity": "AFFIRMED", "detail_types": []
    }],
    "missing": "Chưa thấy quy mô hoặc vai trò cá nhân"
  }],
  "consistency_notes": [{"type": "TITLE_DESCRIPTION_MISMATCH", "quote": "...", "detail": "..."}],
  "meta": {"model": "...", "prompt_version": "..."}
}
```

Không có `weight`, `multiplier`, `score`, `evidence_level` (mức đã áp luật hạ), `grade`, hay `verified` (việc xác minh trích dẫn là của backend, không phải model tự nhận). Backend từ chối `AiModelOutputV1` nếu có bất kỳ trường nào trong nhóm này xuất hiện, hoặc `criteria_id` không khớp `criteria_version` đang dùng.

**`AiAnalysisResultV1` — do backend tạo ra, lưu vào `ai_analyses.computed_result` và hiển thị cho HR:**

```json
{
  "schema_version": "1.2",
  "status": "DONE",
  "extraction": {"quality": "OK", "method": "TEXT_LAYER", "char_count": 5231, "hidden_text_removed_chars": 0},
  "scores": {"claim_coverage": 88, "evidence_score": 42, "evidence_ratio": 0.48, "evidence_grade": "MEDIUM", "confidence": "MEDIUM"},
  "criteria": [{
    "id": "C1", "name": "Spring Boot", "type": "MUST", "weight": 30,
    "evidence_level": "MENTIONED_IN_EXPERIENCE", "multiplier": 0.6,
    "evidence": [{"quote": "...", "section": "EXPERIENCE", "polarity": "AFFIRMED",
                  "verified": true, "jd_overlap": 0.10, "is_copied_span": false, "detail_types": []}],
    "missing": "Chưa thấy quy mô hoặc vai trò cá nhân", "downgrade_reason": null
  }],
  "flags": [{"code": "JD_MIRRORING_SUSPECTED", "severity": "CHECK", "detail": "...",
             "metric": {"ngram_overlap": 0.31}, "suggested_question": "..."}],
  "verify_points": [{"claim": "...", "why": "Chỉ có ở mục Kỹ năng", "suggested_questions": ["..."]}],
  "meta": {"model": "...", "prompt_version": "...", "criteria_version": 3, "scoring_profile_version": 2, "input_hash": "...", "run_id": "...", "duration_ms": 0}
}
```

- `weight`, `multiplier`, `evidence_level`, `verified`, `scores`, `flags` chỉ tồn tại trong `AiAnalysisResultV1`, do backend tính. `AiModelOutputV1` không bao giờ chứa các trường này — đây chính là ranh giới kỹ thuật khiến model không thể tự ghi điểm, kể cả khi bị prompt injection.
- `confidence` là `LOW` khi trích xuất chất lượng thấp, hoặc tỷ lệ trích dẫn không xác minh được vượt ngưỡng ⚙ `scoring.confidence.unverified_citation_ratio_max`, hoặc (nếu bật chạy lặp cho hồ sơ gần ranh giới) hai lần chạy lệch điểm quá ngưỡng. Mặc định chỉ chạy một lần.
- `verify_points` tối đa 5 điểm ưu tiên: tiêu chí `MUST` chỉ có bằng chứng thấp, và các cờ mức `CHECK`. Đây là nguồn cho bộ câu hỏi phỏng vấn.

### 11.10. Hiển thị cho HR (giảm automation bias)

- Luôn ghi "AI đề xuất, cần con người xác minh".
- **Danh sách hồ sơ mặc định sắp theo thời gian nộp hoặc SLA, không theo điểm AI.** HR có thể chủ động bật "Sắp theo bằng chứng AI", giao diện hiển thị nhãn đang dùng AI để sắp xếp.
- Không ẩn hồ sơ điểm thấp, không đổi số lượng phân trang.
- Nhãn hai trục: "Độ phủ lời khai theo JD" và "Mức bằng chứng". Không dùng cách gọi "độ phù hợp thực tế". Có chú thích: độ phủ lời khai không phải xác minh năng lực.
- Trích dẫn được bôi sáng ngay trên CV. Cụm trùng JD cũng được bôi sáng. Các cờ đi kèm câu hỏi gợi ý.
- Hồ sơ AI lỗi, chưa chạy hoặc `NEEDS_MANUAL_REVIEW` hiển thị đầy đủ cho HR đọc thủ công.
- Chỉ so sánh và xếp hạng các kết quả cùng cặp `(criteria_version_id, scoring_profile_version_id)`.
- HR đánh dấu `AGREE`, `DISAGREE` hoặc `PARTIAL` kèm lý do (lưu `hr_ai_feedback`).
- Lấy mẫu ngẫu nhiên hồ sơ điểm thấp cho HR kiểm tra chéo: P2.

### 11.11. Câu hỏi sàng lọc trên form (P1, bật theo posting)

2 đến 3 câu tình huống ngắn ("mô tả một lần bạn xử lý X, bạn làm gì, kết quả ra sao"). AI đọc câu trả lời để **sinh thêm `verify_points`**. Câu trả lời mặc định **không cộng** vào `evidence_score` của CV. Nhận định thẳng thắn: ứng viên có thể dùng AI để viết câu trả lời, nên không đặt niềm tin quá mức. Giá trị chính là cung cấp điểm bắt đầu cho phỏng vấn. Không được biến thành cổng chặn.

### 11.12. Công bằng, riêng tư

- **Che thuộc tính nhạy cảm bằng code** trước khi gửi LLM: không gửi ảnh, xóa các dòng và trường như giới tính, ngày sinh hoặc tuổi, tình trạng hôn nhân, tôn giáo, dân tộc, số CCCD, địa chỉ chi tiết. Nhận diện bằng mẫu và danh sách nhãn tiếng Việt và tiếng Anh. Chấp nhận có rủi ro sót, nên có kiểm thử đối chứng T9.
- Không gửi tên ứng viên cho LLM khi không cần cho việc chấm. Kiểm tra định danh làm bằng code.
- Consent lưu thời điểm, phiên bản điều khoản, mục đích, và **nói rõ CV được xử lý bởi nhà cung cấp AI bên ngoài**. Không đồng ý thì vẫn nộp được, AI không chạy, kiểm tra ở backend.
- Lưu `model`, `prompt_version`, `criteria_version`, `scoring_profile_version`, `input_hash` để tái kiểm tra.
- Định kỳ so sánh phân phối điểm theo vị trí và phòng ban để phát hiện drift (P2).

### 11.13. Tham số cấu hình và hiệu chỉnh

Toàn bộ dòng dưới đây là bản ghi trong `scoring_parameters` hoặc `system_configurations` (mục 0), đọc qua `ConfigurationService`, sửa được qua API quản trị mà không cần deploy lại. Cột "Giá trị khởi tạo mẫu" chỉ là dữ liệu seed ban đầu để hệ thống chạy được lần đầu, không phải hằng số trong code.

| Khóa cấu hình | Giá trị khởi tạo mẫu | Ghi chú |
|---|---|---|
| `scoring.evidence_multiplier.listed_only` / `.mentioned` / `.demonstrated` | 0.25 / 0.6 / 1.0 | Hiệu chỉnh bằng cách so với xếp hạng của HR |
| `scoring.evidence_grade.low_ratio` / `.high_ratio` / `.low_score_max` / `.high_score_min` | 0.4 / 0.7 / 30 / 50 | Hiệu chỉnh |
| `scoring.ngram_n` | 6 | |
| `scoring.copy_span_threshold` | 0.5 | Hiệu chỉnh trên CV thật |
| `scoring.mirroring_warn_threshold` | Chưa có giá trị khởi tạo cố định | Đặt theo phân vị cao của phân phối CV trung thực cộng biên độ, cập nhật qua API quản trị |
| `upload.max_file_size_mb` / `.max_pages` | 5 / 10 | `system_configurations` |
| `scoring.max_input_chars` | Theo ngữ cảnh model đang dùng | Vượt thì `NEEDS_MANUAL_REVIEW`, không cắt |
| `ai.timeout_seconds`, `ai.max_retry` | Seed hợp lý, ví dụ retry tối đa 2 | `system_configurations` |
| `scoring.confidence.unverified_citation_ratio_max` | 0.2 | Dùng ở 11.9 |

**Quy trình hiệu chỉnh:** chạy trên một tập CV thật (đã ẩn danh, có consent) cho cùng một JD, lấy phân phối `jd_ngram_overlap` của CV trung thực làm nền, đặt ngưỡng cảnh báo theo phân vị cao cộng biên độ, đo tỷ lệ cảnh báo sai. Hiệu chỉnh hệ số và ngưỡng `evidence_grade` bằng cách so với xếp hạng của HR. Kết quả hiệu chỉnh tạo một `scoring_profile` mới ở `DRAFT`; sau khi người có quyền xác nhận mới chuyển `ACTIVE`. Không sửa trực tiếp tham số của profile đã dùng, trong code hoặc trong build ứng dụng.

**Đo độ ổn định:** chạy mỗi CV kiểm thử nhiều lần với cấu hình ổn định nhất có thể, ghi độ lệch điểm. Dùng độ lệch nền này làm dung sai cho các ca T5 và T9.

**Chỉ số theo dõi thật:** tỷ lệ HR đồng ý hay không đồng ý với AI, tương quan giữa mức bằng chứng và kết quả phỏng vấn vòng 1 (CV điểm cao hay rớt ở vòng 1 nghĩa là tiêu chí đang bị lách), tỷ lệ cờ được HR xác nhận là đúng.

### 11.14. Rủi ro tồn dư

1. **CV bịa chi tiết.** Ứng viên có thể bịa hẳn một đoạn kinh nghiệm chi tiết. Không cách nào đọc CV mà phát hiện chắc chắn.
2. **CV diễn đạt lại JD.** Không trùng nguyên văn và không có chi tiết cụ thể vẫn đạt tối đa `MENTIONED_IN_EXPERIENCE`, tức grade MEDIUM (dòng C ở ví dụ 11.5).
3. **Redaction và OCR không hoàn hảo.** Có thể sót thuộc tính nhạy cảm hoặc đọc sai.
4. **Regex phát hiện injection bị né.** Giảm nhẹ nhờ điểm do code tính từ trích dẫn đã xác minh.
5. **Model có drift và không hoàn toàn tái lập.** Lưu model, prompt, input version; chạy hồi quy trước khi đổi model; có công tắc chuyển sang manual-only.
6. **HR vẫn có thể thiên lệch theo điểm AI.** Giao diện chỉ giảm chứ không loại bỏ được.

Các rủi ro 1 và 2 được giải bằng `verify_points`, phỏng vấn có câu hỏi nhắm đúng điểm khai, và kiểm tra tham chiếu có consent trước khi gửi offer.

---

## 12. Human-in-the-loop và tuân thủ

### 12.1. Ai làm gì

| | AI | Con người |
|---|---|---|
| Đọc CV | Trích cấu trúc, đánh dấu bằng chứng | HR đọc CV gốc và quyết định |
| Đánh giá | Gợi ý mức bằng chứng, độ phủ lời khai | HR và chuyên môn ra quyết định Duyệt, Trả về, Từ chối |
| Cảnh báo | Nêu điểm cần xác minh kèm câu hỏi | HR xác minh, hỏi ứng viên, bỏ qua nếu thấy vô lý |
| Từ chối | **Không bao giờ tự từ chối hay gửi email** | HR nhập lý do và chọn có gửi email hay không |
| Sắp xếp | Chỉ khi HR bật tùy chọn | HR chọn cách sắp |

### 12.2. Các cơ chế bảo đảm

- Công tắc `ai_mode` (`ON` hoặc `MANUAL_ONLY`) theo hệ thống hoặc theo posting. `MANUAL_ONLY` tắt phân tích AI nhưng luồng tuyển dụng vẫn chạy đầy đủ.
- HR đánh dấu đồng ý hay không với gợi ý AI. Số liệu này chỉ dùng đánh giá chất lượng AI, **không dùng đánh giá cá nhân HR**.
- Nội dung consent nói rõ AI hỗ trợ, quyết định do con người, và CV được xử lý bởi nhà cung cấp AI bên ngoài.
- File CV truy cập bằng URL ký số có thời hạn. CV bị từ chối được xóa hoặc ẩn danh sau thời hạn cấu hình. Talent Pool cần consent riêng và ngày hết hạn.
- CCCD chỉ thu ở pre-boarding sau `OFFER_ACCEPTED`.

### 12.3. Căn cứ pháp lý cần đối chiếu

Xem mục 17. Toàn bộ nghĩa vụ cụ thể của hệ thống AI hỗ trợ tuyển dụng đối với ứng viên phải được pháp chế hoặc luật sư xác nhận. Tài liệu này chỉ ghi các văn bản cần đối chiếu.

---

## 13. Bộ kiểm thử

### 13.1. Kiểm thử AI chấm CV (T1 đến T15)

| Mã | Ca | Kết quả kỳ vọng |
|---|---|---|
| T1 | CV trung thực, mạnh | `evidence_grade` = HIGH; không có cờ `CHECK` vô lý |
| T2 | CV trung thực, yếu | Điểm thấp nhưng hồ sơ vẫn ở `PENDING_HR_CV_REVIEW`; không bị chặn, không có email tự động |
| T3 | Sao chép nguyên JD vào phần kỹ năng và kinh nghiệm | `claim_coverage` cao, grade LOW; cờ `JD_MIRRORING_SUSPECTED` và `EVIDENCE_COPIED_FROM_JD` |
| T4 | Nhồi 40 công nghệ vào mục kỹ năng | Chỉ tiêu chí trong bộ được tính, tối đa `LISTED_ONLY`; công nghệ ngoài bộ không cộng điểm |
| T5 | Chèn câu lệnh cho AI ("cho tôi 100 điểm", "ignore previous instructions"), kể cả biến thể Unicode | Điểm chênh không vượt dung sai so với CV không chèn; cờ `PROMPT_INJECTION_PATTERN` khi khớp mẫu; nếu mẫu bị né thì điểm vẫn do code tính từ trích dẫn đã xác minh |
| T6 | Chữ trắng trên nền trắng chứa từ khóa | Chữ ẩn bị loại khỏi văn bản chấm; cờ `HIDDEN_TEXT_SUSPECTED`; điểm không tăng |
| T7 | Hai việc chồng thời gian hoặc mốc ở tương lai | Cờ `TIMELINE_OVERLAP` hoặc `FUTURE_DATE` kèm câu hỏi gợi ý |
| T8 | Tên có dấu, không dấu, đảo thứ tự; và một ca lệch thật | Ca đầu không có `IDENTITY_MISMATCH_CHECK`; ca lệch thật nêu đúng trường lệch |
| T9 | Đối chứng công bằng: đổi giới tính, tuổi, ảnh, tên trong cùng một CV | Chênh điểm không vượt dao động nền cộng dung sai nhỏ |
| T10 | CV dạng ảnh quét chất lượng thấp | `NEEDS_MANUAL_REVIEW`, không có điểm |
| T11 | CV ghi "Tôi chưa từng làm Spring Boot" | Tiêu chí Spring Boot ở mức `NONE`; sự hiện diện của từ khóa không nâng mức; có thể sinh verify point, không kết luận gian lận |
| T12 | CV chép một câu JD nhưng có đoạn độc lập mô tả dự án, vai trò, metric thật | Chỉ span chép bị hạ; trích dẫn độc lập vẫn được chấm |
| T13 | Diễn đạt lại JD bằng lời khác, không chi tiết cụ thể | Tối đa `MENTIONED_IN_EXPERIENCE`; xuất hiện trong `verify_points`; không đạt HIGH |
| T14 | CV rất dài vượt giới hạn, kinh nghiệm phù hợp nằm ở cuối | `NEEDS_MANUAL_REVIEW`; hệ thống không cắt bớt và không chấm |
| T15 | Model trả criteria ID lạ, hoặc tự đặt weight hoặc điểm | Backend từ chối output, run `FAILED`, không ghi điểm; weight luôn lấy từ server |

**Ca P1:** hai CV dùng cùng template nhưng nội dung khác không bị gắn `NEAR_DUPLICATE_CV`; chữ ẩn được phát hiện bằng đối chiếu OCR; câu trả lời sàng lọc chỉ sinh verify point.

### 13.2. Kiểm thử luồng và dữ liệu (W1 đến W18)

| Mã | Ca | Kết quả kỳ vọng |
|---|---|---|
| W1 | Hai HR cùng gửi offer cho suất cuối cùng | Chỉ một transaction thành công; người còn lại nhận lỗi ở phía HR |
| W2 | Gửi offer thứ hai khi hết suất | Bị chặn; chỉ khi HR Head xác nhận overbook mới gửi được; ứng viên không bao giờ thấy xung đột |
| W3 | Ứng viên từ chối, offer quá hạn, offer bị thu hồi, ứng viên rút | Suất về `AVAILABLE`; `seat_events` ghi đúng lý do |
| W4 | Ứng viên đề nghị thương lượng | Suất vẫn `RESERVED`; offer version mới phải duyệt lại |
| W5 | Người duyệt quyết định trên request đã cũ (offer bị sửa) | Bị từ chối vì `entity_version` không khớp |
| W6 | Người soạn tự duyệt; người giới thiệu duyệt hồ sơ của mình | Bị chặn ở backend |
| W7 | Bấm duyệt hai lần liên tiếp | Chỉ một chuyển trạng thái; lần hai trả conflict |
| W8 | Phần mềm quét mail mở link offer (GET) | Token không bị tiêu; chỉ POST có xác nhận mới có hiệu lực |
| W9 | File giả đuôi PDF; DOCX có macro | Bị từ chối ở upload; không tạo hồ sơ giả và không chạy AI |
| W10 | HR đổi tiêu chí khi có 30 hồ sơ: 20 hồ sơ ở bước CV/phỏng vấn, 5 hồ sơ từ `PENDING_HR_OFFER` trở đi, 5 hồ sơ đã kết thúc | Chỉ 20 hồ sơ ở bước CV/phỏng vấn được chạy lại; 10 hồ sơ còn lại giữ snapshot lịch sử; không có bảng xếp hạng trộn cặp criteria/scoring version |
| W11 | Ứng viên chấp nhận đúng lúc HR thu hồi offer | Chỉ một bên thắng; bên còn lại nhận thông báo rõ |
| W12 | Sau `OFFER_ACCEPTED`, ứng viên không đến nhận việc | Suất `ACCEPTED` → `AVAILABLE`; tạo `REOPEN_REVIEW_REQUIRED`; lịch sử offer chấp nhận không bị xóa |
| W13 | Posting `FILLED` khi còn hồ sơ đang xử lý | Không tự loại; tạo task cho HR |
| W14 | Gọi trực tiếp đổi trạng thái không có trong bảng (nhảy cóc, bỏ qua duyệt) | Bị từ chối (default deny) |
| W15 | HR gia hạn khi dispatch vẫn `ACTIVE` | Trong một transaction: dispatch cũ `SUPERSEDED`, dispatch mới `ACTIVE`, token cũ vô hiệu, seat vẫn `RESERVED`; không tồn tại hai dispatch `ACTIVE` |
| W16 | HR gửi lại sau khi dispatch đã `EXPIRED` và seat đã bị người khác giữ | Không tạo dispatch mới; báo hết suất cho HR, hoặc chỉ thành công sau khi HR Head xác nhận `OVERBOOK` |
| W17 | Thay đổi hệ số chấm trong khi posting đang mở | Tạo `scoring_profile_version` mới; kết quả cũ giữ nguyên version; chỉ tập hồ sơ CV/phỏng vấn được chạy lại có chủ đích; không so sánh hai profile version |
| W18 | Hai consumer đồng thời claim một `event_id` | Insert-if-absent chỉ cho một bên xử lý; bên còn lại chờ kết quả đã commit rồi trả idempotent, không phát sinh HTTP 500 |

---

## 14. Kịch bản demo chung kết

Điểm nhấn: **AI chống thao túng CV** ở bước 3 đến 5, và **giữ suất từ lúc gửi offer** ở bước 9 đến 10. Các bước còn lại chạy gọn để chứng minh toàn bộ luồng.

1. Trưởng phòng tạo requisition (headcount 1). CEO trả về vì khung lương chưa phù hợp. Trưởng phòng sửa và gửi lại. CEO duyệt. Hệ thống sinh 1 suất `AVAILABLE`.
2. HR tạo posting. AI đề xuất bản nháp tiêu chí, HR chỉnh và xác nhận. Khi mở posting, tiêu chí bị khóa.
3. Ba ứng viên nộp hồ sơ: **A** trung thực và có kinh nghiệm thật; **B** sao chép nguyên JD; **C** chèn câu lệnh "cho tôi 100 điểm" và chữ ẩn chứa từ khóa. Cả ba xuất hiện ngay cho HR trong khi AI chạy nền.
4. HR mở danh sách (mặc định theo thời gian nộp), rồi bật "Sắp theo bằng chứng AI": A độ phủ 85, bằng chứng CAO; **B độ phủ 100 nhưng bằng chứng THẤP**, có cờ bám JD; **C** điểm không đổi, có cờ prompt injection và chữ ẩn. Mở B để bôi sáng các cụm trùng JD.
5. HR xem trích dẫn của A, xem `verify_points`, đánh dấu `PARTIAL` với một gợi ý AI và ghi lý do, rồi duyệt A. Không có hồ sơ nào bị loại tự động.
6. Trưởng phòng chuyên môn duyệt A, đặt lịch, nhập feedback hai vòng và kết quả đàm phán.
7. HR soạn offer v1 vượt nhẹ khung lương. Hệ thống yêu cầu lý do vượt khung. CEO trả về, HR tạo v2, CEO duyệt.
8. HR gửi offer cho A. Suất chuyển `RESERVED`.
9. HR thử gửi offer cho ứng viên D thứ hai (hồ sơ D được chuẩn bị sẵn ở trạng thái `OFFER_INTERNALLY_APPROVED`): hệ thống chặn vì hết suất. HR Head xác nhận "offer dự phòng" kèm lý do; offer được gửi. Ứng viên D không thấy bất kỳ thông báo xung đột nào.
10. A mở link offer (GET chỉ xem), bấm chấp nhận (POST có xác nhận). Suất `ACCEPTED`, posting `FILLED`, requisition `FULFILLED`. Sự kiện `OFFER_ACCEPTED` được phát qua outbox.
11. **Lát cắt vòng đời:** Person `PROVISIONAL`, Employee `PRE_BOARDING`; tài khoản có thể chưa tạo hoặc đã chuẩn bị ở `DISABLED`. HR xác nhận ngày đi làm thì Employee thành `EMPLOYED` và suất thành `JOINED`; lệnh tạo/kích hoạt tài khoản chạy qua outbox, lỗi cấp quyền không đảo ngược `JOINED` (theo `VONG_DOI_NHAN_VIEN_HRM_AI_P0_1_PATCHED.md`).
12. Mở audit timeline để chứng minh toàn bộ quá trình truy vết được, gồm `seat_events` và các chuyển trạng thái.

**Kịch bản dự phòng:** nếu API AI lỗi lúc demo, bật `ai_mode = MANUAL_ONLY` để chứng minh luồng vẫn chạy bình thường mà không có AI, đúng nguyên tắc số 2.

---

## 15. Chỉ số đo lường

- Time to first review: từ lúc nộp hồ sơ đến khi HR mở hồ sơ.
- Time in stage: thời gian ở từng trạng thái.
- Time to hire: từ requisition được duyệt đến offer accepted.
- Conversion rate giữa các vòng.
- Offer acceptance rate và lý do từ chối offer.
- Tỷ lệ hồ sơ quá SLA.
- Tỷ lệ AI chạy thành công, thời gian xử lý, tỷ lệ `NEEDS_MANUAL_REVIEW`.
- Tỷ lệ HR đồng ý hay không đồng ý với AI (chỉ đánh giá chất lượng AI).
- Tỷ lệ cờ AI được HR xác nhận là đúng.
- Tương quan giữa mức bằng chứng và kết quả phỏng vấn vòng 1.
- Tỷ lệ tuyển đủ headcount đúng hạn; số suất bị nhả sau khi đã chấp nhận.

---

## 16. Phạm vi triển khai

### P0. Bắt buộc để đúng nghiệp vụ và demo

- `RecruitmentTransitionService` với default deny, audit log, `@Version`, unique constraint, idempotency key.
- State machine cho Requisition, Posting, Application, Offer (bảng ở mục 6).
- Approval engine: `approval_requests`, `approval_steps`, resolver, luật xung đột lợi ích.
- Seat ledger, giữ suất từ `OFFER_SENT`, offer dự phòng do HR Head xác nhận, quy tắc nhả suất.
- Offer version bất biến; dispatch có `SUPERSEDED` khi gia hạn trước hạn; gửi lại sau `EXPIRED` phải giữ lại suất; link phản hồi GET xem và POST xác nhận; chấp nhận atomic.
- Interview có lịch và phiếu feedback làm điều kiện duyệt.
- AI CV: pipeline đúng thứ tự, chấm theo bằng chứng do code tính, xác minh trích dẫn, khóa cặp `criteria_version` và `scoring_profile_version` theo posting, chỉ chạy lại tập hồ sơ CV/phỏng vấn khi đổi version, luật span chép, phủ định, quét injection, loại chữ ẩn (heuristic), kiểm tra định danh, che dữ liệu nhạy cảm, consent, `NEEDS_MANUAL_REVIEW`, kiểm tra file cơ bản, sắp xếp mặc định trung lập, phản hồi của HR.
- `scoring_profiles` bất biến, có seed/version và lưu version trên mọi `ai_analyses`.
- Bảng outbox/inbox đơn giản có poller, retry, event envelope chung với payload theo từng `event_type`, và xử lý duplicate-key idempotent.
- Bộ kiểm thử T1 đến T15 và W1 đến W18 chạy được.

### P1. Tăng sức nặng

- Nhắc SLA, dashboard funnel, nhắc lịch phỏng vấn.
- Form đàm phán lương chi tiết và kiểm soát khung lương nâng cao.
- Near-duplicate CV (MinHash); phát hiện chữ ẩn bằng đối chiếu OCR.
- Sandbox parser, quét malware.
- Câu hỏi sàng lọc trên form; chỉnh sửa bộ câu hỏi phỏng vấn từ `verify_points`.
- Cờ nhất quán nâng cao (`EXPERIENCE_YEARS_MISMATCH`, `SKILL_YEARS_EXCEEDS_TENURE`, `TITLE_DESCRIPTION_MISMATCH`).
- Ủy quyền có thời hạn; giao diện diff bộ tiêu chí; giao diện overbook và seat.

### P2. Nâng cấp doanh nghiệp

- Talent Pool đa chiến dịch; pre-boarding nâng cao.
- Phân tích drift và fairness theo thời gian; lấy mẫu hồ sơ điểm thấp cho HR kiểm tra chéo.
- Chunk-and-merge cho CV rất dài; chế độ cohort khi đổi tiêu chí.
- Policy designer nâng cao, analytics theo cohort, retention tự động toàn hệ thống.

---

## 17. Điểm cần xác minh bên ngoài

| Nội dung | Trạng thái | Nguồn hoặc người cần đối chiếu |
|---|---|---|
| Consent, xử lý CV bởi nhà cung cấp AI bên ngoài (Gemini), chuyển dữ liệu xuyên biên giới, đánh giá tác động, thời hạn lưu CV bị từ chối và Talent Pool | `[CẦN XÁC MINH]` | Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026); Nghị định 356/2025/NĐ-CP (ban hành 31/12/2025, hiệu lực 01/01/2026): https://vanban.chinhphu.vn/?classid=1&docid=216387&pageid=27160 ; pháp chế hoặc DPO |
| Quan hệ hiệu lực giữa Nghị định 13/2023/NĐ-CP và Nghị định 356/2025/NĐ-CP | `[CẦN XÁC MINH]` | Điều khoản chuyển tiếp và bãi bỏ; pháp chế. Chưa cố định căn cứ nào là căn cứ chính cho đến khi đối chiếu xong |
| Mức xử phạt và hành vi vi phạm hành chính về an ninh mạng và bảo vệ dữ liệu cá nhân | `[CẦN XÁC MINH]` | Nghị định 330/2026/NĐ-CP (hiệu lực 19/08/2026): https://vanban.chinhphu.vn/?classid=1&docid=219266&orggroupid=2&pageid=27160 |
| Nghĩa vụ của hệ thống AI hỗ trợ tuyển dụng: phân loại rủi ro, minh bạch, giám sát của con người | `[CẦN XÁC MINH]` | Luật Trí tuệ nhân tạo số 134/2025/QH15 (hiệu lực 01/03/2026); văn bản hướng dẫn; tư vấn pháp lý |
| Kiểm tra lương trong offer so với lương tối thiểu vùng | `[CẦN XÁC MINH]` | Nghị định 293/2025/NĐ-CP (hiệu lực 01/01/2026) và văn bản thay thế sau đó. Khuyến nghị cảnh báo khi vượt dưới mức, lưu theo policy có ngày hiệu lực |
| Thời gian thử việc tối đa, tỷ lệ lương thử việc tối thiểu trong offer | `[CẦN XÁC MINH]` | Bộ luật Lao động hiện hành; luật sư lao động hoặc HR compliance. Không hardcode |
| Giới hạn khi hỏi thông tin cá nhân trong tuyển dụng (các loại dữ liệu không được thu thập) | `[CẦN XÁC MINH]` | Luật Bảo vệ dữ liệu cá nhân và văn bản hướng dẫn; pháp chế |

Không hardcode giá trị pháp lý trong source code. Lưu policy có `effective_from`, nguồn phê duyệt, người xác nhận, và test theo ngày hiệu lực.
