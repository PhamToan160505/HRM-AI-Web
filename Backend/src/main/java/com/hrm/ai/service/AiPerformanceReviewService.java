package com.hrm.ai.service;

import com.hrm.attendance.entity.Attendance;
import com.hrm.attendance.repository.AttendanceRepository;
import com.hrm.employee.entity.PerformanceReview;
import com.hrm.employee.repository.PerformanceReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiPerformanceReviewService {

    private final GeminiClientService geminiClientService;
    private final AttendanceRepository attendanceRepository;
    private final PerformanceReviewRepository performanceReviewRepository;

    public PerformanceReview generateReview(Long employeeId, int thang, int nam) {
        if (performanceReviewRepository.existsByEmployeeIdAndThangAndNam(employeeId, thang, nam)) {
            throw new RuntimeException("Đánh giá cho tháng " + thang + "/" + nam + " đã tồn tại.");
        }

        LocalDate startDate = LocalDate.of(nam, thang, 1);
        LocalDate endDate = startDate.withDayOfMonth(startDate.lengthOfMonth());

        List<Attendance> attendances = attendanceRepository.findByEmployeeIdAndDateBetween(employeeId, startDate, endDate);

        long totalDays = attendances.size();
        long lateDays = attendances.stream().filter(a -> "LATE".equals(a.getStatus())).count();
        long absentDays = attendances.stream().filter(a -> "ABSENT".equals(a.getStatus())).count();

        String prompt = String.format(
            "Bạn là một chuyên gia Quản trị nhân sự (HR). Hãy viết một báo cáo đánh giá hiệu suất hàng tháng ngắn gọn (dưới 300 chữ) " +
            "cho nhân viên này bằng tiếng Việt. Dữ liệu chấm công tháng %d/%d như sau:\n" +
            "- Tổng số ngày có dữ liệu chấm công: %d\n" +
            "- Số ngày đi muộn: %d\n" +
            "- Số ngày vắng mặt/nghỉ: %d\n\n" +
            "Yêu cầu:\n" +
            "1. Nhận xét khách quan 100%% dựa trên dữ liệu trên.\n" +
            "2. Trình bày dạng Markdown với các mục: Tổng quan, Điểm đáng chú ý, và Khuyến nghị.\n" +
            "3. Giọng văn chuyên nghiệp, động viên nhưng nghiêm khắc nếu đi muộn/vắng nhiều.",
            thang, nam, totalDays, lateDays, absentDays
        );

        String aiResponse = geminiClientService.callGemini(prompt).block();
        String evaluationText = geminiClientService.extractTextFromGeminiResponse(aiResponse);

        if (evaluationText.isEmpty()) {
            evaluationText = "AI không thể tạo đánh giá lúc này, vui lòng thử lại sau.";
        }

        PerformanceReview review = PerformanceReview.builder()
                .employeeId(employeeId)
                .thang(thang)
                .nam(nam)
                .aiEvaluation(evaluationText)
                .build();

        return performanceReviewRepository.save(review);
    }
}
