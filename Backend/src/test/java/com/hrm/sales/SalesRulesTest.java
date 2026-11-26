package com.hrm.sales;

import com.hrm.common.entity.Role;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class SalesRulesTest {
    private final SalesAccess access = new SalesAccess(null);

    @Test
    void employeeCannotReadAnotherOwnersCustomerOrAnotherDepartment() {
        var employee = new SalesAccess.Actor(12, Role.NHAN_VIEN, 4L, "SALES");
        assertDoesNotThrow(() -> access.requireCustomer(employee, Map.of("department_id",4L,"owner_id",12L)));
        assertThrows(AppException.class, () -> access.requireCustomer(employee, Map.of("department_id",4L,"owner_id",13L)));
        assertThrows(AppException.class, () -> access.requireCustomer(employee, Map.of("department_id",5L,"owner_id",12L)));
    }

    @Test
    void managerSeesOnlyTheirDepartmentAndCeoSeesAll() {
        var manager = new SalesAccess.Actor(12, Role.TRUONG_PHONG, 4L, "SALES");
        assertDoesNotThrow(() -> access.requireCustomer(manager, Map.of("department_id",4L,"owner_id",13L)));
        assertThrows(AppException.class, () -> access.requireCustomer(manager, Map.of("department_id",5L,"owner_id",13L)));
        assertDoesNotThrow(() -> access.requireCustomer(new SalesAccess.Actor(1,Role.CEO,null,"OTHER"), Map.of("department_id",5L,"owner_id",13L)));
    }

    @Test
    void recipientCannotUseSalesPermissions() {
        var accountant = new SalesAccess.Actor(12,Role.TRUONG_PHONG,4L,"ACCOUNTING");
        assertThrows(AppException.class, () -> access.requireSales(accountant));
        assertThrows(AppException.class, () -> access.requireCustomer(accountant,Map.of("department_id",4L,"owner_id",12L)));
    }

    @Test
    void normalizesExistingDepartmentNames() {
        assertEquals("SALES",SalesAccess.kind(" Phòng Kinh Doanh "));
        assertEquals("TECHNICAL",SalesAccess.kind("Công nghệ"));
        assertEquals("TECHNICAL",SalesAccess.kind("Phòng Công nghệ"));
        assertEquals("TECHNICAL",SalesAccess.kind("Kỹ thuật"));
        assertEquals("ACCOUNTING",SalesAccess.kind("Tài chính - Kế toán"));
        assertEquals("ACCOUNTING",SalesAccess.kind("Phòng Tài chính - Kế toán"));
        assertEquals("ACCOUNTING",SalesAccess.kind("Kế toán"));
        assertEquals("OTHER",SalesAccess.kind("Nhân sự"));
    }

    @Test
    void totalsUseDecimalRoundingAndRejectExcessDiscount() {
        var line = new SalesCommands.QuoteLine(1L,"Triển khai",new BigDecimal("1.25"),new BigDecimal("123.45"));
        assertEquals(new BigDecimal("144.31"),SalesCommercialService.quotationTotal(List.of(line),new BigDecimal("10")));
        assertThrows(AppException.class, () -> SalesCommercialService.quotationTotal(List.of(line),new BigDecimal("200")));
    }

    @Test
    void cannotSkipQuotationApprovalOrChangeAcceptedQuotation() {
        assertEquals("PENDING_APPROVAL",SalesCommercialService.quoteTarget("DRAFT","SUBMIT"));
        assertEquals("APPROVED",SalesCommercialService.quoteTarget("PENDING_APPROVAL","APPROVE"));
        assertThrows(AppException.class, () -> SalesCommercialService.quoteTarget("DRAFT","ACCEPT"));
        assertThrows(AppException.class, () -> SalesCommercialService.quoteTarget("ACCEPTED","RETURN"));
    }

    @Test
    void staleWritesAreRejected() {
        assertDoesNotThrow(() -> SalesWorkspaceService.version(Map.of("version",3L),3L));
        assertThrows(AppException.class, () -> SalesWorkspaceService.version(Map.of("version",3L),2L));
    }
}
