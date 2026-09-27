package com.hrm.approval.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ApprovalPolicyResolver {

    private final ConfigurationService configurationService;
    private final UserRepository userRepository;

    public ResolvedPolicy resolve(ApprovalEntityType entityType, ApprovalContext context) {
        ConfigurationService.ApprovalPolicyConfiguration policy = configurationService
                .activeApprovalPolicies(entityType.name())
                .stream()
                .filter(candidate -> matches(candidate.conditions(), context))
                .max(Comparator
                        .comparingInt((ConfigurationService.ApprovalPolicyConfiguration candidate) ->
                                candidate.conditions().size())
                        .thenComparingInt(ConfigurationService.ApprovalPolicyConfiguration::versionNumber))
                .orElseThrow(() -> AppException.conflict(
                        "Không tìm thấy approval policy phù hợp cho " + entityType));

        JsonNode template = policy.stepsTemplate();
        if (!template.isArray() || template.isEmpty()) {
            throw AppException.conflict("Approval policy " + policy.policyCode() + " không có bước duyệt");
        }

        Set<Integer> orders = new HashSet<>();
        List<ResolvedStep> steps = new ArrayList<>();
        for (JsonNode stepNode : template) {
            int stepOrder = stepNode.path("stepOrder").asInt(0);
            if (stepOrder <= 0 || !orders.add(stepOrder)) {
                throw AppException.conflict("Approval policy có stepOrder thiếu hoặc trùng");
            }
            JsonNode approvers = stepNode.path("approvers");
            if (!approvers.isArray() || approvers.isEmpty()) {
                throw AppException.conflict("Approval step " + stepOrder + " không có phương án người duyệt");
            }
            steps.add(resolveStep(policy.policyCode(), stepOrder, approvers, context));
        }
        steps.sort(Comparator.comparingInt(ResolvedStep::stepOrder));
        return new ResolvedPolicy(policy.id(), policy.policyCode(), policy.versionNumber(), List.copyOf(steps));
    }

    private ResolvedStep resolveStep(
            String policyCode,
            int stepOrder,
            JsonNode approverOptions,
            ApprovalContext context) {
        Set<Long> conflicts = new HashSet<>(context.conflictUserIds() == null ? Set.of() : context.conflictUserIds());
        conflicts.add(context.requestedBy());

        int optionIndex = 0;
        for (JsonNode option : approverOptions) {
            optionIndex++;
            Role role;
            try {
                role = Role.valueOf(option.path("role").asText());
            } catch (IllegalArgumentException exception) {
                throw AppException.conflict("Role không hợp lệ trong approval policy " + policyCode);
            }
            String scope = option.path("scope").asText("GLOBAL");
            List<User> candidates = userRepository.findByRoleAndActiveTrueOrderByIdAsc(role).stream()
                    .filter(user -> !conflicts.contains(user.getId()))
                    .filter(user -> !"ENTITY_DEPARTMENT".equals(scope)
                            || (context.departmentId() != null && context.departmentId().equals(user.getDepartmentId())))
                    .toList();
            if (!candidates.isEmpty()) {
                User selected = candidates.get(0);
                String note = optionIndex == 1
                        ? "Resolved by policy " + policyCode
                        : "Escalated by policy " + policyCode + " to option " + optionIndex;
                return new ResolvedStep(stepOrder, role, selected.getId(), note);
            }
        }
        throw AppException.conflict(
                "Không tìm được người duyệt hợp lệ cho policy " + policyCode + ", bước " + stepOrder);
    }

    private boolean matches(JsonNode conditions, ApprovalContext context) {
        if (conditions == null || conditions.isEmpty()) {
            return true;
        }
        JsonNode targetRoles = conditions.path("targetRoles");
        if (targetRoles.isArray()) {
            if (context.targetRole() == null) {
                return false;
            }
            boolean roleMatched = false;
            for (JsonNode role : targetRoles) {
                if (context.targetRole().name().equals(role.asText())) {
                    roleMatched = true;
                    break;
                }
            }
            if (!roleMatched) {
                return false;
            }
        }
        return true;
    }

    public record ApprovalContext(
            Long requestedBy,
            Long departmentId,
            Role targetRole,
            Set<Long> conflictUserIds) {

        public static ApprovalContext forRequisition(Long requestedBy, Long departmentId, Role targetRole) {
            return new ApprovalContext(requestedBy, departmentId, targetRole, Set.of(requestedBy));
        }
    }

    public record ResolvedPolicy(Long policyId, String policyCode, int policyVersion, List<ResolvedStep> steps) {}
    public record ResolvedStep(int stepOrder, Role approverRole, Long approverId, String resolutionNote) {}
}
