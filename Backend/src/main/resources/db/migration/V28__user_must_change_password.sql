-- V28: Cờ bắt buộc/nhắc đổi mật khẩu khi nhân viên mới đăng nhập lần đầu
ALTER TABLE users
    ADD COLUMN must_change_password BIT(1) NOT NULL DEFAULT b'0';

-- Bật cờ nhắc đổi mật khẩu lần đầu cho các tài khoản nhân viên mới vừa được cấp tự động từ quy trình Onboarding
UPDATE users u
JOIN account_creation_requests acr ON acr.user_id = u.id
SET u.must_change_password = b'1'
WHERE acr.status = 'PROVISIONED';
