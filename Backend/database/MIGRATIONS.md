# Database migrations

HRM AI dùng Flyway làm nguồn sự thật cho thay đổi schema. Hibernate chỉ kiểm tra schema bằng `ddl-auto: validate`; không tự tạo hoặc sửa bảng.

## Trước khi chạy migration

Từ thư mục `Backend`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\backup-db.ps1
```

Backup được lưu ở `Backend/database/backups/`, có file SHA-256 đi kèm và bị loại khỏi Git vì có thể chứa dữ liệu cá nhân, lương và thông tin đăng nhập đã băm.

Kiểm tra baseline trên một database tạm (script tự tạo và xóa đúng database có tiền tố kiểm thử):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\verify-baseline.ps1
```

Kiểm tra migration state machine tuyển dụng bằng dữ liệu legacy mô phỏng:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\verify-recruitment-migration.ps1
```

Kiểm tra Chặng 2 (cấu hình, scoring version, backfill posting và tính bất biến):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\verify-configuration-migration.ps1
```

Kiểm tra Chặng 3 (approval policies, request/step backfill, resolver và DB guards):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\verify-approval-migration.ps1
```

Kiểm tra Chặng 4 (offer version, dispatch, seat ledger, outbox và concurrency guards):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\verify-offer-seat-migration.ps1
```

Script trên đồng thời kiểm tra `V9`–`V11`: các bảng vòng đời P0, hai khóa
idempotency của Employee, trigger append-only của `lifecycle_events`, pipeline AI CV
và các ràng buộc phỏng vấn/feedback/đàm phán.

## Cơ chế baseline

- Database cũ đã có bảng nhưng chưa có `flyway_schema_history`: sau khi backup, chạy lần đầu với biến môi trường `FLYWAY_BASELINE_ON_MIGRATE=true`. Flyway tạo baseline ở version `1`; không thực thi lại `V1__baseline_schema.sql`. Sau lần này bỏ biến môi trường hoặc đặt lại `false`.
- Database trống: Flyway thực thi `V1__baseline_schema.sql` để tạo schema nền.
- Migration nghiệp vụ tiếp theo bắt đầu từ `V2`.

Không sửa một migration đã được áp dụng. Mọi thay đổi mới phải tạo file version mới trong `src/main/resources/db/migration`.

## Quy tắc an toàn

1. Luôn backup trước migration.
2. Chạy migration trên database thử nghiệm trước.
3. Kiểm tra `flyway_schema_history` sau khi chạy.
4. Chỉ deploy code sử dụng enum/trường mới cùng migration tạo ra chúng.
5. `spring.flyway.clean-disabled=true`; không dùng Flyway Clean trên database có dữ liệu.

## Mapping Chặng 1

`V2__recruitment_state_machine.sql` thực hiện mapping bảo toàn ý nghĩa:

- Application: `NEW → PENDING_HR_CV_REVIEW`, `PENDING_CEO_EVALUATION → PENDING_INTERVIEW_2`, `OFFER_APPROVED → OFFER_INTERNALLY_APPROVED`.
- Requisition: `PENDING_CEO → PENDING_APPROVAL`, `POSTED → APPROVED` vì vòng đời posting được theo dõi độc lập.
- Posting: `CLOSED → EXPIRED` nếu đã quá hạn, ngược lại `CLOSED → PAUSED`. Không tự suy diễn thành `FILLED` khi chưa có seat ledger.

Migration đồng thời thêm optimistic-lock `version`, thông tin lần xem hồ sơ đầu tiên, unique constraint chống nộp trùng theo email/số điện thoại đã chuẩn hóa, và bảng audit append-only `application_transition_logs`.

`V3__baseline_legacy_recruitment_audit.sql` ghi một mốc `LEGACY_BASELINE` cho mỗi bản ghi tuyển dụng có trước Chặng 1. Mốc này chỉ xác nhận trạng thái tại thời điểm migration, không suy diễn người thực hiện hoặc lịch sử không tồn tại.

## Mapping Chặng 2

`V4__configuration_and_scoring_versions.sql` tạo nguồn cấu hình nghiệp vụ có ngày hiệu lực, scoring profile bất biến và các danh mục an toàn AI. Migration seed profile `CV_EVIDENCE` v1 ở trạng thái `ACTIVE`, tạo snapshot tiêu chí cho từng posting cũ, rồi backfill cặp `criteria_version_id` / `scoring_profile_version_id`.

Mọi `scoring_parameters` đã tạo là append-only ở tầng database. Muốn thay đổi tham số phải clone đầy đủ sang một `scoring_profiles` version mới ở `DRAFT`, xác nhận rồi mới kích hoạt. Bảng `ai_analyses` lưu cặp version trên từng lượt chạy để API không trộn kết quả khác cohort.

## Mapping Chặng 3

`V5__approval_engine.sql` tạo `approval_policies`, `approval_requests` và `approval_steps`. Ma trận người duyệt nằm trong `steps_template` có version; resolver chọn người cụ thể và loại người gửi khỏi danh sách ứng viên duyệt. Mỗi request giữ `entity_version`, chỉ có một request `OPEN` cho một thực thể và mọi bước chạy tuần tự.

Migration chỉ backfill các requisition đang `PENDING_APPROVAL`. Các requisition đã duyệt hoặc từ chối trước Chặng 3 không đủ dữ liệu bước duyệt đáng tin cậy nên tiếp tục dùng mốc `LEGACY_BASELINE`, không tạo lịch sử giả.

## Mapping Chặng 4

`V6__offers_and_seat_ledger.sql` tạo offer version bất biến, từng lần gửi offer, seat ledger, audit seat append-only, outbox và task vận hành. Mỗi requisition đang `APPROVED`/`FULFILLED` được backfill đúng `so_luong` seat `STANDARD/AVAILABLE`; migration không suy diễn offer hoặc lịch sử chấp nhận cho application cũ.

Các generated unique key bảo đảm một offer chỉ có một dispatch `ACTIVE`, và một application/offer chỉ chiếm một seat hoạt động. Trigger database chặn sửa điều khoản của offer đã duyệt và chặn sửa/xóa `seat_events`.

`V7` và `V8` chỉ căn chỉnh kiểu cột hash/UUID với mapping Hibernate sau khi V6 đã được áp dụng; chúng được giữ riêng để không viết lại checksum migration lịch sử.

## Mapping Chặng 5

`V9__employee_lifecycle_p0.sql` tạo Person `PROVISIONAL`, Employee `PRE_BOARDING`,
bản ghi việc làm/lương có ngày hiệu lực, checklist, inbox và timeline append-only.
`account_creation_requests` được nâng cấp để chuẩn bị tài khoản `DISABLED`; tài khoản chỉ
được kích hoạt sau sự kiện `JOINED`. Hai unique constraint `event_id` và
`conversion_key` bảo vệ độc lập trước retry và sự kiện nghiệp vụ trùng lặp.

## Mapping AI CV và phỏng vấn

`V10__ai_cv_pipeline_v1_2.sql` bổ sung tiêu chí có cấu trúc, consent của ứng viên,
metadata file CV an toàn và tách output thô của model khỏi kết quả do backend tính.
Posting đang tồn tại được tạo snapshot tiêu chí mới; snapshot cũ không bị sửa.

`V11__interviews_and_feedback.sql` tạo lịch phỏng vấn theo vòng/lần, hội đồng,
feedback riêng từng người và đàm phán sơ bộ ở vòng 2. Database chặn điểm ngoài
0–100, lịch kết thúc trước lúc bắt đầu và các mức lương không dương.
