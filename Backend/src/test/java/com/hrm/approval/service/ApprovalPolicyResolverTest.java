package com.hrm.approval.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.configuration.service.ConfigurationService;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApprovalPolicyResolverTest {

    @Test
    void excludesRequesterAndEscalatesToConfiguredFallback() throws Exception {
        ConfigurationService configurationService = mock(ConfigurationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        ObjectMapper mapper = new ObjectMapper();
        var policy = new ConfigurationService.ApprovalPolicyConfiguration(
                10L,
                "REQUISITION_DEFAULT",
                1,
                "JOB_REQUISITION",
                mapper.readTree("{}"),
                mapper.readTree("""
                        [{"stepOrder":1,"approvers":[
                          {"role":"CEO","scope":"GLOBAL"},
                          {"role":"ADMIN","scope":"GLOBAL"}
                        ]}]
                        """),
                LocalDateTime.now());
        when(configurationService.activeApprovalPolicies("JOB_REQUISITION")).thenReturn(List.of(policy));

        User requesterCeo = User.builder().id(1L).role(Role.CEO).active(true).build();
        User fallbackAdmin = User.builder().id(2L).role(Role.ADMIN).active(true).build();
        when(userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.CEO)).thenReturn(List.of(requesterCeo));
        when(userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.ADMIN)).thenReturn(List.of(fallbackAdmin));

        ApprovalPolicyResolver resolver = new ApprovalPolicyResolver(configurationService, userRepository);
        ApprovalPolicyResolver.ResolvedPolicy result = resolver.resolve(
                ApprovalEntityType.JOB_REQUISITION,
                ApprovalPolicyResolver.ApprovalContext.forRequisition(1L, null, Role.NHAN_VIEN));

        assertEquals(2L, result.steps().get(0).approverId());
        assertEquals(Role.ADMIN, result.steps().get(0).approverRole());
        assertEquals("Escalated by policy REQUISITION_DEFAULT to option 2",
                result.steps().get(0).resolutionNote());
    }
}
