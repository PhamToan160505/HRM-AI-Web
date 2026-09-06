import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

def create_pdf(filename):
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    # Register Arial font to support Vietnamese
    font_path = "C:/Windows/Fonts/arial.ttf"
    font_bold_path = "C:/Windows/Fonts/arialbd.ttf"
    
    if os.path.exists(font_path) and os.path.exists(font_bold_path):
        pdfmetrics.registerFont(TTFont('Arial', font_path))
        pdfmetrics.registerFont(TTFont('Arial-Bold', font_bold_path))
        c.setFont("Arial-Bold", 16)
    else:
        c.setFont("Helvetica-Bold", 16)

    # Header
    c.drawString(50, height - 50, "TRAN THI TAI CHINH")
    
    if os.path.exists(font_path):
        c.setFont("Arial", 11)
    else:
        c.setFont("Helvetica", 11)
        
    c.drawString(50, height - 70, "Email: tranthitaichinh@gmail.com | SĐT: 0901234567")
    c.drawString(50, height - 85, "Vị trí ứng tuyển: Nhân viên Tài chính")
    
    # Objective
    if os.path.exists(font_bold_path):
        c.setFont("Arial-Bold", 12)
    c.drawString(50, height - 120, "1. MỤC TIÊU NGHỀ NGHIỆP")
    
    if os.path.exists(font_path):
        c.setFont("Arial", 11)
    c.drawString(50, height - 140, "- Trở thành Nhân viên Tài chính chuyên nghiệp, đóng góp vào việc quản lý ngân sách")
    c.drawString(50, height - 155, "  và dòng tiền hiệu quả cho công ty.")

    # Education
    if os.path.exists(font_bold_path):
        c.setFont("Arial-Bold", 12)
    c.drawString(50, height - 190, "2. HỌC VẤN (BẰNG CẤP)")
    
    if os.path.exists(font_path):
        c.setFont("Arial", 11)
    c.drawString(50, height - 210, "- Tốt nghiệp Đại học chuyên ngành Tài chính - Ngân hàng (Loại Giỏi).")
    c.drawString(50, height - 225, "- Nắm vững kiến thức về Kế toán và Quản trị kinh doanh.")

    # Experience
    if os.path.exists(font_bold_path):
        c.setFont("Arial-Bold", 12)
    c.drawString(50, height - 260, "3. KINH NGHIỆM LÀM VIỆC (2 NĂM KINH NGHIỆM)")
    
    if os.path.exists(font_bold_path):
        c.setFont("Arial-Bold", 11)
    c.drawString(50, height - 280, "Công ty ABC - Vị trí: Nhân viên Tài chính (2022 - Nay)")
    
    if os.path.exists(font_path):
        c.setFont("Arial", 11)
    c.drawString(50, height - 300, "- Lập ngân sách: Xây dựng, theo dõi và quản lý kế hoạch ngân sách hàng tháng, quý,")
    c.drawString(50, height - 315, "  năm cho các phòng ban.")
    c.drawString(50, height - 330, "- Quản lý dòng tiền: Theo dõi các khoản thu - chi, kiểm soát dòng tiền mặt và đảm")
    c.drawString(50, height - 345, "  bảo tính thanh khoản cho hoạt động hàng ngày.")
    c.drawString(50, height - 360, "- Lập báo cáo tài chính: Tổng hợp số liệu, lập các báo cáo tài chính, báo cáo quản trị")
    c.drawString(50, height - 375, "  và phân tích biến động chi phí.")

    # Skills
    if os.path.exists(font_bold_path):
        c.setFont("Arial-Bold", 12)
    c.drawString(50, height - 410, "4. KỸ NĂNG CHUYÊN MÔN")
    
    if os.path.exists(font_path):
        c.setFont("Arial", 11)
    c.drawString(50, height - 430, "- Sử dụng thành thạo Excel văn phòng và các phần mềm kế toán/tài chính (MISA, SAP).")
    c.drawString(50, height - 445, "- Hiểu biết về luật thuế và chuẩn mực kế toán hiện hành.")
    c.drawString(50, height - 460, "- Kỹ năng phân tích số liệu và tư duy logic tốt.")

    c.save()
    print(f"File {filename} created successfully!")

if __name__ == "__main__":
    create_pdf("CV_NhanVienTaiChinh_AI_Test.pdf")
