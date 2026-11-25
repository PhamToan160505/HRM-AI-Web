package com.hrm.sales;

import com.hrm.common.entity.Role;
import com.hrm.exception.AppException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class SalesPricingTest {
    private Map<String,Object> policy() {
        return new HashMap<>(Map.of("enabled",true,"standard_max",100,"manager_max",200,"director_max",1000,
                "manager_discount",5,"director_discount",10,"standard_terms","Chuẩn"));
    }
    private Map<String,Object> quote(int total,int discount) {
        return new HashMap<>(Map.of("terms","Chuẩn","total_amount",total,"discount_amount",discount));
    }
    private Map<String,Object> line(int price,int floor) {
        return new HashMap<>(Map.of("catalog_price",100,"unit_price",price,"floor_price",floor,"quantity",1,
                "standard_package",true,"description","Gói chuẩn","standard_scope","Gói chuẩn"));
    }
    private SalesPricingService.Decision evaluate(Map<String,Object> quote,Map<String,Object> line) {
        return SalesPricingService.evaluate(policy(),quote,List.of(line));
    }
    @Test void standardQuoteIsSystemEligibleWithoutHumanApproval() {
        var decision = evaluate(quote(100,0),line(100,80));
        assertEquals("STANDARD",decision.level());
        assertFalse(decision.technical());
    }
    @Test void effectiveDiscountIncludesLinePriceAndGlobalDiscountAndRoundsConservatively() {
        assertEquals("MANAGER",evaluate(quote(95,0),line(95,80)).level());
        assertEquals("DIRECTOR",evaluate(quote(94,0),line(94,80)).level());
        assertEquals("DIRECTOR",evaluate(quote(92,3),line(95,80)).level());
        assertEquals("CEO",evaluate(quote(89,0),line(89,80)).level());
        var tiny = quote(95,0); tiny.put("total_amount",new BigDecimal("94.999999"));
        assertEquals("DIRECTOR",evaluate(tiny,line(95,80)).level());
    }
    @Test void amountAndFloorAreIndependentGates() {
        var line = line(95,80); line.put("quantity",3);
        assertEquals("DIRECTOR",evaluate(quote(285,0),line).level());
        line.put("quantity",11);
        assertEquals("CEO",evaluate(quote(1045,0),line).level());
        assertEquals("CEO",evaluate(quote(95,0),line(95,96)).level());
        assertEquals("CEO",evaluate(quote(95,5),line(100,96)).level());
    }
    @Test void customizedScopeGoesToTechnicalBeforeCommercialAndStandardSourceHandoverDoesNotEscalate() {
        var line = line(100,80); line.put("description","Phạm vi mới");
        var decision = evaluate(quote(100,0),line);
        assertTrue(decision.technical()); assertEquals("MANAGER",decision.level());
        for (String flag : List.of("custom_scope","new_technology","resource_exception")) {
            var quote = quote(100,0); quote.put(flag,true);
            assertTrue(evaluate(quote,line(100,80)).technical());
        }
        assertEquals("STANDARD",evaluate(quote(100,0),line(100,80)).level());
    }
    @Test void exceptionsUseHighestAuthorityEvenWhenPriceIsStandard() {
        for (String flag : List.of("resource_exception","exclusive_rights","strategic_exception")) {
            var quote = quote(100,0); quote.put(flag,true);
            assertEquals("CEO",evaluate(quote,line(100,80)).level());
        }
        var terms = quote(100,0); terms.put("terms","Công nợ đặc biệt");
        assertEquals("CEO",evaluate(terms,line(100,80)).level());
        assertEquals("CEO",evaluate(quote(0,100),line(100,0)).level());
    }
    @Test void noInventedDefaultPolicyAndNoUnversionedLegacySnapshot() {
        var disabled = policy(); disabled.put("enabled",false);
        assertThrows(AppException.class,() -> SalesPricingService.evaluate(disabled,quote(100,0),List.of(line(100,80))));
        var legacy = line(100,80); legacy.remove("catalog_price");
        assertThrows(AppException.class,() -> evaluate(quote(100,0),legacy));
    }
    @Test void distinctAuthorityAndNoSelfApprovalWithExplicitDelegation() {
        var quote = new HashMap<String,Object>(Map.of("created_by",5L,"approval_level","DIRECTOR"));
        var manager = new SalesAccess.Actor(1,Role.TRUONG_PHONG,1L,"SALES");
        var director = new SalesAccess.Actor(2,Role.GIAM_DOC_PHONG_BAN,1L,"SALES");
        assertFalse(SalesPricingService.canApprove(manager,quote));
        assertTrue(SalesPricingService.canApprove(director,quote));
        quote.put("approval_level","MANAGER"); quote.put("created_by",director.id());
        assertTrue(SalesPricingService.canApprove(manager,quote)); // A director author does not force CEO approval.
        assertFalse(SalesPricingService.canApprove(director,quote));
        quote.put("created_by",5L); quote.put("approval_level","CEO");
        assertFalse(SalesPricingService.canApprove(director,quote));
        quote.put("policy_snapshot", "{\"ceo_delegate_id\":2}");
        assertTrue(SalesPricingService.canApprove(director,quote));
        quote.put("created_by",2L); assertFalse(SalesPricingService.canApprove(director,quote));
        assertFalse(SalesPricingService.canApprove(new SalesAccess.Actor(2,Role.GIAM_DOC_PHONG_BAN,2L,"TECHNICAL"),quote));
    }
}
