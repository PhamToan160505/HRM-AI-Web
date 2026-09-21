-- HRM AI - Dữ liệu demo được ghi trực tiếp vào MySQL
-- Mục tiêu: bổ sung dữ liệu có liên kết nghiệp vụ, không hardcode ở frontend.
-- Script idempotent: có thể chạy lại mà không nhân đôi các bản ghi seed chính.

SET NAMES utf8mb4;
USE hrm_db;

START TRANSACTION;

SET @seed_now = NOW();
SET @seed_today = CURDATE();
SET @seed_month = MONTH(CURDATE());
SET @seed_year = YEAR(CURDATE());

-- ================================================================
-- 1. PHÒNG BAN
-- ================================================================

INSERT INTO departments (created_at, ten_phong, mo_ta, is_lock)
SELECT @seed_now, seed.ten_phong, seed.mo_ta, b'0'
FROM (
    SELECT 'Kinh doanh' AS ten_phong, 'Phụ trách phát triển khách hàng, doanh thu và quan hệ đối tác.' AS mo_ta
    UNION ALL SELECT 'Marketing', 'Phụ trách thương hiệu, truyền thông và hoạt động tiếp thị đa kênh.'
    UNION ALL SELECT 'Tài chính - Kế toán', 'Quản lý ngân sách, kế toán, thuế và báo cáo tài chính doanh nghiệp.'
    UNION ALL SELECT 'Vận hành', 'Điều phối quy trình vận hành và bảo đảm chất lượng dịch vụ nội bộ.'
    UNION ALL SELECT 'Chăm sóc khách hàng', 'Tiếp nhận, hỗ trợ và duy trì trải nghiệm tích cực cho khách hàng.'
    UNION ALL SELECT 'Sản phẩm', 'Nghiên cứu nhu cầu và phát triển lộ trình sản phẩm của doanh nghiệp.'
    UNION ALL SELECT 'Pháp chế', 'Tư vấn pháp lý, quản trị hợp đồng và kiểm soát tuân thủ.'
    UNION ALL SELECT 'Hành chính', 'Quản lý hành chính, cơ sở vật chất và hậu cần văn phòng.'
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM departments d WHERE d.ten_phong = seed.ten_phong
);

-- ================================================================
-- 2. NGƯỜI DÙNG
-- Tài khoản seed dùng cùng mật khẩu đã mã hóa của tài khoản Admin demo.
-- ================================================================

INSERT INTO users (
    active, created_at, department_id, email, ho_ten, avatar_url,
    password_hash, role, cccd, cccd_back_public_id, cccd_front_public_id,
    dia_chi, ngay_cap_cccd, ngay_sinh, noi_cap_cccd, phone, que_quan,
    chuc_vu, allowance, base_salary, so_nguoi_phu_thuoc, ma_nhan_vien, team_id
)
SELECT
    b'1', @seed_now, d.id, seed.email, seed.ho_ten, NULL,
    credential.password_hash, seed.role_name, seed.cccd, NULL, NULL,
    seed.dia_chi, seed.ngay_cap_cccd, seed.ngay_sinh, seed.noi_cap_cccd,
    seed.phone, seed.que_quan, seed.chuc_vu, seed.allowance_amount,
    seed.base_salary_amount, seed.dependents, seed.ma_nhan_vien, NULL
FROM (
    SELECT 'Kinh doanh' AS department_name, 'quan.nguyen@hrm.local' AS email,
           'Nguyễn Minh Quân' AS ho_ten, 'GIAM_DOC_PHONG_BAN' AS role_name,
           '079090000301' AS cccd, '12 Nguyễn Huệ, Phường Sài Gòn, TP. Hồ Chí Minh' AS dia_chi,
           '2022-03-18' AS ngay_cap_cccd, '1990-03-15' AS ngay_sinh,
           'Cục Cảnh sát QLHC về TTXH' AS noi_cap_cccd, '0901000301' AS phone,
           'TP. Hồ Chí Minh' AS que_quan, 'Giám đốc Kinh doanh' AS chuc_vu,
           8000000 AS allowance_amount, 45000000 AS base_salary_amount, 2 AS dependents,
           '88000003' AS ma_nhan_vien
    UNION ALL SELECT 'Marketing', 'ha.tran@hrm.local', 'Trần Thu Hà', 'GIAM_DOC_PHONG_BAN',
           '001091000402', '28 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', '2021-07-09', '1991-07-22',
           'Cục Cảnh sát QLHC về TTXH', '0901000402', 'Hà Nội', 'Giám đốc Marketing',
           7000000, 42000000, 1, '88000004'
    UNION ALL SELECT 'Tài chính - Kế toán', 'nam.le@hrm.local', 'Lê Hoàng Nam', 'GIAM_DOC_PHONG_BAN',
           '048089000503', '45 Bạch Đằng, Hải Châu, Đà Nẵng', '2020-11-12', '1989-11-05',
           'Cục Cảnh sát QLHC về TTXH', '0901000503', 'Đà Nẵng', 'Giám đốc Tài chính',
           9000000, 48000000, 2, '88000005'
    UNION ALL SELECT 'Kinh doanh', 'huy.pham@hrm.local', 'Phạm Quốc Huy', 'TRUONG_PHONG',
           '079093000311', '90 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh', '2022-05-20', '1993-01-12',
           'Cục Cảnh sát QLHC về TTXH', '0902000311', 'Bình Dương', 'Trưởng phòng Kinh doanh',
           5000000, 30000000, 1, '03000001'
    UNION ALL SELECT 'Marketing', 'lan.vu@hrm.local', 'Vũ Ngọc Lan', 'TRUONG_PHONG',
           '001094000412', '15 Láng Hạ, Đống Đa, Hà Nội', '2021-08-16', '1994-06-18',
           'Cục Cảnh sát QLHC về TTXH', '0902000412', 'Hải Phòng', 'Trưởng phòng Marketing',
           4000000, 28000000, 0, '04000001'
    UNION ALL SELECT 'Tài chính - Kế toán', 'binh.do@hrm.local', 'Đỗ Thanh Bình', 'TRUONG_PHONG',
           '048092000513', '62 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', '2020-09-04', '1992-09-27',
           'Cục Cảnh sát QLHC về TTXH', '0902000513', 'Quảng Nam', 'Trưởng phòng Kế toán',
           5000000, 32000000, 2, '05000001'
    UNION ALL SELECT 'Vận hành', 'tuan.nguyen@hrm.local', 'Nguyễn Anh Tuấn', 'TRUONG_PHONG',
           '079093000614', '120 Cộng Hòa, Tân Bình, TP. Hồ Chí Minh', '2022-02-11', '1993-12-03',
           'Cục Cảnh sát QLHC về TTXH', '0902000614', 'Đồng Nai', 'Trưởng phòng Vận hành',
           4500000, 29000000, 1, '06000001'
    UNION ALL SELECT 'Chăm sóc khách hàng', 'linh.luong@hrm.local', 'Lương Mỹ Linh', 'TRUONG_PHONG',
           '079095000715', '33 Phan Xích Long, Phú Nhuận, TP. Hồ Chí Minh', '2023-04-21', '1995-04-09',
           'Cục Cảnh sát QLHC về TTXH', '0902000715', 'Long An', 'Trưởng phòng Chăm sóc khách hàng',
           3500000, 26000000, 0, '07000001'
    UNION ALL SELECT 'Sản phẩm', 'minh.phan@hrm.local', 'Phan Nhật Minh', 'TRUONG_PHONG',
           '079092000816', '18 Nguyễn Đình Chiểu, Quận 3, TP. Hồ Chí Minh', '2021-12-02', '1992-02-14',
           'Cục Cảnh sát QLHC về TTXH', '0902000816', 'TP. Hồ Chí Minh', 'Trưởng phòng Sản phẩm',
           5000000, 34000000, 1, '08000001'
    UNION ALL SELECT 'Pháp chế', 'trang.do@hrm.local', 'Đỗ Thu Trang', 'TRUONG_PHONG',
           '001093000917', '77 Kim Mã, Ba Đình, Hà Nội', '2022-10-10', '1993-10-30',
           'Cục Cảnh sát QLHC về TTXH', '0902000917', 'Hà Nội', 'Trưởng phòng Pháp chế',
           4500000, 33000000, 0, '09000001'
    UNION ALL SELECT 'Hành chính', 'quanghuy.trinh@hrm.local', 'Trịnh Quang Huy', 'TRUONG_PHONG',
           '079094001018', '55 Hoàng Văn Thụ, Phú Nhuận, TP. Hồ Chí Minh', '2022-06-14', '1994-08-25',
           'Cục Cảnh sát QLHC về TTXH', '0902001018', 'Tây Ninh', 'Trưởng phòng Hành chính',
           3500000, 25000000, 1, '10000001'
    UNION ALL SELECT 'Kinh doanh', 'yen.nguyen@hrm.local', 'Nguyễn Hải Yến', 'NHAN_VIEN',
           '079098000321', '101 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh', '2023-03-08', '1998-05-16',
           'Cục Cảnh sát QLHC về TTXH', '0903000321', 'Bến Tre', 'Chuyên viên Kinh doanh',
           2000000, 15000000, 0, '03000002'
    UNION ALL SELECT 'Marketing', 'ducanh.tran@hrm.local', 'Trần Đức Anh', 'NHAN_VIEN',
           '001097000422', '40 Nguyễn Trãi, Thanh Xuân, Hà Nội', '2023-01-19', '1997-09-11',
           'Cục Cảnh sát QLHC về TTXH', '0903000422', 'Nam Định', 'Chuyên viên Nội dung',
           2000000, 16000000, 0, '04000002'
    UNION ALL SELECT 'Tài chính - Kế toán', 'mai.le@hrm.local', 'Lê Ngọc Mai', 'NHAN_VIEN',
           '048096000523', '29 Hàm Nghi, Thanh Khê, Đà Nẵng', '2022-12-09', '1996-12-21',
           'Cục Cảnh sát QLHC về TTXH', '0903000523', 'Huế', 'Kế toán viên',
           2500000, 18000000, 1, '05000002'
) AS seed
JOIN departments d ON d.ten_phong = seed.department_name
CROSS JOIN (
    SELECT password_hash FROM users ORDER BY (role = 'ADMIN') DESC, id LIMIT 1
) AS credential
WHERE NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.email = seed.email OR u.ma_nhan_vien = seed.ma_nhan_vien
);

-- ================================================================
-- 3. YÊU CẦU TUYỂN DỤNG
-- ================================================================

INSERT INTO job_requisitions (
    approver_id, budget, cap_bac, created_at, department_id, description,
    hinh_thuc_lam_viec, reason, rejection_reason, requester_id, requirements,
    so_luong, status, target_role, title, updated_at
)
SELECT
    approver.id, seed.budget, seed.cap_bac,
    TIMESTAMPADD(DAY, -seed.days_ago, @seed_now), d.id, seed.description,
    seed.work_type, seed.reason, seed.rejection_reason, requester.id,
    seed.requirements, seed.quantity, seed.req_status, seed.target_role,
    seed.title, TIMESTAMPADD(DAY, -seed.days_ago + 1, @seed_now)
FROM (
    SELECT 'Chuyên viên Tuyển dụng' AS title, 'Nhân sự' AS department_name,
           'truongphong@hrm.vn' AS requester_email, 'ceo@hrm.vn' AS approver_email,
           '18.000.000 - 25.000.000 VNĐ' AS budget, 'Chuyên viên (Mid-level)' AS cap_bac,
           'Phụ trách toàn bộ quy trình tìm nguồn, sàng lọc, phỏng vấn và chăm sóc ứng viên.' AS description,
           'Toàn thời gian (Full-time)' AS work_type,
           'Khối lượng tuyển dụng tăng và cần bổ sung nhân sự chuyên trách để bảo đảm tiến độ.' AS reason,
           NULL AS rejection_reason,
           'Có tối thiểu hai năm kinh nghiệm tuyển dụng, giao tiếp tốt và sử dụng thành thạo công cụ quản lý hồ sơ.' AS requirements,
           2 AS quantity, 'POSTED' AS req_status, 'NHAN_VIEN' AS target_role, 32 AS days_ago
    UNION ALL SELECT 'Lập trình viên Backend', 'Kỹ thuật', 'giamdocphong@hrm.vn', 'ceo@hrm.vn',
           '25.000.000 - 38.000.000 VNĐ', 'Chuyên viên (Mid-level)',
           'Phát triển API, tối ưu truy vấn dữ liệu và bảo đảm an toàn cho các dịch vụ backend.',
           'Linh hoạt (Hybrid)',
           'Sản phẩm mở rộng thêm nhiều phân hệ nên cần tăng năng lực phát triển backend.', NULL,
           'Thành thạo Java, Spring Boot, MySQL, REST API và có kinh nghiệm viết kiểm thử tự động.',
           3, 'POSTED', 'NHAN_VIEN', 30
    UNION ALL SELECT 'Chuyên viên Kinh doanh B2B', 'Kinh doanh', 'huy.pham@hrm.local', 'ceo@hrm.vn',
           '15.000.000 - 30.000.000 VNĐ', 'Nhân viên (Junior)',
           'Tìm kiếm khách hàng doanh nghiệp, tư vấn giải pháp và theo dõi cơ hội bán hàng đến khi ký hợp đồng.',
           'Toàn thời gian (Full-time)',
           'Doanh nghiệp mở rộng thị trường phía Nam và cần tăng độ phủ đội ngũ kinh doanh.', NULL,
           'Có kỹ năng giao tiếp, đàm phán, quản lý cơ hội bán hàng và chủ động đạt mục tiêu doanh số.',
           4, 'POSTED', 'NHAN_VIEN', 27
    UNION ALL SELECT 'Chuyên viên Digital Marketing', 'Marketing', 'lan.vu@hrm.local', 'ceo@hrm.vn',
           '16.000.000 - 24.000.000 VNĐ', 'Chuyên viên (Mid-level)',
           'Lập kế hoạch nội dung, vận hành quảng cáo và phân tích hiệu quả các kênh truyền thông số.',
           'Linh hoạt (Hybrid)',
           'Cần triển khai chiến dịch thương hiệu mới và tăng lượng khách hàng tiềm năng trực tuyến.', NULL,
           'Có kinh nghiệm quảng cáo số, phân tích dữ liệu, viết nội dung và quản lý ngân sách chiến dịch.',
           2, 'POSTED', 'NHAN_VIEN', 25
    UNION ALL SELECT 'Kế toán Tổng hợp', 'Tài chính - Kế toán', 'binh.do@hrm.local', 'ceo@hrm.vn',
           '18.000.000 - 26.000.000 VNĐ', 'Chuyên viên (Mid-level)',
           'Hạch toán nghiệp vụ, lập báo cáo định kỳ và phối hợp thực hiện các nghĩa vụ thuế của doanh nghiệp.',
           'Toàn thời gian (Full-time)',
           'Khối lượng giao dịch tăng và cần tăng cường kiểm soát số liệu kế toán hàng tháng.', NULL,
           'Tốt nghiệp tài chính kế toán, nắm vững chuẩn mực kế toán và sử dụng tốt phần mềm kế toán.',
           2, 'POSTED', 'NHAN_VIEN', 23
    UNION ALL SELECT 'Chuyên viên Vận hành', 'Vận hành', 'tuan.nguyen@hrm.local', 'ceo@hrm.vn',
           '16.000.000 - 22.000.000 VNĐ', 'Nhân viên (Junior)',
           'Theo dõi quy trình dịch vụ, xử lý sự cố và phối hợp các phòng ban để duy trì hoạt động ổn định.',
           'Toàn thời gian (Full-time)',
           'Số lượng quy trình vận hành tăng nhanh và cần người theo dõi chất lượng chuyên trách.', NULL,
           'Tư duy hệ thống, xử lý vấn đề tốt, thành thạo bảng tính và có khả năng phối hợp đa phòng ban.',
           3, 'POSTED', 'NHAN_VIEN', 21
    UNION ALL SELECT 'Nhân viên Chăm sóc Khách hàng', 'Chăm sóc khách hàng', 'linh.luong@hrm.local', 'ceo@hrm.vn',
           '13.000.000 - 18.000.000 VNĐ', 'Nhân viên (Junior)',
           'Tiếp nhận yêu cầu, hướng dẫn sử dụng sản phẩm và theo dõi mức độ hài lòng của khách hàng.',
           'Toàn thời gian (Full-time)',
           'Lượng khách hàng mới tăng và cần bảo đảm thời gian phản hồi theo cam kết dịch vụ.', NULL,
           'Giọng nói rõ ràng, giao tiếp tích cực, kiên nhẫn và sử dụng tốt các công cụ chăm sóc khách hàng.',
           4, 'POSTED', 'NHAN_VIEN', 19
    UNION ALL SELECT 'Product Owner', 'Sản phẩm', 'minh.phan@hrm.local', 'ceo@hrm.vn',
           '30.000.000 - 45.000.000 VNĐ', 'Chuyên viên cao cấp (Senior)',
           'Xây dựng lộ trình sản phẩm, quản lý backlog và phối hợp với kỹ thuật để bàn giao tính năng.',
           'Linh hoạt (Hybrid)',
           'Cần một đầu mối chịu trách nhiệm ưu tiên nhu cầu và đo lường hiệu quả sản phẩm.', NULL,
           'Có kinh nghiệm phát triển sản phẩm số, phân tích nghiệp vụ và làm việc theo phương pháp Agile.',
           1, 'POSTED', 'NHAN_VIEN', 17
    UNION ALL SELECT 'Chuyên viên Pháp chế', 'Pháp chế', 'trang.do@hrm.local', 'ceo@hrm.vn',
           '20.000.000 - 30.000.000 VNĐ', 'Chuyên viên (Mid-level)',
           'Rà soát hợp đồng, tư vấn quy định pháp luật và theo dõi các nghĩa vụ tuân thủ của doanh nghiệp.',
           'Toàn thời gian (Full-time)',
           'Số lượng hợp đồng đối tác tăng và cần kiểm soát rủi ro pháp lý chặt chẽ hơn.', NULL,
           'Tốt nghiệp luật, có kinh nghiệm hợp đồng thương mại và kỹ năng nghiên cứu văn bản pháp luật.',
           2, 'POSTED', 'NHAN_VIEN', 15
    UNION ALL SELECT 'Chuyên viên Hành chính', 'Hành chính', 'quanghuy.trinh@hrm.local', 'ceo@hrm.vn',
           '13.000.000 - 18.000.000 VNĐ', 'Nhân viên (Junior)',
           'Quản lý văn phòng phẩm, hồ sơ hành chính và hỗ trợ tổ chức các hoạt động nội bộ.',
           'Toàn thời gian (Full-time)',
           'Nhu cầu vận hành văn phòng tăng nhưng ngân sách tuyển dụng chưa được phê duyệt.',
           'Ưu tiên điều chuyển nhân sự nội bộ trước khi mở thêm vị trí mới.',
           'Cẩn thận, giao tiếp tốt, thành thạo tin học văn phòng và có khả năng tổ chức công việc.',
           1, 'REJECTED', 'NHAN_VIEN', 13
    UNION ALL SELECT 'Trưởng nhóm Kinh doanh', 'Kinh doanh', 'quan.nguyen@hrm.local', 'ceo@hrm.vn',
           '28.000.000 - 40.000.000 VNĐ', 'Quản lý (Manager)',
           'Quản lý nhóm bán hàng, huấn luyện nhân viên và chịu trách nhiệm về kế hoạch doanh thu khu vực.',
           'Toàn thời gian (Full-time)',
           'Đội ngũ kinh doanh mở rộng nên cần bổ sung cấp quản lý trung gian có kinh nghiệm.', NULL,
           'Có tối thiểu ba năm quản lý bán hàng B2B, kỹ năng huấn luyện và lập kế hoạch doanh số.',
           1, 'POSTED', 'TRUONG_PHONG', 11
    UNION ALL SELECT 'Giám đốc Sản phẩm', 'Sản phẩm', 'minh.phan@hrm.local', NULL,
           '55.000.000 - 75.000.000 VNĐ', 'Giám đốc (Director)',
           'Định hướng chiến lược sản phẩm, quản lý danh mục sáng kiến và phát triển đội ngũ sản phẩm.',
           'Linh hoạt (Hybrid)',
           'Doanh nghiệp cần củng cố năng lực lãnh đạo sản phẩm cho giai đoạn mở rộng tiếp theo.', NULL,
           'Có kinh nghiệm lãnh đạo sản phẩm số, xây dựng chiến lược và quản trị đội ngũ đa chức năng.',
           1, 'PENDING_CEO', 'GIAM_DOC_PHONG_BAN', 9
) AS seed
JOIN departments d ON d.ten_phong = seed.department_name
JOIN users requester ON requester.email = seed.requester_email
LEFT JOIN users approver ON approver.email = seed.approver_email
WHERE NOT EXISTS (
    SELECT 1 FROM job_requisitions jr
    WHERE jr.title = seed.title AND jr.requester_id = requester.id
);

-- ================================================================
-- 4. CHIẾN DỊCH TUYỂN DỤNG
-- ================================================================

INSERT INTO job_postings (
    co_thoa_thuan, so_luong_tuyen, created_at, han_nop_ho_so, ngay_bat_dau,
    updated_at, description, dia_diem, muc_luong, quyen_loi, requirements,
    slug, status, title, cap_bac, hinh_thuc_lam_viec, department_id,
    job_requisition_id, target_role
)
SELECT
    seed.negotiable, jr.so_luong, jr.created_at,
    DATE_ADD(@seed_now, INTERVAL seed.deadline_days DAY),
    DATE_ADD(@seed_now, INTERVAL 7 DAY), @seed_now,
    jr.description, seed.location_name, jr.budget, seed.benefits,
    jr.requirements, seed.slug, seed.job_status, jr.title, jr.cap_bac,
    jr.hinh_thuc_lam_viec, jr.department_id, jr.id, jr.target_role
FROM (
    SELECT 'Chuyên viên Tuyển dụng' AS requisition_title, 'chuyen-vien-tuyen-dung-2026' AS slug,
           'OPEN' AS job_status, 'TP. Hồ Chí Minh' AS location_name, b'0' AS negotiable,
           28 AS deadline_days, 'Thưởng hiệu suất, bảo hiểm đầy đủ, đào tạo chuyên môn và 14 ngày phép năm.' AS benefits
    UNION ALL SELECT 'Lập trình viên Backend', 'lap-trinh-vien-backend-2026', 'OPEN', 'TP. Hồ Chí Minh', b'1', 35,
           'Thiết bị làm việc hiện đại, ngân sách học tập, bảo hiểm sức khỏe và làm việc linh hoạt.'
    UNION ALL SELECT 'Chuyên viên Kinh doanh B2B', 'chuyen-vien-kinh-doanh-b2b-2026', 'OPEN', 'TP. Hồ Chí Minh', b'1', 24,
           'Hoa hồng theo doanh số, thưởng quý, phụ cấp gặp khách hàng và lộ trình thăng tiến rõ ràng.'
    UNION ALL SELECT 'Chuyên viên Digital Marketing', 'digital-marketing-specialist-2026', 'OPEN', 'Hà Nội', b'0', 30,
           'Ngân sách chứng chỉ chuyên môn, thưởng chiến dịch, bảo hiểm và hoạt động gắn kết hàng quý.'
    UNION ALL SELECT 'Kế toán Tổng hợp', 'ke-toan-tong-hop-2026', 'OPEN', 'Đà Nẵng', b'0', 27,
           'Thưởng tháng mười ba, bảo hiểm đầy đủ, khám sức khỏe và hỗ trợ đào tạo nghiệp vụ thuế.'
    UNION ALL SELECT 'Chuyên viên Vận hành', 'chuyen-vien-van-hanh-2026', 'CLOSED', 'TP. Hồ Chí Minh', b'0', 18,
           'Phụ cấp ăn trưa, điện thoại, thưởng chất lượng và chương trình phát triển năng lực nội bộ.'
    UNION ALL SELECT 'Nhân viên Chăm sóc Khách hàng', 'nhan-vien-cham-soc-khach-hang-2026', 'OPEN', 'TP. Hồ Chí Minh', b'0', 25,
           'Phụ cấp ca làm việc, thưởng dịch vụ, bảo hiểm và đào tạo kỹ năng chăm sóc khách hàng.'
    UNION ALL SELECT 'Product Owner', 'product-owner-2026', 'OPEN', 'TP. Hồ Chí Minh', b'1', 32,
           'Quyền chọn làm việc linh hoạt, ngân sách nghiên cứu người dùng và thưởng theo kết quả sản phẩm.'
    UNION ALL SELECT 'Chuyên viên Pháp chế', 'chuyen-vien-phap-che-2026', 'CLOSED', 'Hà Nội', b'0', 20,
           'Bảo hiểm sức khỏe, hỗ trợ chứng chỉ nghề nghiệp và ngân sách cập nhật văn bản pháp luật.'
    UNION ALL SELECT 'Trưởng nhóm Kinh doanh', 'truong-nhom-kinh-doanh-2026', 'OPEN', 'TP. Hồ Chí Minh', b'1', 36,
           'Thưởng quản lý theo doanh số đội nhóm, phụ cấp công tác và chương trình đào tạo lãnh đạo.'
) AS seed
JOIN job_requisitions jr ON jr.title = seed.requisition_title AND jr.status = 'POSTED'
WHERE NOT EXISTS (
    SELECT 1 FROM job_postings jp WHERE jp.slug = seed.slug
);

-- ================================================================
-- 5. HỒ SƠ ỨNG VIÊN
-- ================================================================

INSERT INTO applications (
    fit_score, fraud_flagged, created_at, job_posting_id, updated_at,
    cccd_url, cv_url, email, extracted_data, full_name, phone, raw_cv_text,
    approval_status, is_priority, needs_verification, hr_review_feedback,
    hr_reviewer, interview1feedback, interview1reviewer, interview2feedback,
    interview2reviewer, offer_details, rejection_reason, rejector_name,
    tech_review_feedback, tech_reviewer
)
SELECT
    seed.fit_score, seed.fraud_flagged,
    TIMESTAMPADD(DAY, -seed.days_ago, @seed_now), jp.id,
    TIMESTAMPADD(DAY, -seed.days_ago + 1, @seed_now),
    NULL, NULL, seed.email,
    JSON_OBJECT(
        'education', seed.education,
        'experienceYears', seed.experience_years,
        'skills', JSON_ARRAY(seed.skill_1, seed.skill_2, seed.skill_3),
        'source', 'demo-seed'
    ),
    seed.full_name, seed.phone,
    CONCAT(seed.full_name, ' có ', seed.experience_years, ' năm kinh nghiệm. Kỹ năng chính gồm ',
           seed.skill_1, ', ', seed.skill_2, ' và ', seed.skill_3, '. ', seed.education, '.'),
    seed.approval_status, seed.is_priority, seed.needs_verification,
    CASE WHEN seed.approval_status IN (
        'PENDING_TECH_CV_REVIEW', 'PENDING_INTERVIEW_1', 'PENDING_CEO_EVALUATION',
        'PENDING_INTERVIEW_2', 'PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL',
        'OFFER_APPROVED', 'REJECTED'
    ) THEN 'Hồ sơ đáp ứng yêu cầu cơ bản và có kinh nghiệm liên quan đến vị trí.' ELSE NULL END,
    CASE WHEN seed.approval_status IN (
        'PENDING_TECH_CV_REVIEW', 'PENDING_INTERVIEW_1', 'PENDING_CEO_EVALUATION',
        'PENDING_INTERVIEW_2', 'PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL',
        'OFFER_APPROVED', 'REJECTED'
    ) THEN 'Trần Thị Trưởng Phòng - Trưởng phòng Nhân sự' ELSE NULL END,
    CASE WHEN seed.approval_status IN (
        'PENDING_CEO_EVALUATION', 'PENDING_INTERVIEW_2', 'PENDING_HR_OFFER',
        'PENDING_OFFER_APPROVAL', 'OFFER_APPROVED'
    ) THEN 'Ứng viên trình bày rõ ràng, xử lý tình huống tốt và phù hợp văn hóa.' ELSE NULL END,
    CASE WHEN seed.approval_status IN (
        'PENDING_CEO_EVALUATION', 'PENDING_INTERVIEW_2', 'PENDING_HR_OFFER',
        'PENDING_OFFER_APPROVAL', 'OFFER_APPROVED'
    ) THEN 'Phạm Quốc Huy - Trưởng phòng Kinh doanh' ELSE NULL END,
    CASE WHEN seed.approval_status IN ('PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL', 'OFFER_APPROVED')
         THEN 'Ứng viên đạt yêu cầu vòng cuối và thống nhất được thời gian nhận việc.' ELSE NULL END,
    CASE WHEN seed.approval_status IN ('PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL', 'OFFER_APPROVED')
         THEN 'Nguyễn Minh Quân - Giám đốc Kinh doanh' ELSE NULL END,
    CASE WHEN seed.approval_status IN ('PENDING_OFFER_APPROVAL', 'OFFER_APPROVED')
         THEN CONCAT('Mức lương đề xuất phù hợp khung tuyển dụng của vị trí ', jp.title, '.') ELSE NULL END,
    CASE WHEN seed.approval_status = 'REJECTED'
         THEN 'Kinh nghiệm thực tế chưa đáp ứng mức độ chuyên sâu mà vị trí yêu cầu.' ELSE NULL END,
    CASE WHEN seed.approval_status = 'REJECTED'
         THEN 'Trần Thị Trưởng Phòng - Trưởng phòng Nhân sự' ELSE NULL END,
    CASE WHEN seed.approval_status IN (
        'PENDING_INTERVIEW_1', 'PENDING_CEO_EVALUATION', 'PENDING_INTERVIEW_2',
        'PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL', 'OFFER_APPROVED', 'REJECTED'
    ) THEN 'Năng lực chuyên môn phù hợp, cần kiểm tra thêm qua bài tập tình huống.' ELSE NULL END,
    CASE WHEN seed.approval_status IN (
        'PENDING_INTERVIEW_1', 'PENDING_CEO_EVALUATION', 'PENDING_INTERVIEW_2',
        'PENDING_HR_OFFER', 'PENDING_OFFER_APPROVAL', 'OFFER_APPROVED', 'REJECTED'
    ) THEN 'Quản lý chuyên môn phụ trách vị trí' ELSE NULL END
FROM (
    SELECT 'chuyen-vien-tuyen-dung-2026' AS job_slug, 'Nguyễn Thảo Vy' AS full_name,
           'candidate01@hrm-demo.local' AS email, '0911000001' AS phone, 88 AS fit_score,
           b'0' AS fraud_flagged, 'OFFER_APPROVED' AS approval_status, b'1' AS is_priority,
           b'0' AS needs_verification, 'Đại học Kinh tế TP. Hồ Chí Minh' AS education,
           4 AS experience_years, 'Tuyển dụng' AS skill_1, 'Phỏng vấn' AS skill_2,
           'Quản trị ATS' AS skill_3, 20 AS days_ago
    UNION ALL SELECT 'lap-trinh-vien-backend-2026', 'Trần Minh Đức', 'candidate02@hrm-demo.local', '0911000002', 92, b'0', 'OFFER_APPROVED', b'1', b'0', 'Đại học Bách khoa TP. Hồ Chí Minh', 5, 'Java', 'Spring Boot', 'MySQL', 19
    UNION ALL SELECT 'chuyen-vien-kinh-doanh-b2b-2026', 'Lê Hoài An', 'candidate03@hrm-demo.local', '0911000003', 85, b'0', 'OFFER_APPROVED', b'0', b'0', 'Đại học Ngoại thương', 3, 'Bán hàng B2B', 'Đàm phán', 'CRM', 18
    UNION ALL SELECT 'digital-marketing-specialist-2026', 'Phạm Khánh Ngọc', 'candidate04@hrm-demo.local', '0911000004', 90, b'0', 'OFFER_APPROVED', b'1', b'0', 'Đại học Kinh tế Quốc dân', 4, 'Google Ads', 'Phân tích dữ liệu', 'Content Marketing', 17
    UNION ALL SELECT 'ke-toan-tong-hop-2026', 'Võ Thành Long', 'candidate05@hrm-demo.local', '0911000005', 87, b'0', 'OFFER_APPROVED', b'0', b'0', 'Đại học Kinh tế Đà Nẵng', 5, 'Kế toán tổng hợp', 'Thuế', 'MISA', 16
    UNION ALL SELECT 'chuyen-vien-van-hanh-2026', 'Bùi Ngọc Hân', 'candidate06@hrm-demo.local', '0911000006', 83, b'0', 'OFFER_APPROVED', b'0', b'0', 'Đại học Công nghiệp TP. Hồ Chí Minh', 3, 'Vận hành', 'Lean', 'Excel', 15
    UNION ALL SELECT 'nhan-vien-cham-soc-khach-hang-2026', 'Đặng Tuấn Kiệt', 'candidate07@hrm-demo.local', '0911000007', 82, b'0', 'OFFER_APPROVED', b'0', b'0', 'Đại học Mở TP. Hồ Chí Minh', 2, 'Chăm sóc khách hàng', 'Xử lý khiếu nại', 'Zendesk', 14
    UNION ALL SELECT 'product-owner-2026', 'Nguyễn Gia Linh', 'candidate08@hrm-demo.local', '0911000008', 94, b'0', 'OFFER_APPROVED', b'1', b'0', 'Đại học Quốc gia TP. Hồ Chí Minh', 6, 'Product Management', 'Agile', 'User Research', 13
    UNION ALL SELECT 'chuyen-vien-phap-che-2026', 'Trịnh Anh Khoa', 'candidate09@hrm-demo.local', '0911000009', 86, b'0', 'OFFER_APPROVED', b'0', b'0', 'Đại học Luật Hà Nội', 4, 'Luật thương mại', 'Hợp đồng', 'Tuân thủ', 12
    UNION ALL SELECT 'truong-nhom-kinh-doanh-2026', 'Hồ Quang Vinh', 'candidate10@hrm-demo.local', '0911000010', 91, b'0', 'OFFER_APPROVED', b'1', b'0', 'Đại học Kinh tế TP. Hồ Chí Minh', 7, 'Quản lý bán hàng', 'Coaching', 'Forecast', 11
    UNION ALL SELECT 'chuyen-vien-tuyen-dung-2026', 'Đinh Bảo Châu', 'candidate11@hrm-demo.local', '0911000011', 72, b'0', 'NEW', b'0', b'0', 'Đại học Lao động Xã hội', 1, 'Tuyển dụng', 'Sourcing', 'Giao tiếp', 5
    UNION ALL SELECT 'lap-trinh-vien-backend-2026', 'Phan Quốc Bảo', 'candidate12@hrm-demo.local', '0911000012', 78, b'0', 'PENDING_HR_CV_REVIEW', b'0', b'0', 'Đại học Công nghệ Thông tin', 2, 'Java', 'REST API', 'Docker', 5
    UNION ALL SELECT 'chuyen-vien-kinh-doanh-b2b-2026', 'Nguyễn Thanh Trúc', 'candidate13@hrm-demo.local', '0911000013', 81, b'0', 'PENDING_TECH_CV_REVIEW', b'0', b'0', 'Đại học Thương mại', 3, 'Bán hàng', 'CRM', 'Thuyết trình', 4
    UNION ALL SELECT 'digital-marketing-specialist-2026', 'Lê Minh Thư', 'candidate14@hrm-demo.local', '0911000014', 84, b'0', 'PENDING_TECH_CV_REVIEW', b'1', b'0', 'Đại học Tài chính Marketing', 3, 'Facebook Ads', 'SEO', 'Analytics', 4
    UNION ALL SELECT 'ke-toan-tong-hop-2026', 'Trần Quốc Khánh', 'candidate15@hrm-demo.local', '0911000015', 80, b'0', 'PENDING_INTERVIEW_1', b'0', b'0', 'Học viện Tài chính', 4, 'Kế toán', 'Thuế', 'Excel', 3
    UNION ALL SELECT 'truong-nhom-kinh-doanh-2026', 'Vũ Minh Hoàng', 'candidate16@hrm-demo.local', '0911000016', 89, b'0', 'PENDING_CEO_EVALUATION', b'1', b'0', 'Đại học Ngoại thương', 8, 'Quản lý bán hàng', 'Đàm phán', 'Leadership', 3
    UNION ALL SELECT 'nhan-vien-cham-soc-khach-hang-2026', 'Đỗ Ngọc Ánh', 'candidate17@hrm-demo.local', '0911000017', 79, b'0', 'PENDING_INTERVIEW_2', b'0', b'0', 'Đại học Văn Lang', 2, 'Customer Service', 'Giao tiếp', 'CRM', 2
    UNION ALL SELECT 'product-owner-2026', 'Nguyễn Phúc Thành', 'candidate18@hrm-demo.local', '0911000018', 93, b'0', 'PENDING_HR_OFFER', b'1', b'0', 'Đại học FPT', 6, 'Product Strategy', 'Scrum', 'Data Analysis', 2
    UNION ALL SELECT 'chuyen-vien-phap-che-2026', 'Phạm Thu Hương', 'candidate19@hrm-demo.local', '0911000019', 88, b'0', 'PENDING_OFFER_APPROVAL', b'1', b'0', 'Đại học Luật TP. Hồ Chí Minh', 5, 'Hợp đồng', 'Pháp lý doanh nghiệp', 'Compliance', 1
    UNION ALL SELECT 'lap-trinh-vien-backend-2026', 'Hoàng Đức Tài', 'candidate20@hrm-demo.local', '0911000020', 55, b'1', 'REJECTED', b'0', b'1', 'Cao đẳng Công nghệ Thông tin', 1, 'Java cơ bản', 'SQL', 'Git', 1
) AS seed
JOIN job_postings jp ON jp.slug = seed.job_slug
WHERE NOT EXISTS (
    SELECT 1 FROM applications app
    WHERE app.email = seed.email AND app.job_posting_id = jp.id
);

-- ================================================================
-- 6. YÊU CẦU TẠO TÀI KHOẢN TỪ ỨNG VIÊN ĐÃ ĐƯỢC DUYỆT
-- ================================================================

INSERT INTO account_creation_requests (
    application_id, chuc_vu, created_at, department_id, email, ho_ten, status
)
SELECT
    app.id, jp.title, @seed_now, jp.department_id, app.email, app.full_name, 'PENDING'
FROM applications app
JOIN job_postings jp ON jp.id = app.job_posting_id
WHERE app.approval_status = 'OFFER_APPROVED'
  AND app.email LIKE 'candidate%@hrm-demo.local'
  AND NOT EXISTS (
      SELECT 1 FROM account_creation_requests acr WHERE acr.application_id = app.id
  )
ORDER BY app.id
LIMIT 10;

-- ================================================================
-- 7. CHẤM CÔNG HÔM NAY
-- ================================================================

INSERT INTO attendances (
    created_at, date, employee_id, exception_reason, exception_status,
    is_exception, status, time_in, time_out, updated_at, loai_nghi_phep,
    scan_history, location_in, location_out
)
SELECT
    TIMESTAMP(@seed_today, seed.time_in), @seed_today, u.id, NULL, NULL,
    b'0', seed.attendance_status, CAST(seed.time_in AS TIME),
    CAST(seed.time_out AS TIME), TIMESTAMP(@seed_today, seed.time_out), NULL,
    JSON_ARRAY(seed.time_in, seed.time_out), seed.location_text, seed.location_text
FROM (
    SELECT 'quan.nguyen@hrm.local' AS email, '08:03:00' AS time_in, '17:36:00' AS time_out,
           'PRESENT' AS attendance_status, 'Tòa nhà Central Plaza, Quận 1, TP. Hồ Chí Minh' AS location_text
    UNION ALL SELECT 'ha.tran@hrm.local', '08:08:00', '17:42:00', 'PRESENT', 'Văn phòng HRM AI, Hoàn Kiếm, Hà Nội'
    UNION ALL SELECT 'nam.le@hrm.local', '08:16:00', '17:51:00', 'LATE', 'Văn phòng HRM AI, Hải Châu, Đà Nẵng'
    UNION ALL SELECT 'huy.pham@hrm.local', '07:58:00', '17:34:00', 'PRESENT', 'Tòa nhà Central Plaza, Quận 1, TP. Hồ Chí Minh'
    UNION ALL SELECT 'lan.vu@hrm.local', '08:05:00', '17:45:00', 'PRESENT', 'Văn phòng HRM AI, Hoàn Kiếm, Hà Nội'
    UNION ALL SELECT 'binh.do@hrm.local', '08:20:00', '17:38:00', 'LATE', 'Văn phòng HRM AI, Hải Châu, Đà Nẵng'
    UNION ALL SELECT 'tuan.nguyen@hrm.local', '08:01:00', '17:32:00', 'PRESENT', 'Tòa nhà Central Plaza, Quận 1, TP. Hồ Chí Minh'
    UNION ALL SELECT 'linh.luong@hrm.local', '08:09:00', '17:47:00', 'PRESENT', 'Tòa nhà Central Plaza, Quận 1, TP. Hồ Chí Minh'
    UNION ALL SELECT 'minh.phan@hrm.local', '08:18:00', '18:05:00', 'LATE', 'Tòa nhà Central Plaza, Quận 1, TP. Hồ Chí Minh'
    UNION ALL SELECT 'trang.do@hrm.local', '08:06:00', '17:40:00', 'PRESENT', 'Văn phòng HRM AI, Hoàn Kiếm, Hà Nội'
) AS seed
JOIN users u ON u.email = seed.email
WHERE NOT EXISTS (
    SELECT 1 FROM attendances a
    WHERE a.employee_id = u.id AND a.date = @seed_today
);

-- ================================================================
-- 8. ĐƠN TỪ NHÂN VIÊN
-- ================================================================

INSERT INTO employee_requests (
    created_at, end_date, note, reason, request_type, start_date, status,
    updated_at, approver_id, user_id
)
SELECT
    TIMESTAMPADD(DAY, -seed.created_days_ago, @seed_now),
    DATE_ADD(@seed_today, INTERVAL seed.end_offset DAY), seed.note_text,
    seed.reason_text, seed.request_type,
    DATE_ADD(@seed_today, INTERVAL seed.start_offset DAY), seed.request_status,
    @seed_now, approver.id, requester.id
FROM (
    SELECT 'huy.pham@hrm.local' AS requester_email, 'quan.nguyen@hrm.local' AS approver_email,
           'NORMAL_LEAVE' AS request_type, 'Khám sức khỏe định kỳ theo lịch hẹn của bệnh viện.' AS reason_text,
           3 AS start_offset, 3 AS end_offset, 'PENDING' AS request_status,
           NULL AS note_text, 1 AS created_days_ago
    UNION ALL SELECT 'lan.vu@hrm.local', 'ha.tran@hrm.local', 'SPECIAL_WFH_LEAVE',
           'Làm việc tại nhà để tập trung hoàn thiện kế hoạch truyền thông quý mới.', 1, 1, 'APPROVED',
           'Đã xác nhận không ảnh hưởng lịch họp của phòng.', 2
    UNION ALL SELECT 'binh.do@hrm.local', 'nam.le@hrm.local', 'OVERTIME',
           'Hoàn thành báo cáo tài chính và đối soát số liệu trước kỳ chốt tháng.', 0, 0, 'APPROVED',
           'Được duyệt làm thêm tối đa ba giờ.', 2
    UNION ALL SELECT 'tuan.nguyen@hrm.local', 'ceo@hrm.vn', 'HALF_DAY_LEAVE',
           'Giải quyết công việc gia đình vào buổi chiều và đã bàn giao đầu việc.', 5, 5, 'PENDING',
           NULL, 1
    UNION ALL SELECT 'linh.luong@hrm.local', 'ceo@hrm.vn', 'NORMAL_LEAVE',
           'Nghỉ phép năm để về quê thăm gia đình theo kế hoạch cá nhân.', 8, 9, 'PENDING',
           NULL, 1
    UNION ALL SELECT 'minh.phan@hrm.local', 'ceo@hrm.vn', 'SPECIAL_WFH_LEAVE',
           'Làm việc từ xa để tham gia chuỗi phỏng vấn người dùng trực tuyến.', 2, 2, 'APPROVED',
           'Bảo đảm tham gia đầy đủ các cuộc họp sản phẩm.', 3
    UNION ALL SELECT 'trang.do@hrm.local', 'ceo@hrm.vn', 'OVERTIME',
           'Rà soát gấp phụ lục hợp đồng đối tác trước thời hạn ký kết.', 0, 0, 'APPROVED',
           'Đã duyệt làm thêm hai giờ.', 2
    UNION ALL SELECT 'quanghuy.trinh@hrm.local', 'ceo@hrm.vn', 'UNPAID_LEAVE',
           'Xin nghỉ không lương để giải quyết thủ tục hành chính cá nhân.', 12, 13, 'REJECTED',
           'Thời gian đề xuất trùng lịch kiểm kê văn phòng.', 1
    UNION ALL SELECT 'yen.nguyen@hrm.local', 'huy.pham@hrm.local', 'NORMAL_LEAVE',
           'Nghỉ phép một ngày để tham dự lễ tốt nghiệp của người thân.', 6, 6, 'APPROVED',
           'Đã bàn giao danh sách khách hàng đang theo dõi.', 2
    UNION ALL SELECT 'ducanh.tran@hrm.local', 'lan.vu@hrm.local', 'HALF_DAY_LEAVE',
           'Xin nghỉ buổi sáng để thực hiện thủ tục khám sức khỏe cá nhân.', 4, 4, 'PENDING',
           NULL, 1
) AS seed
JOIN users requester ON requester.email = seed.requester_email
JOIN users approver ON approver.email = seed.approver_email
WHERE NOT EXISTS (
    SELECT 1 FROM employee_requests er
    WHERE er.user_id = requester.id
      AND er.request_type = seed.request_type
      AND er.start_date = DATE_ADD(@seed_today, INTERVAL seed.start_offset DAY)
);

-- ================================================================
-- 9. LỊCH SỬ NHÂN SỰ
-- ================================================================

INSERT INTO employee_histories (
    description, employee_id, event_date, event_type, new_value, old_value
)
SELECT
    seed.description_text, u.id,
    TIMESTAMPADD(DAY, -seed.days_ago, @seed_now), seed.event_type,
    seed.new_value, seed.old_value
FROM (
    SELECT 'quan.nguyen@hrm.local' AS email, 'Tiếp nhận vị trí Giám đốc Kinh doanh.' AS description_text,
           'JOINED' AS event_type, 'Giám đốc Kinh doanh' AS new_value, NULL AS old_value, 420 AS days_ago
    UNION ALL SELECT 'ha.tran@hrm.local', 'Tiếp nhận vị trí Giám đốc Marketing.', 'JOINED', 'Giám đốc Marketing', NULL, 390
    UNION ALL SELECT 'nam.le@hrm.local', 'Tiếp nhận vị trí Giám đốc Tài chính.', 'JOINED', 'Giám đốc Tài chính', NULL, 365
    UNION ALL SELECT 'huy.pham@hrm.local', 'Được bổ nhiệm làm Trưởng phòng Kinh doanh.', 'PROMOTED', 'Trưởng phòng Kinh doanh', 'Chuyên viên Kinh doanh cao cấp', 180
    UNION ALL SELECT 'lan.vu@hrm.local', 'Được bổ nhiệm làm Trưởng phòng Marketing.', 'PROMOTED', 'Trưởng phòng Marketing', 'Chuyên viên Marketing cao cấp', 175
    UNION ALL SELECT 'binh.do@hrm.local', 'Được bổ nhiệm làm Trưởng phòng Kế toán.', 'PROMOTED', 'Trưởng phòng Kế toán', 'Kế toán trưởng nhóm', 170
    UNION ALL SELECT 'tuan.nguyen@hrm.local', 'Điều chuyển sang phụ trách phòng Vận hành.', 'TRANSFERRED', 'Phòng Vận hành', 'Ban dự án vận hành', 145
    UNION ALL SELECT 'linh.luong@hrm.local', 'Tiếp nhận vị trí Trưởng phòng Chăm sóc khách hàng.', 'JOINED', 'Trưởng phòng Chăm sóc khách hàng', NULL, 130
    UNION ALL SELECT 'minh.phan@hrm.local', 'Được bổ nhiệm làm Trưởng phòng Sản phẩm.', 'PROMOTED', 'Trưởng phòng Sản phẩm', 'Product Owner cao cấp', 120
    UNION ALL SELECT 'trang.do@hrm.local', 'Tiếp nhận vị trí Trưởng phòng Pháp chế.', 'JOINED', 'Trưởng phòng Pháp chế', NULL, 110
) AS seed
JOIN users u ON u.email = seed.email
WHERE NOT EXISTS (
    SELECT 1 FROM employee_histories eh
    WHERE eh.employee_id = u.id AND eh.description = seed.description_text
);

-- ================================================================
-- 10. LỊCH SỬ LƯƠNG
-- ================================================================

INSERT INTO salary_history (
    change_date, changed_by, employee_id, new_allowance, new_base_salary,
    old_allowance, old_base_salary, reason
)
SELECT
    TIMESTAMPADD(DAY, -seed.days_ago, @seed_now), changer.id, employee.id,
    employee.allowance, employee.base_salary, seed.old_allowance,
    seed.old_base_salary, seed.reason_text
FROM (
    SELECT 'quan.nguyen@hrm.local' AS employee_email, 'ceo@hrm.vn' AS changer_email,
           42000000 AS old_base_salary, 7000000 AS old_allowance,
           'Điều chỉnh theo khung lương vị trí Giám đốc Kinh doanh.' AS reason_text, 90 AS days_ago
    UNION ALL SELECT 'ha.tran@hrm.local', 'ceo@hrm.vn', 39000000, 6000000,
           'Điều chỉnh theo kết quả đánh giá quản lý nửa đầu năm.', 88
    UNION ALL SELECT 'nam.le@hrm.local', 'ceo@hrm.vn', 45000000, 8000000,
           'Điều chỉnh trách nhiệm quản lý tài chính và ngân sách doanh nghiệp.', 86
    UNION ALL SELECT 'huy.pham@hrm.local', 'quan.nguyen@hrm.local', 27000000, 4000000,
           'Tăng lương sau khi hoàn thành chỉ tiêu kinh doanh hai quý liên tiếp.', 75
    UNION ALL SELECT 'lan.vu@hrm.local', 'ha.tran@hrm.local', 26000000, 3500000,
           'Tăng lương theo kết quả các chiến dịch thương hiệu trọng điểm.', 72
    UNION ALL SELECT 'binh.do@hrm.local', 'nam.le@hrm.local', 30000000, 4500000,
           'Điều chỉnh lương sau khi nhận thêm trách nhiệm kiểm soát nội bộ.', 70
    UNION ALL SELECT 'tuan.nguyen@hrm.local', 'ceo@hrm.vn', 27000000, 4000000,
           'Điều chỉnh phụ cấp trách nhiệm quản lý vận hành.', 65
    UNION ALL SELECT 'linh.luong@hrm.local', 'ceo@hrm.vn', 24000000, 3000000,
           'Điều chỉnh theo quy mô đội ngũ chăm sóc khách hàng.', 62
    UNION ALL SELECT 'minh.phan@hrm.local', 'ceo@hrm.vn', 32000000, 4500000,
           'Tăng lương theo phạm vi quản lý lộ trình sản phẩm mới.', 60
) AS seed
JOIN users employee ON employee.email = seed.employee_email
JOIN users changer ON changer.email = seed.changer_email
WHERE NOT EXISTS (
    SELECT 1 FROM salary_history sh
    WHERE sh.employee_id = employee.id AND sh.reason = seed.reason_text
);

-- ================================================================
-- 11. BẢNG LƯƠNG THÁNG HIỆN TẠI
-- Các khoản được tính từ lương cơ bản, phụ cấp, tăng ca và giảm trừ.
-- ================================================================

INSERT INTO payrolls (
    actual_days, allowance, base_salary, created_at, employee_id, late_penalty,
    month, net_salary, overtime_pay, overtime_reason, rejection_reason,
    standard_days, status, updated_at, year, bhtn_amount, bhxh_amount,
    bhyt_amount, gross_salary, thu_nhap_tinh_thue, thu_tncn
)
SELECT
    seed.actual_days, COALESCE(u.allowance, 0), COALESCE(u.base_salary, 0),
    @seed_now, u.id, seed.late_penalty, @seed_month,
    (
        COALESCE(u.base_salary, 0) + COALESCE(u.allowance, 0) + seed.overtime_pay - seed.late_penalty
        - COALESCE(u.base_salary, 0) * 0.08
        - COALESCE(u.base_salary, 0) * 0.015
        - COALESCE(u.base_salary, 0) * 0.01
        - GREATEST(
            COALESCE(u.base_salary, 0) + COALESCE(u.allowance, 0) + seed.overtime_pay - seed.late_penalty
            - COALESCE(u.base_salary, 0) * 0.105 - 15500000,
            0
          ) * 0.05
    ) AS net_salary,
    seed.overtime_pay, seed.overtime_reason, NULL, 22,
    seed.payroll_status, @seed_now, @seed_year,
    COALESCE(u.base_salary, 0) * 0.01,
    COALESCE(u.base_salary, 0) * 0.08,
    COALESCE(u.base_salary, 0) * 0.015,
    COALESCE(u.base_salary, 0) + COALESCE(u.allowance, 0) + seed.overtime_pay - seed.late_penalty,
    GREATEST(
        COALESCE(u.base_salary, 0) + COALESCE(u.allowance, 0) + seed.overtime_pay - seed.late_penalty
        - COALESCE(u.base_salary, 0) * 0.105 - 15500000,
        0
    ),
    GREATEST(
        COALESCE(u.base_salary, 0) + COALESCE(u.allowance, 0) + seed.overtime_pay - seed.late_penalty
        - COALESCE(u.base_salary, 0) * 0.105 - 15500000,
        0
    ) * 0.05
FROM (
    SELECT 'quan.nguyen@hrm.local' AS email, 22.0 AS actual_days, 1800000 AS overtime_pay,
           0 AS late_penalty, 'Hỗ trợ ký hợp đồng ngoài giờ hành chính.' AS overtime_reason,
           'PENDING_CEO' AS payroll_status
    UNION ALL SELECT 'ha.tran@hrm.local', 21.5, 1200000, 300000,
           'Hoàn thành kế hoạch truyền thông ngoài giờ.', 'PENDING_DIRECTOR'
    UNION ALL SELECT 'nam.le@hrm.local', 22.0, 2400000, 0,
           'Chốt báo cáo tài chính cuối tháng.', 'PENDING_CEO'
    UNION ALL SELECT 'huy.pham@hrm.local', 21.0, 1500000, 450000,
           'Gặp khách hàng và hoàn tất hồ sơ thầu.', 'DRAFT'
    UNION ALL SELECT 'lan.vu@hrm.local', 22.0, 1100000, 0,
           'Giám sát sự kiện thương hiệu cuối tuần.', 'MANAGER_APPROVED'
    UNION ALL SELECT 'binh.do@hrm.local', 21.5, 1800000, 250000,
           'Đối soát chứng từ và kê khai thuế.', 'DRAFT'
    UNION ALL SELECT 'tuan.nguyen@hrm.local', 22.0, 1300000, 0,
           'Xử lý sự cố vận hành ngoài giờ.', 'MANAGER_APPROVED'
    UNION ALL SELECT 'linh.luong@hrm.local', 21.0, 900000, 300000,
           'Hỗ trợ ca chăm sóc khách hàng buổi tối.', 'DRAFT'
    UNION ALL SELECT 'minh.phan@hrm.local', 22.0, 1600000, 0,
           'Tổ chức phiên nghiên cứu người dùng ngoài giờ.', 'PENDING_DIRECTOR'
) AS seed
JOIN users u ON u.email = seed.email
WHERE NOT EXISTS (
    SELECT 1 FROM payrolls p
    WHERE p.employee_id = u.id AND p.month = @seed_month AND p.year = @seed_year
);

-- ================================================================
-- 12. ĐÁNH GIÁ HIỆU SUẤT
-- ================================================================

INSERT INTO performance_reviews (ai_evaluation, employee_id, generated_at, nam, thang)
SELECT
    seed.evaluation_text, u.id, @seed_now, @seed_year, @seed_month
FROM (
    SELECT 'quan.nguyen@hrm.local' AS email,
           'Hoàn thành tốt kế hoạch doanh thu, duy trì tỷ lệ chuyển đổi ổn định và hỗ trợ đội ngũ xử lý các cơ hội lớn. Nên tiếp tục chuẩn hóa quy trình dự báo doanh số.' AS evaluation_text
    UNION ALL SELECT 'ha.tran@hrm.local',
           'Triển khai đúng tiến độ các chiến dịch trọng điểm, kiểm soát ngân sách tốt và cải thiện chất lượng khách hàng tiềm năng. Cần tăng cường đo lường đóng góp theo kênh.'
    UNION ALL SELECT 'nam.le@hrm.local',
           'Bảo đảm báo cáo tài chính đúng hạn, quản lý dòng tiền chặt chẽ và chủ động cảnh báo rủi ro ngân sách. Nên tiếp tục tự động hóa công tác đối soát.'
    UNION ALL SELECT 'huy.pham@hrm.local',
           'Dẫn dắt nhóm kinh doanh đạt tiến độ, theo sát dữ liệu khách hàng và hỗ trợ nhân viên mới hiệu quả. Cần cải thiện độ chính xác của dự báo theo tuần.'
    UNION ALL SELECT 'lan.vu@hrm.local',
           'Quản lý nội dung và quảng cáo nhất quán, phối hợp tốt với kinh doanh và giữ đúng cam kết tiến độ. Nên thử nghiệm thêm các kênh tăng trưởng mới.'
    UNION ALL SELECT 'binh.do@hrm.local',
           'Kiểm soát chứng từ cẩn thận, hoàn thành nghĩa vụ thuế đúng hạn và hỗ trợ tốt công tác kiểm toán. Cần xây dựng thêm bộ chỉ số cảnh báo sớm.'
    UNION ALL SELECT 'tuan.nguyen@hrm.local',
           'Duy trì hoạt động ổn định, phản hồi nhanh với sự cố và phối hợp hiệu quả giữa các phòng ban. Nên cập nhật tài liệu quy trình sau mỗi thay đổi.'
    UNION ALL SELECT 'linh.luong@hrm.local',
           'Duy trì chất lượng phản hồi khách hàng, xử lý khiếu nại tích cực và hỗ trợ đào tạo nhân viên. Cần giảm thời gian xử lý các yêu cầu phức tạp.'
    UNION ALL SELECT 'minh.phan@hrm.local',
           'Xác định ưu tiên sản phẩm rõ ràng, phối hợp tốt với kỹ thuật và sử dụng phản hồi người dùng trong quyết định. Nên tăng tần suất theo dõi chỉ số sau phát hành.'
) AS seed
JOIN users u ON u.email = seed.email
WHERE NOT EXISTS (
    SELECT 1 FROM performance_reviews pr
    WHERE pr.employee_id = u.id AND pr.thang = @seed_month AND pr.nam = @seed_year
);

-- ================================================================
-- 13. BÁO CÁO LƯƠNG THEO PHÒNG BAN
-- ================================================================

INSERT INTO payroll_reports (
    created_at, created_by, department_id, month, report_level, status,
    total_employees, total_gross_salary, updated_at, year
)
SELECT
    @seed_now, creator.id, d.id, @seed_month, seed.report_level,
    seed.report_status,
    (SELECT COUNT(*) FROM users u_count WHERE u_count.department_id = d.id AND u_count.active = b'1'),
    (SELECT COALESCE(SUM(COALESCE(u_salary.base_salary, 0) + COALESCE(u_salary.allowance, 0)), 0)
       FROM users u_salary WHERE u_salary.department_id = d.id AND u_salary.active = b'1'),
    @seed_now, @seed_year
FROM (
    SELECT 'Nhân sự' AS department_name, 'truongphong@hrm.vn' AS creator_email,
           'MANAGER_LEVEL' AS report_level, 'PENDING_DIRECTOR' AS report_status
    UNION ALL SELECT 'Kỹ thuật', 'giamdocphong@hrm.vn', 'DIRECTOR_LEVEL', 'PENDING_CEO'
    UNION ALL SELECT 'Kinh doanh', 'huy.pham@hrm.local', 'MANAGER_LEVEL', 'APPROVED_BY_DIRECTOR'
    UNION ALL SELECT 'Marketing', 'lan.vu@hrm.local', 'MANAGER_LEVEL', 'PENDING_DIRECTOR'
    UNION ALL SELECT 'Tài chính - Kế toán', 'binh.do@hrm.local', 'MANAGER_LEVEL', 'PENDING_CEO'
    UNION ALL SELECT 'Vận hành', 'tuan.nguyen@hrm.local', 'MANAGER_LEVEL', 'PENDING_DIRECTOR'
    UNION ALL SELECT 'Chăm sóc khách hàng', 'linh.luong@hrm.local', 'MANAGER_LEVEL', 'APPROVED_BY_DIRECTOR'
    UNION ALL SELECT 'Sản phẩm', 'minh.phan@hrm.local', 'MANAGER_LEVEL', 'PENDING_CEO'
    UNION ALL SELECT 'Pháp chế', 'trang.do@hrm.local', 'MANAGER_LEVEL', 'PENDING_DIRECTOR'
    UNION ALL SELECT 'Hành chính', 'quanghuy.trinh@hrm.local', 'MANAGER_LEVEL', 'PENDING_DIRECTOR'
) AS seed
JOIN departments d ON d.ten_phong = seed.department_name
JOIN users creator ON creator.email = seed.creator_email
WHERE NOT EXISTS (
    SELECT 1 FROM payroll_reports pr
    WHERE pr.department_id = d.id
      AND pr.month = @seed_month
      AND pr.year = @seed_year
      AND pr.report_level = seed.report_level
);

-- ================================================================
-- 14. NGÀY LỄ
-- ================================================================

INSERT INTO holidays (ngay_le, ten_ngay_le)
SELECT seed.holiday_date, seed.holiday_name
FROM (
    SELECT '2026-01-01' AS holiday_date, 'Tết Dương lịch' AS holiday_name
    UNION ALL SELECT '2026-02-16', 'Nghỉ Tết Nguyên đán - ngày 1'
    UNION ALL SELECT '2026-02-17', 'Nghỉ Tết Nguyên đán - ngày 2'
    UNION ALL SELECT '2026-02-18', 'Nghỉ Tết Nguyên đán - ngày 3'
    UNION ALL SELECT '2026-02-19', 'Nghỉ Tết Nguyên đán - ngày 4'
    UNION ALL SELECT '2026-02-20', 'Nghỉ Tết Nguyên đán - ngày 5'
    UNION ALL SELECT '2026-04-26', 'Giỗ Tổ Hùng Vương'
    UNION ALL SELECT '2026-04-30', 'Ngày Giải phóng miền Nam'
    UNION ALL SELECT '2026-05-01', 'Ngày Quốc tế Lao động'
    UNION ALL SELECT '2026-09-02', 'Ngày Quốc khánh'
    UNION ALL SELECT '2026-09-03', 'Nghỉ bổ sung Quốc khánh'
    UNION ALL SELECT '2027-01-01', 'Tết Dương lịch 2027'
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM holidays h WHERE h.ngay_le = seed.holiday_date
);

-- ================================================================
-- 15. NHÓM CHAT PHÒNG BAN VÀ THÀNH VIÊN
-- ================================================================

INSERT INTO chat_groups (created_at, department_id, name, type)
SELECT @seed_now, d.id, CONCAT('Phòng ', d.ten_phong), 'DEPARTMENT'
FROM departments d
WHERE d.ten_phong IN (
    'Kinh doanh', 'Marketing', 'Tài chính - Kế toán', 'Vận hành',
    'Chăm sóc khách hàng', 'Sản phẩm', 'Pháp chế', 'Hành chính'
)
AND NOT EXISTS (
    SELECT 1 FROM chat_groups cg WHERE cg.department_id = d.id AND cg.type = 'DEPARTMENT'
);

INSERT INTO chat_group_members (group_id, joined_at, last_read_message_id, user_id)
SELECT cg.id, @seed_now, NULL, u.id
FROM users u
JOIN chat_groups cg ON cg.department_id = u.department_id AND cg.type = 'DEPARTMENT'
WHERE u.email LIKE '%@hrm.local'
  AND NOT EXISTS (
      SELECT 1 FROM chat_group_members cgm
      WHERE cgm.group_id = cg.id AND cgm.user_id = u.id
  );

-- Bổ sung một cuộc hội thoại chatbot đã lưu trong DB.
INSERT INTO chat_messages (content, created_at, role, user_id)
SELECT seed.content_text, TIMESTAMPADD(SECOND, seed.offset_seconds, @seed_now), seed.chat_role, u.id
FROM (
    SELECT 'ceo@hrm.vn' AS user_email, 'Tóm tắt giúp tôi tình hình nhân sự hiện tại.' AS content_text,
           'user' AS chat_role, -30 AS offset_seconds
    UNION ALL SELECT 'ceo@hrm.vn',
           'Hệ thống hiện có dữ liệu nhân sự theo phòng ban, chấm công trong ngày và các chiến dịch tuyển dụng đang mở để theo dõi trên dashboard.',
           'model', -25
    UNION ALL SELECT 'huy.pham@hrm.local', 'Tôi cần xem những hồ sơ ứng viên đang chờ đánh giá chuyên môn.', 'user', -20
    UNION ALL SELECT 'huy.pham@hrm.local',
           'Anh có thể mở mục Tuyển dụng, chọn Danh sách hồ sơ và lọc trạng thái Chờ đánh giá chuyên môn.',
           'model', -15
) AS seed
JOIN users u ON u.email = seed.user_email
WHERE NOT EXISTS (
    SELECT 1 FROM chat_messages cm
    WHERE cm.user_id = u.id AND cm.role = seed.chat_role AND cm.content = seed.content_text
);

-- ================================================================
-- 16. CẤU HÌNH HỆ THỐNG
-- ================================================================

INSERT INTO system_settings (description, setting_key, setting_value)
SELECT seed.description_text, seed.setting_key, seed.setting_value
FROM (
    SELECT 'Tên hiển thị của doanh nghiệp.' AS description_text, 'company_name' AS setting_key, 'HRM AI Company' AS setting_value
    UNION ALL SELECT 'Giờ bắt đầu làm việc tiêu chuẩn.', 'work_start_time', '08:00'
    UNION ALL SELECT 'Giờ kết thúc làm việc tiêu chuẩn.', 'work_end_time', '17:30'
    UNION ALL SELECT 'Số phút được phép trễ trước khi ghi nhận đi muộn.', 'late_grace_minutes', '10'
    UNION ALL SELECT 'Số ngày công tiêu chuẩn trong tháng.', 'standard_work_days', '22'
    UNION ALL SELECT 'Hệ số tính tiền làm thêm giờ.', 'overtime_multiplier', '1.5'
    UNION ALL SELECT 'Ngày chốt dữ liệu bảng lương hàng tháng.', 'payroll_cutoff_day', '25'
    UNION ALL SELECT 'Số ngày nghỉ phép năm tiêu chuẩn.', 'annual_leave_days', '12'
    UNION ALL SELECT 'Ngưỡng tương đồng tối thiểu khi nhận diện khuôn mặt.', 'face_similarity_threshold', '0.85'
    UNION ALL SELECT 'Kích thước tối đa của tệp CV tính theo MB.', 'max_cv_size_mb', '5'
    UNION ALL SELECT 'Số ngày lưu thông báo trước khi dọn dẹp.', 'notification_retention_days', '90'
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM system_settings ss WHERE ss.setting_key = seed.setting_key
);

COMMIT;

-- Các bảng không seed bằng chuỗi giả:
-- face_embeddings: phải tạo từ camera và mô hình nhận diện khuôn mặt.
-- faq_caches: question_embedding phải do mô hình embedding sinh ra.
-- ai_decision_logs: hệ thống hiện đã có dữ liệu do các lần chạy AI thực tế tạo.
-- notifications và group_messages: hiện đã vượt mục tiêu 20 bản ghi.

