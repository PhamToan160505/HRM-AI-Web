---
name: -hrm-react-frontend-patterns
description: "Chuẩn kiến trúc React (MVC phía client) cho  HRM. LUÔN dùng skill này khi viết/sửa page, hook, service, hoặc component — kể cả khi user chỉ nói 'thêm màn hình X'. Có phần bắt buộc tách component cho màn hình hồ sơ ứng viên để tránh dồn cục."
risk: safe
source: project-specific
date_added: "2026-08-17"
---
# React Frontend Patterns —  HRM

React thuần (Vite), KHÔNG dùng Next.js.

## 1. Kiến trúc MVC phía client

```
frontend/src/
├── pages/
│   ├── director/           # Dashboard tổng, báo cáo toàn công ty
│   ├── manager/
│   │   └── recruitment/     # TOÀN BỘ page của module Tuyển dụng, xem mục 1.1 — không đặt
│   │                          # rải rác các page tuyển dụng ở nơi khác trong manager/
│   ├── employee/            # Nhân viên: chấm công, xem lương của mình
│   └── public/               # KHÔNG qua auth — ApplyPage (ứng viên)
├── components/
│   ├── common/                # Button, Input, Select, DataTable, Modal, Card, Badge,
│   │                            # ConfirmModal, NotificationBell, NotificationPanel, NotificationModal
│   ├── recruitment/           # xem chi tiết bắt buộc ở mục 2 — chia theo sub-folder, KHÔNG để
│   │                            # phẳng 1 tầng khi số lượng component vượt quá ~6 file
│   ├── attendance/
│   └── payroll/
├── hooks/                     # "Controller" — điều phối logic + gọi service
├── services/                  # "Model" — MỌI request qua đây
│   ├── api.js
│   ├── socket.js
│   └── <resource>.service.js
├── context/
│   ├── AuthContext.jsx
│   └── NotificationContext.jsx
└── utils/
```

**Luật cứng:** Component KHÔNG gọi `fetch`/`axios` trực tiếp. Luồng: `component` → `hook` → `service` → `api.js`.

### 1.1. Cấu trúc page module Tuyển dụng — BẮT BUỘC, mỗi tab = 1 page riêng

`RecruitmentSubTabs` (Tổng quan/Đánh giá/Chiến dịch tuyển dụng/Quản lý/Phê duyệt/Báo cáo/Thiết lập — xem `SKILL_frontend-design.md` mục 1.1) là điều hướng **cấp module**, không phải chỉ riêng cho màn hình chi tiết hồ sơ. Bắt buộc tách route/page tương ứng, không dồn logic của nhiều tab vào 1 file:

```
pages/manager/recruitment/
├── RecruitmentLayout.jsx        # render RecruitmentSubTabs + <Outlet/>, dùng chung cho mọi tab
├── OverviewPage.jsx             # tab "Tổng quan"
├── EvaluationPage.jsx           # tab "Đánh giá"
├── CampaignsPage.jsx            # tab "Chiến dịch tuyển dụng" — danh sách + tạo tin tuyển dụng
├── ApplicationListPage.jsx      # tab "Quản lý" — danh sách hồ sơ (DataTable), KHÔNG chứa chi
│                                  tiết hồ sơ trực tiếp, chỉ điều hướng sang ApplicationDetailPage
├── ApplicationDetailPage.jsx    # xem chi tiết cấu trúc ở mục 2 — mở từ ApplicationListPage
├── ApprovalPage.jsx             # tab "Phê duyệt"
├── ReportsPage.jsx              # tab "Báo cáo"
└── SettingsPage.jsx             # tab "Thiết lập"
```

Route mount qua `RecruitmentLayout` (VD dùng React Router `<Route element={<RecruitmentLayout/>}>` bọc các route con) — mỗi page trên chỉ lo đúng 1 tab, không viết chung 1 file `RecruitmentPage.jsx` khổng lồ rồi `if (activeTab === ...)` render nội dung bên trong.

## 2. Tách component màn hình hồ sơ ứng viên — BẮT BUỘC, đây là điểm hay bị dồn cục nhất

Đây là màn hình phức tạp nhất hệ thống (theo `SKILL_frontend-design.md` mục 1). **Cấm viết thành 1 file `ApplicationDetailPage.jsx` khổng lồ chứa hết mọi thứ.** Bắt buộc tách như sau, chia theo sub-folder (không để phẳng khi >6 file trong `components/recruitment/`):

```
pages/manager/recruitment/ApplicationDetailPage.jsx   # CHỈ ghép layout 2 cột + gọi hook, không
│                                                         chứa logic hiển thị chi tiết từng khối
components/recruitment/applicationDetail/
├── RecruitmentSubTabs.jsx                   # đặt ở đây vì dùng chung mọi page mục 1.1, KHÔNG
│                                               phải chỉ riêng detail page — nhưng import dùng
│                                               chung từ đây, không copy lại ở page khác
├── ApplicationAttachmentsBlock.jsx          # khối "File đính kèm" (File CV/Ảnh CCCD/Link CV)
├── ApplicationPersonalInfoForm.jsx          # khối "Thông tin cá nhân" — xem RÀNG BUỘC bắt buộc
│                                               ở mục 2.1 bên dưới trước khi code
├── CandidateProfileCard.jsx                 # thẻ hồ sơ AI cột phải — CHỈ layout khung + avatar
│                                              + tên + liên hệ nhanh, KHÔNG chứa nội dung học vấn/
│                                              kinh nghiệm trực tiếp (gọi 2 component con dưới đây)
├── CandidateEducationSection.jsx            # khối "Học vấn" — con của CandidateProfileCard
├── CandidateExperienceList.jsx              # khối "Kinh nghiệm làm việc" (bullet list) — con
├── CandidateCareerObjective.jsx             # khối "Mục tiêu nghề nghiệp" — con
├── AIFitScoreCard.jsx                       # khối điểm Semantic Fit Score + nút xem lý do
├── AIFraudFlagCard.jsx                      # khối cờ gian lận (nếu có) + lý do
├── AIDecisionReasonModal.jsx                # modal hiện chi tiết lý do từ ai_decision_logs
│                                              (dùng chung cho cả Fit Score và Fraud Flag)
└── AIInterviewQuestionsList.jsx             # danh sách câu hỏi phỏng vấn gợi ý

components/recruitment/list/
├── ApplicationTableColumns.js               # định nghĩa cột cho DataTable ở ApplicationListPage,
│                                               tách khỏi page để page không phình vì cấu hình cột
└── ApplicationFilters.jsx                   # bộ lọc trạng thái/vị trí ứng tuyển trên danh sách

components/recruitment/jobPosting/
├── JobPostingForm.jsx                       # form tạo/sửa tin tuyển dụng (dùng ở CampaignsPage)
└── JobPostingLinkBox.jsx                    # khối hiện link công khai đã sinh + nút copy
```

### 2.1. Ràng buộc bắt buộc cho `ApplicationPersonalInfoForm.jsx` — component dùng chung nội bộ + public

Component này được dùng lại ở cả `ApplicationDetailPage.jsx` (nội bộ, Trưởng phòng xem/sửa) lẫn `ApplyStepConfirmInfo.jsx` (public, ứng viên tự điền) — đây là điểm dễ rò rỉ quyền nếu không quy định rõ:

- **Component này CHỈ được render form nhập liệu + hiển thị cảnh báo confidence thấp** (theo `SKILL_frontend-design.md`, field confidence thấp có viền/nền cảnh báo). **TUYỆT ĐỐI không được chứa nút Duyệt/Từ chối, không gọi API quyết định nghiệp vụ** — các hành động đó thuộc về `ApplicationDetailPage.jsx` (nội bộ) hoặc `ApplyStepConfirmInfo.jsx` (public), gọi component này như 1 "form thuần túy" (presentational), nhận `mode: 'internal' | 'public'` qua prop để tự ẩn/hiện phần không phù hợp ngữ cảnh (VD: `internal` mới hiện thêm ghi chú nội bộ nếu có).
- Nếu agent viết bất kỳ logic quyết định/duyệt nào bên trong file này, đó là lỗi kiến trúc nghiêm trọng — dừng lại và báo cáo, không tự "tiện thể" thêm vào.

## 3. Trang Public Apply — tách riêng khỏi cấu trúc nội bộ

```
pages/public/ApplyPage.jsx                  # không dùng layout sidebar/header nội bộ
components/recruitment/public/
├── ApplyStepUpload.jsx                     # bước 1: upload CV
├── ApplyStepConfirmInfo.jsx                # bước 2: xác nhận thông tin OCR — TÁI DÙNG
│                                              components/recruitment/applicationDetail/
│                                              ApplicationPersonalInfoForm.jsx với prop
│                                              mode="public" (xem ràng buộc mục 2.1), không
│                                              viết lại form từ đầu
└── ApplySuccessScreen.jsx                  # bước 3: xác nhận đã nộp
```

`ApplyPage.jsx` không dùng `AuthContext` (ứng viên không đăng nhập) — gọi thẳng `services/publicApply.service.js` (endpoint riêng, không gắn JWT interceptor).

## 4. Gọi API & JWT

`services/api.js` — 1 axios instance, interceptor tự gắn token (bỏ qua với `publicApply.service.js`):

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

`AuthContext` lưu `role` (1 trong 3: `nhan_vien`/`truong_phong`/`giam_doc`) + `department_id`, dùng ẩn/hiện menu (`<RequireRole roles={['truong_phong','giam_doc']}>`) — **chỉ là UX**, backend Spring luôn tự kiểm tra độc lập qua `@PreAuthorize`, không tin frontend.

## 5. Thông báo real-time — WebSocket (STOMP), KHÔNG dùng socket.io-client

Backend là Spring Boot dùng STOMP over WebSocket, không phải Socket.io — frontend phải dùng `@stomp/stompjs` + `sockjs-client`, không cài `socket.io-client`.

`services/socket.js`:

```js
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient;
export function connectSocket(token, userId, onNotification) {
  stompClient = new Client({
    webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL),
    connectHeaders: { Authorization: `Bearer ${token}` },
    onConnect: () => {
      stompClient.subscribe(`/user/${userId}/queue/notifications`, (message) => {
        onNotification(JSON.parse(message.body));
      });
    },
  });
  stompClient.activate();
  return stompClient;
}
export function disconnectSocket() {
  stompClient?.deactivate();
}
```

`context/NotificationContext.jsx` — load danh sách ban đầu từ API khi vào trang, sau đó nhận cập nhật qua `connectSocket`. `muc_do: 'khan'` → `NotificationModal` chặn màn hình (VD: cờ gian lận CV phát hiện). `muc_do: 'binh_thuong'` → chỉ cập nhật số đếm ở `NotificationBell`.

## 6. State management

- Local UI: `useState`.
- Dùng chung nhiều nơi: Context (`AuthContext`, `NotificationContext`).
- Data từ server: custom hook tự quản `loading/error/data`, mỗi page/module nghiệp vụ có hook riêng, KHÔNG dùng chung 1 hook cho nhiều page khác mục đích:
  - `useApplicationDetail(applicationId)` — dữ liệu hồ sơ + AI scores gộp 1 lần cho `ApplicationDetailPage`
  - `useApplicationList(filters)` — danh sách hồ sơ cho `ApplicationListPage`
  - `useJobPostings()` — danh sách/tạo tin tuyển dụng cho `CampaignsPage`
  - `useAttendanceToday()`, `usePayroll(period)` — tương tự cho module chấm công/lương

## 7. Bảng dữ liệu nghiệp vụ

Danh sách ứng viên/chấm công/phiếu lương đều dùng chung `components/common/DataTable.jsx` (sort/filter/phân trang). Không tự viết bảng riêng từng trang.

## 8. Quy tắc code

- Component: `PascalCase.jsx`. Hook: `useXxx.js`. Service: `xxx.service.js`.
- Không đặt logic gọi API/business logic phức tạp trực tiếp trong JSX — đẩy vào hook.
- 1 bộ icon duy nhất, import nhất quán.
- Mỗi component trong `components/recruitment/` (mục 2) chỉ nhận props cần thiết, không tự fetch riêng lẻ trừ khi thực sự độc lập (VD: `AIDecisionReasonModal` có thể tự fetch chi tiết lý do khi mở, vì đây là lazy-load hợp lý).

## 9. Checklist tự kiểm tra sau khi code xong 1 page/feature

- [ ] Component không gọi axios/fetch trực tiếp?
- [ ] Đủ loading/error/data (+ rỗng)?
- [ ] Dùng đúng component chung (`common/`)?
- [ ] Màn hình hồ sơ ứng viên có tách đúng theo mục 2, không dồn vào 1 file?
- [ ] Mỗi tab của module Tuyển dụng (mục 1.1) có page riêng, không gộp chung 1 file `if (activeTab)`?
- [ ] `ApplicationPersonalInfoForm.jsx` không chứa nút Duyệt/Từ chối hay logic quyết định nghiệp vụ (mục 2.1)?
- [ ] Trang public apply không dùng `AuthContext`/sidebar nội bộ?
- [ ] Danh sách nghiệp vụ dùng `DataTable`?
- [ ] Màu lấy từ CSS variable xanh dương-trắng, không hardcode mã màu mới, không còn sót màu vàng cũ?
- [ ] Nút hành động quan trọng có chữ?
- [ ] Thông báo đi qua `NotificationContext`, không tự viết toast riên

---
name: -hrm-react-frontend-patterns
description: "Chuẩn kiến trúc React (MVC phía client) cho  HRM. LUÔN dùng skill này khi viết/sửa page, hook, service, hoặc component — kể cả khi user chỉ nói 'thêm màn hình X'. Có phần bắt buộc tách component cho màn hình hồ sơ ứng viên để tránh dồn cục."
risk: safe
source: project-specific
date_added: "2026-08-17"
---
# React Frontend Patterns —  HRM

React thuần (Vite), KHÔNG dùng Next.js.

## 1. Kiến trúc MVC phía client

```
frontend/src/
├── pages/
│   ├── director/           # Dashboard tổng, báo cáo toàn công ty
│   ├── manager/             # Trưởng phòng: tuyển dụng, duyệt chấm công/lương phòng mình
│   ├── employee/            # Nhân viên: chấm công, xem lương của mình
│   └── public/               # KHÔNG qua auth — ApplyPage (ứng viên)
├── components/
│   ├── common/                # Button, Input, Select, DataTable, Modal, Card, Badge,
│   │                            # ConfirmModal, NotificationBell, NotificationPanel, NotificationModal
│   ├── recruitment/           # xem chi tiết bắt buộc ở mục 2 — KHÔNG dồn tất cả vào 1 file
│   ├── attendance/
│   └── payroll/
├── hooks/                     # "Controller" — điều phối logic + gọi service
├── services/                  # "Model" — MỌI request qua đây
│   ├── api.js
│   ├── socket.js
│   └── <resource>.service.js
├── context/
│   ├── AuthContext.jsx
│   └── NotificationContext.jsx
└── utils/
```

**Luật cứng:** Component KHÔNG gọi `fetch`/`axios` trực tiếp. Luồng: `component` → `hook` → `service` → `api.js`.

## 2. Tách component màn hình hồ sơ ứng viên — BẮT BUỘC, đây là điểm hay bị dồn cục nhất

Đây là màn hình phức tạp nhất hệ thống (theo `SKILL_frontend-design.md` mục 1). **Cấm viết thành 1 file `ApplicationDetailPage.jsx` khổng lồ chứa hết mọi thứ.** Bắt buộc tách như sau:

```
pages/manager/ApplicationDetailPage.jsx     # CHỈ ghép layout 2 cột + gọi hook, không chứa
│                                              logic hiển thị chi tiết từng khối
components/recruitment/
├── RecruitmentSubTabs.jsx                   # thanh tab con (Tổng quan/Đánh giá/...)
├── ApplicationAttachmentsBlock.jsx          # khối "File đính kèm" (File CV/Ảnh CCCD/Link CV)
├── ApplicationPersonalInfoForm.jsx          # khối "Thông tin cá nhân" (editable form)
├── CandidateProfileCard.jsx                 # thẻ hồ sơ AI cột phải — CHỈ layout khung + avatar
│                                              + tên + liên hệ nhanh, KHÔNG chứa nội dung học vấn/
│                                              kinh nghiệm trực tiếp (gọi 2 component con dưới đây)
├── CandidateEducationSection.jsx            # khối "Học vấn" — con của CandidateProfileCard
├── CandidateExperienceList.jsx              # khối "Kinh nghiệm làm việc" (bullet list) — con
├── CandidateCareerObjective.jsx             # khối "Mục tiêu nghề nghiệp" — con
├── AIFitScoreCard.jsx                       # khối điểm Semantic Fit Score + nút xem lý do
├── AIFraudFlagCard.jsx                      # khối cờ gian lận (nếu có) + lý do
├── AIDecisionReasonModal.jsx                # modal hiện chi tiết lý do từ ai_decision_logs
│                                              (dùng chung cho cả Fit Score và Fraud Flag)
└── AIInterviewQuestionsList.jsx             # danh sách câu hỏi phỏng vấn gợi ý
```

**Nguyên tắc chia:** mỗi khối trong ảnh tham chiếu = 1 component riêng, có thể test/sửa độc lập. `ApplicationDetailPage.jsx` chỉ đóng vai trò lắp ráp (composition), không chứa logic nghiệp vụ hay style chi tiết của từng khối. Nếu sau này cần sửa "khối kinh nghiệm làm việc", chỉ cần vào đúng `CandidateExperienceList.jsx`, không phải dò trong 1 file dài hàng trăm dòng.

Hook tương ứng: `hooks/useApplicationDetail.js` (gọi service lấy dữ liệu hồ sơ + AI scores gộp 1 lần, trả về object có cấu trúc rõ theo từng khối để các component con nhận props gọn, không mỗi component tự fetch riêng).

## 3. Trang Public Apply — tách riêng khỏi cấu trúc nội bộ

```
pages/public/ApplyPage.jsx                  # không dùng layout sidebar/header nội bộ
components/recruitment/public/
├── ApplyStepUpload.jsx                     # bước 1: upload CV
├── ApplyStepConfirmInfo.jsx                # bước 2: xác nhận thông tin OCR — TÁI DÙNG
│                                              ApplicationPersonalInfoForm.jsx +
│                                              ApplicationAttachmentsBlock.jsx nếu field trùng,
│                                              không viết lại form từ đầu
└── ApplySuccessScreen.jsx                  # bước 3: xác nhận đã nộp
```

`ApplyPage.jsx` không dùng `AuthContext` (ứng viên không đăng nhập) — gọi thẳng `services/publicApply.service.js` (endpoint riêng, không gắn JWT interceptor).

## 4. Gọi API & JWT

`services/api.js` — 1 axios instance, interceptor tự gắn token (bỏ qua với `publicApply.service.js`):

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

`AuthContext` lưu `role` (1 trong 3: `nhan_vien`/`truong_phong`/`giam_doc`) + `department_id`, dùng ẩn/hiện menu (`<RequireRole roles={['truong_phong','giam_doc']}>`) — **chỉ là UX**, backend Spring luôn tự kiểm tra độc lập qua `@PreAuthorize`, không tin frontend.

## 5. Thông báo real-time — WebSocket (STOMP), KHÔNG dùng socket.io-client

Backend là Spring Boot dùng STOMP over WebSocket, không phải Socket.io — frontend phải dùng `@stomp/stompjs` + `sockjs-client`, không cài `socket.io-client`.

`services/socket.js`:

```js
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient;
export function connectSocket(token, userId, onNotification) {
  stompClient = new Client({
    webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL),
    connectHeaders: { Authorization: `Bearer ${token}` },
    onConnect: () => {
      stompClient.subscribe(`/user/${userId}/queue/notifications`, (message) => {
        onNotification(JSON.parse(message.body));
      });
    },
  });
  stompClient.activate();
  return stompClient;
}
export function disconnectSocket() {
  stompClient?.deactivate();
}
```

`context/NotificationContext.jsx` — load danh sách ban đầu từ API khi vào trang, sau đó nhận cập nhật qua `connectSocket`. `muc_do: 'khan'` → `NotificationModal` chặn màn hình (VD: cờ gian lận CV phát hiện). `muc_do: 'binh_thuong'` → chỉ cập nhật số đếm ở `NotificationBell`.

## 6. State management

- Local UI: `useState`.
- Dùng chung nhiều nơi: Context (`AuthContext`, `NotificationContext`).
- Data từ server: custom hook tự quản `loading/error/data`, VD `useApplicationDetail(applicationId)`, `useAttendanceToday()`, `usePayroll(period)`.

## 7. Bảng dữ liệu nghiệp vụ

Danh sách ứng viên/chấm công/phiếu lương đều dùng chung `components/common/DataTable.jsx` (sort/filter/phân trang). Không tự viết bảng riêng từng trang.

## 8. Quy tắc code

- Component: `PascalCase.jsx`. Hook: `useXxx.js`. Service: `xxx.service.js`.
- Không đặt logic gọi API/business logic phức tạp trực tiếp trong JSX — đẩy vào hook.
- 1 bộ icon duy nhất, import nhất quán.
- Mỗi component trong `components/recruitment/` (mục 2) chỉ nhận props cần thiết, không tự fetch riêng lẻ trừ khi thực sự độc lập (VD: `AIDecisionReasonModal` có thể tự fetch chi tiết lý do khi mở, vì đây là lazy-load hợp lý).

## 9. Checklist tự kiểm tra sau khi code xong 1 page/feature

- [ ] Component không gọi axios/fetch trực tiếp?
- [ ] Đủ loading/error/data (+ rỗng)?
- [ ] Dùng đúng component chung (`common/`)?
- [ ] Màn hình hồ sơ ứng viên có tách đúng theo mục 2, không dồn vào 1 file?
- [ ] Trang public apply không dùng `AuthContext`/sidebar nội bộ?
- [ ] Danh sách nghiệp vụ dùng `DataTable`?
- [ ] Màu lấy từ CSS variable xanh dương-trắng, không hardcode mã màu mới, không còn sót màu vàng cũ?
- [ ] Nút hành động quan trọng có chữ?
- [ ] Thông báo đi qua `NotificationContext`, không tự viết toast riêng?
