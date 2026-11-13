package com.hrm.tech.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hrm.common.entity.Department;
import com.hrm.common.entity.Role;
import com.hrm.common.entity.User;
import com.hrm.common.payroll.entity.SalaryHistory;
import com.hrm.common.payroll.repository.SalaryHistoryRepository;
import com.hrm.common.repository.DepartmentRepository;
import com.hrm.common.repository.UserRepository;
import com.hrm.employee.service.EmployeeHistoryService;
import com.hrm.exception.AppException;
import com.hrm.notification.service.NotificationService;
import com.hrm.tech.dto.*;
import com.hrm.tech.entity.*;
import com.hrm.tech.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TechPerformanceService {

    private final TechEvaluationCycleRepository cycleRepository;
    private final TechPerformanceReviewRepository reviewRepository;
    private final TechSkillPromotionItemRepository skillPromotionItemRepository;
    private final TechCareerEventRepository careerEventRepository;
    private final TechSkillRepository skillRepository;
    private final UserTechSkillRepository userSkillRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final SalaryHistoryRepository salaryHistoryRepository;
    private final EmployeeHistoryService employeeHistoryService;
    private final NotificationService notificationService;
    private final TechTelemetryScoreCalculator telemetryCalculator;
    private final TechEvaluationCopilotService copilotService;
    private final TechSkillService techSkillService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<TechEvaluationCycleResponse> getCycles(Long actorId) {
        User actor = loadActor(actorId);
        Long deptId = resolveScopedDepartmentId(actor, null);

        List<TechEvaluationCycle> cycles = deptId != null
                ? cycleRepository.findByDepartmentIdOrderByPeriodEndDescIdDesc(deptId)
                : cycleRepository.findAllByOrderByPeriodEndDescIdDesc();

        if (cycles.isEmpty()) {
            return Collections.emptyList();
        }

        Map<Long, User> creatorMap = loadUserMap(
                cycles.stream().map(TechEvaluationCycle::getCreatedBy).filter(Objects::nonNull).collect(Collectors.toSet())
        );

        List<TechEvaluationCycleResponse> responses = new ArrayList<>(cycles.size());
        for (TechEvaluationCycle c : cycles) {
            List<TechPerformanceReview> cycleReviews = reviewRepository.findByCycleId(c.getId());
            long total = cycleReviews.size();
            long selfSubmitted = cycleReviews.stream().filter(r -> r.getSelfSubmittedAt() != null).count();
            long approved = cycleReviews.stream().filter(r -> r.getStatus() == TechReviewStatus.APPROVED).count();
            long pendingAction = cycleReviews.stream()
                    .filter(r -> r.getStatus() == TechReviewStatus.MANAGER_REVIEW_PENDING
                            || r.getStatus() == TechReviewStatus.DIRECTOR_APPROVAL_PENDING)
                    .count();

            User creator = creatorMap.get(c.getCreatedBy());
            responses.add(TechEvaluationCycleResponse.builder()
                    .id(c.getId())
                    .cycleCode(c.getCycleCode())
                    .title(c.getTitle())
                    .reviewType(c.getReviewType())
                    .periodStart(c.getPeriodStart())
                    .periodEnd(c.getPeriodEnd())
                    .selfReviewDeadline(c.getSelfReviewDeadline())
                    .status(c.getStatus())
                    .departmentId(c.getDepartmentId())
                    .createdBy(c.getCreatedBy())
                    .createdByName(creator != null ? creator.getHoTen() : null)
                    .createdAt(c.getCreatedAt())
                    .totalReviews(total)
                    .selfReviewSubmittedCount(selfSubmitted)
                    .selfReviewRatePercent(total > 0 ? (int) Math.round((selfSubmitted * 100.0) / total) : 0)
                    .approvedCount(approved)
                    .approvedRatePercent(total > 0 ? (int) Math.round((approved * 100.0) / total) : 0)
                    .pendingActionCount(pendingAction)
                    .build());
        }
        return responses;
    }

    @Transactional
    public TechEvaluationCycleResponse createCycle(CreateTechEvaluationCycleRequest req, Long actorId) {
        User actor = loadActor(actorId);
        if (actor.getRole() != Role.GIAM_DOC_PHONG_BAN
                && actor.getRole() != Role.TRUONG_PHONG
                && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Trưởng phòng hoặc Giám đốc Công nghệ mới có quyền khởi tạo kỳ đánh giá!");
        }

        if (req.getPeriodEnd().isBefore(req.getPeriodStart())) {
            throw AppException.badRequest("Ngày kết thúc kỳ đánh giá không được trước ngày bắt đầu!");
        }

        TechReviewType reviewType = req.getReviewType() != null ? req.getReviewType() : TechReviewType.QUARTERLY;

        // Validation ràng buộc chặt chẽ thời gian theo loại kỳ đánh giá (áp dụng cửa sổ trượt: kỳ trước, kỳ này, kỳ kế tiếp)
        validateCycleBoundaries(reviewType, req.getPeriodStart(), req.getPeriodEnd(), true);

        // Validation Hạn tự đánh giá
        if (req.getSelfReviewDeadline() != null) {
            if (req.getSelfReviewDeadline().isBefore(req.getPeriodStart())) {
                throw AppException.badRequest("Hạn tự đánh giá không được trước ngày bắt đầu kỳ đánh giá!");
            }
            if (req.getSelfReviewDeadline().isBefore(LocalDate.now())) {
                throw AppException.badRequest("Hạn tự đánh giá không được ở trong quá khứ (phải từ hôm nay trở đi)!");
            }
            LocalDate baseForMax = req.getPeriodEnd().isBefore(LocalDate.now()) ? LocalDate.now() : req.getPeriodEnd();
            int maxDays = reviewType == TechReviewType.ANNUAL ? 30 : 15;
            LocalDate maxAllowed = baseForMax.plusDays(maxDays);
            if (req.getSelfReviewDeadline().isAfter(maxAllowed)) {
                throw AppException.badRequest("Hạn tự đánh giá không được vượt quá ngày " + maxAllowed + " (tối đa " + maxDays + " ngày sau khi kết thúc kỳ đánh giá)!");
            }
        }

        Long deptId = resolveDepartmentForCycleCreation(actor, req.getDepartmentId());
        String cycleCode = req.getCycleCode().trim();
        if (cycleRepository.existsByCycleCodeIgnoreCase(cycleCode)) {
            throw AppException.conflict("Mã kỳ đánh giá '" + cycleCode + "' đã tồn tại!");
        }

        List<User> targetEmployees = resolveTargetEmployees(deptId, req);
        if (targetEmployees.isEmpty()) {
            throw AppException.badRequest("Không tìm thấy kỹ sư hoạt động phù hợp trong Phòng Công nghệ để tạo phiếu đánh giá!");
        }

        List<User> eligibleEmployees = new ArrayList<>();
        for (User emp : targetEmployees) {
            boolean exists = reviewRepository.existsByEmployeeIdAndReviewTypeAndPeriodStartAndPeriodEnd(
                    emp.getId(), reviewType, req.getPeriodStart(), req.getPeriodEnd());
            if (!exists) {
                eligibleEmployees.add(emp);
            }
        }
        if (eligibleEmployees.isEmpty()) {
            throw AppException.conflict("Tất cả kỹ sư được chọn đã có phiếu đánh giá cùng loại trong khoảng thời gian này!");
        }

        TechEvaluationCycle savedCycle = cycleRepository.save(TechEvaluationCycle.builder()
                .cycleCode(cycleCode)
                .title(req.getTitle().trim())
                .reviewType(reviewType)
                .periodStart(req.getPeriodStart())
                .periodEnd(req.getPeriodEnd())
                .selfReviewDeadline(req.getSelfReviewDeadline())
                .status(TechEvaluationCycleStatus.OPEN)
                .departmentId(deptId)
                .createdBy(actorId)
                .build());

        int createdCount = 0;
        for (User emp : eligibleEmployees) {
            TechTelemetryBreakdownResponse breakdown = telemetryCalculator.calculateTelemetry(
                    emp.getId(), req.getPeriodStart(), req.getPeriodEnd());
            TechPerformanceReview review = TechPerformanceReview.builder()
                    .cycle(savedCycle)
                    .employeeId(emp.getId())
                    .departmentId(deptId)
                    .reviewType(reviewType)
                    .periodLabel(savedCycle.getCycleCode())
                    .periodStart(req.getPeriodStart())
                    .periodEnd(req.getPeriodEnd())
                    .deliveryScore(bd(breakdown.getDeliveryScore()))
                    .impactScore(bd(breakdown.getImpactScore()))
                    .capabilityScore(bd(breakdown.getCapabilityScore()))
                    .disciplineScore(bd(breakdown.getDisciplineScore()))
                    .telemetryTotalScore(bd(breakdown.getTelemetryTotalScore()))
                    .telemetrySnapshotJson(serializeBreakdown(breakdown))
                    .compensationStatus(CompensationProposalStatus.NONE)
                    .status(TechReviewStatus.SELF_REVIEW_PENDING)
                    .build();

            TechPerformanceReview savedReview = reviewRepository.save(review);
            createdCount++;

            notifySafe(
                    emp.getId(),
                    "TECH_REVIEW_CREATED",
                    "Kỳ đánh giá hiệu suất mới: " + savedCycle.getTitle(),
                    actor.getHoTen() + " đã mở kỳ đánh giá [" + savedCycle.getCycleCode() + "]. "
                            + "Điểm Telemetry hiện tại của bạn là " + formatScore(breakdown.getTelemetryTotalScore())
                            + "/100. Vui lòng hoàn thành Tự đánh giá trước hạn.",
                    "binh_thuong",
                    buildEmployeeReviewLink(savedReview.getId())
            );
        }

        broadcastReviewSync("CYCLE_CREATED", savedCycle.getId(), null, null);
        log.info("[Tech Review] {} đã mở kỳ đánh giá '{}' ({} phiếu)", actor.getHoTen(), savedCycle.getCycleCode(), createdCount);

        return TechEvaluationCycleResponse.builder()
                .id(savedCycle.getId())
                .cycleCode(savedCycle.getCycleCode())
                .title(savedCycle.getTitle())
                .reviewType(savedCycle.getReviewType())
                .periodStart(savedCycle.getPeriodStart())
                .periodEnd(savedCycle.getPeriodEnd())
                .selfReviewDeadline(savedCycle.getSelfReviewDeadline())
                .status(savedCycle.getStatus())
                .departmentId(savedCycle.getDepartmentId())
                .createdBy(actorId)
                .createdByName(actor.getHoTen())
                .createdAt(savedCycle.getCreatedAt())
                .totalReviews((long) createdCount)
                .selfReviewSubmittedCount(0L)
                .selfReviewRatePercent(0)
                .approvedCount(0L)
                .approvedRatePercent(0)
                .pendingActionCount(0L)
                .build();
    }

    @Transactional
    public TechEvaluationCycleResponse updateCycle(Long cycleId, UpdateTechEvaluationCycleRequest req, Long actorId) {
        User actor = loadActor(actorId);
        TechEvaluationCycle cycle = cycleRepository.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá #" + cycleId));

        validateCycleDepartmentAccess(actor, cycle.getDepartmentId());

        if (req.getTitle() != null && !req.getTitle().isBlank()) {
            cycle.setTitle(req.getTitle().trim());
        }

        if (req.getPeriodEnd() != null) {
            if (req.getPeriodEnd().isBefore(cycle.getPeriodStart())) {
                throw AppException.badRequest("Ngày kết thúc kỳ đánh giá không được trước ngày bắt đầu (" + cycle.getPeriodStart() + ")!");
            }
            validateCycleBoundaries(cycle.getReviewType(), cycle.getPeriodStart(), req.getPeriodEnd(), false);
            cycle.setPeriodEnd(req.getPeriodEnd());
            List<TechPerformanceReview> reviews = reviewRepository.findByCycleId(cycleId);
            for (TechPerformanceReview r : reviews) {
                if (r.getStatus() != TechReviewStatus.APPROVED) {
                    r.setPeriodEnd(req.getPeriodEnd());
                }
            }
        }

        if (req.getSelfReviewDeadline() != null) {
            if (req.getSelfReviewDeadline().isBefore(cycle.getPeriodStart())) {
                throw AppException.badRequest("Hạn tự đánh giá không được trước ngày bắt đầu kỳ (" + cycle.getPeriodStart() + ")!");
            }
            if (cycle.getStatus() == TechEvaluationCycleStatus.OPEN && req.getSelfReviewDeadline().isBefore(LocalDate.now())) {
                throw AppException.badRequest("Hạn tự đánh giá không được ở trong quá khứ (phải từ hôm nay trở đi)!");
            }
            LocalDate effectiveEnd = req.getPeriodEnd() != null ? req.getPeriodEnd() : cycle.getPeriodEnd();
            LocalDate baseForMax = effectiveEnd.isBefore(LocalDate.now()) ? LocalDate.now() : effectiveEnd;
            int maxDays = cycle.getReviewType() == TechReviewType.ANNUAL ? 30 : 15;
            LocalDate maxAllowed = baseForMax.plusDays(maxDays);
            if (req.getSelfReviewDeadline().isAfter(maxAllowed)) {
                throw AppException.badRequest("Hạn tự đánh giá không được vượt quá ngày " + maxAllowed + " (tối đa " + maxDays + " ngày sau khi kết thúc kỳ đánh giá)!");
            }
            cycle.setSelfReviewDeadline(req.getSelfReviewDeadline());
        }

        if (req.getStatus() != null) {
            cycle.setStatus(req.getStatus());
        }

        TechEvaluationCycle saved = cycleRepository.save(cycle);

        broadcastReviewSync("CYCLE_UPDATED", saved.getId(), null, null);
        log.info("[Tech Review] {} đã cập nhật kỳ đánh giá '{}' (#{})", actor.getHoTen(), saved.getCycleCode(), saved.getId());

        List<TechPerformanceReview> cycleReviews = reviewRepository.findByCycleId(saved.getId());
        long total = cycleReviews.size();
        long selfSubmitted = cycleReviews.stream().filter(r -> r.getSelfSubmittedAt() != null).count();
        long approved = cycleReviews.stream().filter(r -> r.getStatus() == TechReviewStatus.APPROVED).count();
        long pendingAction = cycleReviews.stream()
                .filter(r -> r.getStatus() == TechReviewStatus.MANAGER_REVIEW_PENDING
                        || r.getStatus() == TechReviewStatus.DIRECTOR_APPROVAL_PENDING)
                .count();

        User creator = loadActor(saved.getCreatedBy());

        return TechEvaluationCycleResponse.builder()
                .id(saved.getId())
                .cycleCode(saved.getCycleCode())
                .title(saved.getTitle())
                .reviewType(saved.getReviewType())
                .periodStart(saved.getPeriodStart())
                .periodEnd(saved.getPeriodEnd())
                .selfReviewDeadline(saved.getSelfReviewDeadline())
                .status(saved.getStatus())
                .departmentId(saved.getDepartmentId())
                .createdBy(saved.getCreatedBy())
                .createdByName(creator != null ? creator.getHoTen() : null)
                .createdAt(saved.getCreatedAt())
                .totalReviews(total)
                .selfReviewSubmittedCount(selfSubmitted)
                .selfReviewRatePercent(total > 0 ? (int) Math.round((selfSubmitted * 100.0) / total) : 0)
                .approvedCount(approved)
                .approvedRatePercent(total > 0 ? (int) Math.round((approved * 100.0) / total) : 0)
                .pendingActionCount(pendingAction)
                .build();
    }

    @Transactional
    public void deleteCycle(Long cycleId, Long actorId) {
        User actor = loadActor(actorId);
        TechEvaluationCycle cycle = cycleRepository.findById(cycleId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá #" + cycleId));

        validateCycleDepartmentAccess(actor, cycle.getDepartmentId());

        List<TechPerformanceReview> reviews = reviewRepository.findByCycleId(cycleId);
        long approvedCount = reviews.stream()
                .filter(r -> r.getStatus() == TechReviewStatus.APPROVED)
                .count();

        if (approvedCount > 0) {
            throw AppException.badRequest("Không thể xóa kỳ đánh giá đã có " + approvedCount
                    + " phiếu được phê duyệt hoàn tất! Hãy đổi trạng thái sang 'Đã đóng' (CLOSED) để lưu trữ.");
        }

        for (TechPerformanceReview r : reviews) {
            skillPromotionItemRepository.deleteByReviewId(r.getId());
            reviewRepository.delete(r);
        }

        cycleRepository.delete(cycle);

        broadcastReviewSync("CYCLE_DELETED", cycleId, null, null);
        log.info("[Tech Review] {} đã xóa kỳ đánh giá '{}' (#{}) và {} phiếu liên quan",
                actor.getHoTen(), cycle.getCycleCode(), cycleId, reviews.size());
    }

    @Transactional(readOnly = true)
    public TechPerformancePageResponse getReviewsPaginated(
            Long actorId,
            Long cycleId,
            TechReviewStatus status,
            TechRatingGrade grade,
            String keyword,
            Long focusReviewId,
            int page,
            int size) {

        User actor = loadActor(actorId);
        Long deptId = resolveScopedDepartmentId(actor, null);
        String cleanKeyword = (keyword != null && !keyword.isBlank()) ? keyword.trim() : null;

        int safePage = Math.max(0, page);
        int safeSize = Math.min(100, Math.max(1, size));

        if (focusReviewId != null) {
            List<Long> orderedIds = reviewRepository.findOrderedReviewIds(deptId, cycleId, status, grade, cleanKeyword);
            int idx = orderedIds.indexOf(focusReviewId);
            if (idx >= 0) {
                safePage = idx / safeSize;
            }
        }

        var pageable = org.springframework.data.domain.PageRequest.of(safePage, safeSize);
        var pageResult = reviewRepository.findReviewsPaginated(deptId, cycleId, status, grade, cleanKeyword, pageable);
        if (safePage > 0 && pageResult.getContent().isEmpty() && pageResult.getTotalElements() > 0) {
            int clamped = Math.max(0, pageResult.getTotalPages() - 1);
            pageResult = reviewRepository.findReviewsPaginated(deptId, cycleId, status, grade, cleanKeyword,
                    org.springframework.data.domain.PageRequest.of(clamped, safeSize));
        }

        List<TechPerformanceReview> rows = pageResult.getContent();
        Map<Long, User> userMap = loadReviewUsers(rows);

        // B-10: Danh sách phân trang TUYỆT ĐỐI không bao giờ trả trường tiền lương tuyệt đối
        List<TechPerformanceReviewResponse> content = rows.stream()
                .map(r -> mapToReviewResponse(r, userMap, actor, false, false))
                .collect(Collectors.toList());

        return TechPerformancePageResponse.builder()
                .content(content)
                .number(pageResult.getNumber())
                .size(pageResult.getSize())
                .totalElements(pageResult.getTotalElements())
                .totalPages(pageResult.getTotalPages())
                .first(pageResult.isFirst())
                .last(pageResult.isLast())
                .build();
    }

    @Transactional(readOnly = true)
    public TechPerformanceAnalyticsResponse getAnalytics(Long actorId, Long cycleId) {
        User actor = loadActor(actorId);
        Long deptId = resolveScopedDepartmentId(actor, null);

        TechEvaluationCycle targetCycle = null;
        if (cycleId != null) {
            targetCycle = cycleRepository.findById(cycleId)
                    .orElseThrow(() -> AppException.notFound("Không tìm thấy kỳ đánh giá với ID: " + cycleId));
            if (deptId != null && !deptId.equals(targetCycle.getDepartmentId())) {
                throw AppException.forbidden("Bạn không có quyền xem thống kê kỳ đánh giá ngoài phòng ban mình!");
            }
        } else {
            List<TechEvaluationCycle> cycles = deptId != null
                    ? cycleRepository.findByDepartmentIdOrderByPeriodEndDescIdDesc(deptId)
                    : cycleRepository.findAllByOrderByPeriodEndDescIdDesc();
            if (!cycles.isEmpty()) {
                targetCycle = cycles.get(0);
            }
        }

        List<TechPerformanceReview> reviews;
        if (targetCycle != null) {
            reviews = reviewRepository.findByCycleId(targetCycle.getId());
        } else {
            reviews = deptId != null ? reviewRepository.findByDepartmentId(deptId) : reviewRepository.findAll();
        }

        long total = reviews.size();
        long selfSubmitted = reviews.stream().filter(r -> r.getSelfSubmittedAt() != null).count();
        long managerPending = reviews.stream().filter(r -> r.getStatus() == TechReviewStatus.MANAGER_REVIEW_PENDING).count();
        long directorPending = reviews.stream().filter(r -> r.getStatus() == TechReviewStatus.DIRECTOR_APPROVAL_PENDING).count();
        long approved = reviews.stream().filter(r -> r.getStatus() == TechReviewStatus.APPROVED).count();
        int completionRate = total > 0 ? (int) Math.round((approved * 100.0) / total) : 0;

        double avgTelemetry = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getTelemetryTotalScore).collect(Collectors.toList()));
        double avgQual = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getManagerQualScore).filter(Objects::nonNull).collect(Collectors.toList()));
        double avgFinal = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getFinalScore).filter(Objects::nonNull).collect(Collectors.toList()));

        double avgDelivery = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getDeliveryScore).collect(Collectors.toList()));
        double avgImpact = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getImpactScore).collect(Collectors.toList()));
        double avgCapability = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getCapabilityScore).collect(Collectors.toList()));
        double avgDiscipline = averageBigDecimal(reviews.stream().map(TechPerformanceReview::getDisciplineScore).collect(Collectors.toList()));

        Map<String, Long> gradeDistribution = new LinkedHashMap<>();
        List<TechPerformanceAnalyticsResponse.GradeBucket> buckets = new ArrayList<>();
        for (TechRatingGrade g : TechRatingGrade.values()) {
            long count = reviews.stream().filter(r -> r.getFinalGrade() == g).count();
            gradeDistribution.put(g.name(), count);
            buckets.add(TechPerformanceAnalyticsResponse.GradeBucket.builder()
                    .grade(g.name())
                    .label(g.getLabelVi())
                    .count(count)
                    .build());
        }

        long pendingSkills = 0L;
        long approvedSkills = 0L;
        long pendingComp = 0L;
        for (TechPerformanceReview r : reviews) {
            if (r.getCompensationStatus() == CompensationProposalStatus.PENDING_CEO) {
                pendingComp++;
            }
            if (r.getSkillPromotionItems() != null) {
                for (TechSkillPromotionItem item : r.getSkillPromotionItems()) {
                    if (item.getStatus() == TechPromotionItemStatus.PENDING) pendingSkills++;
                    else if (item.getStatus() == TechPromotionItemStatus.APPROVED) approvedSkills++;
                }
            }
        }

        List<ExpiringCertificateResponse> expiringCerts = techSkillService != null
                ? techSkillService.getExpiringCertificates(deptId)
                : Collections.emptyList();
        long expiringSoonCount = expiringCerts.stream().filter(c -> "EXPIRING_SOON".equals(c.getExpiryStatus())).count();
        long expiredCount = expiringCerts.stream().filter(c -> "EXPIRED".equals(c.getExpiryStatus())).count();

        return TechPerformanceAnalyticsResponse.builder()
                .cycleId(targetCycle != null ? targetCycle.getId() : null)
                .cycleCode(targetCycle != null ? targetCycle.getCycleCode() : null)
                .cycleTitle(targetCycle != null ? targetCycle.getTitle() : "Toàn phòng Công nghệ")
                .totalReviews(total)
                .selfReviewSubmittedCount(selfSubmitted)
                .managerReviewPendingCount(managerPending)
                .directorApprovalPendingCount(directorPending)
                .approvedCount(approved)
                .completionRatePercent(completionRate)
                .avgTelemetryScore(avgTelemetry)
                .avgManagerQualScore(avgQual)
                .avgFinalScore(avgFinal)
                .avgDeliveryScore(avgDelivery)
                .avgImpactScore(avgImpact)
                .avgCapabilityScore(avgCapability)
                .avgDisciplineScore(avgDiscipline)
                .gradeDistribution(gradeDistribution)
                .gradeBuckets(buckets)
                .pendingSkillPromotionsCount(pendingSkills)
                .approvedSkillPromotionsCount(approvedSkills)
                .pendingCompensationProposalsCount(pendingComp)
                .expiringCertificatesCount(expiringSoonCount)
                .expiredCertificatesCount(expiredCount)
                .build();
    }

    @Transactional(readOnly = true)
    public TechPerformanceReviewResponse getReviewById(Long reviewId, Long actorId) {
        User actor = loadActor(actorId);
        TechPerformanceReview review = loadReview(reviewId);
        validateReadAccess(actor, review);

        Map<Long, User> userMap = loadReviewUsers(List.of(review));
        boolean includeCompMoney = canViewCompensationMoney(actor, review);
        return mapToReviewResponse(review, userMap, actor, true, includeCompMoney);
    }

    @Transactional(readOnly = true)
    public TechMyPerformanceOverviewResponse getMyPerformanceOverview(Long currentUserId) {
        User currentUser = loadActor(currentUserId);
        List<TechPerformanceReview> myReviews = reviewRepository.findByEmployeeIdOrderByPeriodEndDescIdDesc(currentUserId);
        Map<Long, User> userMap = loadReviewUsers(myReviews);
        userMap.putIfAbsent(currentUserId, currentUser);

        // B-10: Ở tab cá nhân không trả lương tuyệt đối qua DTO đánh giá
        List<TechPerformanceReviewResponse> reviewResponses = myReviews.stream()
                .map(r -> mapToReviewResponse(r, userMap, currentUser, true, false))
                .collect(Collectors.toList());

        List<TechCareerEvent> events = careerEventRepository.findByEmployeeIdOrderByEventDateDescIdDesc(currentUserId);
        Map<Long, User> actorMap = loadUserMap(
                events.stream().map(TechCareerEvent::getActorId).filter(Objects::nonNull).collect(Collectors.toSet())
        );
        List<TechCareerEventResponse> careerTimeline = events.stream()
                .map(ev -> TechCareerEventResponse.builder()
                        .id(ev.getId())
                        .employeeId(ev.getEmployeeId())
                        .reviewId(ev.getReviewId())
                        .eventType(ev.getEventType())
                        .title(ev.getTitle())
                        .oldValue(ev.getOldValue())
                        .newValue(ev.getNewValue())
                        .actorId(ev.getActorId())
                        .actorName(ev.getActorId() != null && actorMap.get(ev.getActorId()) != null
                                ? actorMap.get(ev.getActorId()).getHoTen()
                                : null)
                        .note(ev.getNote())
                        .eventDate(ev.getEventDate())
                        .build())
                .collect(Collectors.toList());

        LocalDate today = LocalDate.now();
        TechTelemetryBreakdownResponse livePreview = telemetryCalculator.calculateTelemetry(
                currentUserId, today.withDayOfMonth(1), today);

        long pendingSelfCount = myReviews.stream()
                .filter(r -> r.getStatus() == TechReviewStatus.SELF_REVIEW_PENDING
                        || r.getStatus() == TechReviewStatus.REJECTED_FOR_REVISION)
                .count();
        long approvedCount = myReviews.stream()
                .filter(r -> r.getStatus() == TechReviewStatus.APPROVED)
                .count();

        TechPerformanceReview latestApproved = myReviews.stream()
                .filter(r -> r.getStatus() == TechReviewStatus.APPROVED && r.getFinalScore() != null)
                .findFirst()
                .orElse(null);

        int expiringCount = 0;
        if (livePreview != null) {
            expiringCount = (livePreview.getExpiringSoonCertCount() != null ? livePreview.getExpiringSoonCertCount() : 0)
                    + (livePreview.getExpiredCertCount() != null ? livePreview.getExpiredCertCount() : 0);
        }

        return TechMyPerformanceOverviewResponse.builder()
                .reviews(reviewResponses)
                .careerTimeline(careerTimeline)
                .currentMonthTelemetryPreview(livePreview)
                .pendingSelfReviewCount(pendingSelfCount)
                .approvedReviewCount(approvedCount)
                .latestFinalScore(latestApproved != null && latestApproved.getFinalScore() != null
                        ? latestApproved.getFinalScore().doubleValue() : null)
                .latestFinalGrade(latestApproved != null && latestApproved.getFinalGrade() != null
                        ? latestApproved.getFinalGrade().name() : null)
                .expiringCertificatesCount(expiringCount)
                .build();
    }

    @Transactional
    public TechPerformanceReviewResponse recalculateTelemetry(Long reviewId, Long actorId) {
        User actor = loadActor(actorId);
        if (actor.getRole() != Role.GIAM_DOC_PHONG_BAN
                && actor.getRole() != Role.TRUONG_PHONG
                && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Bạn không có quyền tính lại Telemetry phiếu đánh giá!");
        }
        TechPerformanceReview review = loadReview(reviewId);
        validateManagerDeptAccess(actor, review);

        if (review.getStatus() == TechReviewStatus.APPROVED) {
            throw AppException.badRequest("Phiếu đánh giá đã chốt (APPROVED), snapshot Telemetry đã được đóng băng!");
        }

        TechTelemetryBreakdownResponse breakdown = telemetryCalculator.calculateTelemetry(
                review.getEmployeeId(), review.getPeriodStart(), review.getPeriodEnd());
        review.setDeliveryScore(bd(breakdown.getDeliveryScore()));
        review.setImpactScore(bd(breakdown.getImpactScore()));
        review.setCapabilityScore(bd(breakdown.getCapabilityScore()));
        review.setDisciplineScore(bd(breakdown.getDisciplineScore()));
        review.setTelemetryTotalScore(bd(breakdown.getTelemetryTotalScore()));
        review.setTelemetrySnapshotJson(serializeBreakdown(breakdown));

        // Nếu đã có điểm định tính thì đồng bộ lại finalScore / finalGrade
        if (review.getManagerQualScore() != null) {
            double delta = review.getCalibrationDelta() != null ? review.getCalibrationDelta().doubleValue() : 0.0;
            double recalculatedFinal = computeFinalScore(
                    breakdown.getTelemetryTotalScore(),
                    review.getManagerQualScore().doubleValue(),
                    delta);
            review.setFinalScore(bd1(recalculatedFinal));
            review.setFinalGrade(TechRatingGrade.fromScore(recalculatedFinal));
        }

        TechPerformanceReview saved = reviewRepository.save(review);
        broadcastReviewSync("TELEMETRY_RECALCULATED", saved.getCycle() != null ? saved.getCycle().getId() : null, saved.getId(), saved.getEmployeeId());
        Map<Long, User> userMap = loadReviewUsers(List.of(saved));
        return mapToReviewResponse(saved, userMap, actor, true, canViewCompensationMoney(actor, saved));
    }

    @Transactional
    public TechPerformanceReviewResponse submitSelfReview(Long reviewId, SubmitSelfReviewRequest req, Long currentUserId) {
        User owner = loadActor(currentUserId);
        TechPerformanceReview review = loadReview(reviewId);

        if (!Objects.equals(review.getEmployeeId(), currentUserId)) {
            throw AppException.forbidden("Bạn chỉ có quyền tự đánh giá cho phiếu của chính mình!");
        }

        if (review.getStatus() == TechReviewStatus.APPROVED
                || review.getStatus() == TechReviewStatus.DIRECTOR_APPROVAL_PENDING) {
            throw AppException.badRequest("Phiếu đánh giá đang trình duyệt hoặc đã chốt, không thể chỉnh sửa Self-Review!");
        }

        List<SubmitSelfReviewRequest.SkillPromotionProposalInput> proposals = req.getSkillPromotions() != null
                ? req.getSkillPromotions()
                : Collections.emptyList();
        if (proposals.size() > 3) {
            throw AppException.badRequest("Mỗi kỳ đánh giá chỉ được đề xuất nâng bậc tối đa 3 kỹ năng!");
        }

        Set<Long> seenSkillIds = new HashSet<>();
        Map<Long, UserTechSkill> currentSkillsBySkillId = userSkillRepository.findByUserId(currentUserId).stream()
                .collect(Collectors.toMap(uts -> uts.getSkill().getId(), uts -> uts, (a, b) -> a));

        List<TechSkillPromotionItem> preparedItems = new ArrayList<>();
        for (SubmitSelfReviewRequest.SkillPromotionProposalInput input : proposals) {
            if (input.getSkillId() == null) {
                throw AppException.badRequest("Thiếu ID kỹ năng trong đề xuất nâng bậc!");
            }
            if (!seenSkillIds.add(input.getSkillId())) {
                throw AppException.badRequest("Không được chọn trùng lặp cùng một kỹ năng trong một phiếu đánh giá!");
            }
            if (input.getTargetLevel() == null) {
                throw AppException.badRequest("Vui lòng chọn cấp bậc mục tiêu cho kỹ năng!");
            }
            if (input.getEvidenceNote() == null || input.getEvidenceNote().trim().isEmpty()) {
                throw AppException.badRequest("Vui lòng nhập minh chứng đóng góp cho kỹ năng đề xuất nâng bậc!");
            }

            TechSkill skill = skillRepository.findById(input.getSkillId())
                    .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ năng với ID: " + input.getSkillId()));
            UserTechSkill existingUserSkill = currentSkillsBySkillId.get(skill.getId());
            ProficiencyLevel fromLevel = existingUserSkill != null ? existingUserSkill.getProficiencyLevel() : null;

            if (fromLevel != null && input.getTargetLevel().ordinal() <= fromLevel.ordinal()) {
                throw AppException.badRequest("Cấp bậc mục tiêu của kỹ năng '" + skill.getSkillName()
                        + "' (" + input.getTargetLevel() + ") phải cao hơn cấp bậc hiện tại (" + fromLevel + ")!");
            }

            preparedItems.add(TechSkillPromotionItem.builder()
                    .review(review)
                    .userTechSkillId(existingUserSkill != null ? existingUserSkill.getId() : null)
                    .skill(skill)
                    .fromLevel(fromLevel)
                    .targetLevel(input.getTargetLevel())
                    .evidenceNote(input.getEvidenceNote().trim())
                    .evidenceUrl(normalizeText(input.getEvidenceUrl()))
                    .status(TechPromotionItemStatus.PENDING)
                    .build());
        }

        replaceSkillPromotionItems(review, preparedItems);

        review.setSelfSummary(req.getSelfSummary().trim());
        review.setSelfAchievements(normalizeText(req.getSelfAchievements()));
        review.setSelfChallenges(normalizeText(req.getSelfChallenges()));
        review.setSelfGoalsNext(normalizeText(req.getSelfGoalsNext()));
        review.setSelfRatingScore(req.getSelfRatingScore() != null ? bd1(req.getSelfRatingScore()) : null);
        review.setSelfSubmittedAt(LocalDateTime.now());
        review.setRejectionReason(null);
        review.setStatus(TechReviewStatus.MANAGER_REVIEW_PENDING);

        TechPerformanceReview saved = reviewRepository.save(review);
        notifyManagersOnSelfSubmitted(saved, owner);
        broadcastReviewSync("SELF_SUBMITTED", saved.getCycle() != null ? saved.getCycle().getId() : null, saved.getId(), saved.getEmployeeId());

        Map<Long, User> userMap = loadReviewUsers(List.of(saved));
        return mapToReviewResponse(saved, userMap, owner, true, false);
    }

    @Transactional
    public TechAiCopilotResponse generateAiCopilotSummary(Long reviewId, Long actorId) {
        User actor = loadActor(actorId);
        TechPerformanceReview review = loadReview(reviewId);
        validateManagerOrCeoDeptAccess(actor, review);

        User employee = userRepository.findById(review.getEmployeeId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự được đánh giá!"));

        TechTelemetryBreakdownResponse breakdown = resolveBreakdown(review);
        TechAiCopilotResponse aiResponse = copilotService.generateReviewSummary(
                review, employee, breakdown, review.getSkillPromotionItems());

        review.setAiCopilotSummary(aiResponse.getFormattedSummary());
        reviewRepository.save(review);
        return aiResponse;
    }

    @Transactional
    public TechPerformanceReviewResponse evaluateReview(Long reviewId, ManagerEvaluateReviewRequest req, Long actorId) {
        User actor = loadActor(actorId);
        if (actor.getRole() != Role.GIAM_DOC_PHONG_BAN
                && actor.getRole() != Role.TRUONG_PHONG
                && actor.getRole() != Role.CEO
                && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Bạn không có quyền chấm điểm đánh giá hiệu suất kỹ sư!");
        }

        TechPerformanceReview review = loadReview(reviewId);
        if (Objects.equals(review.getEmployeeId(), actorId)) {
            throw AppException.forbidden("Không được phép tự chấm điểm hoặc tự phê duyệt phiếu đánh giá của chính mình!");
        }
        validateManagerOrCeoDeptAccess(actor, review);

        // B-10: Trưởng phòng không bao giờ được phép truyền số tiền lương tuyệt đối
        if (actor.getRole() == Role.TRUONG_PHONG
                && (req.getRecommendedNewBaseSalary() != null || req.getRecommendedNewAllowance() != null)) {
            throw AppException.forbidden("Theo nguyên tắc bảo mật B-10, Trưởng phòng chỉ đề xuất % tăng dự kiến và Chức danh; không được xem/nhập số tiền lương tuyệt đối!");
        }

        if (review.getStatus() == TechReviewStatus.APPROVED) {
            throw AppException.badRequest("Phiếu đánh giá đã được chốt hoàn tất (APPROVED), không thể chỉnh sửa!");
        }

        User employee = userRepository.findById(review.getEmployeeId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự được đánh giá!"));

        // Chấm điểm 4 tiêu chí định tính (tổng 0..100)
        double qualTotal = round2(
                req.getQualCraftScore()
                        + req.getQualOwnershipScore()
                        + req.getQualCollabScore()
                        + req.getQualGrowthScore()
        );

        double calibrationDelta = req.getCalibrationDelta() != null ? round2(req.getCalibrationDelta()) : 0.0;
        if (Math.abs(calibrationDelta) > 0.0001) {
            if (actor.getRole() == Role.TRUONG_PHONG) {
                throw AppException.forbidden("Chỉ Giám đốc Công nghệ hoặc Tổng Giám Đốc (CEO) mới có quyền hiệu chỉnh điểm (Calibration Delta)!");
            }
            if (req.getCalibrationReason() == null || req.getCalibrationReason().isBlank()) {
                throw AppException.badRequest("Vui lòng nhập lý do bắt buộc khi hiệu chỉnh điểm (Calibration)!");
            }
        }

        double telemetryTotal = review.getTelemetryTotalScore() != null ? review.getTelemetryTotalScore().doubleValue() : 0.0;
        double finalScore = computeFinalScore(telemetryTotal, qualTotal, calibrationDelta);
        TechRatingGrade finalGrade = TechRatingGrade.fromScore(finalScore);

        boolean hasCompProposal = Boolean.TRUE.equals(req.getRecommendPromotion())
                || (req.getRecommendedSalaryIncreasePct() != null && req.getRecommendedSalaryIncreasePct() > 0.0)
                || (req.getRecommendedTitle() != null && !req.getRecommendedTitle().trim().isEmpty());

        if (hasCompProposal && finalScore < 75.0
                && (req.getExceptionJustification() == null || req.getExceptionJustification().isBlank())) {
            throw AppException.badRequest("Chỉ được đề xuất thăng chức danh / điều chỉnh lương khi Điểm Tổng hợp đạt từ 75.0 trở lên (hoặc nhập giải trình ngoại lệ)!");
        }

        // Cập nhật quyết định duyệt/từ chối từng kỹ năng nâng bậc
        applyManagerSkillDecisions(review, req.getSkillDecisions(), employee.getId());

        // Xác định điều kiện leo thang phê duyệt
        boolean isManagerSubject = employee.getRole() == Role.TRUONG_PHONG
                || employee.getRole() == Role.GIAM_DOC_PHONG_BAN;
        boolean hasSeniorPlusSkill = review.getSkillPromotionItems().stream()
                .anyMatch(item -> item.getStatus() == TechPromotionItemStatus.APPROVED
                        && (item.getTargetLevel() == ProficiencyLevel.SENIOR
                                || item.getTargetLevel() == ProficiencyLevel.EXPERT));

        boolean escalate;
        if (actor.getRole() == Role.TRUONG_PHONG) {
            escalate = isManagerSubject || hasSeniorPlusSkill || hasCompProposal;
        } else if (actor.getRole() == Role.GIAM_DOC_PHONG_BAN) {
            escalate = hasCompProposal || employee.getRole() == Role.GIAM_DOC_PHONG_BAN;
        } else {
            // CEO / ADMIN đánh giá có kèm đề xuất đãi ngộ -> chuyển chờ xác nhận finalDecision hoặc nếu không đề xuất đãi ngộ thì chốt luôn
            escalate = hasCompProposal;
        }

        review.setEvaluatorId(actorId);
        review.setQualCraftScore(bd(req.getQualCraftScore()));
        review.setQualOwnershipScore(bd(req.getQualOwnershipScore()));
        review.setQualCollabScore(bd(req.getQualCollabScore()));
        review.setQualGrowthScore(bd(req.getQualGrowthScore()));
        review.setManagerQualScore(bd(qualTotal));
        review.setManagerComment(req.getManagerComment().trim());
        review.setManagerFeedbackGoals(normalizeText(req.getManagerFeedbackGoals()));
        review.setCalibrationDelta(bd(calibrationDelta));
        review.setCalibrationReason(normalizeText(req.getCalibrationReason()));
        review.setFinalScore(bd1(finalScore));
        review.setFinalGrade(finalGrade);

        review.setRecommendPromotion(hasCompProposal);
        review.setRecommendedTitle(normalizeText(req.getRecommendedTitle()));
        review.setRecommendedSalaryIncreasePct(
                req.getRecommendedSalaryIncreasePct() != null ? bd(req.getRecommendedSalaryIncreasePct()) : null);
        String combinedCompReason = normalizeText(req.getCompensationReason());
        if (hasCompProposal && combinedCompReason == null && req.getExceptionJustification() != null) {
            combinedCompReason = req.getExceptionJustification().trim();
        } else if (req.getExceptionJustification() != null && !req.getExceptionJustification().isBlank() && combinedCompReason != null) {
            combinedCompReason = combinedCompReason + " | Ngoại lệ: " + req.getExceptionJustification().trim();
        }
        review.setCompensationReason(combinedCompReason);

        if (actor.getRole() == Role.GIAM_DOC_PHONG_BAN || actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) {
            if (req.getRecommendedNewBaseSalary() != null) {
                review.setRecommendedNewBaseSalary(req.getRecommendedNewBaseSalary());
            }
            if (req.getRecommendedNewAllowance() != null) {
                review.setRecommendedNewAllowance(req.getRecommendedNewAllowance());
            }
        }

        review.setRejectionReason(null);

        if (escalate) {
            review.setStatus(TechReviewStatus.DIRECTOR_APPROVAL_PENDING);
            review.setCompensationStatus(hasCompProposal ? CompensationProposalStatus.PENDING_CEO : CompensationProposalStatus.NONE);
            review.setFinalApproverId(null);
            review.setFinalApprovedAt(null);
        } else {
            review.setStatus(TechReviewStatus.APPROVED);
            review.setCompensationStatus(CompensationProposalStatus.NONE);
            review.setFinalApproverId(actorId);
            review.setFinalApprovedAt(LocalDateTime.now());
        }

        TechPerformanceReview saved = reviewRepository.save(review);
        if (saved.getStatus() == TechReviewStatus.APPROVED) {
            applyApprovedSkillPromotionsAndTimeline(saved, actorId);
            notifyEngineerOnReviewResult(saved, actor, true, null);
        } else {
            notifyApproversOnEscalation(saved, actor, employee, hasCompProposal);
        }

        broadcastReviewSync("EVALUATED", saved.getCycle() != null ? saved.getCycle().getId() : null, saved.getId(), saved.getEmployeeId());
        Map<Long, User> userMap = loadReviewUsers(List.of(saved));
        return mapToReviewResponse(saved, userMap, actor, true, canViewCompensationMoney(actor, saved));
    }

    @Transactional
    public TechPerformanceReviewResponse finalDecision(Long reviewId, FinalDecisionRequest req, Long actorId) {
        User actor = loadActor(actorId);
        if (actor.getRole() != Role.CEO
                && actor.getRole() != Role.GIAM_DOC_PHONG_BAN
                && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Chỉ Giám đốc Công nghệ hoặc Tổng Giám Đốc (CEO) mới có quyền phê duyệt cuối cùng!");
        }

        TechPerformanceReview review = loadReview(reviewId);
        if (Objects.equals(review.getEmployeeId(), actorId)) {
            throw AppException.forbidden("Không được phép tự phê duyệt phiếu đánh giá của chính mình!");
        }
        validateManagerOrCeoDeptAccess(actor, review);

        if (review.getStatus() == TechReviewStatus.APPROVED) {
            throw AppException.badRequest("Phiếu đánh giá này đã được phê duyệt hoàn tất trước đó!");
        }
        if (review.getManagerQualScore() == null) {
            throw AppException.badRequest("Quản lý trực tiếp chưa hoàn tất chấm điểm định tính cho phiếu đánh giá này!");
        }

        String decision = req.getDecision() != null ? req.getDecision().trim().toUpperCase(Locale.ROOT) : "";
        User employee = userRepository.findById(review.getEmployeeId())
                .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự được đánh giá!"));

        if ("REJECTED_FOR_REVISION".equals(decision)) {
            if (req.getRejectionReason() == null || req.getRejectionReason().trim().isEmpty()) {
                throw AppException.badRequest("Vui lòng nhập lý do trả lại chỉnh sửa!");
            }
            review.setStatus(TechReviewStatus.REJECTED_FOR_REVISION);
            review.setRejectionReason(req.getRejectionReason().trim());
            review.setFinalApproverId(null);
            review.setFinalApprovedAt(null);
            if (review.getCompensationStatus() == CompensationProposalStatus.PENDING_CEO) {
                review.setCompensationStatus(CompensationProposalStatus.REJECTED);
            }

            TechPerformanceReview saved = reviewRepository.save(review);
            notifyOnRejectedForRevision(saved, actor);
            broadcastReviewSync("REJECTED_FOR_REVISION", saved.getCycle() != null ? saved.getCycle().getId() : null, saved.getId(), saved.getEmployeeId());

            Map<Long, User> userMap = loadReviewUsers(List.of(saved));
            return mapToReviewResponse(saved, userMap, actor, true, canViewCompensationMoney(actor, saved));
        }

        if (!"APPROVED".equals(decision)) {
            throw AppException.badRequest("Quyết định không hợp lệ (chỉ chấp nhận APPROVED hoặc REJECTED_FOR_REVISION)!");
        }

        boolean pendingComp = review.getCompensationStatus() == CompensationProposalStatus.PENDING_CEO
                || Boolean.TRUE.equals(review.getRecommendPromotion())
                || (review.getRecommendedSalaryIncreasePct() != null && review.getRecommendedSalaryIncreasePct().doubleValue() > 0)
                || (review.getRecommendedTitle() != null && !review.getRecommendedTitle().isBlank());

        if (pendingComp && actor.getRole() != Role.CEO && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Phiếu có đề xuất Thăng chức danh / Điều chỉnh Lương đang chờ Tổng Giám Đốc (CEO) phê duyệt cuối cùng!");
        }
        if (employee.getRole() == Role.GIAM_DOC_PHONG_BAN && actor.getRole() != Role.CEO && actor.getRole() != Role.ADMIN) {
            throw AppException.forbidden("Phiếu đánh giá của Giám đốc Công nghệ phải do Tổng Giám Đốc (CEO) phê duyệt!");
        }

        // Calibration delta optional override
        if (req.getCalibrationDelta() != null) {
            double delta = round2(req.getCalibrationDelta());
            if (Math.abs(delta) > 0.0001 && (req.getCalibrationReason() == null || req.getCalibrationReason().isBlank())
                    && (review.getCalibrationReason() == null || review.getCalibrationReason().isBlank())) {
                throw AppException.badRequest("Vui lòng nhập lý do khi hiệu chỉnh điểm (Calibration)!");
            }
            review.setCalibrationDelta(bd(delta));
            if (req.getCalibrationReason() != null && !req.getCalibrationReason().isBlank()) {
                review.setCalibrationReason(req.getCalibrationReason().trim());
            }
        }

        double telemetryTotal = review.getTelemetryTotalScore() != null ? review.getTelemetryTotalScore().doubleValue() : 0.0;
        double qualTotal = review.getManagerQualScore() != null ? review.getManagerQualScore().doubleValue() : 0.0;
        double delta = review.getCalibrationDelta() != null ? review.getCalibrationDelta().doubleValue() : 0.0;
        double finalScore = computeFinalScore(telemetryTotal, qualTotal, delta);
        review.setFinalScore(bd1(finalScore));
        review.setFinalGrade(TechRatingGrade.fromScore(finalScore));
        review.setRejectionReason(null);

        if (pendingComp) {
            boolean approveComp = !Boolean.FALSE.equals(req.getApproveCompensation());
            if (approveComp) {
                applyCeoCompensationDecision(review, employee, req, actorId);
                review.setCompensationStatus(CompensationProposalStatus.APPROVED);
            } else {
                review.setCompensationStatus(CompensationProposalStatus.REJECTED);
            }
        }

        review.setStatus(TechReviewStatus.APPROVED);
        review.setFinalApproverId(actorId);
        review.setFinalApprovedAt(LocalDateTime.now());

        TechPerformanceReview saved = reviewRepository.save(review);
        applyApprovedSkillPromotionsAndTimeline(saved, actorId);
        notifyEngineerOnReviewResult(saved, actor, true, null);
        if (saved.getEvaluatorId() != null && !Objects.equals(saved.getEvaluatorId(), actorId)) {
            notifySafe(
                    saved.getEvaluatorId(),
                    "TECH_REVIEW_APPROVED",
                    "Phiếu đánh giá đề xuất đã được cấp trên phê duyệt",
                    actor.getHoTen() + " đã phê duyệt phiếu đánh giá kỳ " + saved.getPeriodLabel()
                            + " của " + employee.getHoTen() + " (Xếp hạng " + saved.getFinalGrade() + ").",
                    "binh_thuong",
                    buildManagerReviewLink(actor, saved.getId())
            );
        }

        broadcastReviewSync("APPROVED", saved.getCycle() != null ? saved.getCycle().getId() : null, saved.getId(), saved.getEmployeeId());
        Map<Long, User> userMap = loadReviewUsers(List.of(saved));
        return mapToReviewResponse(saved, userMap, actor, true, canViewCompensationMoney(actor, saved));
    }

    // ── Private Helpers ─────────────────────────────────────────────────────────

    private void applyCeoCompensationDecision(
            TechPerformanceReview review,
            User employee,
            FinalDecisionRequest req,
            Long actorId) {

        String reason = normalizeText(req.getCompensationNote());
        if (reason == null) {
            reason = normalizeText(review.getCompensationReason());
        }
        if (reason == null) {
            reason = "Phê duyệt sau đánh giá hiệu suất kỳ " + review.getPeriodLabel();
        }

        boolean userModified = false;

        // 1. Thăng chức danh -> users.chuc_vu + employee_histories (PROMOTED) + tech_career_events (TITLE_PROMOTED)
        String targetTitle = normalizeText(req.getOverrideTitle());
        if (targetTitle == null) {
            targetTitle = normalizeText(review.getRecommendedTitle());
        }
        if (targetTitle != null && !targetTitle.equals(employee.getChucVu())) {
            String oldTitle = employee.getChucVu();
            employee.setChucVu(targetTitle);
            userModified = true;

            employeeHistoryService.logHistory(
                    employee.getId(),
                    "PROMOTED",
                    oldTitle,
                    targetTitle,
                    "Thăng chức danh từ kết quả đánh giá Phòng Công nghệ (" + review.getPeriodLabel() + "): " + reason
            );
            careerEventRepository.save(TechCareerEvent.builder()
                    .employeeId(employee.getId())
                    .reviewId(review.getId())
                    .eventType(TechCareerEventType.TITLE_PROMOTED)
                    .title("Thăng chức danh chuyên môn: " + targetTitle)
                    .oldValue(oldTitle)
                    .newValue(targetTitle)
                    .actorId(actorId)
                    .note(reason)
                    .eventDate(LocalDateTime.now())
                    .build());
            review.setRecommendedTitle(targetTitle);
        }

        // 2. Điều chỉnh lương / phụ cấp -> users + salary_history + employee_histories (SALARY_CHANGED) + tech_career_events (không lộ VNĐ!)
        Double oldBs = employee.getBaseSalary();
        Double oldAl = employee.getAllowance();

        Double proposedBs = req.getNewBaseSalary() != null ? req.getNewBaseSalary() : review.getRecommendedNewBaseSalary();
        Double proposedAl = req.getNewAllowance() != null ? req.getNewAllowance() : review.getRecommendedNewAllowance();

        if (proposedBs == null && review.getRecommendedSalaryIncreasePct() != null
                && review.getRecommendedSalaryIncreasePct().doubleValue() > 0
                && oldBs != null && oldBs > 0) {
            double factor = 1.0 + (review.getRecommendedSalaryIncreasePct().doubleValue() / 100.0);
            proposedBs = (double) Math.round(oldBs * factor);
        }

        boolean salaryChanged = false;
        if (proposedBs != null && (oldBs == null || !oldBs.equals(proposedBs))) {
            employee.setBaseSalary(proposedBs);
            review.setRecommendedNewBaseSalary(proposedBs);
            salaryChanged = true;
            userModified = true;
        }
        if (proposedAl != null && (oldAl == null || !oldAl.equals(proposedAl))) {
            employee.setAllowance(proposedAl);
            review.setRecommendedNewAllowance(proposedAl);
            salaryChanged = true;
            userModified = true;
        }

        if (userModified) {
            userRepository.save(employee);
        }

        if (salaryChanged) {
            SalaryHistory salHistory = SalaryHistory.builder()
                    .employeeId(employee.getId())
                    .changedBy(actorId)
                    .oldBaseSalary(oldBs)
                    .newBaseSalary(employee.getBaseSalary())
                    .oldAllowance(oldAl)
                    .newAllowance(employee.getAllowance())
                    .reason(reason)
                    .changeDate(LocalDateTime.now())
                    .build();
            salaryHistoryRepository.save(salHistory);

            String oldSal = String.format("Lương CB: %.0f, Phụ cấp: %.0f",
                    oldBs != null ? oldBs : 0, oldAl != null ? oldAl : 0);
            String newSal = String.format("Lương CB: %.0f, Phụ cấp: %.0f",
                    employee.getBaseSalary() != null ? employee.getBaseSalary() : 0,
                    employee.getAllowance() != null ? employee.getAllowance() : 0);
            employeeHistoryService.logHistory(employee.getId(), "SALARY_CHANGED", oldSal, newSal, reason);

            String pctLabel = review.getRecommendedSalaryIncreasePct() != null
                    ? "+" + review.getRecommendedSalaryIncreasePct().stripTrailingZeros().toPlainString() + "%"
                    : "Điều chỉnh đãi ngộ";
            careerEventRepository.save(TechCareerEvent.builder()
                    .employeeId(employee.getId())
                    .reviewId(review.getId())
                    .eventType(TechCareerEventType.COMPENSATION_ADJUSTED)
                    .title("Tổng Giám Đốc phê duyệt điều chỉnh đãi ngộ (" + review.getPeriodLabel() + ")")
                    .oldValue(null)
                    .newValue(pctLabel)
                    .actorId(actorId)
                    .note(reason)
                    .eventDate(LocalDateTime.now())
                    .build());
        }
    }

    private void applyApprovedSkillPromotionsAndTimeline(TechPerformanceReview review, Long approverId) {
        LocalDateTime now = LocalDateTime.now();

        boolean alreadyLoggedReviewEvent = careerEventRepository.findByEmployeeIdOrderByEventDateDescIdDesc(review.getEmployeeId())
                .stream()
                .anyMatch(ev -> review.getId().equals(ev.getReviewId()) && ev.getEventType() == TechCareerEventType.REVIEW_COMPLETED);

        if (!alreadyLoggedReviewEvent) {
            String gradeName = review.getFinalGrade() != null ? review.getFinalGrade().name() : "B";
            String scoreStr = review.getFinalScore() != null
                    ? review.getFinalScore().stripTrailingZeros().toPlainString()
                    : "0";
            careerEventRepository.save(TechCareerEvent.builder()
                    .employeeId(review.getEmployeeId())
                    .reviewId(review.getId())
                    .eventType(TechCareerEventType.REVIEW_COMPLETED)
                    .title("Hoàn tất Đánh giá Hiệu suất kỳ " + review.getPeriodLabel() + " — Xếp hạng " + gradeName)
                    .oldValue("Telemetry " + formatScore(review.getTelemetryTotalScore() != null ? review.getTelemetryTotalScore().doubleValue() : 0.0) + "đ")
                    .newValue("Hạng " + gradeName + " (" + scoreStr + "đ)")
                    .actorId(approverId)
                    .note(truncate(review.getManagerComment(), 450))
                    .eventDate(now)
                    .build());
        }

        if (review.getSkillPromotionItems() == null) {
            return;
        }

        boolean skillUpdated = false;
        for (TechSkillPromotionItem item : review.getSkillPromotionItems()) {
            if (item.getStatus() != TechPromotionItemStatus.APPROVED || item.getAppliedAt() != null) {
                continue;
            }
            TechSkill skill = item.getSkill();
            UserTechSkill userSkill = userSkillRepository.findByUserIdAndSkillId(review.getEmployeeId(), skill.getId())
                    .orElse(null);

            if (userSkill == null) {
                userSkill = UserTechSkill.builder()
                        .userId(review.getEmployeeId())
                        .skill(skill)
                        .proficiencyLevel(item.getTargetLevel())
                        .yearsOfExperience(1.0)
                        .isVerified(true)
                        .verifiedBy(approverId)
                        .verifiedAt(now)
                        .highlightProject(truncate(item.getEvidenceNote(), 250))
                        .build();
            } else {
                userSkill.setProficiencyLevel(item.getTargetLevel());
                userSkill.setIsVerified(true);
                userSkill.setVerifiedBy(approverId);
                userSkill.setVerifiedAt(now);
                if (userSkill.getHighlightProject() == null || userSkill.getHighlightProject().isBlank()) {
                    userSkill.setHighlightProject(truncate(item.getEvidenceNote(), 250));
                }
            }

            UserTechSkill savedSkill = userSkillRepository.save(userSkill);
            item.setUserTechSkillId(savedSkill.getId());
            item.setAppliedAt(now);
            skillPromotionItemRepository.save(item);
            skillUpdated = true;

            careerEventRepository.save(TechCareerEvent.builder()
                    .employeeId(review.getEmployeeId())
                    .reviewId(review.getId())
                    .eventType(TechCareerEventType.SKILL_LEVEL_UP)
                    .title("Nâng bậc kỹ năng " + skill.getSkillName() + " lên " + item.getTargetLevel().name())
                    .oldValue(item.getFromLevel() != null ? item.getFromLevel().name() : "MỚI")
                    .newValue(item.getTargetLevel().name())
                    .actorId(approverId)
                    .note(truncate(item.getEvidenceNote(), 450))
                    .eventDate(now)
                    .build());
        }

        if (skillUpdated && notificationService != null) {
            try {
                Map<String, Object> skillPayload = new LinkedHashMap<>();
                skillPayload.put("domain", "TECH_SKILL");
                skillPayload.put("action", "PROMOTED_VIA_REVIEW");
                skillPayload.put("userId", review.getEmployeeId());
                notificationService.broadcastTopic("/topic/tech-updates", skillPayload);
            } catch (Exception e) {
                log.warn("[Tech Review] Không thể broadcast sync skill sau review: {}", e.getMessage());
            }
        }
    }

    private void applyManagerSkillDecisions(
            TechPerformanceReview review,
            List<ManagerEvaluateReviewRequest.SkillDecisionInput> decisions,
            Long employeeId) {
        if (decisions == null || decisions.isEmpty()) {
            return;
        }

        Map<Long, UserTechSkill> currentSkillsBySkillId = userSkillRepository.findByUserId(employeeId).stream()
                .collect(Collectors.toMap(uts -> uts.getSkill().getId(), uts -> uts, (a, b) -> a));

        List<TechSkillPromotionItem> items = review.getSkillPromotionItems();
        if (items == null) {
            items = new ArrayList<>();
            review.setSkillPromotionItems(items);
        }

        for (ManagerEvaluateReviewRequest.SkillDecisionInput d : decisions) {
            TechSkillPromotionItem matched = null;
            if (d.getItemId() != null) {
                matched = items.stream().filter(i -> Objects.equals(i.getId(), d.getItemId())).findFirst().orElse(null);
            }
            if (matched == null && d.getSkillId() != null) {
                matched = items.stream().filter(i -> Objects.equals(i.getSkill().getId(), d.getSkillId())).findFirst().orElse(null);
            }

            if (matched != null) {
                if (d.getTargetLevel() != null) {
                    if (matched.getFromLevel() != null && d.getTargetLevel().ordinal() <= matched.getFromLevel().ordinal()) {
                        throw AppException.badRequest("Cấp bậc mục tiêu của kỹ năng '" + matched.getSkill().getSkillName()
                                + "' phải cao hơn cấp bậc hiện tại (" + matched.getFromLevel() + ")!");
                    }
                    matched.setTargetLevel(d.getTargetLevel());
                }
                if (d.getStatus() != null) {
                    matched.setStatus(d.getStatus());
                }
                if (d.getReviewerNote() != null) {
                    matched.setReviewerNote(normalizeText(d.getReviewerNote()));
                }
            } else if (d.getSkillId() != null && d.getTargetLevel() != null) {
                if (items.size() >= 3) {
                    throw AppException.badRequest("Mỗi phiếu đánh giá tối đa 3 kỹ năng đề xuất nâng bậc!");
                }
                TechSkill skill = skillRepository.findById(d.getSkillId())
                        .orElseThrow(() -> AppException.notFound("Không tìm thấy kỹ năng với ID: " + d.getSkillId()));
                UserTechSkill existing = currentSkillsBySkillId.get(skill.getId());
                ProficiencyLevel fromLevel = existing != null ? existing.getProficiencyLevel() : null;
                if (fromLevel != null && d.getTargetLevel().ordinal() <= fromLevel.ordinal()) {
                    throw AppException.badRequest("Cấp bậc mục tiêu của kỹ năng '" + skill.getSkillName()
                            + "' phải cao hơn cấp bậc hiện tại (" + fromLevel + ")!");
                }
                String evidence = normalizeText(d.getEvidenceNote());
                if (evidence == null) {
                    evidence = "Đề xuất nâng bậc bởi quản lý trực tiếp trong kỳ đánh giá " + review.getPeriodLabel();
                }
                items.add(TechSkillPromotionItem.builder()
                        .review(review)
                        .userTechSkillId(existing != null ? existing.getId() : null)
                        .skill(skill)
                        .fromLevel(fromLevel)
                        .targetLevel(d.getTargetLevel())
                        .evidenceNote(evidence)
                        .evidenceUrl(normalizeText(d.getEvidenceUrl()))
                        .status(d.getStatus() != null ? d.getStatus() : TechPromotionItemStatus.APPROVED)
                        .reviewerNote(normalizeText(d.getReviewerNote()))
                        .build());
            }
        }
    }

    private void replaceSkillPromotionItems(TechPerformanceReview review, List<TechSkillPromotionItem> newItems) {
        if (review.getSkillPromotionItems() == null) {
            review.setSkillPromotionItems(new ArrayList<>());
        }
        review.getSkillPromotionItems().clear();
        reviewRepository.saveAndFlush(review);
        review.getSkillPromotionItems().addAll(newItems);
    }

    private TechPerformanceReviewResponse mapToReviewResponse(
            TechPerformanceReview r,
            Map<Long, User> userMap,
            User viewer,
            boolean includeBreakdown,
            boolean includeCompensationMoney) {

        User emp = userMap.get(r.getEmployeeId());
        User evaluator = r.getEvaluatorId() != null ? userMap.get(r.getEvaluatorId()) : null;
        User approver = r.getFinalApproverId() != null ? userMap.get(r.getFinalApproverId()) : null;

        List<TechSkillPromotionItemDto> promoDtos = (r.getSkillPromotionItems() != null
                ? r.getSkillPromotionItems()
                : Collections.<TechSkillPromotionItem>emptyList())
                .stream()
                .map(item -> TechSkillPromotionItemDto.builder()
                        .id(item.getId())
                        .userTechSkillId(item.getUserTechSkillId())
                        .skillId(item.getSkill().getId())
                        .skillName(item.getSkill().getSkillName())
                        .category(item.getSkill().getCategory())
                        .fromLevel(item.getFromLevel())
                        .targetLevel(item.getTargetLevel())
                        .evidenceNote(item.getEvidenceNote())
                        .evidenceUrl(item.getEvidenceUrl())
                        .status(item.getStatus())
                        .reviewerNote(item.getReviewerNote())
                        .appliedAt(item.getAppliedAt())
                        .build())
                .collect(Collectors.toList());

        List<String> escalationReasons = buildEscalationReasons(r, emp, promoDtos);

        boolean allowMoney = includeCompensationMoney && canViewCompensationMoney(viewer, r);

        return TechPerformanceReviewResponse.builder()
                .id(r.getId())
                .cycleId(r.getCycle() != null ? r.getCycle().getId() : null)
                .cycleCode(r.getCycle() != null ? r.getCycle().getCycleCode() : r.getPeriodLabel())
                .cycleTitle(r.getCycle() != null ? r.getCycle().getTitle() : ("Kỳ đánh giá " + r.getPeriodLabel()))
                .departmentId(r.getDepartmentId())
                .reviewType(r.getReviewType())
                .periodLabel(r.getPeriodLabel())
                .periodStart(r.getPeriodStart())
                .periodEnd(r.getPeriodEnd())
                .selfReviewDeadline(r.getCycle() != null ? r.getCycle().getSelfReviewDeadline() : null)
                .employeeId(r.getEmployeeId())
                .hoTen(emp != null ? emp.getHoTen() : "Kỹ sư #" + r.getEmployeeId())
                .maNhanVien(emp != null ? emp.getMaNhanVien() : null)
                .email(emp != null ? emp.getEmail() : null)
                .chucVu(emp != null ? emp.getChucVu() : null)
                .employeeRole(emp != null ? emp.getRole() : null)
                .avatarUrl(emp != null ? emp.getAvatarUrl() : null)
                .deliveryScore(r.getDeliveryScore() != null ? r.getDeliveryScore().doubleValue() : 0.0)
                .impactScore(r.getImpactScore() != null ? r.getImpactScore().doubleValue() : 0.0)
                .capabilityScore(r.getCapabilityScore() != null ? r.getCapabilityScore().doubleValue() : 0.0)
                .disciplineScore(r.getDisciplineScore() != null ? r.getDisciplineScore().doubleValue() : 0.0)
                .telemetryTotalScore(r.getTelemetryTotalScore() != null ? r.getTelemetryTotalScore().doubleValue() : 0.0)
                .telemetryBreakdown(includeBreakdown ? resolveBreakdown(r) : null)
                .selfSummary(r.getSelfSummary())
                .selfAchievements(r.getSelfAchievements())
                .selfChallenges(r.getSelfChallenges())
                .selfGoalsNext(r.getSelfGoalsNext())
                .selfRatingScore(r.getSelfRatingScore() != null ? r.getSelfRatingScore().doubleValue() : null)
                .selfSubmittedAt(r.getSelfSubmittedAt())
                .evaluatorId(r.getEvaluatorId())
                .evaluatorName(evaluator != null ? evaluator.getHoTen() : null)
                .qualCraftScore(r.getQualCraftScore() != null ? r.getQualCraftScore().doubleValue() : null)
                .qualOwnershipScore(r.getQualOwnershipScore() != null ? r.getQualOwnershipScore().doubleValue() : null)
                .qualCollabScore(r.getQualCollabScore() != null ? r.getQualCollabScore().doubleValue() : null)
                .qualGrowthScore(r.getQualGrowthScore() != null ? r.getQualGrowthScore().doubleValue() : null)
                .managerQualScore(r.getManagerQualScore() != null ? r.getManagerQualScore().doubleValue() : null)
                .managerComment(r.getManagerComment())
                .managerFeedbackGoals(r.getManagerFeedbackGoals())
                .aiCopilotSummary(r.getAiCopilotSummary())
                .aiCopilotRoadmap(extractAiRoadmap(r.getAiCopilotSummary()))
                .calibrationDelta(r.getCalibrationDelta() != null ? r.getCalibrationDelta().doubleValue() : 0.0)
                .calibrationReason(r.getCalibrationReason())
                .finalScore(r.getFinalScore() != null ? r.getFinalScore().doubleValue() : null)
                .finalGrade(r.getFinalGrade())
                .recommendPromotion(Boolean.TRUE.equals(r.getRecommendPromotion()))
                .recommendedTitle(r.getRecommendedTitle())
                .recommendedSalaryIncreasePct(r.getRecommendedSalaryIncreasePct() != null
                        ? r.getRecommendedSalaryIncreasePct().doubleValue() : null)
                .compensationReason(r.getCompensationReason())
                .compensationStatus(r.getCompensationStatus())
                .currentBaseSalary(allowMoney && emp != null ? emp.getBaseSalary() : null)
                .currentAllowance(allowMoney && emp != null ? emp.getAllowance() : null)
                .recommendedNewBaseSalary(allowMoney ? r.getRecommendedNewBaseSalary() : null)
                .recommendedNewAllowance(allowMoney ? r.getRecommendedNewAllowance() : null)
                .status(r.getStatus())
                .escalationRequired(!escalationReasons.isEmpty())
                .escalationReasons(escalationReasons)
                .finalApproverId(r.getFinalApproverId())
                .finalApproverName(approver != null ? approver.getHoTen() : null)
                .finalApprovedAt(r.getFinalApprovedAt())
                .rejectionReason(r.getRejectionReason())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .skillPromotionItems(promoDtos)
                .build();
    }

    private List<String> buildEscalationReasons(
            TechPerformanceReview r,
            User emp,
            List<TechSkillPromotionItemDto> promoDtos) {
        List<String> reasons = new ArrayList<>();
        if (emp != null && (emp.getRole() == Role.TRUONG_PHONG || emp.getRole() == Role.GIAM_DOC_PHONG_BAN)) {
            reasons.add("Đánh giá cấp quản lý (" + emp.getRole().name() + ")");
        }
        boolean seniorPlus = promoDtos.stream().anyMatch(p ->
                p.getStatus() != TechPromotionItemStatus.REJECTED
                        && (p.getTargetLevel() == ProficiencyLevel.SENIOR || p.getTargetLevel() == ProficiencyLevel.EXPERT));
        if (seniorPlus) {
            reasons.add("Đề xuất nâng bậc kỹ năng cấp SENIOR / EXPERT");
        }
        boolean hasComp = Boolean.TRUE.equals(r.getRecommendPromotion())
                || (r.getRecommendedSalaryIncreasePct() != null && r.getRecommendedSalaryIncreasePct().doubleValue() > 0)
                || (r.getRecommendedTitle() != null && !r.getRecommendedTitle().isBlank());
        if (hasComp) {
            reasons.add("Đề xuất thăng chức danh / điều chỉnh đãi ngộ (Chờ CEO)");
        }
        return reasons;
    }

    private boolean canViewCompensationMoney(User viewer, TechPerformanceReview review) {
        if (viewer == null || review == null) {
            return false;
        }
        if (viewer.getRole() == Role.CEO) {
            return true;
        }
        return viewer.getRole() == Role.GIAM_DOC_PHONG_BAN
                && !Objects.equals(viewer.getId(), review.getEmployeeId());
    }

    private String extractAiRoadmap(String summary) {
        if (summary == null || summary.isBlank()) return null;
        int idx = summary.indexOf("3. Lộ trình 90 ngày");
        if (idx == -1) {
            idx = summary.indexOf("Lộ trình 90 ngày");
        }
        if (idx != -1) {
            int colonIdx = summary.indexOf(":", idx);
            if (colonIdx != -1 && colonIdx + 1 < summary.length()) {
                return summary.substring(colonIdx + 1).trim();
            }
        }
        return null;
    }

    private TechTelemetryBreakdownResponse resolveBreakdown(TechPerformanceReview r) {
        if (r.getTelemetrySnapshotJson() != null && !r.getTelemetrySnapshotJson().isBlank()) {
            try {
                return objectMapper.readValue(r.getTelemetrySnapshotJson(), TechTelemetryBreakdownResponse.class);
            } catch (Exception e) {
                log.warn("[Tech Review] Không parse được snapshot Telemetry review {}: {}", r.getId(), e.getMessage());
            }
        }
        return telemetryCalculator.calculateTelemetry(r.getEmployeeId(), r.getPeriodStart(), r.getPeriodEnd());
    }

    private String serializeBreakdown(TechTelemetryBreakdownResponse breakdown) {
        if (breakdown == null) return null;
        try {
            return objectMapper.writeValueAsString(breakdown);
        } catch (Exception e) {
            log.warn("[Tech Review] Không serialize được snapshot Telemetry: {}", e.getMessage());
            return null;
        }
    }

    private double computeFinalScore(double telemetryTotal, double managerQualTotal, double calibrationDelta) {
        double raw = (0.60 * telemetryTotal) + (0.40 * managerQualTotal) + calibrationDelta;
        double rounded = Math.round(raw * 10.0) / 10.0;
        return Math.max(0.0, Math.min(100.0, rounded));
    }

    private User loadActor(Long actorId) {
        return userRepository.findById(actorId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy tài khoản người dùng với ID: " + actorId));
    }

    private TechPerformanceReview loadReview(Long reviewId) {
        return reviewRepository.findById(reviewId)
                .orElseThrow(() -> AppException.notFound("Không tìm thấy phiếu đánh giá với ID: " + reviewId));
    }

    private void validateReadAccess(User actor, TechPerformanceReview review) {
        if (Objects.equals(actor.getId(), review.getEmployeeId())) {
            return;
        }
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) {
            return;
        }
        if ((actor.getRole() == Role.TRUONG_PHONG || actor.getRole() == Role.GIAM_DOC_PHONG_BAN)
                && Objects.equals(actor.getDepartmentId(), review.getDepartmentId())) {
            return;
        }
        throw AppException.forbidden("Bạn không có quyền xem phiếu đánh giá này!");
    }

    private void validateManagerDeptAccess(User actor, TechPerformanceReview review) {
        if (actor.getRole() == Role.ADMIN) {
            return;
        }
        if (actor.getDepartmentId() == null || !Objects.equals(actor.getDepartmentId(), review.getDepartmentId())) {
            throw AppException.forbidden("Bạn chỉ có quyền thao tác với phiếu đánh giá thuộc Phòng Công nghệ của mình!");
        }
    }

    private void validateManagerOrCeoDeptAccess(User actor, TechPerformanceReview review) {
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) {
            return;
        }
        validateManagerDeptAccess(actor, review);
    }

    private void validateCycleDepartmentAccess(User actor, Long cycleDeptId) {
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) {
            return;
        }
        if (!Objects.equals(actor.getDepartmentId(), cycleDeptId)) {
            throw AppException.forbidden("Bạn không có quyền thao tác trên kỳ đánh giá của phòng ban khác!");
        }
    }

    private void validateCycleBoundaries(TechReviewType reviewType, LocalDate start, LocalDate end, boolean checkSlidingWindow) {
        if (reviewType == null || start == null || end == null) return;
        LocalDate now = LocalDate.now();
        switch (reviewType) {
            case MONTHLY -> {
                if (start.getDayOfMonth() != 1) {
                    throw AppException.badRequest("Kỳ đánh giá theo tháng phải bắt đầu từ ngày 01 của tháng!");
                }
                LocalDate lastDayOfMonth = start.withDayOfMonth(start.lengthOfMonth());
                if (!end.equals(lastDayOfMonth)) {
                    throw AppException.badRequest("Kỳ đánh giá theo tháng phải kết thúc vào ngày cuối cùng của tháng (" + lastDayOfMonth + ")!");
                }
                if (checkSlidingWindow) {
                    long monthsDiff = (start.getYear() - now.getYear()) * 12L + (start.getMonthValue() - now.getMonthValue());
                    if (monthsDiff < -1 || monthsDiff > 1) {
                        throw AppException.badRequest("Kỳ đánh giá theo tháng chỉ được mở trong phạm vi: Tháng trước, Tháng hiện tại hoặc Tháng kế tiếp!");
                    }
                }
            }
            case QUARTERLY -> {
                int startMonth = start.getMonthValue();
                int startDay = start.getDayOfMonth();
                int endMonth = end.getMonthValue();
                int endDay = end.getDayOfMonth();
                boolean validQ1 = (startMonth == 1 && startDay == 1 && endMonth == 3 && endDay == 31);
                boolean validQ2 = (startMonth == 4 && startDay == 1 && endMonth == 6 && endDay == 30);
                boolean validQ3 = (startMonth == 7 && startDay == 1 && endMonth == 9 && endDay == 30);
                boolean validQ4 = (startMonth == 10 && startDay == 1 && endMonth == 12 && endDay == 31);
                if (start.getYear() != end.getYear() || (!validQ1 && !validQ2 && !validQ3 && !validQ4)) {
                    throw AppException.badRequest("Kỳ đánh giá theo quý phải đúng theo quý chuẩn (Q1: 01/01-31/03, Q2: 01/04-30/06, Q3: 01/07-30/09, Q4: 01/10-31/12)!");
                }
                if (checkSlidingWindow) {
                    int startQuarter = (startMonth - 1) / 3 + 1;
                    int nowQuarter = (now.getMonthValue() - 1) / 3 + 1;
                    int quartersDiff = (start.getYear() - now.getYear()) * 4 + (startQuarter - nowQuarter);
                    if (quartersDiff < -1 || quartersDiff > 1) {
                        throw AppException.badRequest("Kỳ đánh giá theo quý chỉ được mở trong phạm vi: Quý trước, Quý hiện tại hoặc Quý kế tiếp!");
                    }
                }
            }
            case ANNUAL -> {
                if (start.getMonthValue() != 1 || start.getDayOfMonth() != 1
                        || end.getMonthValue() != 12 || end.getDayOfMonth() != 31
                        || start.getYear() != end.getYear()) {
                    throw AppException.badRequest("Kỳ đánh giá theo năm phải từ ngày 01/01 đến 31/12 của cùng một năm!");
                }
                if (checkSlidingWindow) {
                    int yearsDiff = start.getYear() - now.getYear();
                    if (yearsDiff < -1 || yearsDiff > 0) {
                        throw AppException.badRequest("Kỳ đánh giá theo năm chỉ được mở cho năm trước (tổng kết) hoặc năm hiện tại!");
                    }
                }
            }
            case PROBATION -> {
                // Cho phép linh hoạt theo quyết định / hợp đồng thử việc, đã kiểm tra end >= start
            }
        }
    }

    private Long resolveScopedDepartmentId(User actor, Long requestedDeptId) {
        if (actor.getRole() == Role.CEO || actor.getRole() == Role.ADMIN) {
            return requestedDeptId != null ? requestedDeptId : findTechDepartmentId();
        }
        return actor.getDepartmentId();
    }

    private Long resolveDepartmentForCycleCreation(User actor, Long requestedDeptId) {
        if (actor.getRole() != Role.ADMIN) {
            if (requestedDeptId != null && !Objects.equals(requestedDeptId, actor.getDepartmentId())) {
                throw AppException.forbidden("Bạn không có quyền tạo kỳ đánh giá cho phòng ban khác!");
            }
            if (actor.getDepartmentId() == null) {
                throw AppException.badRequest("Tài khoản chưa được gắn Phòng ban!");
            }
            return actor.getDepartmentId();
        }
        return requestedDeptId != null ? requestedDeptId : findTechDepartmentId();
    }

    private Long findTechDepartmentId() {
        return departmentRepository.findByTenPhong("Công nghệ")
                .or(() -> departmentRepository.findByTenPhong("Kỹ thuật"))
                .map(Department::getId)
                .orElse(null);
    }

    private List<User> resolveTargetEmployees(Long deptId, CreateTechEvaluationCycleRequest req) {
        if (req.getTargetEmployeeIds() != null && !req.getTargetEmployeeIds().isEmpty()) {
            List<User> selected = new ArrayList<>();
            for (Long uid : req.getTargetEmployeeIds()) {
                User u = userRepository.findById(uid)
                        .orElseThrow(() -> AppException.notFound("Không tìm thấy nhân sự ID: " + uid));
                if (!Boolean.TRUE.equals(u.getActive())) {
                    continue;
                }
                if (!Objects.equals(deptId, u.getDepartmentId())) {
                    throw AppException.forbidden("Nhân sự '" + u.getHoTen() + "' không thuộc Phòng Công nghệ!");
                }
                selected.add(u);
            }
            return selected;
        }

        boolean includeManagers = !Boolean.FALSE.equals(req.getIncludeManagers());
        return userRepository.findByDepartmentId(deptId).stream()
                .filter(u -> Boolean.TRUE.equals(u.getActive()))
                .filter(u -> u.getRole() == Role.NHAN_VIEN
                        || (includeManagers && u.getRole() == Role.TRUONG_PHONG))
                .sorted(Comparator.comparing(User::getId))
                .collect(Collectors.toList());
    }

    private Map<Long, User> loadReviewUsers(List<TechPerformanceReview> reviews) {
        Set<Long> ids = new LinkedHashSet<>();
        for (TechPerformanceReview r : reviews) {
            if (r.getEmployeeId() != null) ids.add(r.getEmployeeId());
            if (r.getEvaluatorId() != null) ids.add(r.getEvaluatorId());
            if (r.getFinalApproverId() != null) ids.add(r.getFinalApproverId());
        }
        return loadUserMap(ids);
    }

    private Map<Long, User> loadUserMap(Set<Long> ids) {
        Map<Long, User> map = new HashMap<>();
        for (Long id : ids) {
            userRepository.findById(id).ifPresent(u -> map.put(id, u));
        }
        return map;
    }

    private void notifyManagersOnSelfSubmitted(TechPerformanceReview review, User owner) {
        if (notificationService == null) return;
        try {
            List<User> recipients = new ArrayList<>();
            recipients.addAll(userRepository.findByDepartmentIdAndRole(review.getDepartmentId(), Role.TRUONG_PHONG));
            recipients.addAll(userRepository.findByDepartmentIdAndRole(review.getDepartmentId(), Role.GIAM_DOC_PHONG_BAN));
            Map<Long, User> unique = new LinkedHashMap<>();
            for (User u : recipients) {
                if (u != null && u.getId() != null && !Objects.equals(u.getId(), owner.getId()) && Boolean.TRUE.equals(u.getActive())) {
                    unique.putIfAbsent(u.getId(), u);
                }
            }
            int skillCount = review.getSkillPromotionItems() != null ? review.getSkillPromotionItems().size() : 0;
            String content = owner.getHoTen() + " đã nộp bản Tự đánh giá kỳ [" + review.getPeriodLabel() + "]"
                    + (skillCount > 0 ? " kèm " + skillCount + " đề xuất nâng bậc kỹ năng" : "")
                    + ". Vui lòng thẩm định.";
            for (User mgr : unique.values()) {
                notifySafe(
                        mgr.getId(),
                        "TECH_REVIEW_SELF_SUBMITTED",
                        "Kỹ sư đã nộp Tự đánh giá chờ chấm điểm",
                        content,
                        "binh_thuong",
                        buildManagerReviewLink(mgr, review.getId())
                );
            }
        } catch (Exception e) {
            log.warn("[Tech Review] Lỗi thông báo self-review tới quản lý: {}", e.getMessage());
        }
    }

    private void notifyApproversOnEscalation(
            TechPerformanceReview review,
            User evaluator,
            User employee,
            boolean hasCompProposal) {
        if (notificationService == null) return;
        try {
            List<User> recipients = new ArrayList<>();
            if (!hasCompProposal && employee.getRole() != Role.GIAM_DOC_PHONG_BAN) {
                recipients.addAll(userRepository.findByDepartmentIdAndRole(review.getDepartmentId(), Role.GIAM_DOC_PHONG_BAN));
            }
            if (hasCompProposal || recipients.isEmpty() || employee.getRole() == Role.GIAM_DOC_PHONG_BAN) {
                recipients.addAll(userRepository.findByRoleAndActiveTrueOrderByIdAsc(Role.CEO));
            }
            Map<Long, User> unique = new LinkedHashMap<>();
            for (User u : recipients) {
                if (u != null && u.getId() != null
                        && !Objects.equals(u.getId(), evaluator.getId())
                        && !Objects.equals(u.getId(), employee.getId())
                        && Boolean.TRUE.equals(u.getActive())) {
                    unique.putIfAbsent(u.getId(), u);
                }
            }

            String actionType = hasCompProposal ? "đề xuất thăng chức/đãi ngộ" : "đề xuất nâng bậc kỹ thuật";
            for (User approver : unique.values()) {
                notifySafe(
                        approver.getId(),
                        "TECH_REVIEW_ESCALATED",
                        "Phiếu đánh giá kỹ sư chờ Phê duyệt cấp cao",
                        evaluator.getHoTen() + " đã trình phiếu đánh giá kỳ [" + review.getPeriodLabel()
                                + "] của " + employee.getHoTen() + " (Xếp hạng dự kiến " + review.getFinalGrade()
                                + ", " + formatScore(review.getFinalScore() != null ? review.getFinalScore().doubleValue() : 0.0)
                                + "đ) kèm " + actionType + ".",
                        "quan_trong",
                        buildManagerReviewLink(approver, review.getId())
                );
            }
        } catch (Exception e) {
            log.warn("[Tech Review] Lỗi thông báo escalation tới cấp trên: {}", e.getMessage());
        }
    }

    private void notifyEngineerOnReviewResult(TechPerformanceReview review, User approver, boolean approved, String reason) {
        if (approved) {
            String scoreText = review.getFinalScore() != null
                    ? review.getFinalScore().stripTrailingZeros().toPlainString() : "0";
            String gradeText = review.getFinalGrade() != null ? review.getFinalGrade().name() : "B";
            notifySafe(
                    review.getEmployeeId(),
                    "TECH_REVIEW_APPROVED",
                    "Kết quả Đánh giá Hiệu suất kỳ " + review.getPeriodLabel(),
                    approver.getHoTen() + " đã hoàn tất phê duyệt phiếu đánh giá kỳ [" + review.getPeriodLabel()
                            + "] với Điểm Tổng hợp " + scoreText + "/100 (Xếp hạng " + gradeText + ").",
                    "quan_trong",
                    buildEmployeeReviewLink(review.getId())
            );
        } else {
            notifySafe(
                    review.getEmployeeId(),
                    "TECH_REVIEW_REJECTED",
                    "Phiếu đánh giá cần chỉnh sửa thêm",
                    approver.getHoTen() + " yêu cầu điều chỉnh phiếu đánh giá kỳ [" + review.getPeriodLabel()
                            + "]. Lý do: " + reason,
                    "binh_thuong",
                    buildEmployeeReviewLink(review.getId())
            );
        }
    }

    private void notifyOnRejectedForRevision(TechPerformanceReview review, User approver) {
        String reason = review.getRejectionReason();
        if (review.getEvaluatorId() != null && !Objects.equals(review.getEvaluatorId(), approver.getId())) {
            notifySafe(
                    review.getEvaluatorId(),
                    "TECH_REVIEW_REJECTED",
                    "Phiếu đánh giá bị trả lại chỉnh sửa",
                    approver.getHoTen() + " đã trả lại phiếu đánh giá kỳ [" + review.getPeriodLabel()
                            + "] để hiệu chỉnh. Lý do: " + reason,
                    "binh_thuong",
                    buildManagerReviewLink(null, review.getId())
            );
        }
        notifyEngineerOnReviewResult(review, approver, false, reason);
    }

    private void notifySafe(Long userId, String type, String title, String content, String priority, String link) {
        if (notificationService == null || userId == null) return;
        try {
            notificationService.createNotification(userId, type, title, content, priority, link);
        } catch (Exception e) {
            log.warn("[Tech Review] Không thể gửi notification tới user {}: {}", userId, e.getMessage());
        }
    }

    private void broadcastReviewSync(String action, Long cycleId, Long reviewId, Long employeeId) {
        if (notificationService == null) return;
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("domain", "TECH_REVIEW");
            payload.put("action", action);
            payload.put("cycleId", cycleId != null ? cycleId : 0L);
            payload.put("reviewId", reviewId != null ? reviewId : 0L);
            payload.put("employeeId", employeeId != null ? employeeId : 0L);
            notificationService.broadcastTopic("/topic/tech-updates", payload);
        } catch (Exception e) {
            log.warn("[Tech Review] Không thể broadcast sync review: {}", e.getMessage());
        }
    }

    private String buildEmployeeReviewLink(Long reviewId) {
        return "/employee/my-projects?tab=reviews" + (reviewId != null ? "&reviewId=" + reviewId : "");
    }

    private String buildManagerReviewLink(User mgr, Long reviewId) {
        String base = "/manager/tech-projects";
        if (mgr != null) {
            if (mgr.getRole() == Role.CEO) base = "/ceo/tech-projects";
            else if (mgr.getRole() == Role.GIAM_DOC_PHONG_BAN) base = "/director/tech-projects";
        }
        return base + "?tab=reviews" + (reviewId != null ? "&reviewId=" + reviewId : "");
    }

    private BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal bd1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP);
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private double averageBigDecimal(List<BigDecimal> values) {
        if (values == null || values.isEmpty()) return 0.0;
        double avg = values.stream().filter(Objects::nonNull).mapToDouble(BigDecimal::doubleValue).average().orElse(0.0);
        return Math.round(avg * 10.0) / 10.0;
    }

    private String formatScore(double val) {
        return BigDecimal.valueOf(Math.round(val * 10.0) / 10.0).stripTrailingZeros().toPlainString();
    }

    private String normalizeText(String s) {
        if (s == null || s.trim().isEmpty()) return null;
        return s.trim();
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        String clean = s.trim();
        return clean.length() <= maxLen ? clean : clean.substring(0, maxLen);
    }
}
