package com.hrm.request.event;

import com.hrm.request.entity.EmployeeRequest;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class RequestCreatedEvent {
    private final EmployeeRequest request;
}
