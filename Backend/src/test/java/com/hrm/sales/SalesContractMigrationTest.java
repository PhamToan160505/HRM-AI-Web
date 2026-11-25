package com.hrm.sales;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.sql.DriverManager;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfSystemProperty(named="sales.test.url",matches="jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/")
class SalesContractMigrationTest {
    @Test void upgradingPreservesPreviouslySignedContractsWithoutInventingApprovers() throws Exception {
        String server=System.getProperty("sales.test.url");
        String schema="sales_legacy_"+UUID.randomUUID().toString().replace("-","");
        try (var connection=DriverManager.getConnection(server,"root","");var statement=connection.createStatement()) {
            statement.execute("CREATE DATABASE "+schema+" CHARACTER SET utf8mb4");
        }
        try {
            var source=new DriverManagerDataSource(server+schema,"root","");
            Flyway.configure().dataSource(source).target("32").locations("classpath:db/migration").load().migrate();
            var jdbc=new JdbcTemplate(source);
            Long department=jdbc.queryForObject("SELECT id FROM departments WHERE ten_phong='Kinh doanh' LIMIT 1",Long.class);
            jdbc.update("INSERT INTO users(id,ho_ten,email,password_hash,role,department_id,active,created_at,so_nguoi_phu_thuoc) VALUES (900001,'Nhân viên','legacy@example.test','test-only','NHAN_VIEN',?,b'1',NOW(6),0)",department);
            jdbc.update("INSERT INTO sales_customers(id,department_id,owner_id,name,active) VALUES (900001,?,900001,'Khách lịch sử',TRUE)",department);
            jdbc.update("INSERT INTO sales_opportunities(id,customer_id,title,requirements,expected_value,expected_close,stage) VALUES (900001,900001,'Dự án lịch sử','Phạm vi cũ',100,CURDATE(),'WON')");
            jdbc.update("INSERT INTO sales_quotations(id,opportunity_id,customer_name,opportunity_title,revision,status,valid_until,total_amount,terms,created_by) VALUES (900001,900001,'Khách lịch sử','Dự án lịch sử',1,'ACCEPTED',CURDATE(),100,'Điều khoản cũ',900001)");
            jdbc.update("INSERT INTO sales_contracts(id,quotation_id,contract_number,signed_date,end_date,signer,file_url,scope,milestones,payment_terms,created_by) VALUES (900001,900001,'OLD-01',CURDATE(),DATE_ADD(CURDATE(),INTERVAL 1 YEAR),'Người ký cũ','https://example.test/old.pdf','Phạm vi cũ','Mốc cũ','Thanh toán cũ',900001)");
            Flyway.configure().dataSource(source).locations("classpath:db/migration").load().migrate();
            var contract=jdbc.queryForMap("SELECT * FROM sales_contracts WHERE id=900001");
            assertEquals("CONFIRMED",contract.get("status"));
            assertEquals(Boolean.TRUE,contract.get("legacy_record"));
            assertEquals("OLD-01",contract.get("contract_number"));
            assertEquals("https://example.test/old.pdf",contract.get("file_url"));
            assertEquals("Phạm vi cũ",contract.get("scope"));
            assertNull(contract.get("reviewed_by")); assertNull(contract.get("confirmed_by"));
            assertEquals("LEGACY_IMPORTED",jdbc.queryForObject("SELECT action FROM sales_contract_history WHERE contract_id=900001",String.class));
            assertEquals("WON",jdbc.queryForObject("SELECT stage FROM sales_opportunities WHERE id=900001",String.class));
        } finally {
            if (schema.matches("sales_legacy_[a-f0-9]{32}")) {
                try (var connection=DriverManager.getConnection(server,"root","");var statement=connection.createStatement()) { statement.execute("DROP DATABASE "+schema); }
            }
        }
    }
}
