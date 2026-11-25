package com.hrm.sales;

import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.configuration.service.ConfigurationService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.DriverManager;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import static com.hrm.sales.SalesCommands.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.*;

/** Opt-in test against a disposable local MySQL instance, never the configured HRM database. */
@EnabledIfSystemProperty(named="sales.test.url", matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/")
class SalesIntegrationTest {
    private AnnotationConfigApplicationContext context;
    private String schema;
    private String serverUrl;
    private SalesWorkspaceService workspace;
    private SalesCommercialService commercial;
    private SalesContractService contracts;
    private JdbcTemplate jdbc;
    private long departmentId;
    private long manager;
    private long employee;
    private long otherEmployee;
    private long ceo;
    private long director;
    private long technicalManager;
    private long technicalDepartment;
    private SalesPricingService pricing;
    private SalesTechnicalService technical;
    private long accountant;
    private long accountantDepartment;

    @BeforeEach
    void prepare() throws Exception {
        serverUrl = System.getProperty("sales.test.url");
        schema = "sales_it_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = DriverManager.getConnection(serverUrl,"root",""); var statement = connection.createStatement()) {
            statement.execute("CREATE DATABASE " + schema + " CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci");
        }
        var source = new DriverManagerDataSource(serverUrl + schema + "?useUnicode=true&characterEncoding=UTF-8","root","");
        Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
        context = new AnnotationConfigApplicationContext();
        context.registerBean(DataSource.class,() -> source);
        context.register(Config.class);
        context.refresh();
        workspace = context.getBean(SalesWorkspaceService.class);
        commercial = context.getBean(SalesCommercialService.class);
        contracts = context.getBean(SalesContractService.class);
        jdbc = context.getBean(JdbcTemplate.class);
        pricing = context.getBean(SalesPricingService.class);
        technical = context.getBean(SalesTechnicalService.class);
        departmentId = jdbc.queryForObject("SELECT id FROM departments WHERE ten_phong='Kinh doanh' LIMIT 1",Long.class);
        accountantDepartment = workspace.insert("INSERT INTO departments(ten_phong,is_lock,created_at) VALUES ('Kế toán',b'0',NOW(6))");
        manager = user("Quản lý", "TRUONG_PHONG", departmentId);
        employee = user("Nhân viên A", "NHAN_VIEN", departmentId);
        otherEmployee = user("Nhân viên B", "NHAN_VIEN", departmentId);
        ceo = user("CEO", "CEO", null);
        accountant = user("Kế toán", "NHAN_VIEN", accountantDepartment);
        director = user("Giám đốc KD", "GIAM_DOC_PHONG_BAN", departmentId);
        technicalDepartment = workspace.insert("INSERT INTO departments(ten_phong,is_lock,created_at) VALUES ('Kỹ thuật',b'0',NOW(6))");
        technicalManager = user("Trưởng phòng KT", "TRUONG_PHONG", technicalDepartment);
        pricing.publish(ceo,new PricingPolicy(1L,true,BigDecimal.ZERO,new BigDecimal("1000000000"),new BigDecimal("2000000000"),new BigDecimal("5"),new BigDecimal("10"),"Thanh toán theo nghiệm thu",null,"Hạn mức kiểm thử"));
    }

    @AfterEach
    void cleanup() throws Exception {
        if (context != null) context.close();
        if (schema != null && schema.matches("sales_it_[a-f0-9]{32}")) {
            try (var connection = DriverManager.getConnection(serverUrl,"root",""); var statement = connection.createStatement()) {
                statement.execute("DROP DATABASE " + schema);
            }
        }
    }

    @Test
    void completeCommercialFlowWithPermissionAndImmutabilityGuards() throws Exception {
        long customer = workspace.saveCustomer(employee,null,new Customer("Khách kiểm thử","TEST-1","client@example.test","0900000011","HCM","Liên hệ",null,employee,true,0L));
        assertEquals(1,workspace.customers(employee,"").size());
        assertEquals(0,workspace.customers(otherEmployee,"").size());
        assertThrows(AppException.class,() -> workspace.customerDetail(otherEmployee,customer));
        assertThrows(AppException.class,() -> workspace.saveCustomer(employee,customer,new Customer("Khách kiểm thử","TEST-1",null,null,null,null,null,otherEmployee,true,0L)));
        long contact = workspace.addContact(employee,customer,new Contact("Đầu mối","Giám đốc","contact@example.test","0900000012"));
        workspace.updateContact(employee,customer,contact,new Contact("Đầu mối mới","Giám đốc","contact@example.test","0900000012"));
        long opportunity = workspace.saveOpportunity(employee,null,new Opportunity(customer,"Phần mềm kho","Triển khai kho",new BigDecimal("10000"),LocalDate.now().plusDays(10),0L));
        long product = workspace.saveProduct(ceo,null,new Product("Triển khai","Gói",new BigDecimal("10000"),true,0L,BigDecimal.ZERO,true,"Triển khai kho"));
        long quotation = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now().plusDays(20),new BigDecimal("100"),"Thanh toán theo nghiệm thu",List.of(new QuoteLine(product,"Triển khai kho",BigDecimal.ONE,new BigDecimal("10000")))));
        long managerQuote = commercial.createQuotation(manager,new Quotation(opportunity,LocalDate.now().plusDays(20),BigDecimal.ZERO,"Thanh toán theo nghiệm thu",List.of(new QuoteLine(product,"Triển khai kho",BigDecimal.ONE,BigDecimal.TEN))));
        commercial.transitionQuotation(manager,managerQuote,new Transition("SUBMIT",null,0L));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(manager,managerQuote,new Transition("APPROVE",null,1L)));
        commercial.transitionQuotation(employee,quotation,new Transition("SUBMIT",null,0L));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(employee,quotation,new Transition("APPROVE",null,1L)));
        commercial.transitionQuotation(manager,quotation,new Transition("APPROVE",null,1L));
        commercial.transitionQuotation(employee,quotation,new Transition("SEND",null,2L));
        commercial.transitionQuotation(employee,quotation,new Transition("ACCEPT","Email xác nhận",3L));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(employee,quotation,new Transition("DECLINE",null,4L)));
        workspace.saveCustomer(employee,customer,new Customer("Tên khách hàng mới","TEST-1","client@example.test","0900000011","HCM","Liên hệ",null,employee,true,0L));
        @SuppressWarnings("unchecked")
        var frozenQuote = (Map<String,Object>) commercial.quotationDetail(employee,quotation).get("quotation");
        assertEquals("Khách kiểm thử",frozenQuote.get("customer_name"));
        var pdf = new SalesQuotationPdf(commercial).generate(employee,quotation);
        assertTrue(pdf.length > 1000);
        assertEquals("%PDF-",new String(pdf,0,5,java.nio.charset.StandardCharsets.US_ASCII));
        var command = new ContractDraft(quotation,LocalDate.now().plusMonths(12),"Người ký","Đầu mối triển khai",0L);
        long contract = contracts.create(employee,command);
        assertEquals(contract,contracts.create(employee,command));
        assertNotEquals("WON",workspace.opportunities(employee).get(0).get("stage"));
        assertThrows(AppException.class,() -> commercial.sendHandover(employee,contract,new Handover(accountantDepartment)));
        contracts.transition(employee,contract,ct("SUBMIT",0L,null));
        contracts.transition(manager,contract,ct("APPROVE",1L,null));
        contracts.submitSigned(employee,contract,new SignedContract(2L,LocalDate.now(),"Người ký","Đại diện công ty","https://example.test/signed.pdf"));
        assertNotEquals("WON",workspace.opportunities(employee).get(0).get("stage"));
        contracts.transition(manager,contract,new ContractTransition("CONFIRM",3L,"Đã đối chiếu",true,true,true));
        // The reporting selector is never an authorization boundary: lists are scoped by the server.
        assertEquals(1,contracts.list(employee).size());
        assertTrue(contracts.list(otherEmployee).isEmpty());
        assertTrue(workspace.opportunities(otherEmployee).isEmpty());
        assertTrue(commercial.quotations(otherEmployee).isEmpty());
        assertEquals(1,contracts.list(manager).size());
        assertEquals(1,contracts.list(ceo).size());
        @SuppressWarnings("unchecked")
        var employeeOwners = (List<Map<String,Object>>)workspace.context(employee).get("owners");
        assertEquals(1,employeeOwners.size());
        assertEquals(employee,((Number)employeeOwners.get(0).get("id")).longValue());
        assertEquals("WON",workspace.opportunities(employee).get(0).get("stage"));
        long handover = commercial.sendHandover(employee,contract,new Handover(accountantDepartment));
        assertEquals(handover,commercial.sendHandover(employee,contract,new Handover(accountantDepartment)));
        assertEquals(1,commercial.handovers(accountant).size());
        assertThrows(AppException.class,() -> commercial.respondHandover(otherEmployee,handover,new Transition("ACCEPT",null,0L)));
        commercial.respondHandover(accountant,handover,new Transition("RETURN","Cần thông tin lịch thanh toán",0L));
        commercial.respondHandover(employee,handover,new Transition("RESUBMIT","Đối chiếu lịch trong điều khoản hợp đồng",1L));
        commercial.respondHandover(accountant,handover,new Transition("ACCEPT",null,2L));
        assertThrows(AppException.class,() -> commercial.respondHandover(accountant,handover,new Transition("RETURN","Cũ",2L)));
        assertEquals("ACCEPTED",commercial.handovers(ceo).get(0).get("status"));
        assertThrows(AppException.class,() -> workspace.products(accountant));
        assertThrows(AppException.class,() -> workspace.saveCustomer(employee,null,new Customer("Trùng email",null,"client@example.test",null,null,null,null,employee,true,0L)));
        long task = workspace.addActivity(employee,new Activity(customer,null,"Chăm sóc sau bán",null,java.time.LocalDateTime.now().minusHours(1)));
        var reminderConfig = mock(ConfigurationService.class);
        when(reminderConfig.requireInteger("sales.renewal_notice_days")).thenReturn(400);
        var reminderNotifications = mock(NotificationService.class);
        var reminders = new SalesReminderService(jdbc,reminderConfig,reminderNotifications);
        reminders.remind();
        reminders.remind();
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM sales_reminders",Integer.class));
        verify(reminderNotifications,times(2)).createNotification(eq(employee),eq("SALES_REMINDER"),anyString(),anyString(),eq("binh_thuong"),eq("/sales"));
        workspace.completeActivity(employee,task);
        workspace.completeActivity(employee,task);
        assertNotNull(workspace.activities(employee).get(0).get("completed_at"));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_events SET action='TAMPERED' LIMIT 1"));
    }

    @Test
    void concurrentContractCreationCreatesOneContract() throws Exception {
        long customer = workspace.saveCustomer(employee,null,new Customer("Concurrent",null,null,null,null,null,null,employee,true,0L));
        long opportunity = workspace.saveOpportunity(employee,null,new Opportunity(customer,"Cơ hội","Dịch vụ",BigDecimal.TEN,LocalDate.now(),0L));
        long product = workspace.saveProduct(ceo,null,new Product("Dịch vụ","Gói",BigDecimal.TEN,true,0L,BigDecimal.ZERO,true,"Gói"));
        long quote = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Thanh toán theo nghiệm thu",List.of(new QuoteLine(product,"Gói",BigDecimal.ONE,BigDecimal.TEN))));
        commercial.transitionQuotation(employee,quote,new Transition("SUBMIT",null,0L));
        commercial.transitionQuotation(manager,quote,new Transition("APPROVE",null,1L));
        commercial.transitionQuotation(employee,quote,new Transition("SEND",null,2L));
        commercial.transitionQuotation(employee,quote,new Transition("ACCEPT","Xác nhận",3L));
        var command = new ContractDraft(quote,LocalDate.now(),"Người ký",null,0L);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var start = new CountDownLatch(1);
            Callable<Long> create = () -> { start.await(); return contracts.create(employee,command); };
            var first = executor.submit(create);
            var second = executor.submit(create);
            start.countDown();
            assertEquals(first.get(10,TimeUnit.SECONDS),second.get(10,TimeUnit.SECONDS));
            assertEquals(1,contracts.list(employee).size());
        } finally { executor.shutdownNow(); }
    }

    private long user(String name,String role,Long department) {
        return workspace.insert("INSERT INTO users(ho_ten,email,password_hash,role,department_id,active,created_at,so_nguoi_phu_thuoc) VALUES (?,?,?,?,?,b'1',NOW(6),0)",
                name,UUID.randomUUID()+"@example.test","test-only",role,department);
    }

    @Test
    void riskBasedRoutingTechnicalGateAndFrozenPolicy() {
        long policyId = ((Number)pricing.policy(ceo).get("id")).longValue();
        assertThrows(AppException.class,() -> pricing.publish(manager,new PricingPolicy(policyId,true,BigDecimal.TEN,BigDecimal.TEN,BigDecimal.TEN,BigDecimal.ZERO,BigDecimal.ZERO,"Chuẩn",null,"Không có quyền")));
        pricing.publish(ceo,new PricingPolicy(policyId,true,new BigDecimal("100"),new BigDecimal("200"),new BigDecimal("1000"),new BigDecimal("5"),new BigDecimal("10"),"Chuẩn",null,"Hạn mức kiểm thử phân cấp"));
        long customer = workspace.saveCustomer(employee,null,new Customer("Phân cấp",null,null,null,null,null,null,employee,true,0L));
        long opportunity = workspace.saveOpportunity(employee,null,new Opportunity(customer,"Website","Gói website chuẩn",new BigDecimal("100"),LocalDate.now(),0L));
        assertThrows(AppException.class,() -> workspace.saveProduct(manager,null,new Product("Web","Gói",new BigDecimal("100"),true,0L)));
        long product = workspace.saveProduct(director,null,new Product("Web","Gói",new BigDecimal("100"),true,0L,new BigDecimal("80"),true,"Web chuẩn gồm mã nguồn dự án"));
        var lines = List.of(new QuoteLine(product,"Web chuẩn gồm mã nguồn dự án",BigDecimal.ONE,new BigDecimal("100")));
        long standard = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Chuẩn",lines));
        commercial.transitionQuotation(employee,standard,new Transition("SEND",null,0L));
        assertEquals("SENT",quote(standard).get("status")); assertNull(quote(standard).get("approved_by"));
        assertEquals("STANDARD",quote(standard).get("approval_level")); assertNotNull(quote(standard).get("policy_snapshot"));

        long managerQuote = commercial.createQuotation(director,new Quotation(opportunity,LocalDate.now(),new BigDecimal("5"),"Chuẩn",lines));
        commercial.transitionQuotation(director,managerQuote,new Transition("SUBMIT",null,0L));
        assertEquals("MANAGER",quote(managerQuote).get("approval_level")); // Author role does not raise the tier.
        assertThrows(AppException.class,() -> commercial.transitionQuotation(director,managerQuote,new Transition("APPROVE",null,1L)));
        commercial.transitionQuotation(manager,managerQuote,new Transition("APPROVE",null,1L));

        long directorQuote = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),new BigDecimal("6"),"Chuẩn",lines));
        commercial.transitionQuotation(employee,directorQuote,new Transition("SUBMIT",null,0L));
        assertEquals("DIRECTOR",quote(directorQuote).get("approval_level"));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(manager,directorQuote,new Transition("APPROVE",null,1L)));
        String snapshot = quote(directorQuote).get("policy_snapshot").toString();
        long current = ((Number)pricing.policy(ceo).get("id")).longValue();
        pricing.publish(ceo,new PricingPolicy(current,true,BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,"Chuẩn",director,"Thay đổi cho báo giá tiếp theo"));
        assertEquals(snapshot,quote(directorQuote).get("policy_snapshot").toString());
        commercial.transitionQuotation(director,directorQuote,new Transition("APPROVE",null,1L));
        long delegated = commercial.createQuotation(ceo,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Điều khoản ngoại lệ",lines));
        commercial.transitionQuotation(ceo,delegated,new Transition("SUBMIT",null,0L));
        assertEquals("CEO",quote(delegated).get("approval_level"));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(ceo,delegated,new Transition("APPROVE",null,1L)));
        commercial.transitionQuotation(director,delegated,new Transition("APPROVE",null,1L));

        var customLines = List.of(new QuoteLine(product,"Tích hợp ERP ngoài gói",BigDecimal.ONE,new BigDecimal("100")));
        long custom = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Chuẩn",customLines,true,true,false,false,false,"Cần tích hợp",technicalDepartment));
        commercial.transitionQuotation(employee,custom,new Transition("SUBMIT",null,0L));
        assertEquals("PENDING_TECHNICAL",quote(custom).get("status"));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(ceo,custom,new Transition("APPROVE",null,1L)));
        assertThrows(AppException.class,() -> technical.queue(employee));
        assertThrows(AppException.class,() -> commercial.quotationDetail(technicalManager,custom));
        var inbox = technical.queue(technicalManager); assertEquals(1,inbox.size()); assertFalse(inbox.get(0).containsKey("total_amount"));
        var review = new TechnicalReview(1L,true,new BigDecimal("20"),"Khả thi","Bốn tuần sau khi đủ tài liệu","Nguồn lực hiện tại",false);
        assertThrows(AppException.class,() -> technical.review(accountant,custom,review));
        technical.review(technicalManager,custom,review);
        assertEquals("PENDING_APPROVAL",quote(custom).get("status"));
        assertEquals("APPROVED",quote(custom).get("technical_status"));
        assertThrows(AppException.class,() -> technical.review(technicalManager,custom,review));
        commercial.transitionQuotation(ceo,custom,new Transition("APPROVE",null,2L));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_pricing_policies SET enabled=FALSE LIMIT 1"));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_technical_reviews SET feasibility='Sửa' WHERE quotation_id=?",custom));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_quotations SET terms='Sửa điều khoản' WHERE id=?",standard));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_quotations SET policy_snapshot='{}' WHERE id=?",standard));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_quotation_lines SET unit_price=1 WHERE quotation_id=?",standard));

        // Returned technical assessments remain historical; a new quote revision is required.
        long returned = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Chuẩn",customLines,true,false,false,false,false,"Chưa rõ tích hợp",technicalDepartment));
        commercial.transitionQuotation(employee,returned,new Transition("SUBMIT",null,0L));
        technical.review(technicalManager,returned,new TechnicalReview(1L,false,BigDecimal.ONE,"Thiếu tài liệu ERP","Cần chốt API","Chưa xác định",false));
        assertEquals("RETURNED",quote(returned).get("status"));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(employee,returned,new Transition("SUBMIT",null,2L)));

        long technicalEscalation = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Chuẩn",customLines,true,false,false,false,false,"Nguồn lực cần đánh giá",technicalDepartment));
        commercial.transitionQuotation(employee,technicalEscalation,new Transition("SUBMIT",null,0L));
        technical.review(technicalManager,technicalEscalation,new TechnicalReview(1L,true,BigDecimal.TEN,"Khả thi","Sau khi mua bản quyền","Phát sinh bản quyền ngoài ngân sách",true));
        assertEquals("CEO",quote(technicalEscalation).get("approval_level"));

        long stale = commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now(),BigDecimal.ZERO,"Chuẩn",lines));
        workspace.saveProduct(director,product,new Product("Web","Gói",new BigDecimal("110"),true,0L,new BigDecimal("80"),true,"Web chuẩn gồm mã nguồn dự án"));
        assertThrows(AppException.class,() -> commercial.transitionQuotation(employee,stale,new Transition("SUBMIT",null,0L)));
        assertEquals("DRAFT",quote(stale).get("status"));
    }

    @Test
    void demoSeedRemainsCompatibleAndIdempotent() throws Exception {
        String client=System.getProperty("sales.test.mysql");
        Assumptions.assumeTrue(client!=null,"Optional mysql client is required to verify SQL DELIMITER script");
        var port=java.net.URI.create(serverUrl.substring(5)).getPort();
        var script=java.nio.file.Path.of("database/seed_sales_demo.sql").toAbsolutePath();
        for (int i=0;i<2;i++) {
            var process=new ProcessBuilder(client,"-h","127.0.0.1","-P",String.valueOf(port),"-u","root","--default-character-set=utf8mb4",schema)
                    .redirectInput(script.toFile()).redirectErrorStream(true).start();
            var output=new String(process.getInputStream().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
            assertEquals(0,process.waitFor(),output);
        }
        assertEquals(8,jdbc.queryForObject("SELECT COUNT(*) FROM sales_products WHERE name LIKE '[DEMO-KD]%'",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE ma_nhan_vien='79000104' AND role='GIAM_DOC_PHONG_BAN'",Integer.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE ma_nhan_vien='79000302' AND role='TRUONG_PHONG'",Integer.class));
    }

    @Test
    void contractRequiresReviewIndependentSignedVerificationAndImmutableHistory() {
        long quotation=acceptedQuote("Hợp đồng có rà soát","Thanh toán theo nghiệm thu");
        var draft=new ContractDraft(quotation,LocalDate.now().plusMonths(12),"Đại diện khách","Đầu mối kỹ thuật: Lan",0L);
        long id=contracts.create(employee,draft);
        var initial=contract(id);
        assertTrue(initial.get("contract_number").toString().matches("KD-[0-9]{4}-[0-9]{6,}"));
        assertEquals("DRAFT",initial.get("status")); assertNull(initial.get("signed_date"));
        assertEquals("Gói chuẩn · 1.00 Gói",initial.get("scope"));
        assertEquals("Thanh toán theo nghiệm thu",initial.get("payment_terms"));
        assertThrows(AppException.class,() -> contracts.detail(otherEmployee,id));
        assertThrows(AppException.class,() -> contracts.submitSigned(employee,id,new SignedContract(0L,LocalDate.now(),"Khách","Công ty","https://example.test/signed.pdf")));
        assertThrows(AppException.class,() -> commercial.sendHandover(employee,id,new Handover(accountantDepartment)));
        contracts.update(employee,id,new ContractDraft(quotation,draft.endDate(),"Đại diện đã xác minh","Đầu mối đã thống nhất",0L));
        contracts.transition(employee,id,ct("SUBMIT",1L,null));
        assertThrows(AppException.class,() -> contracts.transition(employee,id,ct("APPROVE",2L,null)));
        assertThrows(AppException.class,() -> contracts.transition(manager,id,ct("RETURN",2L,null)));
        contracts.transition(manager,id,ct("RETURN",2L,"Bổ sung đầu mối"));
        contracts.update(employee,id,new ContractDraft(quotation,draft.endDate(),"Đại diện đã xác minh","Lan - trưởng nhóm triển khai",3L));
        contracts.transition(employee,id,ct("SUBMIT",4L,null));
        contracts.transition(manager,id,ct("APPROVE",5L,null));
        assertThrows(AppException.class,() -> contracts.update(employee,id,new ContractDraft(quotation,draft.endDate(),"Sửa sau duyệt",null,6L)));
        assertThrows(AppException.class,() -> contracts.submitSigned(employee,id,new SignedContract(6L,LocalDate.now().plusDays(1),"Khách","Công ty","https://example.test/signed.pdf")));
        assertThrows(AppException.class,() -> contracts.submitSigned(employee,id,new SignedContract(6L,LocalDate.now(),"Khách","Công ty","http://example.test/signed.pdf")));
        contracts.submitSigned(employee,id,new SignedContract(6L,LocalDate.now(),"Đại diện KH","CEO công ty","https://example.test/signed-1.pdf"));
        assertEquals("SIGNED_PENDING_CONFIRMATION",contract(id).get("status"));
        assertNotEquals("WON",workspace.opportunities(employee).get(0).get("stage"));
        assertThrows(AppException.class,() -> contracts.transition(manager,id,ct("CONFIRM",7L,null)));
        assertThrows(AppException.class,() -> contracts.transition(employee,id,new ContractTransition("CONFIRM",7L,null,true,true,true)));
        contracts.transition(manager,id,ct("RETURN_SIGNED",7L,"Bản scan thiếu trang"));
        contracts.submitSigned(manager,id,new SignedContract(8L,LocalDate.now(),"Đại diện KH","CEO công ty","https://example.test/signed-2.pdf"));
        assertThrows(AppException.class,() -> contracts.transition(manager,id,new ContractTransition("CONFIRM",9L,null,true,true,true)));
        contracts.transition(director,id,new ContractTransition("CONFIRM",9L,"Đã đối chiếu đủ trang và thẩm quyền",true,true,true));
        assertEquals("CONFIRMED",contract(id).get("status"));
        assertEquals("https://example.test/signed-2.pdf",contract(id).get("file_url"));
        assertEquals("WON",workspace.opportunities(employee).get(0).get("stage"));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM sales_contract_signatures WHERE contract_id=?",Integer.class,id));
        assertEquals(11,jdbc.queryForObject("SELECT COUNT(*) FROM sales_contract_history WHERE contract_id=?",Integer.class,id));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_contracts SET signer='Sửa' WHERE id=?",id));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("UPDATE sales_contract_signatures SET file_url='https://example.test/other' WHERE contract_id=?",id));
        assertThrows(org.springframework.dao.DataAccessException.class,() -> jdbc.update("DELETE FROM sales_contract_history WHERE contract_id=?",id));
        commercial.sendHandover(employee,id,new Handover(accountantDepartment));
    }

    @Test
    void contractReviewUsesFrozenAuthorityAndManagersCannotApproveTheirOwnDrafts() {
        long quotation=acceptedQuote("Hợp đồng tự lập","Thanh toán theo nghiệm thu");
        long id=contracts.create(manager,new ContractDraft(quotation,LocalDate.now(),"Khách",null,0L));
        contracts.transition(manager,id,ct("SUBMIT",0L,null));
        assertThrows(AppException.class,() -> contracts.transition(manager,id,ct("APPROVE",1L,null)));
        contracts.transition(director,id,ct("APPROVE",1L,null));
        contracts.submitSigned(manager,id,new SignedContract(2L,LocalDate.now(),"Khách","CEO","https://example.test/signed.pdf"));
        assertThrows(AppException.class,() -> contracts.transition(manager,id,new ContractTransition("CONFIRM",3L,null,true,true,true)));
        contracts.transition(director,id,new ContractTransition("CONFIRM",3L,null,true,true,true));

        long exceptional=acceptedQuote("Hợp đồng ngoại lệ","Điều khoản ngoài mẫu");
        long special=contracts.create(employee,new ContractDraft(exceptional,LocalDate.now(),"Khách",null,0L));
        contracts.transition(employee,special,ct("SUBMIT",0L,null));
        assertThrows(AppException.class,() -> contracts.transition(manager,special,ct("APPROVE",1L,null)));
        assertThrows(AppException.class,() -> contracts.transition(director,special,ct("APPROVE",1L,null)));
        contracts.transition(ceo,special,ct("APPROVE",1L,null));
    }

    @Test
    void commercialChangesReturnToQuotationInsteadOfEditingApprovedTerms() {
        long quotation=acceptedQuote("Cần đổi phạm vi","Thanh toán theo nghiệm thu");
        long id=contracts.create(employee,new ContractDraft(quotation,LocalDate.now(),"Khách",null,0L));
        contracts.transition(employee,id,ct("SUBMIT",0L,null));
        contracts.transition(manager,id,ct("APPROVE",1L,null));
        assertThrows(AppException.class,() -> contracts.transition(employee,id,ct("REQUEST_QUOTE_REVISION",2L,null)));
        contracts.transition(employee,id,ct("REQUEST_QUOTE_REVISION",2L,"Khách muốn bổ sung tính năng"));
        assertEquals("CANCELLED",contract(id).get("status"));
        assertEquals("SUPERSEDED",quote(quotation).get("status"));
        var oldLine=jdbc.queryForMap("SELECT * FROM sales_quotation_lines WHERE quotation_id=?",quotation);
        long next=commercial.createQuotation(employee,new Quotation(((Number)quote(quotation).get("opportunity_id")).longValue(),LocalDate.now().plusDays(10),BigDecimal.ZERO,"Thanh toán theo nghiệm thu",
                List.of(new QuoteLine(((Number)oldLine.get("product_id")).longValue(),"Gói chuẩn",BigDecimal.ONE,BigDecimal.TEN))));
        assertEquals(2,((Number)quote(next).get("revision")).intValue());
        assertEquals("DRAFT",quote(next).get("status"));
        assertThrows(AppException.class,() -> contracts.create(employee,new ContractDraft(next,LocalDate.now(),"Khách",null,0L)));
    }

    private long acceptedQuote(String name,String terms) {
        long customer=workspace.saveCustomer(employee,null,new Customer(name,null,null,null,null,null,null,employee,true,0L));
        long opportunity=workspace.saveOpportunity(employee,null,new Opportunity(customer,name,"Dịch vụ",BigDecimal.TEN,LocalDate.now(),0L));
        long product=workspace.saveProduct(director,null,new Product(name,"Gói",BigDecimal.TEN,true,0L,BigDecimal.ZERO,true,"Gói chuẩn"));
        long quote=commercial.createQuotation(employee,new Quotation(opportunity,LocalDate.now().plusDays(10),BigDecimal.ZERO,terms,List.of(new QuoteLine(product,"Gói chuẩn",BigDecimal.ONE,BigDecimal.TEN))));
        commercial.transitionQuotation(employee,quote,new Transition("SUBMIT",null,0L));
        commercial.transitionQuotation("CEO".equals(quote(quote).get("approval_level")) ? ceo : manager,quote,new Transition("APPROVE",null,1L));
        commercial.transitionQuotation(employee,quote,new Transition("SEND",null,2L));
        commercial.transitionQuotation(employee,quote,new Transition("ACCEPT","Khách xác nhận",3L));
        return quote;
    }
    private Map<String,Object> contract(long id) { return jdbc.queryForMap("SELECT * FROM sales_contracts WHERE id=?",id); }
    private static ContractTransition ct(String action,long version,String note) { return new ContractTransition(action,version,note,false,false,false); }

    private Map<String,Object> quote(long id) { return jdbc.queryForMap("SELECT * FROM sales_quotations WHERE id=?",id); }

    @Configuration
    @EnableTransactionManagement
    static class Config {
        @Bean JdbcTemplate jdbc(DataSource dataSource) { return new JdbcTemplate(dataSource); }
        @Bean PlatformTransactionManager transactionManager(DataSource dataSource) { return new DataSourceTransactionManager(dataSource); }
        @Bean SalesAccess access(JdbcTemplate jdbc) { return new SalesAccess(jdbc); }
        @Bean SalesWorkspaceService workspace(JdbcTemplate jdbc,SalesAccess access) { return new SalesWorkspaceService(jdbc,access); }
        @Bean SalesContractService contracts(JdbcTemplate jdbc,SalesAccess access,SalesWorkspaceService workspace) { return new SalesContractService(jdbc,workspace,access,mock(NotificationService.class)); }
        @Bean SalesPricingService pricing(JdbcTemplate jdbc,SalesAccess access,SalesWorkspaceService workspace) { return new SalesPricingService(jdbc,access,workspace); }
        @Bean SalesTechnicalService technical(JdbcTemplate jdbc,SalesAccess access,SalesWorkspaceService workspace) { return new SalesTechnicalService(jdbc,access,workspace); }
        @Bean SalesCommercialService commercial(SalesWorkspaceService workspace,SalesAccess access,JdbcTemplate jdbc,SalesPricingService pricing) { return new SalesCommercialService(workspace,access,mock(NotificationService.class),jdbc,pricing); }
    }
}
