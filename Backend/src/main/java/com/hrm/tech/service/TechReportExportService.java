package com.hrm.tech.service;

import com.hrm.common.entity.User;
import com.hrm.common.repository.UserRepository;
import com.hrm.exception.AppException;
import org.springframework.http.HttpStatus;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechReportExportService {

    private final TechWorklogRepository worklogRepository;
    private final TechProjectRepository projectRepository;
    private final TechSkillRepository skillRepository;
    private final UserTechSkillRepository userSkillRepository;
    private final UserTechCertificateRepository certificateRepository;
    private final TechEvaluationCycleRepository cycleRepository;
    private final TechPerformanceReviewRepository reviewRepository;
    private final UserRepository userRepository;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DecimalFormat CURRENCY_FMT = new DecimalFormat("#,##0 'VNĐ'");

    @Transactional(readOnly = true)
    public byte[] exportTimesheet(Long projectId, Long userId, LocalDate startDate, LocalDate endDate) {
        List<TechWorklog> worklogs = worklogRepository.findDepartmentWorklogsWithFilters(
                projectId, userId, null, startDate, endDate);

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("Bảng kê Giờ công Kỹ thuật");
            sheet.setDisplayGridlines(true);

            XSSFCellStyle headerStyle = createHeaderStyle(workbook, new byte[]{(byte) 30, (byte) 41, (byte) 59});
            XSSFCellStyle dataStyle = createDataStyle(workbook, HorizontalAlignment.LEFT);
            XSSFCellStyle centerStyle = createDataStyle(workbook, HorizontalAlignment.CENTER);
            XSSFCellStyle numberStyle = createDataStyle(workbook, HorizontalAlignment.RIGHT);
            XSSFCellStyle titleStyle = createTitleStyle(workbook);

            // Title block
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("BẢNG ĐỐI SOÁT & KÊ KHAI GIỜ CÔNG PHÒNG CÔNG NGHỆ");
            titleCell.setCellStyle(titleStyle);

            Row subRow = sheet.createRow(1);
            String periodText = "Kỳ kết xuất: " + (startDate != null ? startDate.format(DATE_FMT) : "Từ đầu")
                    + " đến " + (endDate != null ? endDate.format(DATE_FMT) : "Hiện tại");
            subRow.createCell(0).setCellValue(periodText);

            // Headers
            String[] headers = {
                    "STT", "Mã NV", "Họ và tên", "Dự án", "Mốc tiến độ (Milestone)",
                    "Loại công việc", "Tiêu đề công việc (Task)", "Số giờ (h)",
                    "Ngày làm", "Trạng thái", "Người phê duyệt", "Ghi chú"
            };

            Row headerRow = sheet.createRow(3);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // Map user IDs to names
            Set<Long> userIds = worklogs.stream().map(TechWorklog::getUserId).collect(Collectors.toSet());
            worklogs.stream().map(TechWorklog::getApprovedBy).filter(Objects::nonNull).forEach(userIds::add);
            Map<Long, User> userMap = userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            double totalHours = 0.0;
            double approvedHours = 0.0;

            int rowIdx = 4;
            int stt = 1;
            for (TechWorklog w : worklogs) {
                Row row = sheet.createRow(rowIdx++);
                User emp = userMap.get(w.getUserId());
                User approver = w.getApprovedBy() != null ? userMap.get(w.getApprovedBy()) : null;

                double hours = w.getHoursSpent() != null ? w.getHoursSpent().doubleValue() : 0.0;
                totalHours += hours;
                if (w.getApprovalStatus() == WorklogApprovalStatus.APPROVED) {
                    approvedHours += hours;
                }

                Cell c0 = row.createCell(0); c0.setCellValue(stt++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(emp != null ? emp.getMaNhanVien() : "-"); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(emp != null ? emp.getHoTen() : "ID: " + w.getUserId()); c2.setCellStyle(dataStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(w.getProject() != null ? w.getProject().getProjectName() : "-"); c3.setCellStyle(dataStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(w.getMilestone() != null ? w.getMilestone().getTitle() : "Không gắn mốc"); c4.setCellStyle(dataStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(w.getWorkType() != null ? w.getWorkType().name() : "-"); c5.setCellStyle(centerStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(w.getTaskSummary() != null ? w.getTaskSummary() : ""); c6.setCellStyle(dataStyle);
                Cell c7 = row.createCell(7); c7.setCellValue(hours); c7.setCellStyle(numberStyle);
                Cell c8 = row.createCell(8); c8.setCellValue(w.getWorkDate() != null ? w.getWorkDate().format(DATE_FMT) : "-"); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(w.getApprovalStatus() != null ? w.getApprovalStatus().name() : "-"); c9.setCellStyle(centerStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(approver != null ? approver.getHoTen() : "-"); c10.setCellStyle(dataStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(w.getReferenceUrl() != null ? w.getReferenceUrl() : ""); c11.setCellStyle(dataStyle);
            }

            // Summary row
            Row summaryRow = sheet.createRow(rowIdx + 1);
            Cell sumLabel = summaryRow.createCell(6);
            sumLabel.setCellValue("TỔNG CỘNG:");
            sumLabel.setCellStyle(headerStyle);
            Cell sumVal = summaryRow.createCell(7);
            sumVal.setCellValue(totalHours);
            sumVal.setCellStyle(headerStyle);

            Row approvedRow = sheet.createRow(rowIdx + 2);
            Cell appLabel = approvedRow.createCell(6);
            appLabel.setCellValue("ĐÃ PHÊ DUYỆT:");
            appLabel.setCellStyle(headerStyle);
            Cell appVal = approvedRow.createCell(7);
            appVal.setCellValue(approvedHours);
            appVal.setCellStyle(headerStyle);

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                if (sheet.getColumnWidth(i) < 3000) {
                    sheet.setColumnWidth(i, 3000);
                }
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            log.error("[Tech Export] Lỗi xuất Excel Timesheet", e);
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi hệ thống khi kết xuất file Excel Timesheet!");
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportSkillsMatrix(Long departmentId) {
        List<UserTechSkill> allSkills = userSkillRepository.findAll();
        List<UserTechCertificate> allCerts = certificateRepository.findAll();

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Sheet 1: Skills Matrix
            XSSFSheet skillSheet = workbook.createSheet("Ma trận Kỹ năng (Skills Matrix)");
            skillSheet.setDisplayGridlines(true);

            XSSFCellStyle headerStyle = createHeaderStyle(workbook, new byte[]{(byte) 15, (byte) 23, (byte) 42});
            XSSFCellStyle dataStyle = createDataStyle(workbook, HorizontalAlignment.LEFT);
            XSSFCellStyle centerStyle = createDataStyle(workbook, HorizontalAlignment.CENTER);
            XSSFCellStyle numberStyle = createDataStyle(workbook, HorizontalAlignment.RIGHT);
            XSSFCellStyle titleStyle = createTitleStyle(workbook);

            Row titleRow = skillSheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("BẢNG MA TRẬN NĂNG LỰC KỸ THUẬT & SKILLS MATRIX");
            titleCell.setCellStyle(titleStyle);

            String[] skillHeaders = {
                    "STT", "Mã NV", "Họ và tên", "Email", "Tên Kỹ năng",
                    "Nhóm Kỹ năng", "Cấp độ Năng lực", "Số năm kinh nghiệm", "Trạng thái Xác minh", "Dự án Tiêu biểu"
            };

            Row headerRow = skillSheet.createRow(2);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < skillHeaders.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(skillHeaders[i]);
                c.setCellStyle(headerStyle);
            }

            Set<Long> userIds = allSkills.stream().map(UserTechSkill::getUserId).collect(Collectors.toSet());
            allCerts.stream().map(UserTechCertificate::getUserId).forEach(userIds::add);
            Map<Long, User> userMap = userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            int rowIdx = 3;
            int stt = 1;
            for (UserTechSkill s : allSkills) {
                User u = userMap.get(s.getUserId());
                Row row = skillSheet.createRow(rowIdx++);

                Cell c0 = row.createCell(0); c0.setCellValue(stt++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(u != null ? u.getMaNhanVien() : "-"); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(u != null ? u.getHoTen() : "ID: " + s.getUserId()); c2.setCellStyle(dataStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(u != null ? u.getEmail() : "-"); c3.setCellStyle(dataStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(s.getSkill() != null ? s.getSkill().getSkillName() : "-"); c4.setCellStyle(dataStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(s.getSkill() != null && s.getSkill().getCategory() != null ? s.getSkill().getCategory().name() : "-"); c5.setCellStyle(centerStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(s.getProficiencyLevel() != null ? s.getProficiencyLevel().name() : "-"); c6.setCellStyle(centerStyle);
                Cell c7 = row.createCell(7); c7.setCellValue(s.getYearsOfExperience() != null ? s.getYearsOfExperience() : 0.0); c7.setCellStyle(numberStyle);
                Cell c8 = row.createCell(8); c8.setCellValue(Boolean.TRUE.equals(s.getIsVerified()) ? "ĐÃ XÁC MINH" : "CHỜ XÁC MINH"); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(s.getHighlightProject() != null ? s.getHighlightProject() : ""); c9.setCellStyle(dataStyle);
            }

            for (int i = 0; i < skillHeaders.length; i++) {
                skillSheet.autoSizeColumn(i);
                if (skillSheet.getColumnWidth(i) < 3000) skillSheet.setColumnWidth(i, 3000);
            }

            // Sheet 2: Certificates
            XSSFSheet certSheet = workbook.createSheet("Danh sách Chứng chỉ Kỹ thuật");
            certSheet.setDisplayGridlines(true);

            Row cTitleRow = certSheet.createRow(0);
            Cell cTitleCell = cTitleRow.createCell(0);
            cTitleCell.setCellValue("DANH SÁCH CHỨNG CHỈ CÔNG NGHỆ ĐÃ ĐĂNG KÝ");
            cTitleCell.setCellStyle(titleStyle);

            String[] certHeaders = {
                    "STT", "Mã NV", "Họ và tên", "Tên Chứng chỉ", "Tổ chức cấp",
                    "Ngày cấp", "Ngày hết hạn", "Tình trạng", "Link xác minh"
            };

            Row cHeaderRow = certSheet.createRow(2);
            cHeaderRow.setHeightInPoints(24);
            for (int i = 0; i < certHeaders.length; i++) {
                Cell c = cHeaderRow.createCell(i);
                c.setCellValue(certHeaders[i]);
                c.setCellStyle(headerStyle);
            }

            LocalDate today = LocalDate.now();
            int cRowIdx = 3;
            int cStt = 1;
            for (UserTechCertificate cert : allCerts) {
                User u = userMap.get(cert.getUserId());
                Row row = certSheet.createRow(cRowIdx++);

                boolean isExpired = cert.getExpiryDate() != null && cert.getExpiryDate().isBefore(today);
                boolean isExpiringSoon = !isExpired && cert.getExpiryDate() != null && !cert.getExpiryDate().isAfter(today.plusDays(30));
                String statusStr = isExpired ? "HẾT HẠN" : (isExpiringSoon ? "SẮP HẾT HẠN (<30 ngày)" : "CÒN HIỆU LỰC");

                Cell c0 = row.createCell(0); c0.setCellValue(cStt++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(u != null ? u.getMaNhanVien() : "-"); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(u != null ? u.getHoTen() : "ID: " + cert.getUserId()); c2.setCellStyle(dataStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(cert.getCertificateName() != null ? cert.getCertificateName() : "-"); c3.setCellStyle(dataStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(cert.getIssuingOrganization() != null ? cert.getIssuingOrganization() : "-"); c4.setCellStyle(dataStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(cert.getIssueDate() != null ? cert.getIssueDate().format(DATE_FMT) : "-"); c5.setCellStyle(centerStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(cert.getExpiryDate() != null ? cert.getExpiryDate().format(DATE_FMT) : "Vô thời hạn"); c6.setCellStyle(centerStyle);
                Cell c7 = row.createCell(7); c7.setCellValue(statusStr); c7.setCellStyle(centerStyle);
                Cell c8 = row.createCell(8); c8.setCellValue(cert.getCredentialUrl() != null ? cert.getCredentialUrl() : ""); c8.setCellStyle(dataStyle);
            }

            for (int i = 0; i < certHeaders.length; i++) {
                certSheet.autoSizeColumn(i);
                if (certSheet.getColumnWidth(i) < 3000) certSheet.setColumnWidth(i, 3000);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            log.error("[Tech Export] Lỗi xuất Excel Skills Matrix", e);
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi hệ thống khi kết xuất file Excel Skills Matrix!");
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportEvaluationCycle(Long cycleId) {
        TechEvaluationCycle cycle = cycleRepository.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá với ID: " + cycleId));

        List<TechPerformanceReview> reviews = reviewRepository.findByCycleId(cycle.getId());

        // Check user permission for Rule B-10 Strict Salary Masking
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean canViewSalary = auth != null && auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.contains("CEO") || a.contains("ADMIN") || a.contains("GIAM_DOC"));

        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XSSFSheet sheet = workbook.createSheet("Kết quả Đánh giá Kỹ thuật");
            sheet.setDisplayGridlines(true);

            XSSFCellStyle headerStyle = createHeaderStyle(workbook, new byte[]{(byte) 20, (byte) 83, (byte) 45});
            XSSFCellStyle dataStyle = createDataStyle(workbook, HorizontalAlignment.LEFT);
            XSSFCellStyle centerStyle = createDataStyle(workbook, HorizontalAlignment.CENTER);
            XSSFCellStyle numberStyle = createDataStyle(workbook, HorizontalAlignment.RIGHT);
            XSSFCellStyle titleStyle = createTitleStyle(workbook);

            // Title
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("KẾT QUẢ ĐÁNH GIÁ HIỆU SUẤT & NÂNG BẬC KỸ SƯ: " + cycle.getTitle().toUpperCase());
            titleCell.setCellStyle(titleStyle);

            Row subRow = sheet.createRow(1);
            subRow.createCell(0).setCellValue("Kỳ: " + cycle.getCycleCode() + " | Thời gian: "
                    + cycle.getPeriodStart().format(DATE_FMT) + " đến " + cycle.getPeriodEnd().format(DATE_FMT)
                    + " | Trạng thái: " + cycle.getStatus().name());

            String[] headers = {
                    "STT", "Mã NV", "Họ và tên", "Chức danh", "Trạng thái",
                    "Điểm Telemetry (60%)", "Điểm Quản lý (40%)", "Tổng điểm (100)",
                    "Xếp loại", "Tự chấm", "Đề xuất thăng chức", "Đề xuất đãi ngộ (B-10 Masked)",
                    "Nhận xét Quản lý", "Định hướng 90 ngày"
            };

            Row headerRow = sheet.createRow(3);
            headerRow.setHeightInPoints(24);
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            Set<Long> empIds = reviews.stream().map(TechPerformanceReview::getEmployeeId).collect(Collectors.toSet());
            Map<Long, User> userMap = userRepository.findAllById(empIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            int rowIdx = 4;
            int stt = 1;
            for (TechPerformanceReview r : reviews) {
                User u = userMap.get(r.getEmployeeId());
                Row row = sheet.createRow(rowIdx++);

                String compDisplay;
                if (r.getCompensationStatus() == null || r.getCompensationStatus() == CompensationProposalStatus.NONE) {
                    compDisplay = "Không đề xuất";
                } else if (!canViewSalary) {
                    compDisplay = "Có đề xuất [Bảo mật B-10]";
                } else {
                    compDisplay = r.getRecommendedNewBaseSalary() != null
                            ? CURRENCY_FMT.format(r.getRecommendedNewBaseSalary())
                            : "Có đề xuất";
                }

                Cell c0 = row.createCell(0); c0.setCellValue(stt++); c0.setCellStyle(centerStyle);
                Cell c1 = row.createCell(1); c1.setCellValue(u != null ? u.getMaNhanVien() : "-"); c1.setCellStyle(centerStyle);
                Cell c2 = row.createCell(2); c2.setCellValue(u != null ? u.getHoTen() : "ID: " + r.getEmployeeId()); c2.setCellStyle(dataStyle);
                Cell c3 = row.createCell(3); c3.setCellValue(u != null && u.getChucVu() != null ? u.getChucVu() : "-"); c3.setCellStyle(dataStyle);
                Cell c4 = row.createCell(4); c4.setCellValue(r.getStatus() != null ? r.getStatus().name() : "-"); c4.setCellStyle(centerStyle);
                Cell c5 = row.createCell(5); c5.setCellValue(r.getTelemetryTotalScore() != null ? r.getTelemetryTotalScore().doubleValue() : 0.0); c5.setCellStyle(numberStyle);
                Cell c6 = row.createCell(6); c6.setCellValue(r.getManagerQualScore() != null ? r.getManagerQualScore().doubleValue() : 0.0); c6.setCellStyle(numberStyle);
                Cell c7 = row.createCell(7); c7.setCellValue(r.getFinalScore() != null ? r.getFinalScore().doubleValue() : 0.0); c7.setCellStyle(numberStyle);
                Cell c8 = row.createCell(8); c8.setCellValue(r.getFinalGrade() != null ? r.getFinalGrade().name() : "-"); c8.setCellStyle(centerStyle);
                Cell c9 = row.createCell(9); c9.setCellValue(r.getSelfRatingScore() != null ? r.getSelfRatingScore().doubleValue() : 0.0); c9.setCellStyle(centerStyle);
                Cell c10 = row.createCell(10); c10.setCellValue(r.getRecommendedTitle() != null ? r.getRecommendedTitle() : "Không"); c10.setCellStyle(dataStyle);
                Cell c11 = row.createCell(11); c11.setCellValue(compDisplay); c11.setCellStyle(dataStyle);
                Cell c12 = row.createCell(12); c12.setCellValue(r.getManagerComment() != null ? r.getManagerComment() : ""); c12.setCellStyle(dataStyle);
                Cell c13 = row.createCell(13); c13.setCellValue(r.getManagerFeedbackGoals() != null ? r.getManagerFeedbackGoals() : ""); c13.setCellStyle(dataStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                if (sheet.getColumnWidth(i) < 3000) sheet.setColumnWidth(i, 3000);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            log.error("[Tech Export] Lỗi xuất Excel Evaluation Cycle", e);
            throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi hệ thống khi kết xuất file Excel Đánh giá!");
        }
    }

    private XSSFCellStyle createHeaderStyle(XSSFWorkbook workbook, byte[] rgb) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 10);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);

        XSSFColor bg = new XSSFColor(rgb, null);
        style.setFillForegroundColor(bg);
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorders(style);
        return style;
    }

    private XSSFCellStyle createDataStyle(XSSFWorkbook workbook, HorizontalAlignment align) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setFontHeightInPoints((short) 10);
        style.setFont(font);
        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorders(style);
        return style;
    }

    private XSSFCellStyle createTitleStyle(XSSFWorkbook workbook) {
        XSSFCellStyle style = workbook.createCellStyle();
        XSSFFont font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }

    private void setBorders(XSSFCellStyle style) {
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());
    }
}
