package com.hrm.ai.service;

import com.hrm.ai.entity.AiDecisionLog;
import com.hrm.ai.repository.AiDecisionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DecisionLogService {

    private final AiDecisionLogRepository aiDecisionLogRepository;

    @Transactional
    public AiDecisionLog logDecision(Long applicationId, String actionType, String rawRequest, String rawResponse, String reason, boolean isSuccess, String errorMessage) {
        if (errorMessage != null && errorMessage.length() > 255) {
            errorMessage = errorMessage.substring(0, 250) + "...";
        }
        
        AiDecisionLog log = AiDecisionLog.builder()
                .applicationId(applicationId)
                .actionType(actionType)
                .rawRequest(rawRequest)
                .rawResponse(rawResponse)
                .decisionReason(reason)
                .isSuccess(isSuccess)
                .errorMessage(errorMessage)
                .build();
        return aiDecisionLogRepository.save(log);
    }
}
