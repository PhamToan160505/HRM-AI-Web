package com.hrm.email.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Async
    public void sendApprovalEmail(String to, String candidateName, String jobTitle) {
        log.info("Bắt đầu gửi email Trúng tuyển/Mời phỏng vấn cho: {}", to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject("HRM AI - Chúc mừng bạn đã trúng tuyển vị trí " + jobTitle);
            
            String htmlContent = """
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">HRM AI - Thông báo Tuyển dụng</h2>
                    </div>
                    <div style="padding: 30px;">
                        <p>Kính gửi anh/chị <strong>%s</strong>,</p>
                        <p>Lời đầu tiên, thay mặt hệ thống <strong>HRM AI</strong>, chúng tôi xin cảm ơn bạn đã quan tâm và ứng tuyển vào vị trí <strong>%s</strong>.</p>
                        <p>Chúng tôi rất ấn tượng với năng lực và kinh nghiệm của bạn. Xin chúc mừng bạn đã vượt qua các vòng đánh giá và chính thức được chọn cho vị trí này!</p>
                        <p>Phòng Nhân sự sẽ sớm liên hệ trực tiếp với bạn qua điện thoại để trao đổi về chế độ đãi ngộ, ngày nhận việc cũng như các thủ tục cần thiết tiếp theo.</p>
                        <p>Một lần nữa, chúc mừng bạn và hẹn gặp lại bạn tại văn phòng công ty!</p>
                        <br/>
                        <p>Trân trọng,</p>
                        <p><strong>Bộ phận Tuyển dụng HRM AI</strong></p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e0e0e0;">
                        Đây là email tự động từ hệ thống HRM AI. Vui lòng không trả lời email này.
                    </div>
                </body>
                </html>
                """.formatted(candidateName != null ? candidateName : "Ứng viên", jobTitle != null ? jobTitle : "Chưa xác định");

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Đã gửi email Trúng tuyển thành công cho: {}", to);
            
        } catch (Exception e) {
            log.error("LỖI khi gửi email Trúng tuyển cho {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    public void sendRejectionEmail(String to, String candidateName, String jobTitle) {
        log.info("Bắt đầu gửi email Cảm ơn (Từ chối) cho: {}", to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject("HRM AI - Phản hồi kết quả ứng tuyển vị trí " + jobTitle);

            String htmlContent = """
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">HRM AI - Thông báo Tuyển dụng</h2>
                    </div>
                    <div style="padding: 30px;">
                        <p>Kính gửi anh/chị <strong>%s</strong>,</p>
                        <p>Cảm ơn bạn đã quan tâm và dành thời gian ứng tuyển vào vị trí <strong>%s</strong> tại công ty chúng tôi.</p>
                        <p>Chúng tôi đánh giá cao kinh nghiệm và kỹ năng của bạn. Tuy nhiên, sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng hồ sơ của bạn chưa hoàn toàn phù hợp với định hướng hiện tại của vị trí này.</p>
                        <p>Chúng tôi sẽ lưu trữ hồ sơ của bạn vào hệ thống dữ liệu ứng viên tiềm năng và sẽ chủ động liên hệ lại với bạn nếu có vị trí khác phù hợp hơn trong tương lai.</p>
                        <p>Chúc bạn nhiều sức khỏe và gặt hái được nhiều thành công trên con đường sự nghiệp của mình.</p>
                        <br/>
                        <p>Trân trọng,</p>
                        <p><strong>Bộ phận Tuyển dụng HRM AI</strong></p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e0e0e0;">
                        Đây là email tự động từ hệ thống HRM AI. Vui lòng không trả lời email này.
                    </div>
                </body>
                </html>
                """.formatted(candidateName != null ? candidateName : "Ứng viên", jobTitle != null ? jobTitle : "Chưa xác định");

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Đã gửi email Cảm ơn thành công cho: {}", to);

        } catch (Exception e) {
            log.error("LỖI khi gửi email Cảm ơn (Từ chối) cho {}: {}", to, e.getMessage(), e);
        }
    }
    @Async
    public void sendAccountInfo(String to, String fullName, String maNhanVien, String rawPassword) {
        log.info("Bắt đầu gửi email thông báo tài khoản cho: {}", to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject("HRM AI - Thông tin tài khoản đăng nhập hệ thống");

            String htmlContent = """
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">HRM AI - Chào mừng nhân sự mới</h2>
                    </div>
                    <div style="padding: 30px;">
                        <p>Kính gửi anh/chị <strong>%s</strong>,</p>
                        <p>Tài khoản của bạn đã được quản trị viên cấp phát thành công. Dưới đây là thông tin đăng nhập vào hệ thống HRM AI:</p>
                        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Tài khoản (Mã nhân viên):</strong> <span style="color: #2563eb; font-size: 18px; font-weight: bold;">%s</span></p>
                            <p style="margin: 10px 0 0 0;"><strong>Mật khẩu:</strong> <span style="font-family: monospace; background: #e2e8f0; padding: 3px 8px; border-radius: 4px;">%s</span></p>
                        </div>
                        <p>Vui lòng đăng nhập và đổi mật khẩu trong lần đầu tiên truy cập để đảm bảo bảo mật.</p>
                        <br/>
                        <p>Trân trọng,</p>
                        <p><strong>Ban Quản trị Hệ thống HRM AI</strong></p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e0e0e0;">
                        Đây là email tự động từ hệ thống HRM AI. Vui lòng không trả lời email này.
                    </div>
                </body>
                </html>
                """.formatted(fullName, maNhanVien, rawPassword);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Đã gửi email thông báo tài khoản thành công cho: {}", to);

        } catch (Exception e) {
            log.error("LỖI khi gửi email thông báo tài khoản cho {}: {}", to, e.getMessage(), e);
        }
    }
}
