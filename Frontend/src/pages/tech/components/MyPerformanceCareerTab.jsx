import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Clock,
  ArrowRight,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  REVIEW_STATUS_CONFIG,
  REVIEW_TYPE_CONFIG,
  RATING_GRADE_CONFIG,
  PROMOTION_ITEM_STATUS_CONFIG,
  CAREER_EVENT_CONFIG,
  formatDateVN,
  formatDateTimeVN,
  scrollElementIntoViewCleanly,
} from '../techHelpers';

export default function MyPerformanceCareerTab({
  overview = null,
  onOpenSelfReview,
  onSelectReviewDetail,
  onGoToProfileTab,
  focusReviewRequest = null,
  onFocusHandled,
}) {
  const reviewsSectionRef = useRef(null);
  const lastScrolledFocusRef = useRef(0);
  const [highlightState, setHighlightState] = useState(null);
  const highlightedReviewId = highlightState?.id || null;

  const reviews = overview?.reviews || [];
  const careerTimeline = overview?.careerTimeline || [];
  const livePreview = overview?.currentMonthTelemetryPreview || null;
  const pendingSelfCount = Number(overview?.pendingSelfReviewCount ?? 0);
  const approvedCount = Number(overview?.approvedReviewCount ?? 0);
  const expiringCertsCount = Number(overview?.expiringCertificatesCount ?? 0);

  const firstPendingReview = reviews.find(
    (r) => r.status === 'SELF_REVIEW_PENDING' || r.status === 'REJECTED_FOR_REVISION'
  );

  // Scroll & Highlight review card when clicking Notification "Xem chi tiết"
  useEffect(() => {
    const reqAt = focusReviewRequest?.requestedAt;
    if (!reqAt || lastScrolledFocusRef.current === reqAt) return;

    const targetId = focusReviewRequest?.reviewId ? String(focusReviewRequest.reviewId) : null;
    if (targetId && reviews.length === 0) {
      const waitTimer = setTimeout(() => {
        if (lastScrolledFocusRef.current !== reqAt && reviewsSectionRef.current) {
          lastScrolledFocusRef.current = reqAt;
          scrollElementIntoViewCleanly(reviewsSectionRef.current, 'start');
          if (onFocusHandled) onFocusHandled(reqAt);
        }
      }, 2200);
      return () => clearTimeout(waitTimer);
    }

    let initialTimer = null;
    let retryTimer = null;
    let realignTimer = null;

    const attemptScroll = (retryCount = 0) => {
      const cardEl = targetId ? document.getElementById(`my-review-card-${targetId}`) : null;
      const anchorEl = cardEl || reviewsSectionRef.current;
      if (!anchorEl || (targetId && !cardEl && retryCount < 8)) {
        if (retryCount < 8) {
          retryTimer = setTimeout(() => attemptScroll(retryCount + 1), 100);
        }
        return;
      }

      lastScrolledFocusRef.current = reqAt;
      if (cardEl && targetId) {
        setHighlightState({ id: targetId, at: reqAt });
      }
      scrollElementIntoViewCleanly(anchorEl, cardEl ? 'center' : 'start');
      if (onFocusHandled) onFocusHandled(reqAt);

      realignTimer = setTimeout(() => {
        const freshCard = targetId ? document.getElementById(`my-review-card-${targetId}`) : null;
        const freshAnchor = freshCard || reviewsSectionRef.current;
        if (freshAnchor) {
          scrollElementIntoViewCleanly(freshAnchor, freshCard ? 'center' : 'start');
        }
      }, 320);
    };

    initialTimer = setTimeout(() => attemptScroll(0), 200);

    return () => {
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (realignTimer) clearTimeout(realignTimer);
    };
  }, [focusReviewRequest, reviews.length, onFocusHandled]);

  useEffect(() => {
    if (!highlightState?.id) return;
    const clearTimer = setTimeout(() => {
      setHighlightState((prev) => (prev && prev.at === highlightState.at ? null : prev));
    }, 5000);
    return () => clearTimeout(clearTimer);
  }, [highlightState]);

  const latestGradeCfg = overview?.latestFinalGrade
    ? RATING_GRADE_CONFIG[overview.latestFinalGrade]
    : null;

  return (
    <div className="space-y-5">
      {/* 1. Actionable Alert Banners */}
      {pendingSelfCount > 0 && firstPendingReview && (
        <div className="bg-blue-50/85 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0">
              <Send size={16} />
            </div>
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-[#0F2557]">
                Bạn có {pendingSelfCount} phiếu Đánh giá Hiệu suất cần hoàn thành Tự đánh giá
              </p>
              <p className="text-slate-600">
                Kỳ <strong>[{firstPendingReview.cycleCode}]</strong> • Hạn tự đánh giá:{' '}
                <strong className="text-orange-700 tabular">
                  {formatDateVN(firstPendingReview.selfReviewDeadline || firstPendingReview.periodEnd)}
                </strong>
                . Bạn có thể đề xuất tối đa 3 kỹ năng nâng bậc ngay trong bản tự đánh giá.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenSelfReview && onOpenSelfReview(firstPendingReview)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Send size={13} />
            <span>Tự đánh giá ngay</span>
          </button>
        </div>
      )}

      {expiringCertsCount > 0 && (
        <div className="bg-orange-50/85 border border-orange-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle size={17} className="text-orange-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold text-orange-900">
                Có {expiringCertsCount} chứng chỉ quốc tế sắp hết hạn hoặc đã quá hạn
              </p>
              <p className="text-orange-800/90 mt-0.5">
                Cập nhật chứng chỉ mới để giữ trọn điểm Trụ cột Capability trong kỳ đánh giá hiệu suất.
              </p>
            </div>
          </div>
          {onGoToProfileTab && (
            <button
              type="button"
              onClick={onGoToProfileTab}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-orange-100 text-orange-800 border border-orange-300 font-bold transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              Mở Hồ sơ Chứng chỉ →
            </button>
          )}
        </div>
      )}

      {/* 2. 4 Personal Performance KPI Wells */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Xếp hạng Gần nhất</span>
            <Award size={15} className="text-[#1E3A8A]" />
          </div>
          <div className="flex items-center justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-slate-900">
              {overview?.latestFinalScore != null ? `${Number(overview.latestFinalScore).toFixed(1)}đ` : '—'}
            </p>
            {latestGradeCfg && (
              <span className={`text-xs px-2.5 py-0.5 rounded-md border ${latestGradeCfg.badgeClass}`}>
                Hạng {latestGradeCfg.grade}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {latestGradeCfg ? latestGradeCfg.label : 'Chưa có kỳ đánh giá hoàn tất'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Telemetry Tạm tính Tháng này</span>
            <Activity size={15} className="text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-[#1E3A8A]">
              {Number(livePreview?.telemetryTotalScore ?? 0).toFixed(1)}
              <span className="text-xs font-semibold text-slate-400"> / 100</span>
            </p>
            <span className="text-[11px] font-bold text-slate-600">Trọng số 60%</span>
          </div>
          <p className="text-[11px] text-slate-400">Tự động cập nhật từ dữ liệu làm việc</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Phiếu Chờ Tự đánh giá</span>
            <Clock size={15} className="text-orange-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-orange-600">{pendingSelfCount}</p>
            <span className="text-[11px] font-semibold text-slate-500">cần hoàn tất</span>
          </div>
          <p className="text-[11px] text-slate-400">Đề xuất nâng bậc kèm minh chứng PR/Jira</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Kỳ Đánh giá Hoàn tất</span>
            <CheckCircle2 size={15} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-emerald-700">{approvedCount}</p>
            <span className="text-[11px] font-bold text-[#1E3A8A]">{careerTimeline.length} cột mốc</span>
          </div>
          <p className="text-[11px] text-slate-400">Lịch sử thăng tiến minh bạch theo kỳ</p>
        </div>
      </div>

      {/* 3. Live Monthly Telemetry Preview Breakdown */}
      {livePreview && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles size={16} className="text-[#1E3A8A]" />
                <span>Telemetry Hiệu suất 4 Trụ cột Cá nhân (Từ đầu tháng đến hôm nay)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Minh bạch cách hệ thống tính điểm khách quan: Thực thi (35đ) + Tác động (25đ) + Năng lực (20đ) + Kỷ luật (20đ)
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0F2557] text-white text-xs font-extrabold tabular shrink-0">
              <span>Tổng tạm tính:</span>
              <span>{Number(livePreview.telemetryTotalScore || 0).toFixed(1)} / 100đ</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Delivery */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">1. Thực thi (Delivery)</span>
                <span className="text-[#1E3A8A] tabular">
                  {Number(livePreview.deliveryScore || 0).toFixed(1)} / 35
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0F2557]"
                  style={{ width: `${Math.min(100, Math.round(((livePreview.deliveryScore || 0) / 35) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed tabular">
                {livePreview.coverageLabel} • Sạch Audit: {livePreview.cleanAuditWorklogs}/{livePreview.totalApprovedWorklogs} log • Mốc đúng hạn: {livePreview.onTimeMilestonesCount}/{livePreview.dueMilestonesCount}
              </p>
            </div>

            {/* Impact */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">2. Tác động (Impact)</span>
                <span className="text-[#1E3A8A] tabular">
                  {Number(livePreview.impactScore || 0).toFixed(1)} / 25
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1E3A8A]"
                  style={{ width: `${Math.min(100, Math.round(((livePreview.impactScore || 0) / 25) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed tabular">
                Core Engineering: {Number(livePreview.coreWorkRatioPercent || 0).toFixed(0)}% ({livePreview.coreHours}h)
                {livePreview.leadBonusApplied ? ' • +3đ Tech Lead' : ''} • {livePreview.impactMethodLabel}
              </p>
            </div>

            {/* Capability */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">3. Năng lực (Capability)</span>
                <span className="text-[#1E3A8A] tabular">
                  {Number(livePreview.capabilityScore || 0).toFixed(1)} / 20
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, Math.round(((livePreview.capabilityScore || 0) / 20) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed tabular">
                Kỹ năng xác thực: {livePreview.verifiedSkillsCount}/{livePreview.totalSkillsCount} • {livePreview.certStatusLabel}
              </p>
            </div>

            {/* Discipline */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-800">4. Kỷ luật (Discipline)</span>
                <span className="text-[#1E3A8A] tabular">
                  {Number(livePreview.disciplineScore || 0).toFixed(1)} / 20
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${Math.min(100, Math.round(((livePreview.disciplineScore || 0) / 20) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed tabular">
                Đi muộn: {livePreview.lateCount} buổi (miễn trừ {livePreview.freeLateQuota}) • Nghỉ KP: {livePreview.unexcusedAbsentCount} • Đơn WFH/Phép: {livePreview.excusedLeaveOrWfhDays} ngày
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Two-Column Layout: My Reviews + Vertical Career Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 cols): Personal Evaluation Reviews */}
        <div ref={reviewsSectionRef} className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award size={16} className="text-[#1E3A8A]" />
              <span>Phiếu Đánh giá Định kỳ của tôi ({reviews.length})</span>
            </h3>
          </div>

          {reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
              <Award size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Chưa có kỳ đánh giá nào được mở cho bạn</p>
              <p className="text-xs text-slate-400">
                Khi Trưởng phòng hoặc Giám đốc Công nghệ mở kỳ đánh giá mới, phiếu sẽ xuất hiện tại đây kèm thông báo.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {reviews.map((r) => {
                const statusCfg =
                  REVIEW_STATUS_CONFIG[r.status] || REVIEW_STATUS_CONFIG.SELF_REVIEW_PENDING;
                const typeCfg = REVIEW_TYPE_CONFIG[r.reviewType] || REVIEW_TYPE_CONFIG.QUARTERLY;
                const gradeCfg = r.finalGrade ? RATING_GRADE_CONFIG[r.finalGrade] : null;
                const canSelfReview =
                  r.status !== 'APPROVED' && r.status !== 'DIRECTOR_APPROVAL_PENDING';
                const isHighlighted = highlightedReviewId === String(r.id);

                return (
                  <div
                    key={r.id}
                    id={`my-review-card-${r.id}`}
                    className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-3.5 transition duration-300 ${
                      isHighlighted
                        ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/40 shadow-md'
                        : 'border-slate-200/90 hover:border-blue-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#0F2557] text-white">
                            {r.cycleCode}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.badgeClass}`}>
                            {typeCfg.shortLabel}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{r.cycleTitle}</h4>
                        <p className="text-[11px] text-slate-500 tabular">
                          Thời gian: {formatDateVN(r.periodStart)} → {formatDateVN(r.periodEnd)}
                          {r.selfReviewDeadline && ` • Hạn tự chấm: ${formatDateVN(r.selfReviewDeadline)}`}
                        </p>
                      </div>

                      {r.finalScore != null && (
                        <div className="text-right shrink-0 tabular">
                          <span className="text-[10px] text-slate-400 block">Kết quả Tổng hợp</span>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="text-xl font-extrabold text-[#0F2557]">
                              {Number(r.finalScore).toFixed(1)}
                            </span>
                            {gradeCfg && (
                              <span className={`px-2 py-0.5 rounded text-xs border ${gradeCfg.badgeClass}`}>
                                {gradeCfg.grade}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {r.status === 'REJECTED_FOR_REVISION' && r.rejectionReason && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <RotateCcw size={13} className="text-rose-600" />
                          <span>Phiếu được trả lại để bạn hiệu chỉnh:</span>
                        </p>
                        <p className="text-[11px] leading-relaxed">{r.rejectionReason}</p>
                      </div>
                    )}

                    {/* Compact Score Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] tabular">
                      <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/70">
                        <span className="text-slate-500 block">Telemetry (60%)</span>
                        <strong className="text-[#1E3A8A]">{Number(r.telemetryTotalScore || 0).toFixed(1)}đ</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-500 block">Delivery</span>
                        <strong className="text-slate-900">{Number(r.deliveryScore || 0).toFixed(1)}/35</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-500 block">Impact</span>
                        <strong className="text-slate-900">{Number(r.impactScore || 0).toFixed(1)}/25</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-500 block">Capability</span>
                        <strong className="text-slate-900">{Number(r.capabilityScore || 0).toFixed(1)}/20</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-500 block">Định tính (40%)</span>
                        <strong className="text-slate-900">
                          {r.managerQualScore != null ? `${Number(r.managerQualScore).toFixed(1)}đ` : 'Chờ chấm'}
                        </strong>
                      </div>
                    </div>

                    {/* Skill Promotions */}
                    {(r.skillPromotionItems || []).length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Đề xuất Nâng bậc Kỹ năng trong kỳ:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {r.skillPromotionItems.map((item) => {
                            const itemCfg =
                              PROMOTION_ITEM_STATUS_CONFIG[item.status] || PROMOTION_ITEM_STATUS_CONFIG.PENDING;
                            return (
                              <span
                                key={item.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${itemCfg.badgeClass}`}
                              >
                                <span>{item.skillName}:</span>
                                <span className="font-mono font-bold">
                                  {item.fromLevel || 'Mới'} → {item.targetLevel}
                                </span>
                                <span>({itemCfg.label})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Manager Comment Preview */}
                    {r.managerComment && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
                        <span className="text-[11px] font-bold text-slate-800 block">
                          Nhận xét của Quản lý {r.evaluatorName ? `(${r.evaluatorName})` : ''}:
                        </span>
                        <p className="text-[11px] whitespace-pre-line line-clamp-3 leading-relaxed">
                          {r.managerComment}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onSelectReviewDetail && onSelectReviewDetail(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Xem Chi tiết</span>
                      </button>

                      {canSelfReview && onOpenSelfReview && (
                        <button
                          type="button"
                          onClick={() => onOpenSelfReview(r)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                        >
                          <Send size={13} />
                          <span>
                            {r.status === 'REJECTED_FOR_REVISION'
                              ? 'Hiệu chỉnh & Gửi lại'
                              : r.selfSubmittedAt
                              ? 'Cập nhật Tự đánh giá'
                              : 'Tự đánh giá & Nâng bậc'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right (5 cols): Career Progression Timeline */}
        <div className="lg:col-span-5 space-y-3.5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#1E3A8A]" />
            <span>Lộ trình Thăng tiến &amp; Cột mốc Chuyên môn ({careerTimeline.length})</span>
          </h3>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
            {careerTimeline.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <TrendingUp size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-700">Chưa có cột mốc thăng tiến nào được ghi nhận</p>
                <p className="text-[11px] text-slate-400">
                  Mỗi kỳ đánh giá hoàn tất, lần nâng bậc kỹ năng hoặc thăng chức danh sẽ được lưu vĩnh viễn tại dòng thời gian này.
                </p>
              </div>
            ) : (
              <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {careerTimeline.map((ev) => {
                  const evCfg =
                    CAREER_EVENT_CONFIG[ev.eventType] || CAREER_EVENT_CONFIG.REVIEW_COMPLETED;
                  return (
                    <div key={ev.id} className="relative space-y-1">
                      <span
                        className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white flex items-center justify-center ${evCfg.dotClass}`}
                      />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${evCfg.badgeClass}`}>
                          {evCfg.label}
                        </span>
                        <span className="text-[10px] text-slate-400 tabular">
                          {formatDateTimeVN(ev.eventDate)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900">{ev.title}</p>
                      {(ev.oldValue || ev.newValue) && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700">
                          {ev.oldValue && <span className="text-slate-500">{ev.oldValue}</span>}
                          {ev.oldValue && ev.newValue && <ArrowRight size={11} className="text-blue-600" />}
                          {ev.newValue && <span className="text-[#1E3A8A] font-bold">{ev.newValue}</span>}
                        </div>
                      )}
                      {ev.note && (
                        <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">
                          {ev.note}
                        </p>
                      )}
                      {ev.actorName && (
                        <p className="text-[10px] text-slate-400">
                          Xác nhận bởi: <strong className="text-slate-600">{ev.actorName}</strong>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
