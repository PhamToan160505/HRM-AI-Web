package com.hrm.approval.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hrm.approval.entity.ApprovalEntityType;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.service.FinanceAccess;
import com.hrm.common.repository.UserRepository;
import com.hrm.configuration.service.ConfigurationService;
import com.hrm.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired(required = false)
    private FinanceAccess financeAccess;

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

        List<JsonNode> orderedNodes = new ArrayList<>();
        Set<Integer> orders = new HashSet<>();
        for (JsonNode stepNode : template) {
            int stepOrder = stepNode.path("stepOrder").asInt(0);
            if (stepOrder <= 0 || !orders.add(stepOrder)) {
                throw AppException.conflict("Approval policy có stepOrder thiếu hoặc trùng");
            }
            orderedNodes.add(stepNode);
        }
        orderedNodes.sort(Comparator.comparingInt(n -> n.path("stepOrder").asInt(0)));

        Set<Long> usedApprovers = new HashSet<>();
        if (context.conflictUserIds() != null) {
            usedApprovers.addAll(context.conflictUserIds());
        }
        if (context.requestedBy() != null) {
            usedApprovers.add(context.requestedBy());
        }

        // Nếu người tạo là CEO/ADMIN -> bỏ qua các bước trung gian optional (không bắt GĐ/Tài chính duyệt lại yêu cầu của CEO)
        User requester = context.requestedBy() != null
                ? userRepository.findById(context.requestedBy()).orElse(null)
                : null;
        boolean requesterIsExecutive = requester != null
                && (requester.getRole() == Role.CEO || requester.getRole() == Role.ADMIN);

        List<ResolvedStep> steps = new ArrayList<>();
        int nextSeqOrder = 1;
        for (JsonNode stepNode : orderedNodes) {
            JsonNode approvers = stepNode.path("approvers");
            if (!approvers.isArray() || approvers.isEmpty()) {
                throw AppException.conflict("Approval step " + stepNode.path("stepOrder").asInt() + " không có phương án người duyệt");
            }
            boolean optionalIfMissing = stepNode.path("optionalIfMissing").asBoolean(false);
            String stepScope = stepNode.path("stepScope").asText(null);
            String stepLabel = stepNode.path("stepLabel").asText(null);

            if (optionalIfMissing && requesterIsExecutive) {
                continue;
            }

            ResolvedStep resolvedStep = resolveStep(
                    policy.policyCode(),
                    nextSeqOrder,
                    approvers,
                    context,
                    usedApprovers,
                    stepScope,
                    stepLabel,
                    optionalIfMissing);

            if (resolvedStep != null) {
                steps.add(resolvedStep);
                if (resolvedStep.approverId() != null) {
                    usedApprovers.add(resolvedStep.approverId());
                }
                nextSeqOrder++;
            }
        }

        if (steps.isEmpty()) {
            throw AppException.conflict("Không tìm được bước phê duyệt hợp lệ cho policy " + policy.policyCode());
        }

        return new ResolvedPolicy(policy.id(), policy.policyCode(), policy.versionNumber(), List.copyOf(steps));
    }

    private ResolvedStep resolveStep(
            String policyCode,
            int stepOrder,
            JsonNode approverOptions,
            ApprovalContext context,
            Set<Long> conflicts,
            String explicitScope,
            String explicitLabel,
            boolean optionalIfMissing) {

        Long financeDeptId = financeAccess != null ? financeAccess.financeDepartmentId().orElse(null) : null;

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
                    .filter(user -> matchesScope(scope, user, context.departmentId(), financeDeptId))
                    .toList();
            if (!candidates.isEmpty()) {
                User selected = candidates.get(0);
                String note = optionIndex == 1
                        ? "Resolved by policy " + policyCode
                        : "Escalated by policy " + policyCode + " to option " + optionIndex;
                String finalScope = (explicitScope != null && !explicitScope.isBlank()) ? explicitScope : scope;
                String finalLabel = (explicitLabel != null && !explicitLabel.isBlank())
                        ? explicitLabel
                        : defaultLabelFor(finalScope, role);
                return new ResolvedStep(stepOrder, role, selected.getId(), note, finalScope, finalLabel);
            }
        }

        if (optionalIfMissing) {
            return null;
        }
        throw AppException.conflict(
                "Không tìm được người duyệt hợp lệ cho policy " + policyCode + ", bước " + stepOrder);
    }

    private boolean matchesScope(String scope, User candidate, Long entityDepartmentId, Long financeDepartmentId) {
        if ("ENTITY_DEPARTMENT".equals(scope)) {
            return entityDepartmentId != null && entityDepartmentId.equals(candidate.getDepartmentId());
        }
        if ("FINANCE_DEPARTMENT".equals(scope)) {
            return financeDepartmentId != null && financeDepartmentId.equals(candidate.getDepartmentId());
        }
        return true;
    }

    private String defaultLabelFor(String scope, Role role) {
        if ("FINANCE_DEPARTMENT".equals(scope)) {
            return "Phòng Tài chính - Kế toán thẩm định ngân sách";
        }
        if ("ENTITY_DEPARTMENT".equals(scope) && role == Role.GIAM_DOC_PHONG_BAN) {
            return "Giám đốc Phòng ban duyệt chuyên môn & Bench";
        }
        if (role == Role.CEO) {
            return "Tổng Giám đốc phê duyệt cuối";
        }
        return switch (role) {
            case TRUONG_PHONG -> "Trưởng phòng phê duyệt";
            case GIAM_DOC_PHONG_BAN -> "Giám đốc Phòng ban phê duyệt";
            case CEO -> "Tổng Giám đốc phê duyệt";
            case ADMIN -> "Quản trị viên phê duyệt";
            default -> role.name();
        };
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

    public record ResolvedStep(
            int stepOrder,
            Role approverRole,
            Long approverId,
            String resolutionNote,
            String stepScope,
            String stepLabel) {

        public ResolvedStep(int stepOrder, Role approverRole, Long approverId, String resolutionNote) {
            this(stepOrder, approverRole, approverId, resolutionNote, null, null);
        }
    }
}
