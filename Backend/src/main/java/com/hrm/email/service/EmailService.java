package com.hrm.email.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    /**
     * Gửi đồng bộ để outbox chỉ được đánh dấu PUBLISHED sau khi SMTP chấp nhận email.
     * Nếu SMTP lỗi, exception được trả về poller để retry thay vì nuốt lỗi.
     */
    public void sendOfferEmail(String to, String candidateName, String jobTitle,
                               int versionNumber, String responseDeadline, String offerUrl) {
        log.info("Bắt đầu gửi email offer version {} cho: {}", versionNumber, to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject("HRM AI - Đề nghị làm việc vị trí " + safe(jobTitle));

            String htmlContent = """
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.7; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                    <div style="background-color: #2563eb; color: #ffffff; padding: 26px; text-align: center;">
                        <h2 style="margin: 0;">Đề nghị làm việc từ HRM AI</h2>
                    </div>
                    <div style="padding: 32px;">
                        <p>Kính gửi anh/chị <strong>%s</strong>,</p>
                        <p>Chúng tôi trân trọng gửi đến bạn đề nghị làm việc cho vị trí <strong>%s</strong>.</p>
                        <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 22px 0;">
                            <p style="margin: 0 0 6px;"><strong>Phiên bản offer:</strong> %d</p>
                            <p style="margin: 0;"><strong>Hạn phản hồi:</strong> %s</p>
                        </div>
                        <p>Nhấn nút bên dưới để xem đầy đủ nội dung và chọn <strong>Chấp nhận</strong>, <strong>Thương lượng</strong> hoặc <strong>Từ chối</strong>.</p>
                        <p style="text-align: center; margin: 28px 0;">
                            <a href="%s" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; padding: 13px 24px; border-radius: 9px;">Xem và phản hồi offer</a>
                        </p>
                        <p style="font-size: 13px; color: #64748b;">Link này dành riêng cho bạn. Vui lòng không chuyển tiếp cho người khác.</p>
                        <p>Trân trọng,<br/><strong>Bộ phận Tuyển dụng HRM AI</strong></p>
                    </div>
                </body>
                </html>
                """.formatted(
                    safe(candidateName), safe(jobTitle), versionNumber,
                    safe(responseDeadline), safe(offerUrl));
            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Đã gửi email offer version {} thành công cho: {}", versionNumber, to);
        } catch (Exception exception) {
            log.error("Lỗi gửi email offer cho {}: {}", to, exception.getMessage(), exception);
            throw new IllegalStateException("Không thể gửi email offer tới " + to, exception);
        }
    }

    public void sendContractSigningInvitation(String to, String candidateName, String contractNumber,
                                              String expiresAt, String signingUrl) {
        sendHtml(to, "HRM AI - Mời ký hợp đồng " + safe(contractNumber), """
                <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b;max-width:620px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                  <div style="background:#1d4ed8;color:white;padding:26px;text-align:center"><h2 style="margin:0">Mời ký hợp đồng lao động</h2></div>
                  <div style="padding:32px">
                    <p>Kính gửi anh/chị <strong>%s</strong>,</p>
                    <p>Công ty đã phát hành và ký hợp đồng <strong>%s</strong>. Vui lòng mở liên kết bảo mật bên dưới, xác thực OTP qua email và ký hợp đồng.</p>
                    <p><strong>Hạn ký:</strong> %s</p>
                    <p style="text-align:center;margin:28px 0"><a href="%s" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:9px">Xem và ký hợp đồng</a></p>
                    <p style="font-size:13px;color:#64748b">Không chuyển tiếp liên kết này. Hệ thống sẽ yêu cầu mã OTP gửi tới chính email của bạn trước khi ký.</p>
                  </div>
                </div>
                """.formatted(safe(candidateName), safe(contractNumber), safe(expiresAt), safe(signingUrl)));
    }

    public void sendContractSigningOtp(String to, String candidateName, String otp) {
        sendHtml(to, "HRM AI - Mã OTP ký hợp đồng", """
                <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;padding:30px">
                  <h2>Xác thực ký hợp đồng</h2>
                  <p>Xin chào <strong>%s</strong>, mã OTP của bạn là:</p>
                  <div style="font-size:32px;letter-spacing:8px;font-weight:800;text-align:center;background:#eff6ff;color:#1d4ed8;padding:18px;border-radius:10px">%s</div>
                  <p>Mã có hiệu lực trong 10 phút và chỉ dùng một lần. Không cung cấp mã này cho người khác.</p>
                </div>
                """.formatted(safe(candidateName), safe(otp)));
    }

    public void sendContractSignedConfirmation(String to, String candidateName, String contractNumber,
                                               String finalDocumentUrl) {
        sendHtml(to, "HRM AI - Đã ghi nhận chữ ký hợp đồng", """
                <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;padding:30px">
                  <h2 style="color:#047857">Đã hoàn tất ký hợp đồng</h2>
                  <p>Xin chào <strong>%s</strong>, hệ thống đã ghi nhận chữ ký của bạn cho hợp đồng <strong>%s</strong>.</p>
                  <p><a href="%s">Tải bản hợp đồng đã ký bởi hai bên</a></p>
                  <p>Bộ phận Nhân sự sẽ tiếp tục quy trình chuẩn bị nhận việc.</p>
                </div>
                """.formatted(safe(candidateName), safe(contractNumber), safe(finalDocumentUrl)));
    }

    private void sendHtml(String to, String subject, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (Exception exception) {
            log.error("Không thể gửi email {} tới {}: {}", subject, to, exception.getMessage(), exception);
            throw new IllegalStateException("Không thể gửi email tới " + to, exception);
        }
    }

    private String safe(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

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

    @Async
    public void sendChatTagNotification(String to, String receiverName, String senderName, String groupName, String messageContent) {
        log.info("Bắt đầu gửi email thông báo tag cho: {}", to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject("HRM AI - Bạn vừa được nhắc đến trong nhóm " + groupName);

            String htmlContent = """
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; color: #ffffff; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Thông báo Tin nhắn mới</h2>
                    </div>
                    <div style="padding: 30px;">
                        <p>Chào <strong>%s</strong>,</p>
                        <p>Bạn vừa được <strong>%s</strong> nhắc đến trong nhóm thảo luận <strong>%s</strong>.</p>
                        <div style="background-color: #f1f5f9; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
                            <p style="margin: 0; font-style: italic;">"%s"</p>
                        </div>
                        <p>Vui lòng truy cập hệ thống để xem chi tiết và phản hồi.</p>
                        <br/>
                        <p>Trân trọng,</p>
                        <p><strong>Hệ thống HRM AI</strong></p>
                    </div>
                </body>
                </html>
                """.formatted(receiverName, senderName, groupName, messageContent);

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Đã gửi email thông báo tag thành công cho: {}", to);

        } catch (Exception e) {
            log.error("LỖI khi gửi email thông báo tag cho {}: {}", to, e.getMessage(), e);
        }
    }

    @Async
    public void sendInterviewScheduledEmail(String to, String candidateName, String jobTitle,
                                             int round, String scheduledStart, String scheduledEnd,
                                             String mode, String locationOrLink) {
        log.info("Bắt đầu gửi email thông báo lịch phỏng vấn vòng {} cho: {}", round, to);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(to);
            helper.setSubject("HRM AI - Thư mời phỏng vấn vòng " + round + " – " + jobTitle);

            String modeLabel = switch (mode != null ? mode.toUpperCase() : "") {
                case "ONLINE" -> "Trực tuyến (Online)";
                case "ONSITE" -> "Tại văn phòng";
                case "HYBRID" -> "Kết hợp";
                default -> mode != null ? mode : "Chưa xác định";
            };
            String locationLabel = (locationOrLink != null && !locationOrLink.isBlank())
                    ? locationOrLink : "Sẽ được thông báo thêm";

            String htmlContent = """
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.7; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; color: #ffffff; padding: 24px; text-align: center;">
                        <h2 style="margin: 0;">HRM AI – Thư mời phỏng vấn</h2>
                    </div>
                    <div style="padding: 32px;">
                        <p>Kính gửi anh/chị <strong>%s</strong>,</p>
                        <p>Chúng tôi xin trân trọng thông báo rằng bạn đã được <strong>mời tham gia phỏng vấn vòng %d</strong> cho vị trí <strong>%s</strong>.</p>
                        <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 20px 0;">
                            <table style="width: 100%%; border-collapse: collapse;">
                                <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">📅 Thời gian bắt đầu</td><td style="font-weight: bold;">%s</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">⏱ Thời gian kết thúc</td><td style="font-weight: bold;">%s</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">💻 Hình thức</td><td style="font-weight: bold;">%s</td></tr>
                                <tr><td style="padding: 6px 0; color: #64748b;">📍 Địa điểm / Link</td><td style="font-weight: bold;">%s</td></tr>
                            </table>
                        </div>
                        <p>Vui lòng xác nhận tham dự bằng cách phản hồi email này hoặc liên hệ trực tiếp với bộ phận Nhân sự nếu bạn có thắc mắc.</p>
                        <p>Chúc bạn chuẩn bị tốt và buổi phỏng vấn diễn ra thành công!</p>
                        <br/>
                        <p>Trân trọng,</p>
                        <p><strong>Bộ phận Tuyển dụng HRM AI</strong></p>
                    </div>
                    <div style="background-color: #f8fafc; padding: 15px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e0e0e0;">
                        Đây là email tự động từ hệ thống HRM AI. Vui lòng không trả lời email này.
                    </div>
                </body>
                </html>
                """.formatted(
                    candidateName != null ? candidateName : "Ứng viên",
                    round,
                    jobTitle != null ? jobTitle : "Chưa xác định",
                    scheduledStart != null ? scheduledStart : "Chưa xác định",
                    scheduledEnd != null ? scheduledEnd : "Chưa xác định",
                    modeLabel,
                    locationLabel
            );

            helper.setText(htmlContent, true);
            mailSender.send(message);
            log.info("Đã gửi email lịch phỏng vấn vòng {} thành công cho: {}", round, to);

        } catch (Exception e) {
            log.error("LỖI khi gửi email lịch phỏng vấn cho {}: {}", to, e.getMessage(), e);
        }
    }
}
