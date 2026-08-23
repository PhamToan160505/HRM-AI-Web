package com.hrm.admin.dto;

import lombok.Data;

@Data
public class UpdateSettingRequest {
    private String key;
    private String value;
    private String description;
}
