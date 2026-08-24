package com.hrm.common.payroll.controller;

import com.hrm.common.payroll.entity.Holiday;
import com.hrm.common.payroll.repository.HolidayRepository;
import com.hrm.exception.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/holidays")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('GIAM_DOC_PHONG_BAN', 'CEO')")
public class HolidayController {

    private final HolidayRepository holidayRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Holiday>>> getAllHolidays() {
        return ResponseEntity.ok(ApiResponse.ok(holidayRepository.findAll(), "Lấy danh sách ngày lễ thành công"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Holiday>> createHoliday(@RequestBody @Valid Holiday holiday) {
        return ResponseEntity.ok(ApiResponse.ok(holidayRepository.save(holiday), "Thêm ngày lễ thành công"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteHoliday(@PathVariable Long id) {
        holidayRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.ok(null, "Xóa ngày lễ thành công"));
    }
}
