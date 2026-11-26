-- DU LIEU GIA LAP DE KIEM THU MODULE KINH DOANH.
-- Chon database local/test da chay migration V33 truoc khi thuc thi.
-- Tai khoan moi co mat khau SalesDemo@123 (BCrypt). Khong sua tai khoan cu.
-- Chay lai giu nguyen tien trinh demo da thao tac. Moc ngay tinh theo luc nap.
SET NAMES utf8mb4;
SET @sales_demo_old_timezone = @@session.time_zone;
SET time_zone = '+07:00';

DROP PROCEDURE IF EXISTS hrm_seed_sales_demo_v1;
DELIMITER $$
CREATE PROCEDURE hrm_seed_sales_demo_v1()
BEGIN
    DECLARE sales_department BIGINT;
    DECLARE accounting_department BIGINT;
    DECLARE technical_department BIGINT;
    DECLARE manager_id BIGINT;
    DECLARE employee_a BIGINT;
    DECLARE employee_b BIGINT;
    DECLARE accountant_id BIGINT;
    DECLARE technician_id BIGINT;
    DECLARE lock_claimed INT DEFAULT 0;
    DECLARE demo_day DATE;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DO RELEASE_LOCK(CONCAT(DATABASE(), ':sales_demo_v1'));
        RESIGNAL;
    END;

    IF DATABASE() IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hay chon database local/test truoc khi nap demo.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema=DATABASE() AND table_name='sales_contract_history') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Can chay backend/Flyway V33 truoc khi nap demo.';
    END IF;
    SELECT GET_LOCK(CONCAT(DATABASE(), ':sales_demo_v1'), 10) INTO lock_claimed;
    IF lock_claimed <> 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mot phien khac dang nap demo. Hay thu lai sau.';
    END IF;

    SET demo_day=CURDATE();
    START TRANSACTION;

    INSERT INTO departments(ten_phong,mo_ta,is_lock,created_at)
    SELECT 'Kinh doanh','Quản lý khách hàng và kinh doanh',b'0',NOW(6)
    WHERE NOT EXISTS (SELECT 1 FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('kinh doanh','phòng kinh doanh'));
    INSERT INTO departments(ten_phong,mo_ta,is_lock,created_at)
    SELECT 'Tài chính - Kế toán','Phòng Tài chính - Kế toán',b'0',NOW(6)
    WHERE NOT EXISTS (SELECT 1 FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('tài chính - kế toán','phòng tài chính - kế toán','kế toán','phòng kế toán'));
    INSERT INTO departments(ten_phong,mo_ta,is_lock,created_at)
    SELECT 'Công nghệ','Phòng Công nghệ',b'0',NOW(6)
    WHERE NOT EXISTS (SELECT 1 FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('công nghệ','phòng công nghệ','kỹ thuật','phòng kỹ thuật'));
    SELECT MIN(id) INTO sales_department FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('kinh doanh','phòng kinh doanh');
    SELECT MIN(id) INTO accounting_department FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('tài chính - kế toán','phòng tài chính - kế toán','kế toán','phòng kế toán');
    SELECT MIN(id) INTO technical_department FROM departments WHERE LOWER(TRIM(ten_phong)) IN ('công nghệ','phòng công nghệ','kỹ thuật','phòng kỹ thuật');

    DROP TEMPORARY TABLE IF EXISTS sales_demo_users;
    CREATE TEMPORARY TABLE sales_demo_users (
        code VARCHAR(8), email VARCHAR(150), name VARCHAR(150), role_name VARCHAR(30), department_id BIGINT
    );
    INSERT INTO sales_demo_users VALUES
        ('79000101','manager@sales.example.test','[DEMO-KD] Quản lý Kinh doanh','TRUONG_PHONG',sales_department),
        ('79000102','employee-a@sales.example.test','[DEMO-KD] Nguyễn An','NHAN_VIEN',sales_department),
        ('79000103','employee-b@sales.example.test','[DEMO-KD] Trần Bình','NHAN_VIEN',sales_department),
        ('79000104','director@sales.example.test','[DEMO-KD] Giám đốc Kinh doanh','GIAM_DOC_PHONG_BAN',sales_department),
        ('79000302','technical-manager@sales.example.test','[DEMO-KD] Trưởng phòng Công nghệ','TRUONG_PHONG',technical_department),
        ('79000201','accounting@sales.example.test','[DEMO-KD] Người nhận Tài chính - Kế toán','NHAN_VIEN',accounting_department),
        ('79000301','technical@sales.example.test','[DEMO-KD] Người nhận Công nghệ','NHAN_VIEN',technical_department);
    IF EXISTS (
        SELECT 1 FROM users u JOIN sales_demo_users d ON u.email=d.email OR u.ma_nhan_vien=d.code
        WHERE u.email<>d.email OR u.ma_nhan_vien<>d.code OR u.ma_nhan_vien IS NULL
           OR u.role<>d.role_name OR NOT (u.department_id <=> d.department_id)
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ma/email demo bi trung hoac tai khoan demo da doi role/phong. Khong ghi de.';
    END IF;
    INSERT INTO users(ho_ten,email,ma_nhan_vien,password_hash,role,department_id,active,created_at,so_nguoi_phu_thuoc)
    SELECT d.name,d.email,d.code,
        '$2a$10$fLW0eDBNGZJ.4bM/MSUfYeQ6udXq3fBB1SIqqowzWNJ2vC5aDt9Qe',
        d.role_name,d.department_id,b'1',NOW(6),0
    FROM sales_demo_users d WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.email=d.email);
    SELECT id INTO manager_id FROM users WHERE email='manager@sales.example.test';
    SELECT id INTO employee_a FROM users WHERE email='employee-a@sales.example.test';
    SELECT id INTO employee_b FROM users WHERE email='employee-b@sales.example.test';
    SELECT id INTO accountant_id FROM users WHERE email='accounting@sales.example.test';
    SELECT id INTO technician_id FROM users WHERE email='technical@sales.example.test';

    DROP TEMPORARY TABLE IF EXISTS sales_demo_customers;
    CREATE TEMPORARY TABLE sales_demo_customers (
        code VARCHAR(10), name VARCHAR(200), owner_id BIGINT, email VARCHAR(150), phone VARCHAR(30),
        address VARCHAR(500), source VARCHAR(150), active BOOLEAN
    );
    INSERT INTO sales_demo_customers VALUES
        ('001','[DEMO-KD] An Phát',employee_a,'anphat@sales.example.test','0007900001','TP. Hồ Chí Minh','Website',TRUE),
        ('002','[DEMO-KD] Minh Tâm',employee_a,'minhtam@sales.example.test','0007900002','Hà Nội','Giới thiệu',TRUE),
        ('003','[DEMO-KD] Hoàng Long',employee_a,'hoanglong@sales.example.test','0007900003','Đà Nẵng','Hội thảo',TRUE),
        ('004','[DEMO-KD] GreenTech',employee_a,'greentech@sales.example.test','0007900004','Bình Dương','Khách hàng cũ',TRUE),
        ('005','[DEMO-KD] Thiên Nam',employee_b,'thiennam@sales.example.test','0007900005','Đồng Nai','Liên hệ trực tiếp',FALSE),
        ('006','[DEMO-KD] Bản Việt',employee_b,'banviet@sales.example.test','0007900006','Cần Thơ','Website',TRUE);
    INSERT INTO sales_customers(department_id,owner_id,name,tax_code,email,phone,address,source,notes,active)
    SELECT sales_department,d.owner_id,d.name,CONCAT('DEMO-KD-',d.code),d.email,d.phone,d.address,d.source,
        'Dữ liệu giả lập phục vụ kiểm thử. Không dùng để liên hệ thực tế.',d.active
    FROM sales_demo_customers d WHERE NOT EXISTS (SELECT 1 FROM sales_customers c WHERE c.email=d.email);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_contacts;
    CREATE TEMPORARY TABLE sales_demo_contacts (customer_email VARCHAR(150), name VARCHAR(150), title VARCHAR(150), email VARCHAR(150));
    INSERT INTO sales_demo_contacts VALUES
        ('anphat@sales.example.test','[DEMO] Nguyễn Lan','Giám đốc','lan.anphat@sales.example.test'),
        ('anphat@sales.example.test','[DEMO] Lê Hùng','Đầu mối kỹ thuật','hung.anphat@sales.example.test'),
        ('minhtam@sales.example.test','[DEMO] Phạm Mai','Phụ trách mua hàng','mai.minhtam@sales.example.test'),
        ('minhtam@sales.example.test','[DEMO] Trần Nam','Phụ trách triển khai','nam.minhtam@sales.example.test'),
        ('hoanglong@sales.example.test','[DEMO] Đỗ Hà','Giám đốc','ha.hoanglong@sales.example.test'),
        ('greentech@sales.example.test','[DEMO] Vũ Minh','Điều phối dự án','minh.greentech@sales.example.test'),
        ('thiennam@sales.example.test','[DEMO] Bùi Sơn','Giám đốc','son.thiennam@sales.example.test'),
        ('banviet@sales.example.test','[DEMO] Lý Thu','Trưởng phòng Nhân sự','thu.banviet@sales.example.test');
    INSERT INTO sales_contacts(customer_id,name,job_title,email)
    SELECT c.id,d.name,d.title,d.email FROM sales_demo_contacts d JOIN sales_customers c ON c.email=d.customer_email
    WHERE NOT EXISTS (SELECT 1 FROM sales_contacts x WHERE x.customer_id=c.id AND x.email=d.email);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_products;
    CREATE TEMPORARY TABLE sales_demo_products (code VARCHAR(20), name VARCHAR(200), unit VARCHAR(50), price DECIMAL(19,2), active BOOLEAN);
    INSERT INTO sales_demo_products VALUES
        ('CRM','[DEMO-KD] Bản quyền CRM','Gói',80000000,TRUE),
        ('CUSTOM','[DEMO-KD] Phát triển module riêng','Module',80000000,TRUE),
        ('DEPLOY','[DEMO-KD] Triển khai phần mềm','Gói',20000000,TRUE),
        ('TRAIN','[DEMO-KD] Đào tạo sử dụng','Buổi',5000000,TRUE),
        ('WEB','[DEMO-KD] Website doanh nghiệp','Gói',60000000,TRUE),
        ('SAAS','[DEMO-KD] Thuê bao SaaS','Tháng',4000000,TRUE),
        ('MAINT','[DEMO-KD] Bảo trì phần mềm','Tháng',2000000,TRUE),
        ('OLD','[DEMO-KD] Gói dịch vụ ngừng cung cấp','Gói',10000000,FALSE);
    INSERT INTO sales_products(name,unit,unit_price,active,floor_price,standard_package,standard_scope)
    SELECT d.name,d.unit,d.price,d.active,d.price,FALSE,d.name FROM sales_demo_products d
    WHERE NOT EXISTS (SELECT 1 FROM sales_products p WHERE p.name=d.name);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_opportunities;
    CREATE TEMPORARY TABLE sales_demo_opportunities (
        code VARCHAR(20), customer_email VARCHAR(150), title VARCHAR(200), requirements TEXT,
        expected_value DECIMAL(19,2), day_offset INT, stage VARCHAR(30), loss_reason VARCHAR(1000)
    );
    INSERT INTO sales_demo_opportunities VALUES
        ('AP-CRM','anphat@sales.example.test','[DEMO-KD] CRM An Phát','Quản lý 20 nhân viên bán hàng, khách hàng và báo giá.',120000000,20,'NEW',NULL),
        ('AP-MAINT','anphat@sales.example.test','[DEMO-KD] Bảo trì An Phát','Bảo trì ứng dụng hiện tại trong 12 tháng.',24000000,-5,'WON',NULL),
        ('MT-ERP','minhtam@sales.example.test','[DEMO-KD] ERP Minh Tâm','Tích hợp kho, kế toán và báo cáo theo phòng ban.',240000000,30,'NEGOTIATION',NULL),
        ('MT-WEB','minhtam@sales.example.test','[DEMO-KD] Website Minh Tâm','Website giới thiệu doanh nghiệp và form tiếp nhận khách hàng.',60000000,15,'PROPOSAL',NULL),
        ('HL-ECOM','hoanglong@sales.example.test','[DEMO-KD] Thương mại điện tử Hoàng Long','Danh mục sản phẩm, đặt hàng và quản lý khách mua.',150000000,25,'QUALIFIED',NULL),
        ('GT-SAAS','greentech@sales.example.test','[DEMO-KD] SaaS GreenTech','Thuê bao phần mềm trong 12 tháng.',48000000,-2,'WON',NULL),
        ('TN-APP','thiennam@sales.example.test','[DEMO-KD] Ứng dụng Thiên Nam','Ứng dụng quản lý nội bộ cho thiết bị di động.',90000000,-7,'LOST','Khách hàng hoãn ngân sách triển khai.'),
        ('BV-HRM','banviet@sales.example.test','[DEMO-KD] HRM Bản Việt','Quản lý hồ sơ, chấm công và báo cáo nhân sự.',180000000,18,'NEW',NULL);
    INSERT INTO sales_opportunities(customer_id,title,requirements,expected_value,expected_close,stage,loss_reason)
    SELECT c.id,d.title,d.requirements,d.expected_value,DATE_ADD(demo_day,INTERVAL d.day_offset DAY),d.stage,d.loss_reason
    FROM sales_demo_opportunities d JOIN sales_customers c ON c.email=d.customer_email
    WHERE NOT EXISTS (SELECT 1 FROM sales_opportunities o WHERE o.customer_id=c.id AND o.title=d.title);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_quotes;
    CREATE TEMPORARY TABLE sales_demo_quotes (
        code VARCHAR(20), opportunity_code VARCHAR(20), revision INT, status VARCHAR(30), valid_days INT,
        discount DECIMAL(19,2), total DECIMAL(19,2), created_by BIGINT, approved BOOLEAN, version BIGINT
    );
    INSERT INTO sales_demo_quotes VALUES
        ('Q-AP-CRM','AP-CRM',1,'DRAFT',15,5000000,100000000,employee_a,FALSE,0),
        ('Q-MT-ERP','MT-ERP',1,'PENDING_APPROVAL',20,0,200000000,employee_a,FALSE,1),
        ('Q-MT-WEB1','MT-WEB',1,'RETURNED',15,0,60000000,employee_a,FALSE,2),
        ('Q-HL-ECOM','HL-ECOM',2,'APPROVED',15,0,100000000,employee_a,TRUE,2),
        ('Q-BV-HRM','BV-HRM',2,'SENT',15,0,100000000,employee_b,TRUE,3),
        ('Q-GT-SAAS','GT-SAAS',1,'ACCEPTED',20,0,48000000,employee_a,TRUE,4),
        ('Q-AP-MAINT','AP-MAINT',1,'ACCEPTED',20,0,24000000,employee_a,TRUE,4),
        ('Q-MT-WEB2','MT-WEB',2,'DRAFT',20,5000000,60000000,employee_a,FALSE,0),
        ('Q-BV-OLD','BV-HRM',1,'DECLINED',10,0,120000000,employee_b,TRUE,4),
        ('Q-HL-EXPIRED','HL-ECOM',1,'SENT',-1,0,120000000,employee_a,TRUE,3);
    INSERT INTO sales_quotations(opportunity_id,customer_name,customer_address,customer_tax_code,opportunity_title,
        revision,status,valid_until,discount_amount,total_amount,terms,created_by,approved_by,decision_note,version)
    SELECT o.id,c.name,c.address,c.tax_code,o.title,d.revision,d.status,DATE_ADD(demo_day,INTERVAL d.valid_days DAY),
        d.discount,d.total,'Dữ liệu giả lập. Thanh toán 40% khi ký, 60% sau nghiệm thu. Số tiền là giá trị báo giá mẫu.',
        d.created_by,IF(d.approved,manager_id,NULL),
        IF(d.status='RETURNED','[DEMO] Cần bổ sung phạm vi đào tạo và mốc bàn giao.','[DEMO] Bản ghi ở trạng thái mẫu để kiểm thử.'),d.version
    FROM sales_demo_quotes d JOIN sales_demo_opportunities op ON op.code=d.opportunity_code
    JOIN sales_customers c ON c.email=op.customer_email
    JOIN sales_opportunities o ON o.customer_id=c.id AND o.title=op.title
    WHERE NOT EXISTS (SELECT 1 FROM sales_quotations q WHERE q.opportunity_id=o.id AND q.revision=d.revision);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_lines;
    CREATE TEMPORARY TABLE sales_demo_lines (quote_code VARCHAR(20), product_code VARCHAR(20), quantity DECIMAL(12,2));
    INSERT INTO sales_demo_lines VALUES
        ('Q-AP-CRM','CRM',1),('Q-AP-CRM','DEPLOY',1),('Q-AP-CRM','TRAIN',1),
        ('Q-MT-ERP','CUSTOM',2),('Q-MT-ERP','DEPLOY',2),
        ('Q-MT-WEB1','WEB',1),
        ('Q-HL-ECOM','CUSTOM',1),('Q-HL-ECOM','DEPLOY',1),
        ('Q-BV-HRM','CRM',1),('Q-BV-HRM','DEPLOY',1),
        ('Q-GT-SAAS','SAAS',12),('Q-AP-MAINT','MAINT',12),
        ('Q-MT-WEB2','WEB',1),('Q-MT-WEB2','TRAIN',1),
        ('Q-BV-OLD','CRM',1),('Q-BV-OLD','DEPLOY',2),
        ('Q-HL-EXPIRED','CUSTOM',1),('Q-HL-EXPIRED','DEPLOY',2);
    INSERT INTO sales_quotation_lines(quotation_id,product_id,description,unit,quantity,unit_price)
    SELECT q.id,p.id,p.name,p.unit,d.quantity,pd.price
    FROM sales_demo_lines d JOIN sales_demo_quotes qd ON qd.code=d.quote_code
    JOIN sales_demo_opportunities op ON op.code=qd.opportunity_code
    JOIN sales_customers c ON c.email=op.customer_email
    JOIN sales_opportunities o ON o.customer_id=c.id AND o.title=op.title
    JOIN sales_quotations q ON q.opportunity_id=o.id AND q.revision=qd.revision
    JOIN sales_demo_products pd ON pd.code=d.product_code JOIN sales_products p ON p.name=pd.name
    WHERE NOT EXISTS (SELECT 1 FROM sales_quotation_lines l WHERE l.quotation_id=q.id AND l.product_id=p.id);

    INSERT INTO sales_contracts(quotation_id,contract_number,signed_date,end_date,signer,file_url,scope,milestones,payment_terms,created_by,status,legacy_record)
    SELECT q.id,CONCAT('DEMO-KD-',d.code),DATE_SUB(demo_day,INTERVAL IF(d.code='GT-SAAS',2,5) DAY),
        DATE_ADD(demo_day,INTERVAL IF(d.code='GT-SAAS',20,120) DAY),'[DEMO] Đại diện khách hàng',
        CONCAT('https://example.test/contracts/DEMO-KD-',d.code,'.pdf'),
        IF(d.code='GT-SAAS','Thuê bao SaaS cho 20 người dùng trong 12 tháng.','Bảo trì, sửa lỗi và hỗ trợ phần mềm trong 12 tháng.'),
        'Tuần 1 khảo sát. Tuần 2 cấu hình. Tuần 3 đào tạo và nghiệm thu.',
        'Thanh toán 40% khi ký, 60% sau nghiệm thu. Đây là điều khoản giả lập.',employee_a,'CONFIRMED',TRUE
    FROM sales_demo_opportunities d JOIN sales_customers c ON c.email=d.customer_email
    JOIN sales_opportunities o ON o.customer_id=c.id AND o.title=d.title
    JOIN sales_quotations q ON q.opportunity_id=o.id AND q.revision=1
    WHERE d.code IN ('GT-SAAS','AP-MAINT')
      AND NOT EXISTS (SELECT 1 FROM sales_contracts k WHERE k.quotation_id=q.id);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_handovers;
    CREATE TEMPORARY TABLE sales_demo_handovers (contract_number VARCHAR(100), department_id BIGINT, status VARCHAR(20), receiver BIGINT, note VARCHAR(1000));
    INSERT INTO sales_demo_handovers VALUES
        ('DEMO-KD-GT-SAAS',technical_department,'PENDING',NULL,NULL),
        ('DEMO-KD-GT-SAAS',accounting_department,'ACCEPTED',accountant_id,'[DEMO] Đã tiếp nhận lịch thanh toán.'),
        ('DEMO-KD-AP-MAINT',technical_department,'RETURNED',technician_id,'[DEMO] Cần làm rõ thời gian hỗ trợ và đầu mối nghiệm thu.'),
        ('DEMO-KD-AP-MAINT',accounting_department,'PENDING',NULL,NULL);
    INSERT INTO sales_handovers(contract_id,recipient_department_id,status,sent_by,received_by,response_note,responded_at,version)
    SELECT k.id,d.department_id,d.status,employee_a,d.receiver,d.note,IF(d.receiver IS NULL,NULL,NOW(6)),IF(d.receiver IS NULL,0,1)
    FROM sales_demo_handovers d JOIN sales_contracts k ON k.contract_number=d.contract_number
    WHERE NOT EXISTS (SELECT 1 FROM sales_handovers h WHERE h.contract_id=k.id AND h.recipient_department_id=d.department_id);

    DROP TEMPORARY TABLE IF EXISTS sales_demo_activities;
    CREATE TEMPORARY TABLE sales_demo_activities (opportunity_code VARCHAR(20), subject VARCHAR(200), days_offset INT, done BOOLEAN);
    INSERT INTO sales_demo_activities VALUES
        ('AP-CRM','[DEMO-KD] Gọi khảo sát nhu cầu CRM',-2,FALSE),
        ('MT-ERP','[DEMO-KD] Gửi phương án tích hợp ERP',-1,FALSE),
        ('HL-ECOM','[DEMO-KD] Hẹn trình bày giải pháp',2,FALSE),
        ('GT-SAAS','[DEMO-KD] Trao đổi gia hạn SaaS',10,FALSE),
        ('BV-HRM','[DEMO-KD] Xác nhận nhu cầu HRM hôm nay',0,FALSE),
        ('AP-MAINT','[DEMO-KD] Hoàn tất bàn giao bảo trì',-1,TRUE);
    INSERT INTO sales_activities(customer_id,opportunity_id,subject,notes,due_at,completed_at,created_by)
    SELECT c.id,o.id,d.subject,'Lịch chăm sóc giả lập để kiểm thử trạng thái.',
        TIMESTAMP(DATE_ADD(demo_day,INTERVAL d.days_offset DAY),'23:59:00'),IF(d.done,NOW(6),NULL),c.owner_id
    FROM sales_demo_activities d JOIN sales_demo_opportunities op ON op.code=d.opportunity_code
    JOIN sales_customers c ON c.email=op.customer_email
    JOIN sales_opportunities o ON o.customer_id=c.id AND o.title=op.title
    WHERE NOT EXISTS (SELECT 1 FROM sales_activities a WHERE a.customer_id=c.id AND a.subject=d.subject);

    -- Mark fixtures honestly rather than inventing a historical approval trail.
    INSERT INTO sales_events(customer_id,entity_type,entity_id,action,actor_id,details)
    SELECT c.id,'CUSTOMER',c.id,'DEMO_SEEDED',manager_id,
        'Dữ liệu giả lập được nạp từ seed_sales_demo.sql. Trạng thái ban đầu là fixture kiểm thử.'
    FROM sales_customers c JOIN sales_demo_customers d ON d.email=c.email
    WHERE NOT EXISTS (SELECT 1 FROM sales_events e WHERE e.customer_id=c.id AND e.action='DEMO_SEEDED');

    COMMIT;
    DO RELEASE_LOCK(CONCAT(DATABASE(), ':sales_demo_v1'));
END$$
DELIMITER ;
CALL hrm_seed_sales_demo_v1();
DROP PROCEDURE hrm_seed_sales_demo_v1;
SET time_zone = @sales_demo_old_timezone;

SELECT ma_nhan_vien AS demo_login,ho_ten,role FROM users
WHERE email IN ('manager@sales.example.test','employee-a@sales.example.test','employee-b@sales.example.test',
    'director@sales.example.test','technical-manager@sales.example.test',
                'accounting@sales.example.test','technical@sales.example.test') ORDER BY ma_nhan_vien;
