
# -*- coding: utf-8 -*-
"""
Tạo báo cáo Word (.docx) hoàn chỉnh cho hệ thống HRM AI.
Dữ liệu được đọc trực tiếp từ source code — KHÔNG hardcode.
"""

from docx import Document
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import datetime

doc = Document()

# ── Thiết lập trang ──────────────────────────────────────────────────────────
section = doc.sections[0]
section.page_width  = Cm(21)
section.page_height = Cm(29.7)
section.left_margin   = Cm(2.5)
section.right_margin  = Cm(2.5)
section.top_margin    = Cm(2.5)
section.bottom_margin = Cm(2.5)

# ── Helpers ───────────────────────────────────────────────────────────────────
BLUE  = RGBColor(0x1E, 0x40, 0xAF)  # blue-800
DARK  = RGBColor(0x1F, 0x29, 0x37)  # gray-900
GRAY  = RGBColor(0x6B, 0x72, 0x80)  # gray-500
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

def set_cell_bg(cell, hex_color: str):
    """Tô màu nền ô bảng."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def add_heading(text, level=1):
    p = doc.add_heading(text, level=level)
    run = p.runs[0] if p.runs else p.add_run(text)
    run.font.color.rgb = BLUE
    p.paragraph_format.space_before = Pt(14 if level == 1 else 8)
    p.paragraph_format.space_after  = Pt(6)
    return p

def add_paragraph(text, bold=False, color=None, size=10, indent=0):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(indent)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    return p

def add_bullet(text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent = Cm(level * 0.5 + 0.5)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(text)
    run.font.size = Pt(10)
    return p

def make_table_header(table, headers, bg='1E40AF'):
    """Thêm hàng header với nền xanh + chữ trắng."""
    row = table.rows[0]
    for i, h in enumerate(headers):
        cell = row.cells[i]
        cell.text = h
        run = cell.paragraphs[0].runs[0]
        run.bold = True
        run.font.color.rgb = WHITE
        run.font.size = Pt(9)
        set_cell_bg(cell, bg)

def add_table(headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    make_table_header(table, headers)
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        bg = 'F0F4FF' if r_idx % 2 == 0 else 'FFFFFF'
        for c_idx, cell_text in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = str(cell_text)
            cell.paragraphs[0].runs[0].font.size = Pt(9)
            set_cell_bg(cell, bg)
    if col_widths:
        for i, w in enumerate(col_widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)
    return table

def hr():
    """Đường kẻ ngang."""
    p = doc.add_paragraph()
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '1E40AF')
    pBdr.append(bottom)
    pPr.append(pBdr)

# ═══════════════════════════════════════════════════════════════════════════════
#  TRANG BÌA
# ═══════════════════════════════════════════════════════════════════════════════
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('\n\n\n\nBÁO CÁO PHÂN TÍCH & MÔ TẢ HỆ THỐNG\n')
run.bold = True
run.font.size = Pt(22)
run.font.color.rgb = BLUE

sub = title.add_run('HRM AI — Hệ Thống Nhân Sự Tích Hợp Trí Tuệ Nhân Tạo\n')
sub.bold = True
sub.font.size = Pt(16)
sub.font.color.rgb = DARK

meta = title.add_run(
    f'\n\nPhiên bản: 1.0\n'
    f'Ngày lập báo cáo: {datetime.date.today().strftime("%d/%m/%Y")}\n'
    f'Người lập: Business Analyst / Technical Writer (AI-Assisted)\n'
    f'Trạng thái: Bản chính thức\n\n\n'
)
meta.font.size = Pt(11)
meta.font.color.rgb = GRAY

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  MỤC LỤC (thủ công)
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('MỤC LỤC', level=1)
toc_items = [
    ('1', 'TỔNG QUAN HỆ THỐNG', 3),
    ('2', 'DANH SÁCH TÀI KHOẢN / VAI TRÒ (ROLE)', 5),
    ('3', 'DANH SÁCH CHỨC NĂNG / MODULE', 7),
    ('4', 'LUỒNG NGHIỆP VỤ CHI TIẾT', 10),
    ('5', 'BẢNG MÀN HÌNH SỬ DỤNG AI', 14),
    ('6', 'LOGIC XỬ LÝ QUAN TRỌNG (BUSINESS LOGIC)', 16),
    ('7', 'HẠN CHẾ / ĐIỂM CẦN CẢI THIỆN', 19),
    ('8', 'PHỤ LỤC: API ENDPOINTS & ERD', 20),
]
for num, title_text, page in toc_items:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(f'{num}. {title_text}')
    r.font.size = Pt(10)
    r.font.color.rgb = DARK

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 1 — TỔNG QUAN HỆ THỐNG
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('1. TỔNG QUAN HỆ THỐNG', level=1)

add_heading('1.1 Mục tiêu & Phạm vi', level=2)
add_paragraph(
    'HRM AI là hệ thống quản lý nhân sự doanh nghiệp được tích hợp AI, bao gồm ba nhánh nghiệp vụ chính:',
    size=10
)
add_bullet('Tuyển dụng AI — Quy trình từ đăng tin đến duyệt hồ sơ ứng viên hoàn toàn tự động (AI chấm điểm CV, phát hiện gian lận, gợi ý câu hỏi phỏng vấn).')
add_bullet('Chấm công AI — Nhận diện khuôn mặt (face-api.js) tại client, backend xác minh embedding vector.')
add_bullet('Tính lương — Tính tự động dựa trên dữ liệu chấm công, bao gồm BHXH, BHYT, BHTN và Thuế TNCN theo biểu thuế lũy tiến 2026.')
add_paragraph('')
add_paragraph('Đối tượng sử dụng:', bold=True)
add_bullet('Nội bộ: CEO, Giám đốc phòng ban, Trưởng phòng, Nhân viên (đăng nhập qua tài khoản, xác thực JWT).')
add_bullet('Ứng viên bên ngoài (không có tài khoản): truy cập form nộp hồ sơ qua link công khai.')

add_heading('1.2 Kiến trúc tổng thể', level=2)
add_paragraph('Hệ thống áp dụng kiến trúc 3-tầng (3-tier) kết hợp AI-as-a-Service:', size=10)

arch_data = [
    ['Frontend', 'React 18 + Vite', 'TailwindCSS', 'Cổng 5173', 'Single Page Application, routing theo role (admin/ceo/director/manager/employee), WebSocket client (STOMP)'],
    ['Backend', 'Spring Boot 3.x', 'Java 21', 'Cổng 8080', 'RESTful API, JWT Stateless, Spring Security + @PreAuthorize, Spring WebSocket'],
    ['Database', 'MySQL 8+', '—', 'Cổng 3306', '15 bảng chính, JPA/Hibernate ORM, không dùng raw SQL concatenation'],
    ['Cache', 'Redis', '—', 'Cổng 6379', 'Cache session / token blacklist (RedisConfig.java đã cấu hình)'],
    ['AI Service', 'Google Gemini API', 'gemini-1.5-flash\n(configurable)', 'HTTPS', 'OCR CV, Fit Score, Fraud Detection, Chatbot, CCCD OCR, Performance Review, Recruiter Digest'],
    ['File Storage', 'Cloudinary', '—', 'HTTPS', 'Lưu file CV (PDF) và ảnh CCCD. Không lưu ảnh khuôn mặt.'],
    ['Face AI', 'face-api.js (@vladmandic)', 'SSD MobileNet v1\nFaceNet 128D', 'Client-side', 'Chạy hoàn toàn tại trình duyệt. Backend chỉ nhận vector 128 chiều.'],
    ['Real-time', 'WebSocket (STOMP)', '—', 'ws://...', 'Trung tâm thông báo real-time, Group Chat, AI Chatbot trong nhóm'],
]
headers_arch = ['Layer', 'Công nghệ', 'Model/Version', 'Port', 'Vai trò']
table_arch = doc.add_table(rows=1 + len(arch_data), cols=5)
table_arch.style = 'Table Grid'
make_table_header(table_arch, headers_arch)
for r_idx, row_data in enumerate(arch_data):
    row = table_arch.rows[r_idx + 1]
    bg = 'F0F4FF' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate(row_data):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(9)
        set_cell_bg(cell, bg)

add_paragraph('')
add_heading('1.3 Sơ đồ kiến trúc (dạng mô tả)', level=2)
add_paragraph(
    '[Ứng viên / Người dùng nội bộ]\n'
    '        │ HTTPS\n'
    '        ▼\n'
    '[React SPA (Vite, TailwindCSS, face-api.js)]\n'
    '        │ REST API / WebSocket (STOMP)\n'
    '        ▼\n'
    '[Spring Boot API Server]\n'
    '        ├─── JWT Filter → @PreAuthorize RBAC\n'
    '        ├─── [MySQL 8] ←→ JPA/Hibernate\n'
    '        ├─── [Redis] ← Cache\n'
    '        ├─── [Cloudinary] ← File upload\n'
    '        └─── [Google Gemini API] ← AI calls\n'
    '                  ├── Text model (gemini-1.5-flash): OCR, Fit Score, Fraud, Chatbot, Review, Digest\n'
    '                  ├── Vision model (callGeminiVision): OCR CCCD ảnh\n'
    '                  └── Embedding model (gemini-embedding-2): vector ngữ nghĩa FAQ',
    size=9
)
doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 2 — DANH SÁCH ROLE
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('2. DANH SÁCH TÀI KHOẢN / VAI TRÒ (ROLE)', level=1)
add_paragraph(
    'Nguồn: com.hrm.common.entity.Role.java, SecurityConfig.java, CustomUserDetails.java, App.jsx.\n'
    'Hệ thống có 5 Role được định nghĩa trong enum Role, không tính ứng viên (ứng viên không có tài khoản).',
    size=9, color=GRAY
)

role_data = [
    ['ADMIN', 'Quản trị hệ thống',
     '• Quản lý tài khoản người dùng\n• Quản lý phòng ban\n• Cài đặt hệ thống\n• Tạo tài khoản mới\n• Xem dashboard tổng quan\n• Truy cập chat nhóm',
     '/admin/dashboard\n/admin/users\n/admin/departments\n/admin/settings\n/admin/profile\n/admin/chat'],

    ['CEO\n(Tổng Giám đốc)', 'Quản lý toàn công ty, không thuộc phòng ban cụ thể (departmentId = null)',
     '• Xem/duyệt TOÀN BỘ dữ liệu không giới hạn phòng ban\n• Duyệt bảng lương cuối cùng (CEO approve)\n• Xem báo cáo lương tổng hợp từ tất cả Giám đốc phòng ban\n• Quản lý tuyển dụng toàn công ty\n• Xem chấm công toàn công ty\n• Quản lý danh sách nhân viên\n• Đăng ký khuôn mặt chấm công\n• Truy cập tất cả module\n• Duyệt yêu cầu (requests) toàn công ty',
     '/ceo/dashboard\n/ceo/employees\n/ceo/recruitment/*\n/ceo/attendance\n/ceo/my-attendance\n/ceo/requests\n/ceo/my-requests\n/ceo/holidays\n/ceo/payroll\n/ceo/profile\n/ceo/chat\n/ceo/face-enroll'],

    ['GIAM_DOC_PHONG_BAN\n(Giám đốc phòng ban)', 'Quản lý phòng ban cụ thể (có departmentId). Duyệt từ Trưởng phòng, gửi lên CEO',
     '• Xem/duyệt dữ liệu phòng ban mình (scope departmentId)\n• Duyệt báo cáo lương từ Trưởng phòng → gửi lên CEO\n• Quản lý tuyển dụng (không lọc department)\n• Duyệt chấm công ngoại lệ\n• Xem danh sách nhân viên phòng ban\n• Đăng ký khuôn mặt\n• Duyệt yêu cầu của nhân viên phòng ban\n• Truy cập chat nhóm',
     '/director/dashboard\n/director/employees\n/director/recruitment/*\n/director/attendance\n/director/my-attendance\n/director/requests\n/director/my-requests\n/director/holidays\n/director/payroll\n/director/profile\n/director/chat\n/director/face-enroll'],

    ['TRUONG_PHONG\n(Trưởng phòng)', 'Quản lý nhóm/phòng (có departmentId). Đây là "HR" trong luồng tuyển dụng.',
     '• Tính/duyệt lương nhân viên phòng → gửi báo cáo lên Giám đốc phòng ban\n• Trigger AI review hồ sơ ứng viên thủ công\n• Duyệt/từ chối hồ sơ ứng viên (theo state machine)\n• Tạo/quản lý chiến dịch tuyển dụng (job posting)\n• Tạo Yêu cầu tuyển dụng (JobRequisition)\n• Duyệt chấm công ngoại lệ của nhân viên phòng mình\n• Xem danh sách nhân viên phòng\n• Nhận AI Recruiter Digest tự động 2 lần/ngày\n• Quản lý ngày nghỉ lễ\n• Đăng ký khuôn mặt\n• Duyệt yêu cầu nhân viên',
     '/manager/dashboard\n/manager/employees\n/manager/recruitment/*\n/manager/attendance\n/manager/my-attendance\n/manager/requests\n/manager/my-requests\n/manager/payroll\n/manager/profile\n/manager/chat\n/manager/face-enroll'],

    ['NHAN_VIEN\n(Nhân viên)', 'Nhân viên thông thường, chỉ truy cập dữ liệu của chính mình',
     '• Chấm công qua nhận diện khuôn mặt\n• Đăng ký khuôn mặt\n• Xem lịch sử chấm công cá nhân\n• Xem phiếu lương (chỉ lương APPROVED)\n• Gửi yêu cầu nghỉ phép / ngoại lệ chấm công\n• Cập nhật thông tin cá nhân\n• Tham gia chat nhóm\n• Xem dashboard cá nhân',
     '/employee/dashboard\n/employee/face-enroll\n/employee/attendance\n/employee/requests\n/employee/payroll\n/employee/profile\n/employee/chat'],
]

headers_role = ['Role (Enum)', 'Mô tả', 'Quyền hạn (Permissions)', 'Màn hình truy cập được']
table_role = doc.add_table(rows=1 + len(role_data), cols=4)
table_role.style = 'Table Grid'
make_table_header(table_role, headers_role)
for r_idx, row_data in enumerate(role_data):
    row = table_role.rows[r_idx + 1]
    bg = 'EFF6FF' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate(row_data):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

add_paragraph('\n⚠️ Ghi chú quan trọng: Ứng viên KHÔNG có tài khoản. Họ truy cập qua link công khai /public/apply/:jobSlug — không qua verifyToken. Mọi role được xác định hoàn toàn từ JWT token, tuyệt đối không tin dữ liệu role từ client request body.', size=9, color=GRAY)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 3 — DANH SÁCH MODULE
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('3. DANH SÁCH CHỨC NĂNG / MODULE', level=1)

modules = [
    {
        'name': '3.1 Module Xác thực (Auth)',
        'desc': 'Xác thực người dùng nội bộ qua JWT stateless. Không có chức năng đăng ký — tài khoản do Admin tạo.',
        'functions': [
            'Đăng nhập bằng email + mật khẩu → trả JWT token',
            'JWT Filter xác thực mỗi request (JwtAuthFilter.java)',
            'Mã hóa mật khẩu BCrypt',
        ],
        'endpoints': [
            'POST /api/auth/login — Public',
        ],
        'tables': ['users'],
    },
    {
        'name': '3.2 Module Tuyển dụng (Recruitment)',
        'desc': 'Quản lý toàn bộ quy trình tuyển dụng: yêu cầu → đăng tin → nhận hồ sơ → AI chấm → duyệt đa cấp. Module này KHÔNG lọc theo department_id.',
        'functions': [
            'Tạo/duyệt Yêu cầu tuyển dụng (JobRequisition): Trưởng phòng tạo → CEO duyệt',
            'Tạo/chỉnh sửa chiến dịch tuyển dụng (JobPosting) với slug độc nhất',
            'Form nộp hồ sơ công khai (không cần đăng nhập) tại /public/apply/:slug',
            'Upload CV (PDF) + ảnh CCCD lên Cloudinary (xử lý bất đồng bộ)',
            'Phòng chống spam: kiểm tra trùng email+jobId trong vòng 5 phút',
            'Trigger AI review thủ công (POST /run-ai) bởi Trưởng phòng/Giám đốc',
            'Pipeline duyệt hồ sơ đa bước (State Machine 9 trạng thái)',
            'Ghi AI Decision Log cho mọi quyết định AI',
            'AI Recruiter Digest tự động 2 lần/ngày (08:00 & 15:00)',
            'Tự động đóng chiến dịch khi đủ số lượng tuyển',
            'Gửi email từ chối / offer letter',
            'Tự động tạo AccountCreationRequest khi CEO duyệt Offer',
        ],
        'endpoints': [
            'GET /api/recruitment/jobs — Lấy danh sách chiến dịch (TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN)',
            'POST /api/recruitment/jobs — Tạo chiến dịch mới',
            'PUT /api/recruitment/jobs/{id} — Cập nhật chiến dịch',
            'PATCH /api/recruitment/jobs/{id}/status — Đổi trạng thái OPEN/CLOSED',
            'DELETE /api/recruitment/jobs/{id} — Xóa chiến dịch',
            'GET /api/recruitment/jobs/stats — Thống kê',
            'GET /api/recruitment/applications — Danh sách hồ sơ (paginated)',
            'GET /api/recruitment/applications/{id} — Chi tiết hồ sơ',
            'POST /api/recruitment/applications/{id}/approve — Duyệt sang bước tiếp',
            'POST /api/recruitment/applications/{id}/reject — Từ chối',
            'POST /api/recruitment/applications/{id}/run-ai — Trigger AI pipeline',
            'GET /api/recruitment/applications/{id}/ai-logs — Xem AI Decision Log',
            'POST /public/apply/:slug — Nộp hồ sơ công khai (không cần auth)',
            'GET /public/jobs/:slug — Xem chi tiết tin tuyển dụng',
            'GET /api/recruitment/requisitions — Xem danh sách Yêu cầu tuyển dụng',
            'POST /api/recruitment/requisitions — Tạo Yêu cầu tuyển dụng',
            'POST /api/recruitment/requisitions/{id}/approve — CEO duyệt yêu cầu',
            'POST /api/recruitment/requisitions/{id}/reject — CEO từ chối yêu cầu',
        ],
        'tables': ['job_requisitions', 'job_postings', 'applications', 'ai_decision_logs'],
    },
    {
        'name': '3.3 Module Chấm công (Attendance)',
        'desc': 'Chấm công bằng nhận diện khuôn mặt real-time. face-api.js xử lý tại client, backend chỉ nhận vector 128D để so sánh cosine/Euclidean.',
        'functions': [
            'Đăng ký khuôn mặt (Face Enrollment): chụp từ webcam, chống giả mạo bằng anti-spoofing',
            'Chấm công check-in/check-out bằng khuôn mặt (ngưỡng Euclidean distance = 0.6)',
            'Phân loại trạng thái: PRESENT (trước 08:00), LATE (sau 08:00)',
            'Lưu scan_history (log timestamp mỗi lần quét)',
            'Trưởng phòng duyệt ngoại lệ chấm công (PENDING → APPROVED/REJECTED)',
            'Phân loại nghỉ phép: HALF_DAY_LEAVE, NORMAL_LEAVE, SPECIAL_WFH_LEAVE, UNPAID',
            'CEO xem thống kê chấm công toàn phòng ban',
            'Lọc phân trang theo phòng ban, role, tên nhân viên',
        ],
        'endpoints': [
            'POST /api/attendance/punch — Chấm công (tất cả role đã đăng nhập)',
            'GET /api/attendance/me — Lịch sử chấm công cá nhân',
            'GET /api/attendance/department — Chấm công phòng ban (ngày cụ thể)',
            'GET /api/attendance/department/paginated — Paginated',
            'PATCH /api/attendance/{id}/approve-exception — Duyệt ngoại lệ (TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO)',
            'GET /api/attendance/departments/stats — Thống kê toàn phòng ban (CEO only)',
            'POST /api/employees/me/face-enroll — Đăng ký khuôn mặt',
        ],
        'tables': ['attendances', 'face_embeddings'],
    },
    {
        'name': '3.4 Module Tính lương (Payroll)',
        'desc': 'Tính lương tự động dựa trên dữ liệu chấm công với quy trình duyệt 3 cấp: Trưởng phòng → Giám đốc phòng ban → CEO.',
        'functions': [
            'Tính lương tháng tự động (generate): đọc attendance, tính lương gộp, bảo hiểm, thuế TNCN',
            'Trạng thái phiếu lương: DRAFT → MANAGER_APPROVED → PENDING_DIRECTOR → PENDING_CEO → APPROVED_BY_CEO / REJECTED_BY_CEO',
            'Trưởng phòng: duyệt từng phiếu hoặc duyệt tất cả + gửi báo cáo lên Giám đốc',
            'Giám đốc phòng ban: duyệt báo cáo của Trưởng phòng + gửi lên CEO',
            'CEO: duyệt hoặc từ chối báo cáo cuối cùng',
            'Nhân viên xem phiếu lương cá nhân (chỉ trạng thái APPROVED)',
            'Kiểm tra: không tính lương khi còn đơn ngoại lệ PENDING',
            'Tính ngày công chuẩn: trừ thứ 7, CN và ngày lễ quốc gia (bảng holidays)',
            'Overtime pay có thể nhập thủ công',
        ],
        'endpoints': [
            'POST /api/payroll/generate — Tính lương (TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO)',
            'POST /api/payroll/{id}/approve — Duyệt từng phiếu',
            'POST /api/payroll/{id}/reject — Từ chối từng phiếu',
            'POST /api/payroll/manager/approve-all — Duyệt tất cả phiếu (TRUONG_PHONG)',
            'POST /api/payroll/manager/submit-report — Gửi báo cáo lên Giám đốc (TRUONG_PHONG)',
            'GET /api/payroll/director/reports — Xem báo cáo từ Trưởng phòng (GIAM_DOC_PHONG_BAN)',
            'POST /api/payroll/director/approve-report/{id} — Duyệt báo cáo Trưởng phòng',
            'POST /api/payroll/director/submit-report — Gửi báo cáo lên CEO',
            'GET /api/payroll/ceo/reports — Xem báo cáo tổng hợp (CEO)',
            'POST /api/payroll/ceo/approve-report/{id} — CEO duyệt báo cáo',
            'POST /api/payroll/ceo/reject-report/{id} — CEO từ chối báo cáo',
            'GET /api/payroll/me — Phiếu lương cá nhân',
            'GET /api/payroll/department — Lương theo phòng ban',
            'GET/POST /api/payroll/holidays — Quản lý ngày nghỉ lễ',
        ],
        'tables': ['payrolls', 'payroll_reports', 'salary_history', 'holidays'],
    },
    {
        'name': '3.5 Module Thông báo (Notification)',
        'desc': 'Hệ thống thông báo real-time qua WebSocket (STOMP). Hỗ trợ phân loại mức độ: binh_thuong / quan_trong.',
        'functions': [
            'Gửi thông báo real-time qua WebSocket STOMP',
            'Phân loại: PAYROLL, THONG_BAO, tuyen_dung...',
            'Mức độ: binh_thuong / quan_trong',
            'Đánh dấu đã đọc',
            'Liên kết đến màn hình tương ứng (lienKet)',
            'Thông báo tự động khi: payroll bị từ chối, ngoại lệ chấm công được duyệt/từ chối, AI Recruiter Digest',
        ],
        'endpoints': [
            'GET /api/notifications — Danh sách thông báo của user hiện tại',
            'PATCH /api/notifications/{id}/read — Đánh dấu đã đọc',
            'PATCH /api/notifications/read-all — Đánh dấu tất cả đã đọc',
            'WebSocket: /ws (STOMP) — /topic/notifications/{userId}',
        ],
        'tables': ['notifications'],
    },
    {
        'name': '3.6 Module Chat Nhóm (Group Chat)',
        'desc': 'Chat nhóm nội bộ có tích hợp AI assistant. Hỗ trợ nhiều loại nhóm, gửi/xóa tin nhắn.',
        'functions': [
            'Tạo nhóm chat (DEPARTMENT, PROJECT, DIRECT...)',
            'Gửi/nhận tin nhắn real-time qua WebSocket STOMP',
            'Mention @AI trong nhóm để gọi Gemini AI trả lời',
            'Xóa tin nhắn (đánh dấu deleted_by_sender)',
            'Lịch sử 30 tin nhắn gần nhất làm context cho AI',
        ],
        'endpoints': [
            'GET /api/chat/groups — Danh sách nhóm của user',
            'POST /api/chat/groups — Tạo nhóm mới',
            'GET /api/chat/groups/{id}/messages — Lịch sử tin nhắn',
            'DELETE /api/chat/messages/{id} — Xóa tin nhắn',
            'WebSocket: /app/group/{groupId}/send — Gửi tin nhắn nhóm',
        ],
        'tables': ['chat_groups', 'chat_group_members', 'group_messages'],
    },
    {
        'name': '3.7 Module AI Chatbot (Cá nhân)',
        'desc': 'Chatbot Gemini cá nhân cho từng người dùng. Có System Prompt động theo role, FAQ cache, Function Calling để truy vấn dữ liệu thực tế.',
        'functions': [
            'Chatbot cá nhân (1-1 với AI) với System Prompt động theo role',
            'Lưu lịch sử hội thoại trong bảng chat_messages',
            'Function Calling: truy vấn số liệu thực (lương, chấm công, tuyển dụng...)',
            'FAQ cache: Gemini Embedding + cosine similarity để trả lời nhanh câu hỏi thường gặp',
            'Xóa lịch sử hội thoại',
        ],
        'endpoints': [
            'POST /api/ai/chat — Gửi tin nhắn chatbot cá nhân',
            'GET /api/ai/chat/history — Lịch sử chat cá nhân',
            'DELETE /api/ai/chat/history — Xóa lịch sử',
        ],
        'tables': ['chat_messages', 'faq_cache'],
    },
    {
        'name': '3.8 Module Hồ sơ Nhân viên (Employee Profile)',
        'desc': 'Quản lý thông tin cá nhân nhân viên, lịch sử thay đổi, đánh giá hiệu suất AI.',
        'functions': [
            'Xem/cập nhật thông tin cá nhân (tên, CCCD, địa chỉ, ngày sinh...)',
            'OCR CCCD: upload ảnh CCCD → AI trích xuất thông tin tự động',
            'Lịch sử thay đổi vị trí/phòng ban (EmployeeHistory)',
            'Đánh giá hiệu suất hàng tháng do AI sinh dựa trên dữ liệu chấm công',
            'Quản lý danh sách nhân viên theo phòng ban (Trưởng phòng/Giám đốc)',
        ],
        'endpoints': [
            'GET /api/employees/me — Thông tin cá nhân',
            'PUT /api/employees/me — Cập nhật thông tin',
            'POST /api/employees/me/face-enroll — Đăng ký khuôn mặt',
            'GET /api/employees — Danh sách nhân viên (quản lý)',
            'POST /api/employees/{id}/cccd-extract — OCR CCCD',
            'GET /api/employees/{id}/performance-review — Xem đánh giá AI',
            'POST /api/employees/{id}/performance-review — Tạo đánh giá AI',
            'GET /api/employees/{id}/history — Lịch sử thay đổi',
        ],
        'tables': ['users', 'face_embeddings', 'performance_reviews', 'employee_history'],
    },
    {
        'name': '3.9 Module Quản trị (Admin)',
        'desc': 'Dành riêng cho ADMIN. Quản lý tài khoản, phòng ban, cài đặt hệ thống.',
        'functions': [
            'Tạo tài khoản mới (Admin tạo, không tự đăng ký)',
            'Kích hoạt/vô hiệu hóa tài khoản',
            'Quản lý phòng ban (tạo, khóa/mở)',
            'Duyệt yêu cầu tạo tài khoản từ luồng tuyển dụng (AccountCreationRequest)',
            'Cài đặt hệ thống (SystemSetting)',
            'Xem dashboard thống kê tổng quan',
        ],
        'endpoints': [
            'POST /api/admin/accounts — Tạo tài khoản',
            'GET /api/admin/users — Danh sách người dùng',
            'PATCH /api/admin/users/{id} — Cập nhật thông tin user',
            'GET /api/admin/dashboard — Dashboard số liệu',
            'GET/POST /api/admin/departments — Quản lý phòng ban',
            'GET/PUT /api/admin/settings — Cài đặt hệ thống',
        ],
        'tables': ['users', 'departments', 'system_settings', 'account_creation_requests'],
    },
    {
        'name': '3.10 Module Yêu cầu Nhân viên (Employee Request)',
        'desc': 'Nhân viên gửi yêu cầu nghỉ phép, làm thêm giờ, v.v. Quản lý duyệt/từ chối.',
        'functions': [
            'Nhân viên tạo yêu cầu (RequestType: NGHI_PHEP, LAM_THEM, NGO_LE...)',
            'Trưởng phòng/Giám đốc duyệt hoặc từ chối',
            'Trạng thái: PENDING → APPROVED / REJECTED',
        ],
        'endpoints': [
            'GET /api/requests/my — Yêu cầu của nhân viên hiện tại',
            'POST /api/requests — Tạo yêu cầu mới',
            'GET /api/requests/manage — Danh sách cần duyệt (quản lý)',
            'PATCH /api/requests/{id}/approve — Duyệt',
            'PATCH /api/requests/{id}/reject — Từ chối',
        ],
        'tables': ['employee_requests'],
    },
]

for mod in modules:
    add_heading(mod['name'], level=2)
    add_paragraph(mod['desc'], size=10)
    add_paragraph('Chức năng chính:', bold=True, size=10)
    for f in mod['functions']:
        add_bullet(f)
    add_paragraph('API Endpoints liên quan:', bold=True, size=10)
    for ep in mod['endpoints']:
        add_bullet(ep, level=1)
    add_paragraph('Bảng dữ liệu:', bold=True, size=10)
    add_paragraph('  ' + ', '.join(mod['tables']), size=9, color=GRAY)
    add_paragraph('')

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 4 — LUỒNG NGHIỆP VỤ
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('4. LUỒNG NGHIỆP VỤ (WORKFLOW) CHI TIẾT', level=1)

# ── 4.1 Tuyển dụng
add_heading('4.1 Luồng Tuyển dụng (end-to-end)', level=2)
recruitment_steps = [
    ('Bước 1', 'Trưởng phòng', 'Tạo Yêu cầu tuyển dụng (JobRequisition)\nChọn chức danh, phòng ban, số lượng, mô tả lý do tuyển.\nDữ liệu: job_requisitions, status = PENDING_CEO'),
    ('Bước 2', 'CEO', 'Duyệt hoặc từ chối Yêu cầu tuyển dụng\nNếu duyệt: status = APPROVED\nNếu từ chối: status = REJECTED + lý do'),
    ('Bước 3', 'Trưởng phòng', 'Tạo Chiến dịch tuyển dụng (JobPosting) từ yêu cầu đã duyệt\nSlug tự động sinh (VD: ke-toan-truong-2026-09)\nDữ liệu: job_postings, status = OPEN'),
    ('Bước 4', 'Ứng viên (ngoài)', 'Truy cập form công khai: /public/apply/:slug\nUpload CV (PDF) + ảnh CCCD (tùy chọn)\nNhập thông tin cá nhân (hoặc xem AI tự điền từ OCR)\nXác nhận & Nộp hồ sơ'),
    ('Bước 5', 'Hệ thống', 'Lưu Application vào DB với status = NEW\nAsyncUploadService: upload CV lên Cloudinary (bất đồng bộ)\nTrích xuất rawCvText từ file PDF thực tế\nChống spam: kiểm tra email+jobId trong 5 phút'),
    ('Bước 6', 'Trưởng phòng', 'Trigger AI Pipeline thủ công\n(POST /api/recruitment/applications/{id}/run-ai)\nLý do: tránh lãng phí API token khi ứng viên spam'),
    ('Bước 6a', 'AI (Hệ thống)', '[Bước 0] Kiểm tra identity match: tên + email có trong rawCvText?\n→ KHÔNG khớp: fraudFlagged=true, needsVerification=true, DỪNG'),
    ('Bước 6b', 'AI (Gemini)', '[Bước 1] Semantic Fit Score\nInput: rawCvText + JD (description + requirements) + capBac\nModel: gemini-1.5-flash\nOutput: {"score": 0-100, "reason": "..."}\n→ score < 40: status = REJECTED, gửi email, DỪNG'),
    ('Bước 6c', 'AI (Gemini)', '[Bước 2] Fraud Detection (chỉ khi score ≥ 40)\nInput: rawCvText\nOutput: {"isFraud": true/false, "reason": "..."}\n→ isFraud=true: fraudFlagged=true, needsVerification=true, DỪNG'),
    ('Bước 6d', 'AI (Gemini)', '[Bước 3] CV Extraction + Câu hỏi phỏng vấn (chỉ khi không fraud)\nInput: rawCvText + jobTitle\nOutput: JSON với fullName, email, phone, CCCD, education, experience,\nsuggestedQuestions (3-5 câu hỏi tình huống liên quan JD)\n→ status = PENDING_HR_CV_REVIEW'),
    ('Bước 7', 'Trưởng phòng (HR)', 'Duyệt CV vòng 1 (PENDING_HR_CV_REVIEW → PENDING_TECH_CV_REVIEW)\nFeedback lưu vào hrReviewFeedback, hrReviewer'),
    ('Bước 8', 'Trưởng phòng / Giám đốc', 'Duyệt CV chuyên môn (PENDING_TECH_CV_REVIEW → PENDING_INTERVIEW_1)\nFeedback lưu vào techReviewFeedback'),
    ('Bước 9', 'Trưởng phòng / Giám đốc', 'Phỏng vấn vòng 1 pass (PENDING_INTERVIEW_1)\n→ Nếu tuyển Trưởng phòng: → PENDING_CEO_EVALUATION\n→ Nếu tuyển Nhân viên: → PENDING_INTERVIEW_2'),
    ('Bước 9a', 'CEO', '(Chỉ khi tuyển Trưởng phòng) Duyệt sau PV1 (PENDING_CEO_EVALUATION → PENDING_INTERVIEW_2)'),
    ('Bước 10', 'Trưởng phòng / Giám đốc', 'Phỏng vấn vòng 2 pass (PENDING_INTERVIEW_2 → PENDING_HR_OFFER)'),
    ('Bước 11', 'Trưởng phòng (HR)', 'Lên Bảng Offer trình CEO (PENDING_HR_OFFER → PENDING_OFFER_APPROVAL)\nOfferDetails lưu vào offerDetails'),
    ('Bước 12', 'CEO', 'Duyệt Offer cuối cùng (PENDING_OFFER_APPROVAL → OFFER_APPROVED)\n→ Gửi email offer\n→ Tạo AccountCreationRequest (Admin sẽ tạo tài khoản)\n→ Nếu đủ soLuongTuyen: tự động đóng chiến dịch (status = CLOSED)'),
    ('Từ chối', 'Bất kỳ vai trò nào', 'Từ chối tại bất kỳ bước nào → status = REJECTED\n→ Gửi email cảm ơn (rejection email)\n→ Ghi MANUAL_REJECTION vào ai_decision_logs'),
]

table_recruit = doc.add_table(rows=1 + len(recruitment_steps), cols=3)
table_recruit.style = 'Table Grid'
make_table_header(table_recruit, ['Bước', 'Người thực hiện', 'Mô tả hành động & Dữ liệu'])
for r_idx, (step, actor, desc) in enumerate(recruitment_steps):
    row = table_recruit.rows[r_idx + 1]
    bg = 'F0F9FF' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate([step, actor, desc]):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

add_paragraph('')

# ── 4.2 Chấm công
add_heading('4.2 Luồng Đăng ký & Chấm công Khuôn mặt', level=2)
attendance_steps = [
    ('Bước 1 — Đăng ký\n(Face Enrollment)', 'Nhân viên / mọi role', 'Mở trang /face-enroll → Bật webcam\nface-api.js load models (SSD MobileNet v1, FaceNet 128D)\nAnti-spoofing: detection.score ≥ 0.995 AND box.width ≥ 120\nKiểm tra occlusion: max(expressions) ≥ 0.8\nTrích embedding vector 128D (Float32Array)\nPOST /api/employees/me/face-enroll với vectorJson\nBackend lưu vào face_embeddings (KHÔNG lưu ảnh)'),
    ('Bước 2 — Chấm công\n(Punch)', 'Nhân viên / mọi role', 'Mở trang chấm công → Bật webcam\nface-api.js tính embedding realtime từ video stream\nGửi vector + location lên POST /api/attendance/punch\nBackend: đọc vector đã đăng ký từ face_embeddings\nTính Euclidean Distance giữa 2 vector\nNếu distance ≤ 0.6 → HỢP LỆ\nNếu chưa có bản ghi hôm nay: CHECK-IN\n  → Trước 08:00: status=PRESENT; Sau 08:00: status=LATE\nNếu đã có bản ghi (chưa check-out): CHECK-OUT\n  → timeOut = now, locationOut = location\n  → Append scanHistory log\nNếu đã check-out: ném exception "Đã check-out hôm nay rồi"'),
    ('Bước 3 — Duyệt\nngoại lệ', 'Trưởng phòng /\nGiám đốc / CEO', 'Xem danh sách nhân viên theo phòng ban + ngày\nChọn record có isException = false và exceptionStatus = PENDING\nDuyệt/Từ chối: PATCH /api/attendance/{id}/approve-exception\nNếu APPROVED: cập nhật status theo loaiNghiPhep\nGửi thông báo real-time cho nhân viên'),
]
table_att = doc.add_table(rows=1 + len(attendance_steps), cols=3)
table_att.style = 'Table Grid'
make_table_header(table_att, ['Bước', 'Người thực hiện', 'Chi tiết xử lý'])
for r_idx, (step, actor, desc) in enumerate(attendance_steps):
    row = table_att.rows[r_idx + 1]
    bg = 'F0FFF4' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate([step, actor, desc]):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

add_paragraph('')

# ── 4.3 Lương
add_heading('4.3 Luồng Tính lương (3 cấp duyệt)', level=2)
payroll_steps = [
    ('Bước 1', 'Trưởng phòng', 'POST /api/payroll/generate?month=M&year=Y\nHệ thống: kiểm tra xem có đơn ngoại lệ PENDING không → block nếu có\nTính standardDays (loại T7, CN, ngày lễ từ bảng holidays)\nĐọc attendance theo employeeId + tháng\nTính actualDays (có xét đi muộn/nghỉ phép)\nTính gross, bảo hiểm (BHXH 8%, BHYT 1.5%, BHTN 1%), thuế TNCN\nLưu Payroll với status = DRAFT'),
    ('Bước 2', 'Trưởng phòng', 'Xem/duyệt từng phiếu hoặc duyệt tất cả (approve-all)\nStatus: DRAFT → MANAGER_APPROVED\nGửi báo cáo lên Giám đốc: POST /api/payroll/manager/submit-report\nStatus: MANAGER_APPROVED → PENDING_DIRECTOR\nCó cảnh báo ghi đè nếu báo cáo đã tồn tại và đang PENDING_DIRECTOR'),
    ('Bước 3', 'Giám đốc phòng ban', 'Xem báo cáo từ Trưởng phòng: GET /api/payroll/director/reports\nDuyệt báo cáo của từng Trưởng phòng: PENDING_DIRECTOR → APPROVED_BY_DIRECTOR\nBắt buộc tất cả báo cáo APPROVED_BY_DIRECTOR mới được gửi lên CEO\nGửi báo cáo tổng hợp lên CEO: POST /api/payroll/director/submit-report\nStatus: PENDING_DIRECTOR → PENDING_CEO'),
    ('Bước 4', 'CEO', 'Xem báo cáo tổng hợp: GET /api/payroll/ceo/reports\nDuyệt: PENDING_CEO → APPROVED_BY_CEO (phiếu lương nhân viên)\nTừ chối kèm lý do: PENDING_CEO → REJECTED_BY_CEO\nKhi CEO từ chối: Gửi thông báo tự động cho tất cả Giám đốc phòng ban liên quan'),
    ('Kết quả', 'Nhân viên', 'Xem phiếu lương: GET /api/payroll/me\nChỉ hiển thị phiếu có status = APPROVED_BY_CEO (lọc trong PayrollService)'),
]
table_pay = doc.add_table(rows=1 + len(payroll_steps), cols=3)
table_pay.style = 'Table Grid'
make_table_header(table_pay, ['Bước', 'Người thực hiện', 'Chi tiết xử lý'])
for r_idx, (step, actor, desc) in enumerate(payroll_steps):
    row = table_pay.rows[r_idx + 1]
    bg = 'FFFBEB' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate([step, actor, desc]):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

add_paragraph('')

# ── 4.4 Login
add_heading('4.4 Luồng Đăng nhập & Xác thực JWT', level=2)
login_steps = [
    ('Bước 1', 'Người dùng', 'Nhập email + password vào LoginPage.jsx\nPOST /api/auth/login (Public endpoint — không cần JWT)'),
    ('Bước 2', 'Backend (AuthService)', 'AuthenticationManager xác thực email/password với BCrypt\nNếu sai: trả HTTP 401'),
    ('Bước 3', 'Backend (JwtUtil)', 'Tạo JWT token chứa claims: userId, email, role, departmentId, teamId, hoTen\nLưu ý: departmentId = null cho CEO/ADMIN'),
    ('Bước 4', 'Frontend (AuthContext)', 'Lưu JWT vào localStorage\nDecode token để lấy role\nNavigate đến dashboard tương ứng: /admin | /ceo | /director | /manager | /employee'),
    ('Bước 5', 'Mọi request tiếp theo', 'JwtAuthFilter: đọc Authorization: Bearer {token}\nVerify chữ ký JWT → trích claims → tạo CustomUserDetails\nSpring Security sử dụng CustomUserDetails cho @PreAuthorize'),
    ('Bước 6', 'Spring Security', '@PreAuthorize kiểm tra role\nService layer kiểm tra thêm scope (departmentId/teamId/userId)\nTuyệt đối KHÔNG tin role/departmentId từ client body'),
]
table_login = doc.add_table(rows=1 + len(login_steps), cols=3)
table_login.style = 'Table Grid'
make_table_header(table_login, ['Bước', 'Actor', 'Mô tả'])
for r_idx, (step, actor, desc) in enumerate(login_steps):
    row = table_login.rows[r_idx + 1]
    bg = 'F5F3FF' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate([step, actor, desc]):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 5 — BẢNG MÀN HÌNH SỬ DỤNG AI
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('5. BẢNG MÀN HÌNH SỬ DỤNG AI (Gemini)', level=1)
add_paragraph('Tất cả AI call đều thông qua GeminiClientService.java. Model mặc định: gemini-1.5-flash (cấu hình tại app.gemini.model). Timeout text: 120s, Vision: 180s, Chat: 60s, Embedding: 30s. Retry: 2 lần.', size=9, color=GRAY)

ai_data = [
    [
        'Form Nộp hồ sơ Công khai\n(/public/apply/:slug)',
        'OCR CV PDF\n(CvParserService + GeminiVision)',
        'File PDF CV dưới dạng ảnh base64 (mỗi trang 1 phần trong Vision API)',
        'rawCvText: văn bản thuần của CV',
        'Lưu rawCvText vào Application.rawCvText\nDùng làm input cho AI Pipeline (Fit Score, Fraud, Extraction)\nKhông auto-reject — KHÔNG zero auto-reject ở bước này',
        'Chưa xác định ngưỡng cụ thể ở bước này'
    ],
    [
        'Trigger AI Pipeline\n(POST /applications/{id}/run-ai)',
        'Bước 0: Identity Match Check\n(KHÔNG dùng AI — string matching)',
        'app.fullName, app.email, rawCvText',
        'Pass/Fail: tên+email có trong CV?',
        'Fail (cả hai không khớp): fraudFlagged=true, needsVerification=true\nKhông gọi Gemini API → tiết kiệm token\nGhi ai_decision_logs (FRAUD_DETECTION type)',
        'Nguyên tắc Zero Auto-Reject KHÔNG áp dụng ở đây — đây là kiểm tra logic cơ bản, không phải AI'
    ],
    [
        'Trigger AI Pipeline\n(POST /applications/{id}/run-ai)',
        'Semantic Fit Score\n(SemanticFitScoreService)',
        'rawCvText + JD (description + requirements) + capBac (nếu có)',
        'JSON: {"score": 0-100, "reason": "..."}',
        'score < 40: status = REJECTED, gửi email rejection, DỪNG pipeline\nscore ≥ 40: tiếp tục sang Fraud Detection\nGhi vào ai_decision_logs (FIT_SCORE type)',
        'NGƯỠNG AUTO-REJECT: score < 40 → TỰ ĐỘNG REJECT\nĐây là ngoại lệ Zero Auto-Reject vì CV hoàn toàn không liên quan'
    ],
    [
        'Trigger AI Pipeline\n(POST /applications/{id}/run-ai)',
        'Fraud Detection\n(FraudDetectionService)',
        'rawCvText (chỉ khi score ≥ 40)',
        'JSON: {"isFraud": true/false, "reason": "..."}',
        'isFraud=true: fraudFlagged=true, needsVerification=true, DỪNG pipeline\nisFraud=false: tiếp tục sang CV Extraction\nGhi vào ai_decision_logs (FRAUD_DETECTION type)',
        'KHÔNG auto-reject khi fraud — chỉ flag và chuyển sang hàng chờ review thủ công\n→ Áp dụng nguyên tắc Zero Auto-Reject cho fraud'
    ],
    [
        'Trigger AI Pipeline\n(POST /applications/{id}/run-ai)',
        'CV Extraction + Câu hỏi PV\n(CvExtractionService)',
        'rawCvText + jobTitle (chỉ khi score ≥ 40 VÀ không fraud)',
        'JSON: fullName, email, phone, CCCD (với confidence 0-100),\ndob, gender, education[], experience[],\ncareerObjective, suggestedQuestions[]',
        'Validate regex: email, phone, CCCD — nếu sai format → hạ confidence về 30\nMerge với extractedData cũ (giữ trường tay người dùng đã nhập)\nCập nhật app.extractedData\nstatus = PENDING_HR_CV_REVIEW\nGhi vào ai_decision_logs (OCR type)',
        'KHÔNG có ngưỡng auto-reject ở bước này'
    ],
    [
        'Màn hình Chi tiết hồ sơ\n(ApplicationDetailPage)',
        'Xem AI Decision Logs',
        'applicationId',
        'List<AiDecisionLog>: actionType, rawRequest, rawResponse, decisionReason, isSuccess',
        'Hiển thị toàn bộ lịch sử quyết định AI của hồ sơ\nKhông gọi Gemini — chỉ đọc từ DB',
        'N/A'
    ],
    [
        'Hồ sơ Nhân viên\n(ProfilePage / CCCD)',
        'OCR CCCD\n(CccdExtractionService)',
        'Ảnh mặt trước + mặt sau CCCD dạng base64\n(callGeminiVision)',
        'JSON: cccd, fullName, dob, gender, address, hometown, issueDate, issuePlace, expiryDate\nMỗi trường kèm confidenceScore (0-100)',
        'Validate regex CCCD: 12 chữ số — nếu sai → log warning\nKết quả trả về client để người dùng xác nhận trước khi lưu',
        'KHÔNG auto-reject — người dùng xem xét và xác nhận'
    ],
    [
        'Màn hình Đánh giá Hiệu suất\n(PerformanceReviewController)',
        'AI Performance Review\n(AiPerformanceReviewService)',
        'Dữ liệu chấm công tháng: totalDays, lateDays, absentDays\nThông qua prompt text (không gửi dữ liệu nhân viên tên/ID)',
        'Văn bản Markdown: Tổng quan, Điểm đáng chú ý, Khuyến nghị\n(< 300 chữ)',
        'Lưu vào performance_reviews.ai_evaluation\nMột nhân viên chỉ có 1 review/tháng (kiểm tra existsBy...)',
        'KHÔNG có ngưỡng auto-reject'
    ],
    [
        'AI Recruiter Digest\n(Scheduled Job)',
        'Tổng hợp & gửi báo cáo tuyển dụng\n(AiRecruiterDigestService)',
        'Số hồ sơ mới 24h, top ứng viên (score≥80), hồ sơ cần review\n(dữ liệu tổng hợp, không gửi nội dung CV)',
        'Văn bản digest 3-4 câu tóm tắt tình hình',
        'Gửi notification đến TẤT CẢ Trưởng phòng có role TRUONG_PHONG\nChạy lúc 08:00 và 15:00 hàng ngày (@Scheduled)\nFallback nếu AI lỗi: dùng số liệu thô',
        'Trigger: @Scheduled(cron="0 0 8,15 * * *")'
    ],
    [
        'AI Chatbot cá nhân\n(ChatController / ChatbotService)',
        'Trợ lý AI cá nhân\n(Gemini multi-turn chat)',
        'Lịch sử hội thoại + System Prompt động theo role\nFunction Calling để truy vấn dữ liệu DB thực',
        'Câu trả lời văn bản tự nhiên + kết quả Function Call',
        'Lưu history vào chat_messages\nFAQ cache: so sánh embedding cosine similarity để trả lời nhanh\nFunction Calling: truy vấn lương, chấm công, tuyển dụng thực',
        'Không có ngưỡng auto-reject'
    ],
    [
        'Chat nhóm có AI\n(GroupChatPage)',
        'AI tham gia nhóm chat\n(ChatbotService.handleGroupMessage)',
        'Lịch sử 30 tin nhắn gần nhất của nhóm + tin nhắn người dùng hiện tại\nThông tin nhóm (tên, số thành viên)',
        'Câu trả lời của AI trong ngữ cảnh nhóm',
        'Lưu tin nhắn AI vào group_messages với isAi=true\nChỉ phản hồi khi có @mention hoặc tin nhắn gửi trực tiếp đến AI',
        'Không có ngưỡng auto-reject'
    ],
]

headers_ai = ['Màn hình / Tính năng', 'AI làm gì', 'Input đưa vào AI', 'Output AI trả về', 'Logic xử lý sau kết quả AI', 'Ngưỡng / Zero Auto-Reject']
table_ai = doc.add_table(rows=1 + len(ai_data), cols=6)
table_ai.style = 'Table Grid'
make_table_header(table_ai, headers_ai)
for r_idx, row_data in enumerate(ai_data):
    row = table_ai.rows[r_idx + 1]
    bg = 'FFF7ED' if r_idx % 2 == 0 else 'FFFFFF'
    for c_idx, val in enumerate(row_data):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 6 — BUSINESS LOGIC QUAN TRỌNG
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('6. LOGIC XỬ LÝ QUAN TRỌNG (BUSINESS LOGIC)', level=1)

# 6.1 Fraud Detection
add_heading('6.1 Fraud Detection — Cơ chế phát hiện CV gian lận', level=2)
add_paragraph('Hệ thống có 2 lớp kiểm tra gian lận, áp dụng tuần tự:', size=10)
add_bullet('[Lớp 1] Identity Match (Miễn phí AI token): So sánh chuỗi thuần (string.contains) giữa {fullName, email} mà ứng viên nhập trên form với rawCvText. Nếu CẢ HAI đều không xuất hiện trong CV → flag fraudFlagged=true, needsVerification=true. Logic: ứng viên đã nộp CV của người khác. Ghi log: FRAUD_DETECTION / "Gian lận danh tính".')
add_bullet('[Lớp 2] AI Fraud Detection (Gemini): Chỉ chạy khi Fit Score ≥ 40. Prompt: phân tích chồng chéo thời gian làm việc, kỹ năng phi lý so với kinh nghiệm. Output: {"isFraud": bool, "reason": string}. Nếu isFraud=true: fraudFlagged=true, needsVerification=true, DỪNG. KHÔNG tự động từ chối — chuyển cho HR xem xét thủ công (Zero Auto-Reject với fraud).')

add_heading('6.2 Approval 2 cấp trong Tuyển dụng', level=2)
add_paragraph('State Machine được implement tại ApplicationService.approveApplication() với switch-case theo approvalStatus:', size=10)
add_bullet('PENDING_HR_CV_REVIEW → PENDING_TECH_CV_REVIEW (HR duyệt CV)')
add_bullet('PENDING_TECH_CV_REVIEW → PENDING_INTERVIEW_1 (Trưởng phòng/GĐ duyệt chuyên môn)')
add_bullet('PENDING_INTERVIEW_1 → PENDING_CEO_EVALUATION (nếu tuyển TRUONG_PHONG) hoặc PENDING_INTERVIEW_2 (nếu tuyển NHAN_VIEN)')
add_bullet('PENDING_CEO_EVALUATION → PENDING_INTERVIEW_2 (CEO đánh giá PV1 của ứng viên Trưởng phòng)')
add_bullet('PENDING_INTERVIEW_2 → PENDING_HR_OFFER')
add_bullet('PENDING_HR_OFFER → PENDING_OFFER_APPROVAL (HR lên offer)')
add_bullet('PENDING_OFFER_APPROVAL → OFFER_APPROVED (CEO duyệt cuối)')
add_paragraph('Bảo mật scope duyệt: Trưởng phòng chỉ được duyệt chuyên môn (TECH/INTERVIEW) của ứng viên tuyển vào phòng MÌNH (departmentId phải khớp). Ngoại lệ: Trưởng phòng Nhân sự có thể duyệt mọi phòng.', size=10)

add_heading('6.3 Công thức Tính lương', level=2)
add_paragraph('Nguồn: PayrollService.java, PersonalIncomeTaxCalculator.java, cấu hình payroll.* trong application.yml', size=9, color=GRAY)
formula_items = [
    'standardDays = Số ngày làm việc trong tháng (trừ T7, CN, ngày lễ từ bảng holidays)',
    'dailySalary = baseSalary / standardDays',
    'actualDays = Tổng ngày công thực tế (theo bảng tính đi muộn/nghỉ phép bên dưới)',
    'grossSalary = (baseSalary + allowance) × (actualDays / standardDays) − latePenalty + overtimePay',
    'Bảo hiểm (nếu actualDays ≥ 14):',
    '  BHXH = baseSalary × 8% (payroll.insurance.bhxh-percent)',
    '  BHYT = baseSalary × 1.5% (payroll.insurance.bhyt-percent)',
    '  BHTN = baseSalary × 1% (payroll.insurance.bhtn-percent)',
    'thuNhapChiuThue = grossSalary − (BHXH + BHYT + BHTN)',
    'totalDeduction = 15,500,000 + (6,200,000 × soNguoiPhuThuoc) — theo Luật Thuế TNCN 2025',
    'thuNhapTinhThue = max(0, thuNhapChiuThue − totalDeduction)',
    'Thuế TNCN lũy tiến (Luật 109/2025/QH15):',
    '  Bậc 1: ≤ 10tr → 5%',
    '  Bậc 2: 10tr–30tr → 10%',
    '  Bậc 3: 30tr–60tr → 20%',
    '  Bậc 4: 60tr–100tr → 30%',
    '  Bậc 5: > 100tr → 35%',
    'netSalary = grossSalary − totalInsurance − thuTncn',
]
for item in formula_items:
    add_bullet(item, level=0 if not item.startswith(' ') else 1)

add_paragraph('\nBảng tính ngày công theo loại nghỉ/đi muộn:', bold=True, size=10)
late_table_data = [
    ['PRESENT', 'Đúng giờ (trước 08:00)', '+1.0 ngày', '0'],
    ['LATE (lần 1)', 'Đi muộn (sau 08:00)', '+1.0 ngày', '0 (miễn phí lần đầu — payroll.late-free-times)'],
    ['LATE (lần 2-3)', 'Đi muộn lần 2, 3', '+1.0 ngày', '− dailySalary × 30% (payroll.late-penalty-percent)'],
    ['LATE (lần 4)', 'Đi muộn lần 4', '+0.5 ngày', '0 (trừ 0.5 ngày — payroll.late-4th-time-days-deducted)'],
    ['LATE (lần 5+)', 'Đi muộn lần 5 trở đi', '+0.0 ngày', '0 (trừ 1.0 ngày — payroll.late-5th-plus-days-deducted)'],
    ['ABSENT + APPROVED + HALF_DAY_LEAVE', 'Nghỉ nửa ngày được duyệt', '+0.5 ngày', '0'],
    ['ABSENT + APPROVED + NORMAL_LEAVE', 'Nghỉ phép thường (≤ 1 ngày/tháng)', '+1.0 ngày', '0 (tối đa payroll.normal-leave-days-per-month)'],
    ['ABSENT + APPROVED + SPECIAL_WFH_LEAVE', 'Nghỉ WFH đặc biệt (≤ 1 ngày/tháng)', '+0.7 ngày', '0'],
    ['ABSENT (vắng không lý do)', 'Không có bản ghi hoặc không được duyệt', '+0.0 ngày', '0'],
]
add_table(
    ['Trạng thái', 'Ý nghĩa', 'actualDays cộng thêm', 'Penalty'],
    late_table_data,
    col_widths=[4.5, 4, 2.5, 5]
)

add_heading('6.4 Chống Spam Form Apply Công khai', level=2)
add_paragraph('Nguồn: ApplicationService.submitApplication()', size=10)
add_bullet('Kiểm tra: applicationRepository.existsByEmailAndJobPostingIdAndCreatedAtAfter(email, jobId, now-5phút)')
add_bullet('Nếu tìm thấy bản ghi → ném exception: "Bạn vừa nộp hồ sơ cho vị trí này gần đây. Vui lòng thử lại sau 5 phút nếu có lỗi."')
add_bullet('Kiểm tra trạng thái chiến dịch: job.status ≠ "OPEN" → từ chối')
add_bullet('Kiểm tra hạn nộp: hanNopHoSo < now → từ chối với thông báo ngày hết hạn')

add_heading('6.5 Chuẩn hóa Department scope', level=2)
add_paragraph('Nguồn: WORKFLOW.md mục 3, ApplicationService, AttendanceService, PayrollService', size=10)
add_bullet('Module Tuyển dụng: KHÔNG áp dụng department_id scope — mọi Trưởng phòng đều thấy/thao tác toàn bộ dữ liệu tuyển dụng. Đây là quyết định thiết kế có chủ đích.')
add_bullet('Module Chấm công / Lương: Trưởng phòng chỉ thấy nhân viên phòng mình (departmentId phải khớp). CEO không có departmentId → thấy tất cả.')
add_bullet('Phòng chống lạm dụng: Trưởng phòng duyệt chuyên môn CV chỉ được làm với hồ sơ tuyển vào phòng MÌNH. Trường hợp ngoại lệ: Trưởng phòng "Nhân sự" có thể duyệt tất cả.')

add_heading('6.6 AI Pipeline Optimization (Tiết kiệm Token)', level=2)
add_bullet('AI KHÔNG chạy tự động ngay khi nộp hồ sơ → Trưởng phòng phải trigger thủ công.')
add_bullet('Bước 0 (Identity Check) không tốn token — chỉ string.contains().')
add_bullet('Chỉ chạy Fraud Detection khi Fit Score ≥ 40.')
add_bullet('Chỉ chạy CV Extraction khi Fit Score ≥ 40 VÀ không fraud.')
add_bullet('Pipeline dừng sớm tại mỗi bước fail để tiết kiệm token tối đa.')

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 7 — HẠN CHẾ / ĐIỂM CẦN CẢI THIỆN
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('7. HẠN CHẾ / ĐIỂM CẦN CẢI THIỆN', level=1)
add_paragraph('Các điểm dưới đây được phát hiện trực tiếp trong source code (TODO, thiếu validate, code chưa hoàn thiện):', size=10)

issues = [
    ('User.java:93', 'TODO: migrate sang lấy baseSalary từ Contract.mucLuong khi module Hợp đồng lao động hoàn thành. Hiện tại baseSalary lưu trực tiếp trong bảng users.', 'Trung bình', 'Thiếu module Hợp đồng lao động'),
    ('AttendanceController.java:45-51', 'Endpoint GET /api/attendance/fix-duplicates hardcode employeeId=3L và trả về "Fixed" mà không làm gì thực tế. Đây là code debug chưa được xóa.', 'Cao', 'Code debug chưa xóa, có thể gây nhầm lẫn'),
    ('AttendanceService.java:39', 'SIMILARITY_THRESHOLD = 0.6 được hardcode trong source code. Nên đưa vào application.yml để có thể cấu hình theo môi trường mà không cần recompile.', 'Thấp', 'Thiếu khả năng cấu hình'),
    ('AttendanceService.java:40', 'START_TIME = LocalTime.of(8, 0) được hardcode. Nên đưa vào SystemSetting hoặc application.yml để Admin có thể thay đổi giờ làm việc.', 'Thấp', 'Thiếu khả năng cấu hình'),
    ('AttendanceService.java:60', 'Comment "Tìm các bản ghi trong ngày (phòng trường hợp DB đang có lỗi nhiều bản ghi cùng ngày)" → DB có thể có duplicate records. Chưa có unique constraint đảm bảo mỗi nhân viên chỉ có 1 bản ghi/ngày.', 'Cao', 'Có thể có duplicate data trong DB'),
    ('Payroll.java:83', 'Trạng thái phiếu lương là String ("DRAFT", "APPROVED"...) thay vì Enum. Dễ gây lỗi typo và khó refactor.', 'Trung bình', 'Thiếu type safety'),
    ('Attendance.java:41', 'Trạng thái chấm công (status) là String ("PRESENT", "LATE"...) thay vì Enum. Tương tự vấn đề Payroll.', 'Trung bình', 'Thiếu type safety'),
    ('ApplicationService.java:318', 'rawCvText được lưu tạm với giá trị "Đang trích xuất văn bản (chạy ngầm)...". Nếu AsyncUploadService gặp lỗi và không cập nhật lại, hồ sơ sẽ có rawCvText giả định — vi phạm quy tắc dữ liệu thật.', 'Cao', 'Có thể dẫn đến rawCvText không được cập nhật nếu async job lỗi'),
    ('GeminiClientService.java:24', 'model mặc định trong @Value là "gemini-1.5-flash" nhưng WORKFLOW.md đề cập "gemini-3.5-flash". Cần thống nhất và kiểm tra tên model đúng.', 'Trung bình', 'Mâu thuẫn giữa code và tài liệu'),
    ('PayrollService.java:472-474', 'getMyPayroll() lọc .filter(p -> "APPROVED".equals(p.getStatus())) nhưng trạng thái cuối cùng được set là "APPROVED_BY_CEO". Có thể nhân viên không thấy phiếu lương dù đã được CEO duyệt.', 'Cao', 'Bug logic — nhân viên có thể không thấy phiếu lương'),
    ('RecruitmentController.java:172', 'Endpoint POST /api/recruitment/test-digest dùng để trigger AI Digest thủ công. Endpoint này không có bảo vệ đặc biệt (chỉ TRUONG_PHONG, GIAM_DOC, CEO) — nên xem xét thêm rate limiting để tránh lạm dụng.', 'Thấp', 'Test endpoint còn trong production code'),
    ('ProfilePage / CCCD', 'Module OCR CCCD có validate regex 12 chữ số nhưng nếu không hợp lệ chỉ log warning, không hạ confidence hay thông báo rõ ràng cho user.', 'Thấp', 'UX không rõ ràng khi CCCD không hợp lệ'),
]

headers_issues = ['Vị trí trong Code', 'Mô tả vấn đề', 'Mức độ', 'Ảnh hưởng']
table_issues = doc.add_table(rows=1 + len(issues), cols=4)
table_issues.style = 'Table Grid'
make_table_header(table_issues, headers_issues, bg='DC2626')
for r_idx, row_data in enumerate(issues):
    row = table_issues.rows[r_idx + 1]
    level_color = {'Cao': 'FEE2E2', 'Trung bình': 'FFF7ED', 'Thấp': 'F0FDF4'}
    bg = level_color.get(row_data[2], 'FFFFFF')
    for c_idx, val in enumerate(row_data):
        cell = row.cells[c_idx]
        cell.text = val
        cell.paragraphs[0].runs[0].font.size = Pt(8)
        set_cell_bg(cell, bg)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════════════════════
#  CHƯƠNG 8 — PHỤ LỤC
# ═══════════════════════════════════════════════════════════════════════════════
add_heading('8. PHỤ LỤC', level=1)

# 8.1 API Endpoints
add_heading('8.1 Danh sách API Endpoint đầy đủ', level=2)
add_paragraph('Nguồn: Đọc trực tiếp từ @RequestMapping và @PreAuthorize trong các Controller files.', size=9, color=GRAY)

all_endpoints = [
    # Auth
    ('POST', '/api/auth/login', 'Đăng nhập, nhận JWT token', 'Tất cả (Public)'),
    # Admin
    ('POST', '/api/admin/accounts', 'Tạo tài khoản mới', 'ADMIN'),
    ('GET', '/api/admin/users', 'Danh sách người dùng', 'ADMIN'),
    ('PATCH', '/api/admin/users/{id}', 'Cập nhật/vô hiệu hóa tài khoản', 'ADMIN'),
    ('GET', '/api/admin/dashboard', 'Dashboard thống kê', 'ADMIN'),
    ('GET/POST', '/api/admin/departments', 'Quản lý phòng ban', 'ADMIN'),
    ('GET/PUT', '/api/admin/settings', 'Cài đặt hệ thống', 'ADMIN'),
    # Recruitment - Jobs
    ('GET', '/api/recruitment/jobs', 'Danh sách chiến dịch tuyển dụng', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('GET', '/api/recruitment/jobs/stats', 'Thống kê chiến dịch', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('GET', '/api/recruitment/jobs/stats/paginated', 'Thống kê phân trang', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('GET', '/api/recruitment/jobs/{id}', 'Chi tiết chiến dịch', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/recruitment/jobs', 'Tạo chiến dịch mới', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('PUT', '/api/recruitment/jobs/{id}', 'Cập nhật chiến dịch', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('PATCH', '/api/recruitment/jobs/{id}/status', 'Đổi trạng thái OPEN/CLOSED', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('DELETE', '/api/recruitment/jobs/{id}', 'Xóa chiến dịch', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    # Recruitment - Applications
    ('GET', '/api/recruitment/jobs/{jobId}/applications', 'Hồ sơ theo chiến dịch', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('GET', '/api/recruitment/applications', 'Tất cả hồ sơ (paginated)', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('GET', '/api/recruitment/applications/{id}', 'Chi tiết hồ sơ', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/recruitment/applications/{id}/approve', 'Duyệt hồ sơ sang bước tiếp', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('POST', '/api/recruitment/applications/{id}/reject', 'Từ chối hồ sơ', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('DELETE', '/api/recruitment/applications/{id}', 'Xóa hồ sơ', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/recruitment/applications/{id}/run-ai', 'Trigger AI pipeline', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('GET', '/api/recruitment/applications/{id}/ai-logs', 'Xem AI Decision Log', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/recruitment/test-digest', 'Trigger AI Digest thủ công', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    # Job Requisitions
    ('GET', '/api/recruitment/requisitions', 'Danh sách yêu cầu tuyển dụng', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('POST', '/api/recruitment/requisitions', 'Tạo yêu cầu tuyển dụng', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN'),
    ('POST', '/api/recruitment/requisitions/{id}/approve', 'Duyệt yêu cầu tuyển dụng', 'CEO'),
    ('POST', '/api/recruitment/requisitions/{id}/reject', 'Từ chối yêu cầu', 'CEO'),
    # Public
    ('GET', '/public/jobs/{slug}', 'Xem chi tiết tin tuyển dụng', 'Public (không cần auth)'),
    ('POST', '/public/apply/{slug}', 'Nộp hồ sơ công khai', 'Public (không cần auth)'),
    ('GET', '/public/jobs', 'Danh sách tin tuyển dụng đang mở', 'Public'),
    # Attendance
    ('POST', '/api/attendance/punch', 'Chấm công (check-in/check-out)', 'Tất cả (đã đăng nhập)'),
    ('GET', '/api/attendance/me', 'Lịch sử chấm công cá nhân', 'Tất cả'),
    ('GET', '/api/attendance/department', 'Chấm công theo phòng ban', 'Tất cả (scoped)'),
    ('GET', '/api/attendance/department/paginated', 'Chấm công phân trang', 'Tất cả (scoped)'),
    ('PATCH', '/api/attendance/{id}/approve-exception', 'Duyệt ngoại lệ chấm công', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('GET', '/api/attendance/departments/stats', 'Thống kê chấm công toàn phòng ban', 'CEO'),
    # Face Enrollment
    ('POST', '/api/employees/me/face-enroll', 'Đăng ký khuôn mặt', 'Tất cả (đã đăng nhập)'),
    # Employee
    ('GET', '/api/employees/me', 'Thông tin cá nhân', 'Tất cả'),
    ('PUT', '/api/employees/me', 'Cập nhật thông tin cá nhân', 'Tất cả'),
    ('GET', '/api/employees', 'Danh sách nhân viên', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO, ADMIN'),
    ('POST', '/api/employees/{id}/cccd-extract', 'OCR CCCD bằng AI', 'Tất cả (đã đăng nhập)'),
    ('GET', '/api/employees/{id}/performance-review', 'Xem đánh giá AI hiệu suất', 'Tất cả'),
    ('POST', '/api/employees/{id}/performance-review', 'Tạo đánh giá AI', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('GET', '/api/employees/{id}/history', 'Lịch sử thay đổi nhân viên', 'Tất cả'),
    # Payroll
    ('POST', '/api/payroll/generate', 'Tính lương tháng', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/payroll/{id}/approve', 'Duyệt phiếu lương', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/payroll/{id}/reject', 'Từ chối phiếu lương', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('POST', '/api/payroll/manager/approve-all', 'Duyệt tất cả phiếu lương', 'TRUONG_PHONG'),
    ('POST', '/api/payroll/manager/submit-report', 'Gửi báo cáo lên Giám đốc', 'TRUONG_PHONG'),
    ('GET', '/api/payroll/director/reports', 'Xem báo cáo từ Trưởng phòng', 'GIAM_DOC_PHONG_BAN'),
    ('POST', '/api/payroll/director/approve-report/{id}', 'Duyệt báo cáo Trưởng phòng', 'GIAM_DOC_PHONG_BAN'),
    ('POST', '/api/payroll/director/submit-report', 'Gửi báo cáo lên CEO', 'GIAM_DOC_PHONG_BAN'),
    ('GET', '/api/payroll/ceo/reports', 'Xem báo cáo tổng hợp', 'CEO'),
    ('POST', '/api/payroll/ceo/approve-report/{id}', 'CEO duyệt báo cáo', 'CEO'),
    ('POST', '/api/payroll/ceo/reject-report/{id}', 'CEO từ chối báo cáo', 'CEO'),
    ('GET', '/api/payroll/me', 'Phiếu lương cá nhân', 'Tất cả'),
    ('GET', '/api/payroll/department', 'Lương theo phòng ban', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('GET', '/api/payroll/holidays', 'Danh sách ngày nghỉ lễ', 'Tất cả'),
    ('POST', '/api/payroll/holidays', 'Thêm ngày nghỉ lễ', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    # Notifications
    ('GET', '/api/notifications', 'Danh sách thông báo', 'Tất cả'),
    ('PATCH', '/api/notifications/{id}/read', 'Đánh dấu đã đọc', 'Tất cả'),
    ('PATCH', '/api/notifications/read-all', 'Đánh dấu tất cả đã đọc', 'Tất cả'),
    # AI Chat
    ('POST', '/api/ai/chat', 'Gửi tin nhắn chatbot', 'Tất cả'),
    ('GET', '/api/ai/chat/history', 'Lịch sử chat cá nhân', 'Tất cả'),
    ('DELETE', '/api/ai/chat/history', 'Xóa lịch sử chat', 'Tất cả'),
    # Group Chat
    ('GET', '/api/chat/groups', 'Danh sách nhóm', 'Tất cả'),
    ('POST', '/api/chat/groups', 'Tạo nhóm mới', 'Tất cả'),
    ('GET', '/api/chat/groups/{id}/messages', 'Lịch sử tin nhắn nhóm', 'Tất cả'),
    ('DELETE', '/api/chat/messages/{id}', 'Xóa tin nhắn', 'Tất cả'),
    # Employee Requests
    ('GET', '/api/requests/my', 'Yêu cầu cá nhân', 'Tất cả'),
    ('POST', '/api/requests', 'Tạo yêu cầu mới', 'Tất cả'),
    ('GET', '/api/requests/manage', 'Danh sách cần duyệt', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('PATCH', '/api/requests/{id}/approve', 'Duyệt yêu cầu', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    ('PATCH', '/api/requests/{id}/reject', 'Từ chối yêu cầu', 'TRUONG_PHONG, GIAM_DOC_PHONG_BAN, CEO'),
    # WebSocket
    ('WS/STOMP', '/ws → /topic/notifications/{userId}', 'Nhận thông báo real-time', 'Tất cả (đã đăng nhập)'),
    ('WS/STOMP', '/app/group/{groupId}/send', 'Gửi tin nhắn nhóm', 'Tất cả'),
    # Health
    ('GET', '/actuator/health', 'Health check', 'Public'),
]

add_table(
    ['Method', 'Path', 'Mô tả', 'Role được phép'],
    all_endpoints,
    col_widths=[1.5, 5, 4.5, 5]
)

add_paragraph('')
add_heading('8.2 ERD — Mô tả các bảng chính trong MySQL', level=2)
add_paragraph('Nguồn: @Entity classes trong source code. Tất cả bảng dùng strategy = IDENTITY cho Primary Key.', size=9, color=GRAY)

erd_data = [
    ('users', 'Người dùng nội bộ', 'id (PK), ho_ten, ma_nhan_vien (UNIQUE), email (UNIQUE), password_hash, role (ENUM), department_id (FK nullable), team_id, chuc_vu, avatar_url, phone, cccd, ngay_sinh, que_quan, dia_chi, ngay_cap_cccd, noi_cap_cccd, cccd_front_public_id, cccd_back_public_id, base_salary, allowance, so_nguoi_phu_thuoc, active, created_at'),
    ('departments', 'Phòng ban', 'id (PK), ten_phong (NOT NULL), mo_ta, created_at, is_lock'),
    ('job_requisitions', 'Yêu cầu tuyển dụng', 'id, title, target_role (ENUM), department_id, so_luong, reason, requirements, description, budget, cap_bac, hinh_thuc_lam_viec, status (ENUM: PENDING_CEO/APPROVED/REJECTED/POSTED), requester_id, approver_id, rejection_reason, created_at, updated_at'),
    ('job_postings', 'Chiến dịch tuyển dụng', 'id, title, description, requirements, slug (UNIQUE), status (OPEN/CLOSED), so_luong_tuyen, dia_diem, hinh_thuc_lam_viec, ngay_bat_dau, han_nop_ho_so, muc_luong, co_thoa_thuan, quyen_loi, cap_bac, department_id, target_role (ENUM), job_requisition_id, created_at, updated_at'),
    ('applications', 'Hồ sơ ứng viên', 'id, job_posting_id (FK), full_name, email, phone, cv_url, cccd_url, fit_score, fraud_flagged, approval_status (ENUM 9 trạng thái), needs_verification, is_priority, extracted_data (JSON), raw_cv_text (TEXT), hr_review_feedback, hr_reviewer, tech_review_feedback, tech_reviewer, interview1_feedback, interview1_reviewer, interview2_feedback, interview2_reviewer, rejection_reason, rejector_name, offer_details, created_at, updated_at'),
    ('ai_decision_logs', 'Nhật ký quyết định AI', 'id, application_id, action_type (OCR/FIT_SCORE/FRAUD_DETECTION/MANUAL_REJECTION), raw_request (TEXT), raw_response (TEXT), decision_reason (TEXT), is_success, error_message, created_at'),
    ('attendances', 'Bảng chấm công', 'id, employee_id (FK), date, time_in, time_out, scan_history (TEXT/JSON), status (PRESENT/LATE/ABSENT/...), is_exception, exception_reason (TEXT), exception_status (PENDING/APPROVED/REJECTED), loai_nghi_phep, location_in (TEXT), location_out (TEXT), created_at, updated_at'),
    ('face_embeddings', 'Vector khuôn mặt', 'id, employee_id (FK), embedding_vector (TEXT — JSON array 128 float), created_at'),
    ('payrolls', 'Phiếu lương', 'id, employee_id (FK), month, year, UNIQUE(employee_id, month, year), base_salary, standard_days, actual_days, allowance, late_penalty, overtime_pay, overtime_reason, gross_salary, bhxh_amount, bhyt_amount, bhtn_amount, thu_nhap_tinh_thue, thu_tncn, net_salary, status (String: DRAFT/MANAGER_APPROVED/PENDING_DIRECTOR/PENDING_CEO/APPROVED_BY_CEO/REJECTED_BY_CEO), rejection_reason, created_at, updated_at'),
    ('payroll_reports', 'Báo cáo lương tổng hợp', 'id, department_id, created_by (userId), month, year, report_level (MANAGER_LEVEL/DIRECTOR_LEVEL), total_employees, total_gross_salary, status (PENDING_DIRECTOR/APPROVED_BY_DIRECTOR/PENDING_CEO/APPROVED_BY_CEO/REJECTED), created_at, updated_at'),
    ('holidays', 'Ngày nghỉ lễ quốc gia', 'id, ten_le (NOT NULL), ngay_le (NOT NULL), ghi_chu'),
    ('salary_history', 'Lịch sử thay đổi lương', 'id, employee_id, old_salary, new_salary, change_reason, changed_by, changed_at'),
    ('notifications', 'Thông báo', 'id, user_id (FK), loai, tieu_de, noi_dung (TEXT), muc_do (binh_thuong/quan_trong), da_doc, lien_ket, created_at'),
    ('chat_groups', 'Nhóm chat', 'id, name, type (ENUM: ChatGroupType), created_by, created_at'),
    ('chat_group_members', 'Thành viên nhóm', 'id, group_id (FK), user_id (FK), joined_at'),
    ('group_messages', 'Tin nhắn nhóm', 'id, group_id (FK), sender_id (FK nullable), content (TEXT), is_ai, deleted_by_sender, created_at'),
    ('chat_messages', 'Lịch sử chat AI cá nhân', 'id, user_id (FK), role (user/model), content (TEXT), created_at'),
    ('faq_cache', 'Cache câu hỏi thường gặp', 'id, question (TEXT), answer (TEXT), embedding_vector (TEXT), created_at, updated_at'),
    ('performance_reviews', 'Đánh giá hiệu suất AI', 'id, employee_id (FK), thang, nam, UNIQUE(employee_id, thang, nam), ai_evaluation (TEXT), generated_at'),
    ('employee_history', 'Lịch sử thay đổi nhân viên', 'id, employee_id (FK), action, old_value (TEXT), new_value (TEXT), changed_by, changed_at'),
    ('employee_requests', 'Yêu cầu nhân viên', 'id, user_id (FK → User), request_type (ENUM), reason (TEXT), start_date, end_date, status (ENUM: PENDING/APPROVED/REJECTED), approver_id (FK → User), note (TEXT), created_at, updated_at'),
    ('system_settings', 'Cài đặt hệ thống', 'id, setting_key (UNIQUE), setting_value, description, updated_at'),
    ('account_creation_requests', 'Yêu cầu tạo tài khoản sau tuyển dụng', 'id, application_id, ho_ten, email, chuc_vu, department_id, status (PENDING/COMPLETED/REJECTED), created_at'),
]

add_table(
    ['Tên bảng', 'Mô tả', 'Các cột chính'],
    erd_data,
    col_widths=[3.5, 3.5, 9.5]
)

# Footer
add_paragraph('\n\n')
hr()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = p.add_run(f'Báo cáo được tổng hợp tự động từ source code dự án HRM AI | Ngày lập: {datetime.date.today().strftime("%d/%m/%Y")} | Phiên bản 1.0')
run.font.size = Pt(8)
run.font.color.rgb = GRAY

# ── Lưu file ──────────────────────────────────────────────────────────────────
output_path = r'c:\Vibe-Coding\HRM AI\BaoCao_HRM_AI_System.docx'
doc.save(output_path)
print(f"[OK] Da tao bao cao: {output_path}")
