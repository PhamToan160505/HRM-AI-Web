# VÒNG ĐỜI NHÂN VIÊN: LÁT CẮT P0.1

**Hệ thống:** HRM AI
**Phạm vi triển khai và demo:** chỉ một lát cắt mỏng nối từ tuyển dụng sang nhân viên. Toàn bộ phần còn lại (thử việc, tăng lương, thăng chức, điều chuyển, nghỉ phép dài hạn, nghỉ việc) là **roadmap**, được thiết kế sẵn dữ liệu nhưng không triển khai và không đưa vào demo.
**Tài liệu liên quan:** `LUONG_TUYEN_DUNG_HRM_AI_V2_2_PATCHED.md` (luồng tuyển dụng, seat ledger, bảng chuyển trạng thái, mục 0 — nguyên tắc không hardcode dùng chung cho cả hai tài liệu).

**Ký hiệu:** `P0` là lát cắt triển khai; `P1` và `P2` là roadmap. `[CẦN XÁC MINH]` là khẳng định pháp lý hoặc chính sách cần đối chiếu bên ngoài. `⚙` đánh dấu giá trị phải đọc từ cấu hình qua `ConfigurationService`/API (mục 0 của tài liệu tuyển dụng), không hardcode.

---

## 1. Lát cắt P0

```text
OFFER_ACCEPTED (từ tuyển dụng, kèm conversion_key)
   → tạo Person PROVISIONAL
   → tạo Employee idempotent ở PRE_BOARDING
   → gửi yêu cầu chuẩn bị tài khoản; nếu tạo trước ngày đi làm thì tài khoản ở DISABLED
   → HR xác nhận JOINED
   → phát lệnh tạo/kích hoạt tài khoản; lỗi cấp quyền không đảo ngược JOINED
   → seat JOINED
```

Nhánh phụ bắt buộc vì nó nhả suất tuyển: `PRE_BOARDING → ONBOARD_CANCELLED` (ứng viên không đến nhận việc).

Vì sao chọn lát cắt này: nó là điểm nối thật giữa hai hệ thống. Nó chứng minh suất tuyển, tài khoản và hồ sơ nhân viên luôn nhất quán, và không tạo tài khoản hay hồ sơ rác khi ứng viên không đến.

### 1.1. Nguyên tắc

1. **Một sự kiện chấp nhận offer tạo ra đúng một Employee.** Idempotent theo `conversion_key`, kể cả khi sự kiện bị phát lại hoặc consumer retry.
2. **Không auto-merge danh tính** dựa trên họ tên, email hay số điện thoại. Person mới luôn ở `PROVISIONAL`.
3. **Tài khoản không được kích hoạt trước sự kiện `JOINED`, nhưng việc chưa có tài khoản không được chặn HR ghi nhận sự thật nhân viên đã đi làm.** Admin duyệt yêu cầu trước ngày đi làm chỉ tạo tài khoản ở `DISABLED`; khi `JOINED`, hệ thống phát lệnh tạo nếu chưa có hoặc kích hoạt nếu đang `DISABLED`.
4. **Không có hai bản ghi lương cùng hiệu lực.** Chỉ tạo đúng một bản ghi lương ban đầu.
5. Payload sự kiện chỉ mang ID, không mang lương hay dữ liệu cá nhân nhạy cảm. Consumer đọc dữ liệu từ offer version đã chấp nhận.
6. Email, cấp phát tài khoản và tích hợp ngoài chạy qua outbox có retry, không chạy trong DB transaction.
7. Mọi thay đổi có audit log và `lifecycle_events` append-only.
8. Ngày dùng kiểu ngày (`LocalDate`), múi giờ `Asia/Ho_Chi_Minh`. Khoảng hiệu lực dùng dạng nửa mở `[effective_from, effective_to)`.

---

## 2. Hợp đồng cầu nối với tuyển dụng

Khi application chuyển `OFFER_ACCEPTED`, module tuyển dụng ghi outbox sự kiện theo **envelope chuẩn dùng chung cho mọi sự kiện trong toàn hệ thống** (định nghĩa gốc ở mục 9 của tài liệu tuyển dụng):

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

Các trường ngoài `payload` là metadata dùng chung. Mỗi `event_type` có schema `payload` riêng và được validate theo `schema_version`. Payload chỉ mang ID và dữ liệu điều phối tối thiểu, không mang lương hay dữ liệu cá nhân nhạy cảm (nguyên tắc 5 ở mục 1.1). Consumer đọc chi tiết từ offer version đã chấp nhận, không lấy từ payload sự kiện.

Consumer ở module vòng đời có bảng `inbox_events` với **hai lớp bảo vệ trùng lặp độc lập nhau**:
- **Unique constraint trên `event_id`**: chống xử lý trùng khi outbox phát lại cùng một sự kiện (at-least-once delivery), hoặc khi có nhiều consumer instance chạy song song đọc cùng một hàng đợi.
- **Unique constraint trên `conversion_key`** (ở bảng `employees`, mục 6): chống tạo trùng Employee về mặt nghiệp vụ, độc lập với việc sự kiện đến từ nguồn nào hay đến bao nhiêu lần.

Quy trình xử lý một sự kiện đến: (1) validate envelope và payload theo `event_type` + `schema_version`; (2) trong transaction, **claim event bằng lệnh insert-if-absent dựa trên unique `event_id`**, không dùng chuỗi “SELECT rồi INSERT” làm lớp bảo vệ chính; (3) chỉ consumer claim thành công mới xử lý nghiệp vụ (mục 3.1), với unique `conversion_key` làm lớp bảo vệ thứ hai. Consumer không claim được chờ transaction thắng commit rồi đọc `result_ref` và trả kết quả idempotent. Nếu ORM/database làm transaction bị rollback-only khi gặp unique conflict, phải rollback transaction đó và đọc kết quả trong transaction mới; không tiếp tục dùng transaction đã lỗi và không để cạnh tranh trở thành HTTP 500.

Consumer đọc thêm: chức danh, phòng ban, cấp bậc, quản lý dự kiến, ngày bắt đầu, lương, thử việc từ offer version đã chấp nhận, và snapshot thông tin ứng viên từ `applications`.

Chiều ngược lại, vòng đời nhân viên phát cho tuyển dụng hai sự kiện bằng cùng metadata envelope nhưng payload riêng:
- `EMPLOYEE_JOINED` có payload `employee_id`, `application_id`, `seat_id`, `join_date` → tuyển dụng chuyển seat `ACCEPTED → JOINED`.
- `ONBOARD_CANCELLED` có payload `employee_id`, `application_id`, `seat_id`, `reason_code` → tuyển dụng chuyển seat `ACCEPTED → AVAILABLE`, tạo `REOPEN_REVIEW_REQUIRED` (dòng R33 và S5 ở tài liệu tuyển dụng).

---

## 3. Xử lý từng bước

### 3.1. Tạo Person và Employee (một transaction)

Khi nhận sự kiện `OFFER_ACCEPTED`, consumer chạy trong **một database transaction**:

1. Validate metadata envelope và `payload` của `OFFER_ACCEPTED`; đọc `conversion_key`, `application_id`, `accepted_offer_id`, `requisition_id`, `seat_id` từ `payload`.
2. Claim `event_id` bằng insert-if-absent trong `inbox_events`. Nếu không claim được, chờ bản ghi thắng có `result_ref`, đọc kết quả đó trong transaction hợp lệ và dừng.
3. Kiểm tra `conversion_key` trong `employees`. Nếu đã tồn tại, cập nhật `inbox_events.result_ref` về Employee đã có và dừng. Khi insert Employee gặp unique conflict đồng thời trên `conversion_key`, rollback transaction tranh chấp, đọc Employee đã thắng trong transaction mới và hoàn tất/đối chiếu inbox một cách idempotent.
4. **Luôn tạo một `person` mới ở `PROVISIONAL`.** Ở P0, hệ thống **không bao giờ tự động liên kết** vào một `person` đã có sẵn, dù trùng email hay số điện thoại — việc liên kết (merge) là quyết định của con người, chuyển hoàn toàn sang P1 (mục 4). Nếu phát hiện email hoặc số điện thoại trùng với một `person` khác đã tồn tại, hệ thống **đồng thời** tạo một bản ghi `identity_reviews` ở trạng thái `OPEN` để HR xem xét sau — đây là cảnh báo không chặn luồng, transaction vẫn tiếp tục ngay ở bước 5, **không chờ HR xử lý** `identity_reviews` trước khi tạo Employee.
5. Tạo đúng một `employee` ở `PRE_BOARDING`, gắn `person_id`, `application_id`, `offer_id`, `conversion_key`, `start_date_planned`.
6. Tạo `employment_record` ở trạng thái `SCHEDULED`, `effective_from = ngày bắt đầu dự kiến`.
7. Tạo **đúng một** `compensation_record` ban đầu ở trạng thái `SCHEDULED`:
   - Nếu offer có thử việc: bản ghi lương thử việc (`salary_type = PROBATION`).
   - Nếu offer không có thử việc: bản ghi lương chính thức (`salary_type = OFFICIAL`).
   - Mức lương chính thức sau thử việc **không** được tạo ở bước này; nó vẫn nằm trong offer đã chấp nhận và sẽ được tạo khi tính năng thử việc được triển khai (roadmap).
8. Tạo `preboarding_checklist` với các mục cấu hình được (giấy tờ nhân sự, thông tin ngân hàng, thiết bị).
9. Tạo `account_creation_requests` ở chế độ `PREPARE_ONLY`, trạng thái `PENDING_ADMIN`.
10. Ghi `lifecycle_events` (`EMPLOYEE_CREATED`) và các sự kiện outbox (email chào mừng, thông báo HR, thông báo Admin), theo envelope chuẩn ở mục 2.

Nếu bất kỳ bước nào thất bại thì rollback toàn bộ. Các tác vụ ngoài hệ thống chỉ được thực hiện từ outbox sau khi transaction thành công.

### 3.2. Chuẩn bị tài khoản nhưng không chặn JOINED

- Trạng thái yêu cầu cấp phát: `PENDING_ADMIN → APPROVED → PROVISIONING → PROVISIONED`, hoặc `FAILED`/`CANCELLED`. Trước khi có account thật, giao diện hiển thị trạng thái dẫn xuất `NOT_CREATED` hoặc `PENDING_PROVISIONING`.
- Nếu Admin duyệt và cấp phát xong trước ngày đi làm, tài khoản được tạo ở `DISABLED`; đăng nhập bị từ chối.
- Trạng thái của tài khoản đã tồn tại: `DISABLED → ACTIVE → REVOKED`.
- `ACTIVE` chỉ đến từ sự kiện `JOINED` (mục 3.3). API kích hoạt trực tiếp trước `JOINED` bị từ chối. Ngoại lệ kích hoạt sớm có phê duyệt riêng là P1.
- Yêu cầu chưa được duyệt, account chưa được tạo hoặc cấp phát đang lỗi **không chặn HR xác nhận `JOINED`**; đây là trạng thái vận hành cần retry/cảnh báo, không thay đổi sự thật quan hệ lao động.

### 3.3. Xác nhận JOINED

HR bấm "Xác nhận đã đi làm". Điều kiện:
- Employee đang `PRE_BOARDING`.
- Các mục bắt buộc của checklist đã hoàn tất, hoặc HR ghi ngoại lệ kèm lý do.
- Ngày xác nhận không sớm hơn ngày bắt đầu dự kiến, trừ khi có ngoại lệ ghi lý do.

Trong một transaction:
1. `employee.status = EMPLOYED`, ghi `join_date`.
2. `employment_record` và `compensation_record` chuyển `SCHEDULED → CURRENT`.
3. Ghi `lifecycle_events` (`JOINED`) và ghi outbox: (a) sự kiện `EMPLOYEE_JOINED` cho tuyển dụng, (b) lệnh `ENSURE_ACCOUNT_ACTIVE` idempotent — tạo rồi kích hoạt nếu account chưa có, hoặc kích hoạt nếu đang `DISABLED`.

Sau transaction, outbox thực hiện:
- Tuyển dụng chuyển seat `ACCEPTED → JOINED`.
- Thực thi `ENSURE_ACCOUNT_ACTIVE`. Nếu account chưa có thì cấp phát rồi kích hoạt; nếu đang `DISABLED` thì kích hoạt. Nếu thất bại, Employee **vẫn `EMPLOYED`**, seat vẫn `JOINED`; trạng thái truy cập là `PENDING_PROVISIONING` hoặc `ACTIVATION_FAILED`, giao diện hiển thị "chờ cấp quyền", hệ thống retry và tạo cảnh báo. Không được hiển thị cấp quyền thành công khi chưa thành công.

Bấm xác nhận hai lần là idempotent: lần hai không tạo thay đổi thứ hai.

### 3.4. Hủy nhận việc (`ONBOARD_CANCELLED`)

HR ghi nhận ứng viên không đến nhận việc hoặc rút trước ngày đi làm. Điều kiện: employee đang `PRE_BOARDING`, có lý do. Trong một transaction:
1. `employee.status = ONBOARD_CANCELLED`.
2. `employment_record` và `compensation_record` chuyển `SCHEDULED → CANCELLED`.
3. `AccountCreationRequest` bị hủy; nếu tài khoản đã tạo ở `DISABLED` thì chuyển `REVOKED`.
4. Ghi `lifecycle_events` và outbox sự kiện `ONBOARD_CANCELLED` cho tuyển dụng.

Lịch sử application `OFFER_ACCEPTED` không bị sửa. Tuyển dụng nhả seat và tạo task mở lại theo bảng chuyển trạng thái của họ.

---

## 4. Định danh (Person)

Person là dữ liệu chủ cho quan hệ lao động. Application chỉ là snapshot phục vụ tuyển dụng và audit. Chỉ sao chép các trường tối thiểu cần thiết và ghi rõ nguồn, không đồng bộ hai chiều tùy tiện.

| Trạng thái Person | Ý nghĩa | Mức |
|---|---|---|
| `PROVISIONAL` | Tạo từ dữ liệu ứng tuyển, chưa có định danh mạnh được xác minh | P0 |
| `VERIFIED` | HR đã xác minh CCCD ở pre-boarding | P1 |
| `MERGED` | Đã hợp nhất vào Person khác (có mapping và lịch sử quyết định) | P2 |

**Quy tắc P0 (đơn giản, không chặn consumer):**
- Mỗi lần `OFFER_ACCEPTED` được xử lý, hệ thống **luôn tạo một `person` mới ở `PROVISIONAL`**, không có ngoại lệ. Đây là quy tắc duy nhất ở P0 — không có nhánh "tạo hoặc liên kết" nào khác.
- Nếu email hoặc số điện thoại của `person` mới trùng với một `person` đã tồn tại trong hệ thống (kể cả trường hợp người này từng là nhân viên cũ, tức "tái tuyển"), hệ thống tạo thêm một bản ghi `identity_reviews` (`candidate_person_id` = person cũ nghi trùng, `new_person_id` = person vừa tạo, `status = OPEN`) để HR xem xét sau. **Đây thuần túy là cảnh báo hiển thị trên giao diện, không có hành động liên kết hay hợp nhất nào đi kèm ở P0** — không có nút "Là người cũ" hay "Người mới" ở giai đoạn này.
- Vì bước tạo `identity_reviews` chỉ là ghi thêm một dòng cảnh báo, nó nằm trong cùng transaction ở mục 3.1 nhưng **không bao giờ khiến transaction đó thất bại hay phải chờ**, dù HR chưa xem cảnh báo.
- Số CCCD (thu ở pre-boarding, không phải ở bước ứng tuyển) lưu mã hóa, chỉ vai trò HR được phép xem, không ghi vào log ứng dụng.

**Chuyển sang P1 (không triển khai ở P0):**
- Toàn bộ việc **liên kết** (một `person` mới thực chất là cùng một người với một `person` cũ) chuyển hẳn sang P1: giao diện cho HR mở `identity_reviews`, chọn "Liên kết với người cũ" hoặc "Đóng cảnh báo (là người mới)", ghi audit quyết định.
- Việc **hợp nhất** (`merge`) hai `person` thành một, và **tách** (`unmerge`) khi hợp nhất sai, cũng là P1: không xóa bản ghi gốc mà tạo mapping và lịch sử quyết định.
- "Tái tuyển" theo đúng nghĩa (nối một nhân viên mới với person của một nhân viên cũ, đánh dấu `rehire`) chỉ có ý nghĩa đầy đủ sau khi có công cụ liên kết ở P1; ở P0, người tái tuyển đơn giản có một `person` mới hoàn toàn độc lập kèm một `identity_reviews` chờ xử lý, giống mọi trường hợp trùng khác.

---

## 5. Mô hình trạng thái trong phạm vi P0

**Employee (`employee_status`):**

```text
PRE_BOARDING ── xác nhận JOINED ──> EMPLOYED
      └───────── không đến nhận việc ──> ONBOARD_CANCELLED

EMPLOYED ── (roadmap) ──> TERMINATED
```

| Từ | Vai trò | Hành động | Đến | Điều kiện |
|---|---|---|---|---|
| (không có) | Hệ thống | Nhận `OFFER_ACCEPTED` | `PRE_BOARDING` | `conversion_key` chưa tồn tại |
| `PRE_BOARDING` | HR | Xác nhận đã đi làm | `EMPLOYED` | Mục 3.3 |
| `PRE_BOARDING` | HR | Ghi nhận không đến nhận việc | `ONBOARD_CANCELLED` | Lý do bắt buộc |

`EMPLOYED` và `TERMINATED` là trạng thái quan hệ lao động. Các trường `probation_status`, `onboarding_case_status`, `offboarding_case_status` và `leave_period` được **tách riêng, không nhồi vào một enum** (xem mục 9). Ở P0, `probation_status` chỉ được lưu giá trị ban đầu (`PLANNED` nếu offer có thử việc, `NOT_APPLICABLE` nếu không), chưa có luồng xử lý.

**Cấp phát truy cập:** yêu cầu `PENDING_ADMIN → APPROVED → PROVISIONING → PROVISIONED` hoặc `FAILED`/`CANCELLED`; tài khoản đã tồn tại `DISABLED → ACTIVE → REVOKED` (mục 3.2). Trạng thái cấp phát không làm thay đổi `employee_status`.

**Bản ghi có hiệu lực (`record_status`):** `SCHEDULED → CURRENT → ENDED`, hoặc `SCHEDULED → CANCELLED`.

---

## 6. Dữ liệu tối thiểu

| Bảng | Cột chính |
|---|---|
| `persons` | `id`, `status`, `full_name`, `email`, `phone`, `created_from_application_id` |
| `identity_reviews` | `id`, `new_person_id`, `candidate_person_id`, `matched_on` (email/phone), `status` (`OPEN`, `LINKED`, `DISMISSED` — chỉ `OPEN` được ghi ở P0, hai trạng thái còn lại thuộc thao tác P1), `decided_by`, `decided_at` |
| `employees` | `id`, `person_id`, `application_id` (**unique**), `offer_id`, `conversion_key` (**unique**), `employee_code`, `status`, `start_date_planned`, `join_date`, `probation_status`, `version` |
| `employment_records` | `id`, `employee_id`, `department_id`, `position_id`, `level`, `manager_id`, `effective_from`, `effective_to`, `record_status` |
| `compensation_records` | `id`, `employee_id`, `salary_type` (`PROBATION` hoặc `OFFICIAL`), `base_salary`, `allowances`, `effective_from`, `effective_to`, `record_status` |
| `account_creation_requests` | `id`, `employee_id`, `mode` (`PREPARE_ONLY` hoặc `ENSURE_ACTIVE`), `status` (`PENDING_ADMIN`, `APPROVED`, `PROVISIONING`, `PROVISIONED`, `FAILED`, `CANCELLED`), `approved_by`, `approved_at`, `last_error`, `retry_count` |
| `preboarding_checklists`, `preboarding_items` | Mục, người phụ trách, hạn, trạng thái, ngoại lệ kèm lý do |
| `lifecycle_events` | `id`, `subject_type`, `subject_id`, `event_type`, `event_date`, `actor_id`, `ref_type`, `ref_id`, `summary`. Không sửa, không xóa |
| `salary_access_logs` | `actor_id`, `subject_employee_id`, `purpose`, `request_id`, `occurred_at`, `result` |
| `outbox_events` | Dùng chung với module tuyển dụng |
| `inbox_events` | `event_id` (**unique**), `event_type`, `schema_version`, `processed_at`, `result_ref` — chống xử lý trùng khi nhận sự kiện từ tuyển dụng (mục 2) |

Ràng buộc:
- Với cùng một employee và cùng một dimension (vị trí, lương), hai khoảng hiệu lực không được chồng nhau. Kiểm tra ở tầng dịch vụ và có test.
- Chỉ bắt buộc liên tục không hở đối với dimension bắt buộc trong khoảng employee đang `EMPLOYED`.
- `lifecycle_events` dùng `subject_type` và `subject_id` để sự kiện trước khi có Person (ví dụ ứng tuyển) vẫn gắn đúng dòng thời gian sau khi được liên kết, mà không sửa sự kiện gốc.

---

## 7. Phân quyền dữ liệu lương (P0 mức tối thiểu)

- Ba mức: **tự xem** (nhân viên xem lương của chính mình), **HR phụ trách lương** (xem chi tiết), **CEO** (xem tổng hợp; chi tiết cần quyền riêng).
- **HR Recruiter không mặc nhiên đọc được lương nhân viên.** API trả trường lương đã mask nếu không có quyền.
- Admin kỹ thuật không có quyền nghiệp vụ mặc định.
- Mọi lần xem lương của người khác ghi `salary_access_logs`. Không ghi lương thô vào log ứng dụng, thông báo hay stack trace.
- Hệ thống capability đầy đủ (`SALARY_SELF_READ`, `SALARY_SCOPE_READ`, `SALARY_FULL_READ`, `SALARY_EDIT`, `SALARY_APPROVE`, `SALARY_EXPORT`) là P1.

---

## 8. Kiểm thử lát cắt (E1 đến E16)

| Mã | Ca | Kết quả kỳ vọng |
|---|---|---|
| E1 | Sự kiện `OFFER_ACCEPTED` bị phát lại hoặc consumer retry | Chỉ một Employee; không có bản ghi thứ hai (unique `conversion_key`) |
| E2 | Hai consumer xử lý đồng thời cùng một `conversion_key` | Một transaction thành công; bên còn lại nhận kết quả đã có |
| E3 | Ứng viên trùng email hoặc số điện thoại với một Person cũ | Vẫn tạo `person` mới ở `PROVISIONAL` và Employee ngay; đồng thời tạo `identity_reviews (OPEN)`; transaction không bị chặn hay chờ HR |
| E4 | Offer có thử việc; offer không thử việc | Đúng một `compensation_record` ban đầu; không bao giờ có hai bản ghi lương cùng hiệu lực |
| E5 | Admin duyệt yêu cầu tạo tài khoản trước ngày đi làm | Tài khoản `DISABLED`; đăng nhập bị từ chối |
| E6 | Gọi API kích hoạt tài khoản khi chưa `JOINED` | Bị từ chối |
| E7 | HR xác nhận `JOINED` khi thiếu mục bắt buộc của checklist | Bị chặn; có ngoại lệ ghi lý do thì cho qua |
| E8 | `JOINED` thành công và account đã có ở `DISABLED` | Employee `EMPLOYED`; các bản ghi `CURRENT`; seat `JOINED`; outbox kích hoạt account thành `ACTIVE` |
| E9 | `ONBOARD_CANCELLED` trước ngày đi làm | Seat `ACCEPTED → AVAILABLE`; tạo `REOPEN_REVIEW_REQUIRED`; tài khoản `REVOKED` hoặc yêu cầu bị hủy; bản ghi `SCHEDULED → CANCELLED`; lịch sử offer giữ nguyên |
| E10 | HR Recruiter đọc lương nhân viên mới | Bị mask hoặc chặn; người có quyền đọc thì có log |
| E11 | HR bấm xác nhận `JOINED` hai lần | Idempotent; một lần chuyển trạng thái |
| E12 | Tạo hai khoảng hiệu lực chồng nhau cho cùng dimension | Bị từ chối bởi ràng buộc dịch vụ |
| E13 | Sự kiện `OFFER_ACCEPTED` với `event_id` đã có trong `inbox_events` (outbox phát lại, hoặc hai consumer instance cùng nhận) | Bỏ qua, trả kết quả đã xử lý; không tạo Employee thứ hai |
| E14 | Hai lần `OFFER_ACCEPTED` với `event_id` khác nhau nhưng cùng `conversion_key` (lỗi ở tầng phát sự kiện) | Lớp bảo vệ `conversion_key` vẫn chặn được, độc lập với lớp bảo vệ `event_id` |
| E15 | HR xác nhận `JOINED` khi yêu cầu tài khoản chưa duyệt, account chưa tồn tại hoặc đang lỗi | `JOINED` vẫn thành công; Employee `EMPLOYED`, seat `JOINED`; tạo lệnh `ENSURE_ACCOUNT_ACTIVE`, hiển thị `PENDING_PROVISIONING`/`ACTIVATION_FAILED`, retry và cảnh báo |
| E16 | Hai consumer đồng thời claim một `event_id` | Insert-if-absent chỉ cho một bên xử lý; bên còn lại chờ kết quả đã commit rồi trả idempotent, không tạo Employee thứ hai và không trả HTTP 500 |

**Ca P1:** sự kiện ứng tuyển trước khi có Person vẫn hiển thị đúng trên dòng thời gian sau khi liên kết; HR mở `identity_reviews` và chọn liên kết hoặc đóng cảnh báo; merge và unmerge Person có audit.

---

## 9. Kịch bản demo lát cắt (khoảng 3 phút)

Nối tiếp bước 10 của kịch bản demo trong tài liệu tuyển dụng.

1. Ứng viên A vừa chấp nhận offer. HR mở màn hình "Nhân viên mới": Employee ở `PRE_BOARDING`, Person có huy hiệu `PROVISIONAL`; trạng thái cấp quyền là `NOT_CREATED`, `PENDING_PROVISIONING` hoặc tài khoản đã chuẩn bị ở `DISABLED`.
2. Nếu tài khoản đã được chuẩn bị, thử đăng nhập bằng tài khoản mới: **bị từ chối** vì `DISABLED`.
3. HR hoàn tất checklist pre-boarding.
4. Đến ngày bắt đầu, HR bấm "Xác nhận đã đi làm": Employee chuyển `EMPLOYED` và seat chuyển `JOINED` ngay. Lệnh cấp/kích hoạt quyền chạy qua outbox; khi hoàn tất, tài khoản `ACTIVE` và đăng nhập thành công. Nếu IAM tạm lỗi, màn hình vẫn ghi nhận nhân viên đã đi làm nhưng hiển thị "Chờ cấp quyền".
5. Mở trang requisition: suất tuyển hiển thị `JOINED`.
6. Mở timeline: từ ứng tuyển, duyệt, offer, chấp nhận đến `JOINED`, mọi bước có người thực hiện và thời điểm.

Nhánh minh họa nếu còn thời gian: một Employee khác không đến nhận việc → `ONBOARD_CANCELLED` → suất quay về `AVAILABLE` và xuất hiện task "xem xét mở lại".

---

## 10. Roadmap (không triển khai và không demo ở giai đoạn này)

Các phần dưới đây được giữ để định hướng và để mô hình dữ liệu hôm nay không phải làm lại. Không đưa vào phạm vi thi.

### 10.1. Nguyên tắc thiết kế đã chốt cho roadmap

- **Tách trạng thái, không dùng một enum cho mọi thứ:** `employee_status` (`PRE_BOARDING`, `EMPLOYED`, `TERMINATED`, `ONBOARD_CANCELLED`), `probation_status` (`NOT_APPLICABLE`, `PLANNED`, `IN_PROGRESS`, `PASSED`, `FAILED`, `CANCELLED`), `onboarding_case_status`, `offboarding_case_status`, và `leave_period`. Người nghỉ dài hạn hay đang trong thời gian báo trước vẫn là `EMPLOYED`.
- **Lịch sử có ngày hiệu lực, không ghi đè.** Khoảng nửa mở `[from, to)`; cấm overlap theo từng dimension; phân biệt thay đổi nghiệp vụ với sửa sai (correction có `supersedes_id`, lý do, người ghi).
- **Yêu cầu thay đổi dùng chung engine duyệt với tuyển dụng.** Chỉ có một trạng thái chờ duyệt `PENDING_APPROVAL`; bước hiện tại nằm ở `approval_steps`. Sau `APPROVED` là `SCHEDULED`, đến ngày hiệu lực job mới áp dụng (`APPLYING → APPLIED`), idempotent theo `change_request_id` và version.
- **`TERMINATED` không bị chặn bởi checklist offboarding.** Employee chuyển `TERMINATED` theo ngày hiệu lực; tài sản chưa trả hay chứng từ chưa xong ở trạng thái `OVERDUE` và tiếp tục xử lý. Thu hồi quyền truy cập theo lịch, nếu lỗi thì tạo cảnh báo bảo mật, không giả vờ đã thu hồi.
- **Quá hạn đánh giá thử việc chỉ leo thang**, không tự đạt hoặc tự không đạt.
- **Bảng lương đã chốt dùng snapshot.** Thay đổi hồi tố tạo dòng điều chỉnh ở kỳ sau.
- **Quyền lương theo capability có phạm vi**, không theo vai trò chung.

### 10.2. Các hạng mục theo pha

| Pha | Hạng mục |
|---|---|
| P1 | Xác minh danh tính (CCCD) và giao diện merge/unmerge Person; nhắc hạn hợp đồng; nghỉ dài hạn (`leave_period`); audit đọc lương đầy đủ và capability; một luồng thử việc và đánh giá thử việc; một loại yêu cầu thay đổi (ví dụ điều chỉnh lương) |
| P2 | Thăng chức, điều chuyển, chuyển loại hợp đồng, đánh giá định kỳ làm căn cứ xét lương, điều chỉnh bảng lương hồi tố, offboarding đầy đủ (phỏng vấn nghỉ việc, quyết toán, thu hồi quyền theo lịch), tích hợp IAM/thiết bị/bảo hiểm thật, retention tự động sau `TERMINATED` |

### 10.3. Ràng buộc pháp lý cần xác minh trước khi triển khai roadmap

Không hardcode. Lưu thành policy có `effective_from`, nguồn phê duyệt và người xác nhận.

| Nội dung | Trạng thái | Nguồn hoặc người đối chiếu |
|---|---|---|
| Thời gian thử việc tối đa, số lần thử việc, tỷ lệ lương thử việc tối thiểu, trường hợp không thử việc | `[CẦN XÁC MINH]` | Bộ luật Lao động hiện hành; luật sư lao động hoặc HR compliance |
| Loại hợp đồng, thời hạn tối đa, giới hạn số lần ký liên tiếp, thời gian báo trước khi nghỉ | `[CẦN XÁC MINH]` | Bộ luật Lao động hiện hành; luật sư lao động |
| Lương tối thiểu vùng (chặn lương cơ bản dưới mức) | `[CẦN XÁC MINH]` | Nghị định 293/2025/NĐ-CP (hiệu lực 01/01/2026) và văn bản thay thế sau đó |
| Nghỉ thai sản và các đợt nghỉ dài hạn: ảnh hưởng đến thâm niên, lương, thăng chức; tránh đối xử bất lợi | `[CẦN XÁC MINH]` | Pháp luật lao động và bảo hiểm xã hội; pháp chế |
| Thời điểm kích hoạt và thu hồi quyền truy cập khi nghỉ việc hoặc bị chấm dứt | `[CẦN XÁC MINH]` | Pháp chế, HR, an toàn thông tin, quy chế nội bộ |
| Lưu trữ và xóa hồ sơ sau `TERMINATED`; dữ liệu phải giữ cho thuế, lương, bảo hiểm | `[CẦN XÁC MINH]` | Pháp chế, kế toán, bảo hiểm xã hội, chính sách retention |
| Xử lý dữ liệu cá nhân của nhân viên (CCCD, lương, tài khoản ngân hàng) | `[CẦN XÁC MINH]` | Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 (hiệu lực 01/01/2026); Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026); quan hệ hiệu lực với Nghị định 13/2023/NĐ-CP cần pháp chế đối chiếu |

---

## 11. Câu chuyện khi trình bày

Tuyển dụng và AI là sản phẩm chính đã triển khai sâu. Vòng đời nhân viên là phần mở rộng có **điểm nối thật**: dữ liệu đã được thiết kế đúng (một Person, một Employee cho mỗi lần chấp nhận offer, lịch sử có ngày hiệu lực, tài khoản chỉ được kích hoạt khi nhận việc, suất tuyển luôn khớp với thực tế), và một lát cắt khả thi được demo trọn vẹn thay vì trải rộng nhiều tính năng dang dở.
