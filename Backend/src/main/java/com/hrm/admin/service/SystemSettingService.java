package com.hrm.admin.service;

import com.hrm.admin.dto.UpdateSettingRequest;
import com.hrm.common.entity.SystemSetting;
import com.hrm.common.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SystemSettingService {

    private final SystemSettingRepository systemSettingRepository;

    public List<SystemSetting> getAllSettings() {
        return systemSettingRepository.findAll();
    }

    public SystemSetting updateSetting(UpdateSettingRequest request) {
        Optional<SystemSetting> existingOpt = systemSettingRepository.findByKey(request.getKey());
        
        SystemSetting setting;
        if (existingOpt.isPresent()) {
            setting = existingOpt.get();
            setting.setValue(request.getValue());
            if (request.getDescription() != null) {
                setting.setDescription(request.getDescription());
            }
        } else {
            setting = SystemSetting.builder()
                    .key(request.getKey())
                    .value(request.getValue())
                    .description(request.getDescription())
                    .build();
        }
        
        return systemSettingRepository.save(setting);
    }
}
