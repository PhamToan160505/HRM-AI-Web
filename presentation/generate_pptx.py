import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def build_presentation():
    prs = Presentation()
    # Set 16:9 widescreen layout
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    # Blank slide layout
    blank_layout = prs.slide_layouts[6]
    
    # Color Palette (Dark Tech Theme)
    BG_DARK = RGBColor(15, 23, 42)       # #0F172A Slate 900
    CARD_BG = RGBColor(30, 41, 59)      # #1E293B Slate 800
    CARD_BORDER = RGBColor(51, 65, 85)  # #334155 Slate 700
    TEXT_MAIN = RGBColor(248, 250, 252) # #F8FAFC White/Slate 50
    TEXT_MUTED = RGBColor(148, 163, 184)# #94A3B8 Slate 400
    ACCENT_BLUE = RGBColor(59, 130, 246)# #3B82F6 Primary Blue
    ACCENT_GREEN = RGBColor(16, 185, 129)# #10B981 Emerald Green
    ACCENT_PURPLE = RGBColor(139, 92, 246)# #8B5CF6 Purple
    ACCENT_AMBER = RGBColor(245, 158, 11)# #F59E0B Amber/Gold

    def add_bg(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()

    def add_header(slide, title_text, subtitle_text=""):
        tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(1.1))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        
        p = tf.paragraphs[0]
        p.text = title_text
        p.font.name = "Arial"
        p.font.size = Pt(26)
        p.font.bold = True
        p.font.color.rgb = TEXT_MAIN
        
        if subtitle_text:
            p2 = tf.add_paragraph()
            p2.text = subtitle_text
            p2.font.name = "Arial"
            p2.font.size = Pt(14)
            p2.font.color.rgb = ACCENT_BLUE
            p2.space_before = Pt(4)

    def add_footer(slide, slide_num, total_slides=10):
        tb = slide.shapes.add_textbox(Inches(11.2), Inches(6.9), Inches(1.5), Inches(0.4))
        tf = tb.text_frame
        tf.word_wrap = False
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.RIGHT
        p.text = f"{slide_num} / {total_slides}"
        p.font.name = "Arial"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = ACCENT_BLUE

    def add_card(slide, left, top, width, height, title, items, border_color=CARD_BORDER, header_color=ACCENT_BLUE):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = border_color
        card.line.width = Pt(1.5)

        tb = slide.shapes.add_textbox(Inches(left + 0.3), Inches(top + 0.3), Inches(width - 0.6), Inches(height - 0.6))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p = tf.paragraphs[0]
        p.text = title
        p.font.name = "Arial"
        p.font.size = Pt(18)
        p.font.bold = True
        p.font.color.rgb = header_color

        for item in items:
            p = tf.add_paragraph()
            p.space_before = Pt(14) # Increased spacing to comfortably fill card height
            p.font.name = "Arial"
            p.font.size = Pt(13.5)
            p.font.color.rgb = TEXT_MAIN
            
            if isinstance(item, tuple):
                run1 = p.add_run()
                run1.text = "• " + item[0] + ": "
                run1.font.bold = True
                run1.font.color.rgb = ACCENT_BLUE
                
                run2 = p.add_run()
                run2.text = item[1]
                run2.font.color.rgb = TEXT_MAIN
            else:
                run = p.add_run()
                run.text = "• " + str(item)
                run.font.color.rgb = TEXT_MAIN

    # ==========================================
    # SLIDE 1: COVER
    # ==========================================
    slide1 = prs.slides.add_slide(blank_layout)
    add_bg(slide1)
    add_footer(slide1, 1)
    
    hero = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.2), Inches(11.333), Inches(5.1))
    hero.fill.solid()
    hero.fill.fore_color.rgb = CARD_BG
    hero.line.color.rgb = ACCENT_BLUE
    hero.line.width = Pt(2)

    tb = slide1.shapes.add_textbox(Inches(1.4), Inches(1.6), Inches(10.533), Inches(4.3))
    tf = tb.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.alignment = PP_ALIGN.CENTER
    p0.text = "HRM AI"
    p0.font.name = "Arial"
    p0.font.size = Pt(44)
    p0.font.bold = True
    p0.font.color.rgb = ACCENT_BLUE

    p1 = tf.add_paragraph()
    p1.alignment = PP_ALIGN.CENTER
    p1.text = "Hệ thống Tuyển dụng & Quản trị Nhân sự Tích hợp AI"
    p1.font.name = "Arial"
    p1.font.size = Pt(24)
    p1.font.bold = True
    p1.font.color.rgb = TEXT_MAIN
    p1.space_before = Pt(8)

    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    p2.text = "Từ nhu cầu tuyển dụng đến ngày đầu tiên của nhân viên — Theo dõi thông minh qua Telegram"
    p2.font.name = "Arial"
    p2.font.size = Pt(16)
    p2.font.color.rgb = ACCENT_GREEN
    p2.space_before = Pt(12)

    p3 = tf.add_paragraph()
    p3.alignment = PP_ALIGN.CENTER
    p3.text = "Quy trình khép kín: Khởi tạo Nhu cầu → Đăng tin → AI Sàng lọc CV → Phỏng vấn → Offer & Suất tuyển → Chuẩn bị Tiếp nhận → Xác nhận Đi làm → Điều hành Telegram"
    p3.font.name = "Arial"
    p3.font.size = Pt(13)
    p3.font.color.rgb = TEXT_MUTED
    p3.space_before = Pt(28)

    p4 = tf.add_paragraph()
    p4.alignment = PP_ALIGN.CENTER
    p4.text = "Đơn vị: Nhóm phát triển HRM AI | Công nghệ: React 19, Spring Boot, Google Gemini AI, Telegram Bot"
    p4.font.name = "Arial"
    p4.font.size = Pt(12)
    p4.font.color.rgb = ACCENT_PURPLE
    p4.space_before = Pt(18)

    # ==========================================
    # SLIDE 2: BÀI TOÁN & GIẢI PHÁP
    # ==========================================
    slide2 = prs.slides.add_slide(blank_layout)
    add_bg(slide2)
    add_header(slide2, "Bài toán thực tế & Giải pháp HRM AI", "Chuyển đổi quy trình thủ công đứt gãy thành Nền tảng hợp nhất Nhanh - Đúng - Minh bạch")
    add_footer(slide2, 2)

    add_card(slide2, 0.8, 1.6, 5.7, 5.0, "Thách thức Quy trình Truyền thống", [
        ("Nhập liệu thủ công", "Hồ sơ nộp qua nhiều kênh, nhân sự tốn nhiều giờ đọc và nhập liệu thủ công."),
        ("Tiêu chí thiếu nhất quán", "Đánh giá ứng viên không đồng bộ giữa bộ phận Nhân sự và Chuyên môn."),
        ("Tuyển vượt chỉ tiêu", "Thiếu sổ quản lý suất tuyển thời gian thực khi phát hành Offer."),
        ("Đứt gãy dữ liệu", "Hồ sơ ứng viên trúng tuyển không tự động nối liền với hồ sơ Nhân viên."),
        ("Lãnh đạo thiếu công cụ", "Phụ thuộc báo cáo chậm, khó tra cứu & duyệt nhanh khi di chuyển.")
    ], border_color=ACCENT_AMBER, header_color=ACCENT_AMBER)

    add_card(slide2, 6.8, 1.6, 5.7, 5.0, "Giải pháp HRM AI Nổi bật", [
        ("Nhanh hơn", "AI Gemini tự động phân tích CV & tính Điểm phù hợp theo bằng chứng trong vài giây."),
        ("Đúng hơn", "Kiểm soát qua luồng quy trình nghiêm ngặt, tự động giữ suất tuyển (Sổ suất tuyển)."),
        ("Minh bạch hơn", "Nhật ký kiểm toán đầy đủ, cảnh báo sao chép mô tả công việc, người quyết định cuối."),
        ("Nối liền mạch", "Tự động chuyển từ Chấp nhận Offer → Chuẩn bị tiếp nhận → Kích hoạt tài khoản."),
        ("Lãnh đạo đồng hành", "Telegram Bot tra cứu dữ liệu thời gian thực và phê duyệt tức thì.")
    ], border_color=ACCENT_GREEN, header_color=ACCENT_GREEN)

    # ==========================================
    # SLIDE 3: LUỒNG TỔNG THỂ (12 BƯỚC)
    # ==========================================
    slide3 = prs.slides.add_slide(blank_layout)
    add_bg(slide3)
    add_header(slide3, "Luồng Tuyển dụng & Tiếp nhận Nhân sự Tổng thể", "Quy trình 12 bước xuyên suốt từ Nhu cầu tuyển dụng đến Ngày đi làm đầu tiên của Nhân viên")
    add_footer(slide3, 3)

    col_w = 3.65
    gap_x = 0.35
    row_h = 1.15
    gap_y = 0.15
    
    steps_data = [
        ("1. Tạo nhu cầu tuyển dụng", "Trưởng phòng lập Yêu cầu tuyển dụng (Bản nháp)"),
        ("2. Phê duyệt Nhu cầu", "Lãnh đạo duyệt → Cấp suất tuyển sẵn có"),
        ("3. Đăng tin tuyển dụng", "Tạo Tin tuyển dụng, khóa phiên bản Tiêu chí & Cấu hình AI"),
        ("4. Ứng viên nộp CV", "Nộp trực tuyến qua Biểu mẫu công khai (Không thu CCCD)"),
        ("5. AI Phân tích CV", "Trích xuất PDF + AI Gemini chấm Điểm phù hợp bằng chứng"),
        ("6. Duyệt CV 2 Cấp", "Nhân sự duyệt sơ bộ → Phòng chuyên môn duyệt chuyên sâu"),
        ("7. Phỏng vấn 2 Vòng", "Vòng 1 Kỹ thuật & Vòng 2 Quản lý/Nhân sự đánh giá"),
        ("8. Duyệt & Gửi Offer", "Lập Offer, duyệt ngân sách, gửi ứng viên & GIỮ SUẤT TUYỂN"),
        ("9. Ứng viên Chấp nhận", "Ứng viên đồng ý Offer → Tự động kích hoạt luồng tiếp nhận"),
        ("10. Chuẩn bị Tiếp nhận", "Khởi tạo hồ sơ nhân viên, checklist giấy tờ & tài khoản Chưa kích hoạt"),
        ("11. Xác nhận Đi làm", "Ngày đầu đi làm: Nhân sự bấm 'Xác nhận đã đi làm'"),
        ("12. Kích hoạt Nhân viên", "Hồ sơ chuyển Chính thức, Suất tuyển hoàn tất, Tài khoản Kích hoạt")
    ]

    for idx, (stitle, sdesc) in enumerate(steps_data):
        r = idx // 3
        c = idx % 3
        left = 0.8 + c * (col_w + gap_x)
        top = 1.6 + r * (row_h + gap_y)
        
        box = slide3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(col_w), Inches(row_h))
        box.fill.solid()
        box.fill.fore_color.rgb = CARD_BG
        box.line.color.rgb = ACCENT_BLUE
        box.line.width = Pt(1.5)

        tf = box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = Inches(0.1)

        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        p.text = stitle
        p.font.name = "Arial"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = ACCENT_BLUE

        p2 = tf.add_paragraph()
        p2.alignment = PP_ALIGN.CENTER
        p2.text = sdesc
        p2.font.name = "Arial"
        p2.font.size = Pt(10)
        p2.font.color.rgb = TEXT_MAIN
        p2.space_before = Pt(2)

    # ==========================================
    # SLIDE 4: KHỞI TẠO NHU CẦU & STRATEGY
    # ==========================================
    slide4 = prs.slides.add_slide(blank_layout)
    add_bg(slide4)
    add_header(slide4, "Khởi tạo Nhu cầu & Đăng tin Tuyển dụng", "Quản lý Yêu cầu tuyển dụng, Sổ quản lý Suất tuyển và Khóa tiêu chí AI")
    add_footer(slide4, 4)

    add_card(slide4, 0.8, 1.6, 3.7, 5.0, "1. Yêu cầu Tuyển dụng", [
        ("Khởi tạo yêu cầu", "Trưởng phòng lập yêu cầu theo vị trí, phòng ban, số lượng, khung lương."),
        ("Duyệt đa cấp", "Phê duyệt theo ma trận phân quyền hệ thống (Bản nháp → Đã duyệt)."),
        ("Ràng buộc ngân sách", "Ngăn chặn tuyển ngoài kế hoạch hoặc vượt định mức lương quy định.")
    ], border_color=ACCENT_BLUE, header_color=ACCENT_BLUE)

    add_card(slide4, 4.8, 1.6, 3.7, 5.0, "2. Sổ quản lý Suất tuyển", [
        ("Cấp Suất tự động", "Khi yêu cầu được duyệt, tự động sinh các bản ghi suất tuyển sẵn có."),
        ("Ràng buộc nghiêm ngặt", "Mọi đợt gửi Offer đều phải gắn với 1 suất tuyển cụ thể."),
        ("Chống tuyển vượt", "Không bao giờ xảy ra tình trạng ứng viên đồng ý nhưng báo hết chỉ tiêu.")
    ], border_color=ACCENT_GREEN, header_color=ACCENT_GREEN)

    add_card(slide4, 8.8, 1.6, 3.7, 5.0, "3. Đóng băng Tiêu chí AI", [
        ("Mở tin công khai", "Nhân sự tạo Tin tuyển dụng & xác nhận bộ tiêu chí chấm và Cấu hình AI."),
        ("Phiên bản bất biến", "Khóa cặp phiên bản (Tiêu chí, Cấu hình AI) bất biến khi đăng tin."),
        ("Đánh giá lại an toàn", "Khi sửa tiêu chí, chỉ tính toán lại cho các hồ sơ đang ở khâu đánh giá.")
    ], border_color=ACCENT_PURPLE, header_color=ACCENT_PURPLE)

    # ==========================================
    # SLIDE 5: AI PHÂN TÍCH & CHẤM CV
    # ==========================================
    slide5 = prs.slides.add_slide(blank_layout)
    add_bg(slide5)
    add_header(slide5, "AI Phân tích, Sàng lọc & Chấm CV theo Bằng chứng", "Bảo mật tải lên, Trích xuất PDF, AI Gemini chấm Điểm phù hợp & Cảnh báo bất thường")
    add_footer(slide5, 5)

    add_card(slide5, 0.8, 1.6, 5.7, 5.0, "Quy trình Xử lý CV & AI Gemini", [
        ("Nộp Form trực tuyến", "Ứng viên nộp CV trực tuyến (PDF/Word). Tuyệt đối KHÔNG thu thập CCCD ở bước này."),
        ("Kiểm tra An toàn File", "Xác minh định dạng thực tế, dung lượng, số trang, chặn mã độc và file mã hóa."),
        ("Trích xuất văn bản", "Trích xuất chuẩn xác toàn bộ nội dung văn bản thô từ tệp CV."),
        ("AI Phân tích dữ liệu", "Phân tích cấu trúc: Học vấn, Kinh nghiệm, Kỹ năng & Thành tựu thực tế.")
    ], border_color=ACCENT_BLUE, header_color=ACCENT_BLUE)

    add_card(slide5, 6.8, 1.6, 5.7, 5.0, "Điểm Phù hợp theo Bằng chứng", [
        ("Chấm điểm Bằng chứng", "Chấm theo BẰNG CHỨNG thực tế thay vì từ khóa suông. Phân biệt Khai báo vs Thực chứng."),
        ("Cảnh báo Gian lận AI", "Phát hiện & cảnh báo ứng viên sao chép nguyên văn mô tả công việc (JD)."),
        ("Gợi ý Hỏi phỏng vấn", "AI tự động sinh danh sách câu hỏi phỏng vấn xoáy vào các điểm cần xác minh."),
        ("Nguyên tắc bất biến", "AI chỉ gợi ý. Nhân sự & Phòng chuyên môn luôn giữ quyền quyết định cuối cùng!")
    ], border_color=ACCENT_AMBER, header_color=ACCENT_AMBER)

    # ==========================================
    # SLIDE 6: PHỎNG VẤN & PHÊ DUYỆT OFFER
    # ==========================================
    slide6 = prs.slides.add_slide(blank_layout)
    add_bg(slide6)
    add_header(slide6, "Phỏng vấn có kiểm soát & Phê duyệt Offer an toàn", "Quy trình phỏng vấn 2 vòng, Duyệt Offer nội bộ và Cơ chế Giữ suất tuyển")
    add_footer(slide6, 6)

    add_card(slide6, 0.8, 1.6, 5.7, 5.0, "Quy trình Phỏng vấn 2 Vòng", [
        ("Duyệt CV 2 cấp", "Nhân sự duyệt sơ bộ → Phòng chuyên môn duyệt đánh giá chi tiết."),
        ("Phỏng vấn Vòng 1", "Đánh giá năng lực chuyên môn thực hành & tư duy giải quyết bài toán."),
        ("Phỏng vấn Vòng 2", "Đánh giá sự phù hợp văn hóa & định hướng phát triển cùng Quản lý/Nhân sự."),
        ("Hỗ trợ Trả về", "Cho phép trả hồ sơ về bước trước kèm lý do nếu cần đánh giá lại.")
    ], border_color=ACCENT_BLUE, header_color=ACCENT_BLUE)

    add_card(slide6, 6.8, 1.6, 5.7, 5.0, "Tạo & Phê duyệt Offer An toàn", [
        ("Tách biệt Điều khoản & Lần gửi", "Tách điều khoản Offer (bất biến) và Lần gửi thực tế (mã bảo mật, hạn chót)."),
        ("Phê duyệt Nội bộ", "Duyệt theo ngân sách. Cảnh báo cờ vượt khung lương Yêu cầu tuyển dụng."),
        ("Giữ Suất tuyển an toàn", "Ngay khi gửi Offer: Suất tuyển chuyển từ Sẵn có → Đã giữ chỗ."),
        ("Liên kết Bảo mật", "Ứng viên nhận liên kết bảo mật để bấm Chấp nhận, Từ chối hoặc Thương lượng.")
    ], border_color=ACCENT_GREEN, header_color=ACCENT_GREEN)

    # ==========================================
    # SLIDE 7: TỪ OFFER CHẤP NHẬN ĐẾN NHÂN VIÊN
    # ==========================================
    slide7 = prs.slides.add_slide(blank_layout)
    add_bg(slide7)
    add_header(slide7, "Từ Offer Chấp nhận đến Nhân viên Chính thức", "Cầu nối dữ liệu an toàn, Giai đoạn Chuẩn bị tiếp nhận, Cấp tài khoản và Đi làm")
    add_footer(slide7, 7)

    add_card(slide7, 0.8, 1.6, 5.7, 5.0, "Cầu nối Dữ liệu & Chuẩn bị Tiếp nhận", [
        ("Sự kiện Ứng viên Đồng ý", "Ứng viên bấm chấp nhận offer → Kích hoạt sự kiện dữ liệu an toàn chống trùng."),
        ("Tạo Hồ sơ Tiếp nhận", "Khởi tạo Hồ sơ cá nhân & Hồ sơ nhân viên ở trạng thái Chuẩn bị tiếp nhận."),
        ("Danh mục Hồ sơ", "Tự động sinh danh mục tiếp nhận: Thu thập CCCD, Bằng cấp, Ngân hàng."),
        ("Hợp đồng & Lương ban đầu", "Tạo bản ghi hợp đồng & bản ghi lương ban đầu ở trạng thái Chờ hiệu lực.")
    ], border_color=ACCENT_PURPLE, header_color=ACCENT_PURPLE)

    add_card(slide7, 6.8, 1.6, 5.7, 5.0, "Tài khoản Chưa kích hoạt & Xác nhận Đi làm", [
        ("Tài khoản An toàn", "Gửi yêu cầu cấp tài khoản. Tạo trước ngày đi làm ở trạng thái Chưa kích hoạt."),
        ("Xác nhận Đi làm", "Vào ngày nhận việc, Nhân sự bấm 'Xác nhận đã đi làm' trên hệ thống."),
        ("Kích hoạt Đồng bộ", "Hồ sơ chuyển Chính thức, Suất tuyển hoàn tất, Tài khoản chuyển Đã kích hoạt."),
        ("Hủy nhận việc", "Nếu ứng viên không đến → Hủy tiếp nhận, hủy tài khoản & nhả lại Suất tuyển sẵn có.")
    ], border_color=ACCENT_GREEN, header_color=ACCENT_GREEN)

    # ==========================================
    # SLIDE 8: TELEGRAM BOT FOR MANAGEMENT
    # ==========================================
    slide8 = prs.slides.add_slide(blank_layout)
    add_bg(slide8)
    add_header(slide8, "Telegram HRM AI Bot: Điều hành & Phê duyệt Tức thì", "Trợ lý thông minh dành cho CEO & Giám đốc — Tra cứu dữ liệu thời gian thực và Phê duyệt nhanh 24/7")
    add_footer(slide8, 8)

    add_card(slide8, 0.8, 1.6, 5.7, 5.0, "Bộ Lệnh Tra cứu & Duyệt nhanh", [
        ("/dashboard", "Xem tổng quan chỉ số nhân sự toàn công ty thời gian thực."),
        ("/nhanvien & /tuyendung", "Thống kê quy mô nhân sự, phòng ban & đợt tuyển dụng."),
        ("/chamcong & /luong", "Kiểm tra tình hình đi làm trong ngày & tổng chi phí lương."),
        ("/duyet & /tuchoi", "Duyệt hoặc từ chối yêu cầu tuyển dụng, offer theo ID tức thì.")
    ], border_color=ACCENT_BLUE, header_color=ACCENT_BLUE)

    add_card(slide8, 6.8, 1.6, 5.7, 5.0, "Hỏi đáp Tiếng Việt & Cơ chế Dự phòng", [
        ("Truy vấn Tự nhiên", "Hỏi câu tiếng Việt: 'Hiện công ty có bao nhiêu nhân viên?', 'Hôm nay ai đi muộn?'"),
        ("AI Phân tích Ý định", "AI Gemini phân tích ý định câu hỏi → gọi dữ liệu thực tế hệ thống trả về."),
        ("Cơ chế Dự phòng", "Nếu ngắt kết nối AI, Bot tự chuyển sang nhận diện Từ khóa phục vụ liên tục."),
        ("Bảo mật Phân quyền", "Bot xác thực theo Mã trò chuyện và Số điện thoại chỉ dành cho Lãnh đạo được cấp quyền.")
    ], border_color=ACCENT_GREEN, header_color=ACCENT_GREEN)

    # ==========================================
    # SLIDE 9: KIẾN TRÚC CÔNG NGHỆ & SAFEGUARD
    # ==========================================
    slide9 = prs.slides.add_slide(blank_layout)
    add_bg(slide9)
    add_header(slide9, "Kiến trúc Công nghệ & Cấu hình Động (Không hardcode)", "Hệ thống chuẩn Doanh nghiệp: React 19, Spring Boot, MySQL Flyway, Outbox Pattern & Dynamic Config")
    add_footer(slide9, 9)

    add_card(slide9, 0.8, 1.6, 5.7, 5.0, "Kiến trúc Đa tầng Hiện đại", [
        ("Giao diện Modern", "React 19 + Vite + Tailwind CSS + Biểu đồ Recharts + WebSocket thông báo thời gian thực."),
        ("Backend Chuẩn Doanh nghiệp", "Java 17 + Spring Boot + Spring Security + Mô hình Phê duyệt Đa cấp."),
        ("Lưu trữ & Sự kiện", "MySQL + Flyway quản lý phiên bản cơ sở dữ liệu + Outbox Event có tự động xử lý lại."),
        ("AI & Xử lý File", "Google Gemini API + Trích xuất văn bản tệp PDF chuyên dụng.")
    ], border_color=ACCENT_BLUE, header_color=ACCENT_BLUE)

    add_card(slide9, 6.8, 1.6, 5.7, 5.0, "Cấu hình Động (Không gán cứng trong code)", [
        ("Quản lý Tham số ở Database", "Toàn bộ hệ số điểm AI, ngưỡng cảnh báo, ma trận duyệt lưu ở Database."),
        ("Thay đổi tức thì", "Quản trị viên sửa hệ số điểm AI, thời hạn xử lý trên UI → Đổi ngay không re-deploy."),
        ("Phiên bản Bất biến", "Cấu hình chấm điểm AI được lưu phiên bản bất biến, đảm bảo tính nhất quán kiểm toán."),
        ("Bảo mật & Phân quyền", "Phân quyền theo vai trò chi tiết, Nhật ký kiểm toán lưu vết mọi thao tác.")
    ], border_color=ACCENT_PURPLE, header_color=ACCENT_PURPLE)

    # ==========================================
    # SLIDE 10: GIÁ TRỊ DOANH NGHIỆP & DEMO
    # ==========================================
    slide10 = prs.slides.add_slide(blank_layout)
    add_bg(slide10)
    add_header(slide10, "Giá trị Doanh nghiệp & Kịch bản Demo 3-5 Phút", "Tối ưu vận hành nhân sự toàn diện và Kịch bản trình diễn trực quan tính năng sản phẩm")
    add_footer(slide10, 10)

    add_card(slide10, 0.8, 1.6, 5.7, 5.0, "Giá trị mang lại cho Doanh nghiệp", [
        ("Cho Nhân sự (HR)", "Tự động hóa 80% thao tác đọc/nhập CV, loại bỏ bỏ sót hồ sơ, quản lý luồng tập trung."),
        ("Cho Quản lý", "Đánh giá ứng viên theo tiêu chí đồng nhất, nắm chính xác tiến độ từng hồ sơ."),
        ("Cho Lãnh đạo", "Kiểm soát ngân sách & chỉ tiêu (Sổ suất tuyển), tra cứu & phê duyệt 24/7 qua Telegram."),
        ("Toàn vẹn Dữ liệu", "Nối liền mạch Tuyển dụng → Nhân viên, lưu vết Nhật ký kiểm toán đầy đủ.")
    ], border_color=ACCENT_GREEN, header_color=ACCENT_GREEN)

    add_card(slide10, 6.8, 1.6, 5.7, 5.0, "Kịch bản Trình diễn Thực tế (3 - 5 Phút)", [
        ("B1. Đăng tin & Danh sách CV", "Mở Tin tuyển dụng đang mở & danh sách ứng viên nộp CV."),
        ("B2. Chi tiết AI Chấm bằng chứng", "Xem Điểm phù hợp (chấm bằng chứng), Cảnh báo gian lận & Gợi ý hỏi phỏng vấn."),
        ("B3. Offer & Giữ Suất tuyển", "Chuyển phỏng vấn → Duyệt Offer → Suất tuyển chuyển trạng thái Đã giữ chỗ."),
        ("B4. Đồng ý & Đi làm", "Ứng viên bấm Đồng ý → Hồ sơ vào Tiếp nhận → Nhân sự bấm Đi làm → Tài khoản Đã kích hoạt."),
        ("B5. Telegram Live Query", "Mở Telegram hỏi 'Đang tuyển bao nhiêu vị trí?' & gõ /dashboard kết thúc.")
    ], border_color=ACCENT_AMBER, header_color=ACCENT_AMBER)

    output_path = os.path.join(os.path.dirname(__file__), "HRM_AI_Presentation_Final.pptx")
    try:
        prs.save(output_path)
        print(f"Successfully generated PowerPoint presentation at: {output_path}")
    except PermissionError:
        output_path_v2 = os.path.join(os.path.dirname(__file__), "HRM_AI_Presentation_v3.pptx")
        prs.save(output_path_v2)
        print(f"File locked, saved updated presentation at: {output_path_v2}")

if __name__ == "__main__":
    build_presentation()
