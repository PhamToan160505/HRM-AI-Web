import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Award,
  Search,
  X,
  TrendingUp,
  Users,
  CheckCircle2,
  Eye,
  ShieldCheck,
  BarChart3,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Clock,
  FolderKanban,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import TechCycleManagementModal from '../components/TechCycleManagementModal';
import {
  REVIEW_STATUS_CONFIG,
  REVIEW_TYPE_CONFIG,
  RATING_GRADE_CONFIG,
  COMPENSATION_STATUS_CONFIG,
  getCertExpiryInfo,
} from './ceoTechHelpers';
import { scrollElementIntoViewCleanly } from '../techHelpers';

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx);
  }
  const items = [0];
  const left = Math.max(1, currentPage - 1);
  const right = Math.min(totalPages - 2, currentPage + 1);
  if (left > 1) items.push('ellipsis-left');
  for (let p = left; p <= right; p += 1) {
    items.push(p);
  }
  if (right < totalPages - 2) items.push('ellipsis-right');
  items.push(totalPages - 1);
  return items;
}

function CeoGradeTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white px-3 py-2 rounded-xl shadow-lg border border-blue-800 text-xs tabular">
      <p className="font-bold">{d.fullLabel}</p>
      <p className="text-blue-100 mt-0.5">
        Số lượng: <strong className="text-white">{d.count}</strong> phiếu
      </p>
    </div>
  );
}

function CeoPillarTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white px-3 py-2 rounded-xl shadow-lg border border-blue-800 text-xs tabular">
      <p className="font-bold">{d.fullName}</p>
      <p className="text-blue-100 mt-0.5">
        Điểm TB: <strong className="text-white">{d.avgScore}</strong> / {d.maxScore}đ ({d.percent}%)
      </p>
    </div>
  );
}

export default function CeoPerformanceTab({
  cycles = [],
  selectedCycleId = '',
  onChangeCycle,
  analytics = null,
  reviews = [],
  reviewPageData = null,
  reviewQuery = { page: 0, size: 10, status: '', grade: '', keyword: '' },
  reviewsLoading = false,
  onChangeReviewQuery,
  expiringCerts = [],
  currentUserId = null,
  onSelectReview,
  onInspectEngineer,
  focusReviewRequest = null,
  onFocusHandled,
}) {
  const [isCycleMgmtOpen, setIsCycleMgmtOpen] = useState(false);
  const reviewTableRef = useRef(null);
  const lastAppliedFocusRef = useRef(0);
  const lastScrolledFocusRef = useRef(0);
  const [highlightState, setHighlightState] = useState(null);
  const highlightedReviewId = highlightState?.id || null;

  const [keywordInput, setKeywordInput] = useState(reviewQuery?.keyword || '');
  useEffect(() => {
    setKeywordInput(reviewQuery?.keyword || '');
  }, [reviewQuery?.keyword]);

  const filterStatus = reviewQuery?.status || '';
  const filterGrade = reviewQuery?.grade || '';
  const filterKeyword = reviewQuery?.keyword || '';

  const updateFilter = useCallback(
    (patch) => {
      if (typeof onChangeReviewQuery !== 'function') return;
      onChangeReviewQuery((prev) => ({
        ...(prev || { page: 0, size: 10, status: '', grade: '', keyword: '' }),
        ...patch,
        page: 0,
      }));
    },
    [onChangeReviewQuery]
  );

  const clearAllFilters = useCallback(() => {
    setKeywordInput('');
    updateFilter({ status: '', grade: '', keyword: '' });
  }, [updateFilter]);

  useEffect(() => {
    if (keywordInput === filterKeyword) return undefined;
    const timer = setTimeout(() => {
      updateFilter({ keyword: keywordInput });
    }, 320);
    return () => clearTimeout(timer);
  }, [keywordInput, filterKeyword, updateFilter]);

  useEffect(() => {
    const reqAt = focusReviewRequest?.requestedAt;
    if (!reqAt || reqAt === lastAppliedFocusRef.current) return;
    lastAppliedFocusRef.current = reqAt;
    if (filterStatus || filterGrade || filterKeyword) {
      clearAllFilters();
    }
  }, [focusReviewRequest, filterStatus, filterGrade, filterKeyword, clearAllFilters]);

  const hasActiveFilters = Boolean(filterStatus || filterGrade || filterKeyword);

  const matchedReviewId = useMemo(() => {
    const targetId = focusReviewRequest?.reviewId ? String(focusReviewRequest.reviewId) : null;
    if (!targetId) return null;
    const hit = reviews.find((r) => String(r.id) === targetId);
    return hit ? String(hit.id) : null;
  }, [focusReviewRequest, reviews]);

  useEffect(() => {
    if (reviewsLoading || hasActiveFilters) return;
    const reqAt = focusReviewRequest?.requestedAt;
    if (!reqAt || lastScrolledFocusRef.current === reqAt) return;

    if (focusReviewRequest.reviewId && !matchedReviewId) {
      const waitTimer = setTimeout(() => {
        if (lastScrolledFocusRef.current !== reqAt && reviewTableRef.current) {
          lastScrolledFocusRef.current = reqAt;
          scrollElementIntoViewCleanly(reviewTableRef.current, 'start');
          if (onFocusHandled) onFocusHandled(reqAt);
        }
      }, 2200);
      return () => clearTimeout(waitTimer);
    }

    const targetId = matchedReviewId;
    let initialTimer = null;
    let retryTimer = null;
    let realignTimer = null;

    const attemptScroll = (retryCount = 0) => {
      const rowEl = targetId ? document.getElementById(`ceo-review-row-${targetId}`) : null;
      const anchorEl = rowEl || reviewTableRef.current;
      if (!anchorEl || (targetId && !rowEl && retryCount < 8)) {
        if (retryCount < 8) {
          retryTimer = setTimeout(() => attemptScroll(retryCount + 1), 100);
        }
        return;
      }

      lastScrolledFocusRef.current = reqAt;
      if (targetId) {
        setHighlightState({ id: targetId, at: reqAt });
      }
      scrollElementIntoViewCleanly(anchorEl, rowEl ? 'center' : 'start');
      if (onFocusHandled) onFocusHandled(reqAt);

      realignTimer = setTimeout(() => {
        const freshRow = targetId ? document.getElementById(`ceo-review-row-${targetId}`) : null;
        const freshAnchor = freshRow || reviewTableRef.current;
        if (freshAnchor) {
          scrollElementIntoViewCleanly(freshAnchor, freshRow ? 'center' : 'start');
        }
      }, 320);
    };

    initialTimer = setTimeout(() => attemptScroll(0), 200);

    return () => {
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (realignTimer) clearTimeout(realignTimer);
    };
  }, [focusReviewRequest, matchedReviewId, hasActiveFilters, reviewsLoading, onFocusHandled]);

  useEffect(() => {
    if (!highlightState?.id) return;
    const clearTimer = setTimeout(() => {
      setHighlightState((prev) => (prev && prev.at === highlightState.at ? null : prev));
    }, 5000);
    return () => clearTimeout(clearTimer);
  }, [highlightState]);

  const gradeChartData = useMemo(() => {
    const buckets = analytics?.gradeBuckets || [];
    if (buckets.length === 0) {
      return ['S', 'A', 'B', 'C', 'D'].map((g) => ({
        grade: g,
        fullLabel: RATING_GRADE_CONFIG[g]?.label || g,
        count: 0,
        color: RATING_GRADE_CONFIG[g]?.barColor || '#1E3A8A',
      }));
    }
    return buckets.map((b) => ({
      grade: b.grade,
      fullLabel: b.label || RATING_GRADE_CONFIG[b.grade]?.label || b.grade,
      count: Number(b.count ?? 0),
      color: RATING_GRADE_CONFIG[b.grade]?.barColor || '#1E3A8A',
    }));
  }, [analytics]);

  const pillarChartData = useMemo(() => {
    const items = [
      { key: 'delivery', label: 'Delivery', fullName: '1. Thực thi & Bàn giao (35đ)', avgScore: Number(analytics?.avgDeliveryScore ?? 0), maxScore: 35, color: '#0F2557' },
      { key: 'impact', label: 'Impact', fullName: '2. Giá trị & Tác động (25đ)', avgScore: Number(analytics?.avgImpactScore ?? 0), maxScore: 25, color: '#1E3A8A' },
      { key: 'capability', label: 'Capability', fullName: '3. Năng lực & Chứng chỉ (20đ)', avgScore: Number(analytics?.avgCapabilityScore ?? 0), maxScore: 20, color: '#2563EB' },
      { key: 'discipline', label: 'Discipline', fullName: '4. Kỷ luật & Chuyên cần (20đ)', avgScore: Number(analytics?.avgDisciplineScore ?? 0), maxScore: 20, color: '#059669' },
    ];
    return items.map((item) => ({
      ...item,
      avgScore: Math.round(item.avgScore * 10) / 10,
      percent: Math.min(100, Math.round((item.avgScore / item.maxScore) * 100)),
    }));
  }, [analytics]);

  const totalElements = Number(reviewPageData?.totalElements ?? reviews.length);
  const currentPage = reviewPageData?.number ?? reviewQuery?.page ?? 0;
  const pageSize = reviewPageData?.size ?? reviewQuery?.size ?? 10;
  const totalPages = reviewPageData?.totalPages ?? 0;

  const handlePageChange = (nextPage) => {
    if (reviewsLoading || typeof onChangeReviewQuery !== 'function') return;
    const clamped = Math.max(0, Math.min(Math.max(0, totalPages - 1), nextPage));
    if (clamped === currentPage) return;
    onChangeReviewQuery((prev) => ({ ...(prev || { size: pageSize }), page: clamped }));
    if (reviewTableRef.current) {
      scrollElementIntoViewCleanly(reviewTableRef.current, 'start');
    }
  };

  const handlePageSizeChange = (nextSize) => {
    if (reviewsLoading || typeof onChangeReviewQuery !== 'function') return;
    onChangeReviewQuery((prev) => ({ ...(prev || {}), page: 0, size: Number(nextSize) || 10 }));
  };

  const directorPendingCount = Number(analytics?.directorApprovalPendingCount ?? 0);

  return (
    <div className="space-y-5">
      {/* 1. Executive Header Control */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] border border-blue-200 flex items-center justify-center shrink-0">
            <ShieldCheck size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Thẩm định Điều hành, Nâng bậc &amp; Phê duyệt Đãi ngộ Phòng Công nghệ
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Bám sát kết quả đánh giá 60% Telemetry + 40% Định tính; CEO nắm quyền phê duyệt chốt cuối các đề xuất Thăng chức danh, Điều chỉnh Lương và phiếu Giám đốc
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {directorPendingCount > 0 && (
            <button
              type="button"
              onClick={() =>
                updateFilter({
                  status: filterStatus === 'DIRECTOR_APPROVAL_PENDING' ? '' : 'DIRECTOR_APPROVAL_PENDING',
                })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer tabular ${
                filterStatus === 'DIRECTOR_APPROVAL_PENDING'
                  ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                  : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              }`}
            >
              <Clock size={14} />
              <span>Chờ CEO phê duyệt ({directorPendingCount})</span>
            </button>
          )}

          {cycles.length > 0 && (
            <select
              value={selectedCycleId}
              onChange={(e) => onChangeCycle && onChangeCycle(e.target.value)}
              className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 cursor-pointer max-w-xs sm:max-w-sm"
            >
              {cycles.map((c) => {
                const tLabel = REVIEW_TYPE_CONFIG[c.reviewType]?.shortLabel || c.reviewType;
                return (
                  <option key={c.id} value={String(c.id)}>
                    [{c.cycleCode}] {c.title} ({tLabel} • {c.approvedCount}/{c.totalReviews} đã chốt)
                  </option>
                );
              })}
            </select>
          )}

          {/* Nút xem danh sách toàn bộ kỳ đánh giá đã mở dành cho CEO */}
          <button
            type="button"
            onClick={() => setIsCycleMgmtOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer"
            title="Xem danh sách chi tiết các kỳ đánh giá đã mở của Phòng Công nghệ"
          >
            <FolderKanban size={15} className="text-[#1E3A8A]" />
            <span>Danh sách Kỳ ({cycles.length})</span>
          </button>
        </div>
      </div>

      {/* Expiring Certs Read-Only Executive Alert */}
      {expiringCerts.length > 0 && (
        <div className="bg-orange-50/60 border border-orange-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Award size={17} className="text-orange-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <p className="font-bold text-orange-900">
                Tuân thủ Chứng chỉ Quốc tế: Có {expiringCerts.length} chứng chỉ sắp hết hạn hoặc đã quá hạn
              </p>
              <p className="text-[11px] text-orange-800/90">
                {expiringCerts
                  .slice(0, 3)
                  .map((c) => `${c.hoTen} (${c.certificateName} - ${getCertExpiryInfo(c).label})`)
                  .join(' • ')}
                {expiringCerts.length > 3 ? ` và ${expiringCerts.length - 3} chứng chỉ khác` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {cycles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-2.5">
          <Award size={40} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">Phòng Công nghệ chưa mở kỳ đánh giá nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Khi Giám đốc hoặc Trưởng phòng Công nghệ khởi tạo kỳ đánh giá hiệu suất, toàn bộ dữ liệu xếp hạng và hồ sơ trình phê duyệt sẽ tự động hiển thị tại đây.
          </p>
        </div>
      ) : (
        <>
          {/* 2. 4 Executive Bento KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Hồ sơ Đánh giá Toàn phòng</span>
                <Users size={15} className="text-[#1E3A8A]" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-slate-900">{analytics?.totalReviews ?? 0} phiếu</p>
                <span className="text-xs font-bold text-emerald-700">
                  {analytics?.completionRatePercent ?? 0}% hoàn tất
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tabular">
                Đã tự chấm: {analytics?.selfReviewSubmittedCount ?? 0} • Đã chốt: {analytics?.approvedCount ?? 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Điểm Trung bình Tổng hợp</span>
                <Sparkles size={15} className="text-[#1E3A8A]" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-[#1E3A8A]">
                  {Number(analytics?.avgFinalScore ?? 0).toFixed(1)}
                  <span className="text-xs font-semibold text-slate-400"> / 100</span>
                </p>
                <span className="text-xs font-bold text-slate-600">
                  Telemetry: {Number(analytics?.avgTelemetryScore ?? 0).toFixed(1)}đ
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tabular">
                Định tính QL: {Number(analytics?.avgManagerQualScore ?? 0).toFixed(1)}đ
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Hồ sơ Trình Cấp trên Duyệt</span>
                <ShieldCheck size={15} className="text-orange-600" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-orange-600">
                  {analytics?.directorApprovalPendingCount ?? 0}
                </p>
                <span className="text-xs font-bold text-[#1E3A8A]">
                  {analytics?.pendingCompensationProposalsCount ?? 0} đề xuất lương/chức
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Cần CEO kiểm tra &amp; ra quyết định cuối
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Nâng bậc &amp; Tuân thủ Chứng chỉ</span>
                <TrendingUp size={15} className="text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-emerald-700">
                  {analytics?.approvedSkillPromotionsCount ?? 0}
                  <span className="text-xs font-semibold text-slate-500"> đã nâng bậc</span>
                </p>
                <span className="text-xs font-bold text-orange-600">
                  {(analytics?.expiringCertificatesCount ?? 0) + (analytics?.expiredCertificatesCount ?? 0)} cert cảnh báo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tabular">
                Đang chờ duyệt nâng bậc skill: {analytics?.pendingSkillPromotionsCount ?? 0}
              </p>
            </div>
          </div>

          {/* 3. 2 Recharts Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={16} className="text-[#1E3A8A]" />
                    <span>Phân bố Xếp hạng S / A / B / C / D</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bấm trực tiếp vào cột xếp hạng để lọc danh sách bên dưới
                  </p>
                </div>
                {filterGrade && (
                  <button
                    type="button"
                    onClick={() => updateFilter({ grade: '' })}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Bỏ lọc hạng {filterGrade}
                  </button>
                )}
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeChartData} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="grade"
                      tick={{ fontSize: 12, fontWeight: 700, fill: '#334155' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CeoGradeTooltip />} cursor={{ fill: '#F1F5F9' }} />
                    <Bar
                      dataKey="count"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={48}
                      onClick={(entry) => {
                        if (!entry?.grade) return;
                        updateFilter({ grade: filterGrade === entry.grade ? '' : entry.grade });
                      }}
                      className="cursor-pointer"
                    >
                      {gradeChartData.map((entry) => (
                        <Cell
                          key={entry.grade}
                          fill={entry.color}
                          opacity={!filterGrade || filterGrade === entry.grade ? 1 : 0.35}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3 min-w-0">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#1E3A8A]" />
                  <span>Chỉ số TB 4 Trụ cột Telemetry Thực tế</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Phản ánh sức khỏe giao hàng, giá trị kỹ thuật, năng lực &amp; kỷ luật toàn khối IT
                </p>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pillarChartData}
                    layout="vertical"
                    margin={{ top: 6, right: 20, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={78}
                      tick={{ fontSize: 11, fontWeight: 700, fill: '#1E293B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CeoPillarTooltip />} cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="percent" radius={[0, 8, 8, 0]} barSize={22}>
                      {pillarChartData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 4. Executive Server-Paginated Table (Strict B-10: No VND Column in Table; open Detail Modal for Salary Approval) */}
          <div
            ref={reviewTableRef}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h4 className="text-sm font-bold text-slate-900">
                  Hồ sơ Đánh giá &amp; Đề xuất Trình Duyệt ({totalElements} phiếu)
                </h4>
                {reviewsLoading && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Đang tải...</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Tìm tên kỹ sư, mã NV..."
                    className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 w-48"
                  />
                  {keywordInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeywordInput('');
                        updateFilter({ keyword: '' });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Xóa từ khóa"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => updateFilter({ status: e.target.value })}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="DIRECTOR_APPROVAL_PENDING">Chờ CEO / GĐ duyệt</option>
                  <option value="MANAGER_REVIEW_PENDING">Chờ Quản lý chấm</option>
                  <option value="SELF_REVIEW_PENDING">Chờ NV tự đánh giá</option>
                  <option value="APPROVED">Đã chốt hoàn tất</option>
                  <option value="REJECTED_FOR_REVISION">Trả lại hiệu chỉnh</option>
                </select>

                <select
                  value={filterGrade}
                  onChange={(e) => updateFilter({ grade: e.target.value })}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Tất cả xếp loại</option>
                  <option value="S">Hạng S</option>
                  <option value="A">Hạng A</option>
                  <option value="B">Hạng B</option>
                  <option value="C">Hạng C</option>
                  <option value="D">Hạng D</option>
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    <Filter size={12} />
                    <span>Xóa lọc</span>
                  </button>
                )}
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Award size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">
                  Không có hồ sơ đánh giá nào phù hợp bộ lọc
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Bỏ bộ lọc hiện tại
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Nhân sự</th>
                      <th className="py-3 px-4 whitespace-nowrap">Telemetry (60%)</th>
                      <th className="py-3 px-4 whitespace-nowrap">Định tính (40%)</th>
                      <th className="py-3 px-4 whitespace-nowrap">Tổng hợp &amp; Hạng</th>
                      <th className="py-3 px-4">Đề xuất &amp; Lý do Trình duyệt</th>
                      <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Quyết định</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {reviews.map((r) => {
                      const statusCfg =
                        REVIEW_STATUS_CONFIG[r.status] || REVIEW_STATUS_CONFIG.SELF_REVIEW_PENDING;
                      const gradeCfg = r.finalGrade ? RATING_GRADE_CONFIG[r.finalGrade] : null;
                      const compCfg =
                        COMPENSATION_STATUS_CONFIG[r.compensationStatus || 'NONE'] ||
                        COMPENSATION_STATUS_CONFIG.NONE;
                      const isPendingCeoApproval = r.status === 'DIRECTOR_APPROVAL_PENDING';
                      const isOwnReview =
                        currentUserId != null && String(currentUserId) === String(r.employeeId);
                      const isHighlighted = highlightedReviewId === String(r.id);

                      const hasSafeCompBadge =
                        r.recommendPromotion ||
                        Boolean(r.recommendedTitle) ||
                        Number(r.recommendedSalaryIncreasePct || 0) > 0;

                      return (
                        <tr
                          key={r.id}
                          id={`ceo-review-row-${r.id}`}
                          className={`transition duration-300 ${
                            isHighlighted
                              ? 'bg-blue-50/95 ring-2 ring-inset ring-blue-500'
                              : isPendingCeoApproval
                              ? 'bg-orange-50/25 hover:bg-orange-50/50'
                              : 'hover:bg-blue-50/35'
                          }`}
                        >
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-0.5">
                              {onInspectEngineer ? (
                                <button
                                  type="button"
                                  onClick={() => onInspectEngineer(r.employeeId)}
                                  className="font-bold text-[#1E3A8A] hover:underline cursor-pointer text-left"
                                >
                                  {r.hoTen}
                                </button>
                              ) : (
                                <span className="font-bold text-slate-900">{r.hoTen}</span>
                              )}
                              <p className="text-[11px] text-slate-500 tabular">
                                {r.maNhanVien ? `${r.maNhanVien} • ` : ''}
                                {r.chucVu || 'Kỹ sư Công nghệ'}
                              </p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap tabular">
                            <p className="text-sm font-extrabold text-[#0F2557]">
                              {Number(r.telemetryTotalScore || 0).toFixed(1)}đ
                            </p>
                            <p className="text-[10px] text-slate-500">
                              D:{Number(r.deliveryScore || 0).toFixed(0)} • I:{Number(r.impactScore || 0).toFixed(0)} • C:{Number(r.capabilityScore || 0).toFixed(0)} • K:{Number(r.disciplineScore || 0).toFixed(0)}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap tabular">
                            {r.managerQualScore != null ? (
                              <p className="font-bold text-slate-900">{Number(r.managerQualScore).toFixed(1)} / 100</p>
                            ) : (
                              <span className="text-slate-400 italic">Chưa chấm</span>
                            )}
                            {r.evaluatorName && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                                Bởi {r.evaluatorName}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap tabular">
                            {r.finalScore != null ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-extrabold text-slate-900">
                                  {Number(r.finalScore).toFixed(1)}
                                </span>
                                {gradeCfg && (
                                  <span className={`px-2 py-0.5 rounded text-[11px] border ${gradeCfg.badgeClass}`}>
                                    {gradeCfg.grade}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top space-y-1 max-w-xs">
                            {hasSafeCompBadge && (
                              <div className="flex flex-wrap items-center gap-1">
                                {r.recommendedTitle && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                                    → {r.recommendedTitle}
                                  </span>
                                )}
                                {Number(r.recommendedSalaryIncreasePct || 0) > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 tabular">
                                    Đề xuất +{r.recommendedSalaryIncreasePct}%
                                  </span>
                                )}
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${compCfg.badgeClass}`}>
                                  {compCfg.label}
                                </span>
                              </div>
                            )}

                            {r.escalationReasons?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {r.escalationReasons.map((reason, idx) => (
                                  <span
                                    key={`ceo-esc-${r.id}-${idx}`}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            )}

                            {!hasSafeCompBadge && !(r.escalationReasons?.length > 0) && (
                              <span className="text-[11px] text-slate-400 italic">Đánh giá định kỳ chuẩn</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <span
                              className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${statusCfg.badgeClass}`}
                            >
                              {statusCfg.label}
                            </span>
                            {r.finalApproverName && (
                              <p className="text-[10px] text-slate-400 mt-1">Chốt bởi {r.finalApproverName}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectReview && onSelectReview(r)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                                isPendingCeoApproval && !isOwnReview
                                  ? 'bg-[#1E3A8A] hover:bg-blue-700 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isPendingCeoApproval && !isOwnReview ? (
                                <>
                                  <ShieldCheck size={13} />
                                  <span>Thẩm định &amp; Duyệt CEO</span>
                                </>
                              ) : (
                                <>
                                  <Eye size={13} />
                                  <span>Xem Chi tiết</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {(totalElements > 0 || totalPages > 0) && (
              <div className="px-4 sm:px-5 py-3.5 bg-slate-50/75 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600 tabular">
                  <span>
                    Hiển thị <strong className="text-slate-900">{reviews.length}</strong> /{' '}
                    <strong className="text-slate-900">{totalElements}</strong> hồ sơ
                  </span>
                  {(totalElements > 5 || totalPages > 1) && (
                    <>
                      <span className="text-slate-300">•</span>
                      <label className="inline-flex items-center gap-1.5">
                        <span>Dòng/trang:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => handlePageSizeChange(e.target.value)}
                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {[5, 10, 20, 50].map((sz) => (
                            <option key={sz} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1 flex-wrap tabular">
                    <button
                      type="button"
                      disabled={currentPage <= 0 || reviewsLoading}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-45 cursor-pointer"
                      aria-label="Trang trước"
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {buildPageItems(currentPage, totalPages).map((item) =>
                      typeof item === 'string' ? (
                        <span key={item} className="px-1.5 text-slate-400">
                          ...
                        </span>
                      ) : (
                        <button
                          type="button"
                          key={item}
                          disabled={reviewsLoading}
                          onClick={() => handlePageChange(item)}
                          className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            item === currentPage
                              ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {item + 1}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={currentPage >= totalPages - 1 || reviewsLoading}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-45 cursor-pointer"
                      aria-label="Trang sau"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Quản lý / Tra cứu danh sách toàn bộ kỳ đánh giá (Dành cho CEO - Chỉ xem) */}
      <TechCycleManagementModal
        isOpen={isCycleMgmtOpen}
        onClose={() => setIsCycleMgmtOpen(false)}
        cycles={cycles}
        selectedCycleId={selectedCycleId}
        onSelectCycle={(cycleId) => {
          if (onChangeCycle) onChangeCycle(cycleId);
        }}
        isReadOnly={true}
      />
    </div>
  );
}
