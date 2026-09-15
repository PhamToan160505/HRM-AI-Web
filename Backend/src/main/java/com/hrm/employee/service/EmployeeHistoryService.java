package com.hrm.employee.service;

import com.hrm.employee.entity.EmployeeHistory;
import com.hrm.employee.repository.EmployeeHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeeHistoryService {

    private final EmployeeHistoryRepository employeeHistoryRepository;

    public void logHistory(Long employeeId, String eventType, String oldValue, String newValue, String description) {
        EmployeeHistory history = EmployeeHistory.builder()
                .employeeId(employeeId)
                .eventType(eventType)
                .oldValue(oldValue)
                .newValue(newValue)
                .description(description)
                .build();
        employeeHistoryRepository.save(history);
    }

    public List<EmployeeHistory> getEmployeeHistory(Long employeeId) {
        return employeeHistoryRepository.findByEmployeeIdOrderByEventDateDesc(employeeId);
    }
}
