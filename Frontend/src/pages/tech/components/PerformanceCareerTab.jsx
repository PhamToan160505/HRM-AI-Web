import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Award,
  Bell,
  Plus,
  Search,
  X,
  TrendingUp,
  Users,
  CheckCircle2,
  Eye,
  Edit3,
  Trash2,
  Lock,
  FolderKanban,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
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
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import EditEvaluationCycleModal from './EditEvaluationCycleModal';
import TechCycleManagementModal from './TechCycleManagementModal';
import {
  REVIEW_STATUS_CONFIG,
  REVIEW_TYPE_CONFIG,
  RATING_GRADE_CONFIG,
  COMPENSATION_STATUS_CONFIG,
  formatDateVN,
  getCertExpiryInfo,
  scrollElementIntoViewCleanly,
} from '../techHelpers';

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

function GradeChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white px-3 py-2 rounded-xl shadow-lg border border-blue-800 text-xs tabular">
      <p className="font-bold">{d.fullLabel}</p>
      <p className="text-blue-100 mt-0.5">
        Số lượng: <strong className="text-white">{d.count}</strong> phiếu đánh giá
      </p>
    </div>
  );
}

function PillarChartTooltip({ active, payload }) {
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

export default function PerformanceCareerTab({
  cycles = [],
  selectedCycleId = '',
  onChangeCycle,
  onRefreshCycles,
  analytics = null,
  reviews = [],
  reviewPageData = null,
  reviewQuery = { page: 0, size: 10, status: '', grade: '', keyword: '' },
  reviewsLoading = false,
  onChangeReviewQuery,
  expiringCerts = [],
  onRemindCert,
  remindingCertId = null,
  currentUserId = null,
  viewerRole = 'truong_phong',
  isReadOnly = false,
  onOpenCreateCycle,
  onSelectReview,
  onInspectEngineer,
  focusReviewRequest = null,
  onFocusHandled,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [isCycleMgmtOpen, setIsCycleMgmtOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);
  const [deletingCycleTarget, setDeletingCycleTarget] = useState(null);
  const [blockedDeleteTarget, setBlockedDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [closingCycle, setClosingCycle] = useState(false);

  const handleQuickDeleteClick = (cycle) => {
    if (!cycle) return;
    if (Number(cycle.approvedCount || 0) > 0) {
      setBlockedDeleteTarget(cycle);
    } else {
      setDeletingCycleTarget(cycle);
    }
  };

  const handleConfirmQuickDelete = async () => {
    if (!deletingCycleTarget || deleting) return;
    try {
      setDeleting(true);
      await api.delete(`/api/tech/reviews/cycles/${deletingCycleTarget.id}`);
      toastRef.current?.show(
        'Đã xóa kỳ đánh giá',
        `Kỳ "${deletingCycleTarget.cycleCode}" và các phiếu liên quan đã được xóa thành công.`,
        'success'
      );
      setDeletingCycleTarget(null);
      if (onRefreshCycles) await onRefreshCycles();
    } catch (err) {
      toastRef.current?.show(
        'Lỗi xóa kỳ',
        err.response?.data?.message || 'Không thể xóa kỳ đánh giá.',
        'error'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickCloseCycle = async (cycle) => {
    if (!cycle || closingCycle) return;
    try {
      setClosingCycle(true);
      await api.put(`/api/tech/reviews/cycles/${cycle.id}`, { status: 'CLOSED' });
      toastRef.current?.show(
        'Đã đóng kỳ đánh giá',
        `Kỳ "${cycle.cycleCode}" đã được chuyển sang trạng thái Đã đóng (CLOSED).`,
        'success'
      );
      setBlockedDeleteTarget(null);
      if (onRefreshCycles) await onRefreshCycles();
    } catch (err) {
      toastRef.current?.show(
        'Lỗi',
        err.response?.data?.message || 'Không thể đóng kỳ đánh giá.',
        'error'
      );
    } finally {
      setClosingCycle(false);
    }
  };

  const reviewTableRef = useRef(null);
  const lastAppliedFocusRef = useRef(0);
  const lastScrolledFocusRef = useRef(0);
  const [highlightState, setHighlightState] = useState(null);
  const highlightedReviewId = highlightState?.id || null;
  const [showAllExpiringCerts, setShowAllExpiringCerts] = useState(false);

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

  // Debounce keyword search
  useEffect(() => {
    if (keywordInput === filterKeyword) return undefined;
    const timer = setTimeout(() => {
      updateFilter({ keyword: keywordInput });
    }, 320);
    return () => clearTimeout(timer);
  }, [keywordInput, filterKeyword, updateFilter]);

  // Clear filters when deep-linking from notification
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
      const rowEl = targetId ? document.getElementById(`tech-review-row-${targetId}`) : null;
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
        const freshRow = targetId ? document.getElementById(`tech-review-row-${targetId}`) : null;
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

  const selectedCycle = useMemo(
    () => cycles.find((c) => String(c.id) === String(selectedCycleId)) || cycles[0] || null,
    [cycles, selectedCycleId]
  );

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

  const roleNorm = (viewerRole || '').toLowerCase();
  const isDirectorOrAdmin = roleNorm === 'giam_doc_phong_ban' || roleNorm === 'admin' || roleNorm === 'ceo';
  const visibleCerts = showAllExpiringCerts ? expiringCerts : expiringCerts.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* 1. Compliance Radar for Expiring Certificates */}
      {expiringCerts.length > 0 && (
        <div className="bg-white rounded-2xl border border-orange-200/90 shadow-[0_4px_20px_-4px_rgba(234,88,12,0.06)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
                <Award size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Cảnh báo Chứng chỉ Quốc tế sắp / đã hết hạn ({expiringCerts.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Chứng chỉ quá hạn làm trừ điểm Trụ cột Capability trong kỳ đánh giá — nhắc kỹ sư gia hạn kịp thời
                </p>
              </div>
            </div>

            {expiringCerts.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllExpiringCerts((prev) => !prev)}
                className="text-xs font-bold text-[#1E3A8A] hover:underline cursor-pointer"
              >
                {showAllExpiringCerts ? 'Thu gọn' : `Xem tất cả (${expiringCerts.length})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visibleCerts.map((cert) => {
              const expInfo = getCertExpiryInfo(cert);
              const isExpired = expInfo.status === 'EXPIRED';
              return (
                <div
                  key={`perf-cert-${cert.certId}`}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2 text-xs ${
                    isExpired
                      ? 'bg-rose-50/45 border-rose-200/90'
                      : 'bg-orange-50/45 border-orange-200/90'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      {onInspectEngineer ? (
                        <button
                          type="button"
                          onClick={() => onInspectEngineer(cert.userId)}
                          className="font-bold text-[#1E3A8A] hover:underline truncate cursor-pointer text-left"
                        >
                          {cert.hoTen}
                        </button>
                      ) : (
                        <span className="font-bold text-slate-900 truncate">{cert.hoTen}</span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 tabular ${
                          isExpired
                            ? 'bg-rose-100/80 text-rose-700 border-rose-200'
                            : 'bg-orange-100/80 text-orange-700 border-orange-200'
                        }`}
                      >
                        {expInfo.label}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 truncate" title={cert.certificateName}>
                      {cert.certificateName}
                    </p>
                    <p className="text-[11px] text-slate-600 tabular truncate">
                      {cert.issuingOrganization} • Hết hạn: {formatDateVN(cert.expiryDate)}
                    </p>
                  </div>

                  {!isReadOnly && onRemindCert && (
                    <div className="flex justify-end pt-1 border-t border-slate-200/60">
                      <button
                        type="button"
                        disabled={remindingCertId === cert.certId}
                        onClick={() => onRemindCert(cert)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-[#1E3A8A] text-[#1E3A8A] hover:text-white border border-blue-200 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                      >
                        <Bell size={12} />
                        <span>{remindingCertId === cert.certId ? 'Đang gửi...' : 'Nhắc gia hạn'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Cycle Control Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E3A8A] border border-blue-200 flex items-center justify-center shrink-0">
            <TrendingUp size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900">
              Đánh giá Hiệu suất Đa chiều (60% Telemetry + 40% Định tính) &amp; Nâng bậc Kỹ sư
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dữ liệu Telemetry tổng hợp khách quan từ Giờ công, Mốc bàn giao, Kỹ năng/Chứng chỉ và Chấm công; tuân thủ bảo mật B-10
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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

          {/* Nút xem toàn bộ danh sách các kỳ đánh giá đã mở */}
          <button
            type="button"
            onClick={() => setIsCycleMgmtOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer"
            title="Xem danh sách chi tiết các kỳ đánh giá đã mở, quản lý sửa và xóa kỳ"
          >
            <FolderKanban size={15} className="text-[#1E3A8A]" />
            <span>Danh sách Kỳ ({cycles.length})</span>
          </button>

          {!isReadOnly && onOpenCreateCycle && (
            <button
              type="button"
              onClick={onOpenCreateCycle}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <Plus size={15} />
              <span>Mở Kỳ Đánh giá Mới</span>
            </button>
          )}
        </div>
      </div>

      {cycles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <Award size={44} className="mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-800">Chưa có Kỳ Đánh giá Hiệu suất nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Khởi tạo kỳ đánh giá Quý hoặc Tháng để hệ thống tự động chụp điểm Telemetry 4 trụ cột từ Worklog, Milestone, Kỹ năng &amp; Chấm công cho toàn bộ kỹ sư Phòng Công nghệ.
          </p>
          {!isReadOnly && onOpenCreateCycle && (
            <button
              type="button"
              onClick={onOpenCreateCycle}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus size={15} />
              <span>Khởi tạo Kỳ Đánh giá Đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Cycle Metadata Strip */}
          {selectedCycle && (
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 text-xs tabular">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-bold px-2.5 py-0.5 rounded-md bg-[#0F2557] text-white">
                  {selectedCycle.cycleCode}
                </span>
                <span className="font-bold text-slate-800">{selectedCycle.title}</span>
                {selectedCycle.status === 'OPEN' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đang mở
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                    <Lock size={11} />
                    Đã đóng
                  </span>
                )}
                <span className="text-slate-500">
                  Kỳ: {formatDateVN(selectedCycle.periodStart)} → {formatDateVN(selectedCycle.periodEnd)}
                </span>
                {selectedCycle.selfReviewDeadline && (
                  <span className="text-orange-700 font-semibold">
                    • Hạn tự đánh giá: {formatDateVN(selectedCycle.selfReviewDeadline)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
                  <span>
                    Tự đánh giá:{' '}
                    <strong className="text-[#1E3A8A]">
                      {selectedCycle.selfReviewSubmittedCount}/{selectedCycle.totalReviews} ({selectedCycle.selfReviewRatePercent}%)
                    </strong>
                  </span>
                  <span>
                    Chốt kết quả:{' '}
                    <strong className="text-emerald-700">
                      {selectedCycle.approvedCount}/{selectedCycle.totalReviews} ({selectedCycle.approvedRatePercent}%)
                    </strong>
                  </span>
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-blue-200/80">
                    <button
                      type="button"
                      onClick={() => setEditingCycle(selectedCycle)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-2xs transition cursor-pointer"
                      title="Chỉnh sửa thông tin kỳ đánh giá này"
                    >
                      <Edit3 size={13} />
                      <span>Sửa kỳ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDeleteClick(selectedCycle)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg shadow-2xs transition cursor-pointer"
                      title="Xóa kỳ đánh giá này"
                    >
                      <Trash2 size={13} />
                      <span>Xóa kỳ</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. 4 Bento KPI Wells */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Quy mô Kỳ đánh giá</span>
                <Users size={15} className="text-[#1E3A8A]" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-slate-900">{analytics?.totalReviews ?? 0} phiếu</p>
                <span className="text-xs font-bold text-[#1E3A8A]">
                  {analytics?.selfReviewSubmittedCount ?? 0} đã tự chấm
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tabular">
                Chờ QL chấm: {analytics?.managerReviewPendingCount ?? 0} • Chờ GĐ/CEO: {analytics?.directorApprovalPendingCount ?? 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Tiến độ Phê duyệt Kỳ</span>
                <CheckCircle2 size={15} className="text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-emerald-700">
                  {analytics?.completionRatePercent ?? 0}%
                </p>
                <span className="text-xs font-bold text-slate-600">
                  {analytics?.approvedCount ?? 0} đã chốt
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${Math.min(100, analytics?.completionRatePercent ?? 0)}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Điểm Trung bình Phòng</span>
                <Sparkles size={15} className="text-[#1E3A8A]" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-[#1E3A8A]">
                  {Number(analytics?.avgFinalScore ?? 0).toFixed(1)}
                  <span className="text-xs font-semibold text-slate-400"> / 100</span>
                </p>
                <span className="text-[11px] font-bold text-slate-600">
                  Telemetry TB: {Number(analytics?.avgTelemetryScore ?? 0).toFixed(1)}đ
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tabular">
                Định tính Quản lý TB: {Number(analytics?.avgManagerQualScore ?? 0).toFixed(1)}đ
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">Nâng bậc &amp; Đề xuất Đãi ngộ</span>
                <TrendingUp size={15} className="text-orange-600" />
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular">
                <p className="text-2xl font-extrabold text-orange-600">
                  {analytics?.pendingSkillPromotionsCount ?? 0}
                  <span className="text-xs font-semibold text-slate-500"> skill chờ</span>
                </p>
                <span className="text-[11px] font-bold text-[#1E3A8A]">
                  {analytics?.pendingCompensationProposalsCount ?? 0} trình CEO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tabular">
                Đã duyệt nâng bậc: {analytics?.approvedSkillPromotionsCount ?? 0} kỹ năng
              </p>
            </div>
          </div>

          {/* 4. 2 Recharts Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Grade Distribution */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 size={16} className="text-[#1E3A8A]" />
                    <span>Phân bố Xếp loại Hiệu suất (S / A / B / C / D)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bấm vào cột hoặc dùng bộ lọc bên dưới để rà soát nhanh từng nhóm xếp hạng
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
                    <Tooltip content={<GradeChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
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

            {/* 4 Telemetry Pillars */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-3 min-w-0">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#1E3A8A]" />
                  <span>Trung bình 4 Trụ cột Telemetry Toàn phòng</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Delivery (tối đa 35đ) • Impact (25đ) • Capability (20đ) • Discipline (20đ)
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
                    <Tooltip content={<PillarChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
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

          {/* 5. Server-Paginated Performance Reviews Table (Strict B-10: No VND Salary Column) */}
          <div
            ref={reviewTableRef}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h4 className="text-sm font-bold text-slate-900">
                    Danh sách Phiếu Đánh giá Kỹ sư ({totalElements} phiếu)
                  </h4>
                  {reviewsLoading && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                      <Loader2 size={13} className="animate-spin" />
                      <span>Đang tải...</span>
                    </span>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      placeholder="Tìm tên kỹ sư, mã NV, chức vụ..."
                      className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 w-52"
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
                    <option value="SELF_REVIEW_PENDING">Chờ NV tự đánh giá</option>
                    <option value="MANAGER_REVIEW_PENDING">Chờ Quản lý chấm</option>
                    <option value="DIRECTOR_APPROVAL_PENDING">Chờ GĐ / CEO duyệt</option>
                    <option value="APPROVED">Đã chốt hoàn tất</option>
                    <option value="REJECTED_FOR_REVISION">Trả lại hiệu chỉnh</option>
                  </select>

                  <select
                    value={filterGrade}
                    onChange={(e) => updateFilter({ grade: e.target.value })}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Tất cả xếp loại</option>
                    <option value="S">Hạng S (Xuất sắc ≥ 90đ)</option>
                    <option value="A">Hạng A (Vượt kỳ vọng ≥ 80đ)</option>
                    <option value="B">Hạng B (Đạt chuẩn ≥ 65đ)</option>
                    <option value="C">Hạng C (Cải thiện ≥ 50đ)</option>
                    <option value="D">Hạng D (Chưa đạt &lt; 50đ)</option>
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
            </div>

            {reviews.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Award size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">
                  Không có phiếu đánh giá nào khớp điều kiện lọc
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Hiển thị lại tất cả phiếu
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Kỹ sư</th>
                      <th className="py-3 px-4 whitespace-nowrap">Telemetry (60%)</th>
                      <th className="py-3 px-4 whitespace-nowrap">Định tính (40%)</th>
                      <th className="py-3 px-4 whitespace-nowrap">Tổng hợp &amp; Hạng</th>
                      <th className="py-3 px-4">Nâng bậc &amp; Đề xuất</th>
                      <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
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
                      const isOwnReview =
                        currentUserId != null && String(currentUserId) === String(r.employeeId);
                      const isHighlighted = highlightedReviewId === String(r.id);

                      const skillItems = r.skillPromotionItems || [];
                      const pendingSkillCount = skillItems.filter((i) => i.status === 'PENDING').length;
                      const approvedSkillCount = skillItems.filter((i) => i.status === 'APPROVED').length;
                      const hasSafeCompBadge =
                        r.recommendPromotion ||
                        Boolean(r.recommendedTitle) ||
                        Number(r.recommendedSalaryIncreasePct || 0) > 0;

                      const canActionEvaluate =
                        !isReadOnly &&
                        !isOwnReview &&
                        (r.status === 'SELF_REVIEW_PENDING' ||
                          r.status === 'MANAGER_REVIEW_PENDING' ||
                          r.status === 'REJECTED_FOR_REVISION');
                      const canDirectorApprove =
                        !isReadOnly &&
                        !isOwnReview &&
                        isDirectorOrAdmin &&
                        r.status === 'DIRECTOR_APPROVAL_PENDING';

                      return (
                        <tr
                          key={r.id}
                          id={`tech-review-row-${r.id}`}
                          className={`transition duration-300 ${
                            isHighlighted
                              ? 'bg-blue-50/95 ring-2 ring-inset ring-blue-500'
                              : 'hover:bg-blue-50/35'
                          }`}
                        >
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
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
                                {isOwnReview && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                    Phiếu của bạn (Chỉ xem)
                                  </span>
                                )}
                              </div>
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
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              D:{Number(r.deliveryScore || 0).toFixed(0)} • I:{Number(r.impactScore || 0).toFixed(0)} • C:{Number(r.capabilityScore || 0).toFixed(0)} • K:{Number(r.disciplineScore || 0).toFixed(0)}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap tabular">
                            {r.managerQualScore != null ? (
                              <p className="font-bold text-slate-900">
                                {Number(r.managerQualScore).toFixed(1)} / 100
                              </p>
                            ) : (
                              <span className="text-slate-400 italic">Chờ chấm</span>
                            )}
                            {r.selfRatingScore != null && (
                              <p className="text-[10px] text-blue-700 font-semibold mt-0.5">
                                NV tự chấm: {r.selfRatingScore}đ
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
                            {Number(r.calibrationDelta || 0) !== 0 && (
                              <p className="text-[10px] font-semibold text-blue-700 mt-0.5">
                                Hiệu chỉnh: {Number(r.calibrationDelta) > 0 ? `+${r.calibrationDelta}` : r.calibrationDelta}đ
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top space-y-1 max-w-xs">
                            {skillItems.length === 0 && !hasSafeCompBadge && (
                              <span className="text-[11px] text-slate-400 italic">Không có đề xuất</span>
                            )}

                            {skillItems.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200 tabular">
                                  {skillItems.length} nâng bậc kỹ năng
                                </span>
                                {pendingSkillCount > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 tabular">
                                    {pendingSkillCount} chờ duyệt
                                  </span>
                                )}
                                {approvedSkillCount > 0 && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 tabular">
                                    {approvedSkillCount} đã nâng bậc
                                  </span>
                                )}
                              </div>
                            )}

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
                          </td>

                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <span
                              className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${statusCfg.badgeClass}`}
                            >
                              {statusCfg.label}
                            </span>
                            {r.evaluatorName && (
                              <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]">
                                QL chấm: {r.evaluatorName}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onSelectReview && onSelectReview(r)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                                canDirectorApprove
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                  : canActionEvaluate
                                  ? 'bg-[#1E3A8A] hover:bg-blue-700 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {canDirectorApprove ? (
                                <>
                                  <ShieldCheck size={13} />
                                  <span>Phê duyệt</span>
                                </>
                              ) : canActionEvaluate ? (
                                <>
                                  <Edit3 size={13} />
                                  <span>{r.managerQualScore != null ? 'Sửa đánh giá' : 'Thẩm định & Chấm'}</span>
                                </>
                              ) : (
                                <>
                                  <Eye size={13} />
                                  <span>{isOwnReview ? 'Xem phiếu' : 'Chi tiết'}</span>
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

            {/* Pagination Footer */}
            {(totalElements > 0 || totalPages > 0) && (
              <div className="px-4 sm:px-5 py-3.5 bg-slate-50/75 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600 tabular">
                  <span>
                    Hiển thị <strong className="text-slate-900">{reviews.length}</strong> /{' '}
                    <strong className="text-slate-900">{totalElements}</strong> phiếu đánh giá
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

      {/* Modal: Quản lý danh sách các kỳ đánh giá đã mở */}
      <TechCycleManagementModal
        isOpen={isCycleMgmtOpen}
        onClose={() => setIsCycleMgmtOpen(false)}
        cycles={cycles}
        selectedCycleId={selectedCycleId}
        onSelectCycle={(cycleId) => {
          if (onChangeCycle) onChangeCycle(cycleId);
        }}
        onOpenCreateCycle={
          !isReadOnly && onOpenCreateCycle
            ? () => {
                setIsCycleMgmtOpen(false);
                onOpenCreateCycle();
              }
            : undefined
        }
        onEditCycle={!isReadOnly ? (cycle) => setEditingCycle(cycle) : undefined}
        onDeleteSuccess={async () => {
          if (onRefreshCycles) await onRefreshCycles();
        }}
        isReadOnly={isReadOnly}
      />

      {/* Modal: Sửa thông tin kỳ đánh giá */}
      {!isReadOnly && editingCycle && (
        <EditEvaluationCycleModal
          isOpen={!!editingCycle}
          onClose={() => setEditingCycle(null)}
          cycle={editingCycle}
          onSuccess={async () => {
            setEditingCycle(null);
            if (onRefreshCycles) await onRefreshCycles();
          }}
        />
      )}

      {/* Alert Modal: Bị chặn xóa khi kỳ đã có phiếu được duyệt */}
      {blockedDeleteTarget &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-150"
            onClick={() => !closingCycle && setBlockedDeleteTarget(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Không thể xóa Kỳ đánh giá đã có kết quả
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Kỳ <strong>[{blockedDeleteTarget.cycleCode}] {blockedDeleteTarget.title}</strong> hiện có{' '}
                    <strong className="text-emerald-700">{blockedDeleteTarget.approvedCount} phiếu đánh giá đã được phê duyệt</strong> (APPROVED).
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">⚠️ Lý do bảo toàn dữ liệu nhân sự:</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Để đảm bảo tính nhất quán của lịch sử nâng bậc kỹ năng, điều chỉnh lương và sự nghiệp của kỹ sư, hệ thống không cho phép xóa kỳ đã có kết quả chính thức.
                </p>
              </div>

              {blockedDeleteTarget.status !== 'CLOSED' && (
                <p className="text-xs text-slate-600">
                  Bạn có thể <strong>Đóng kỳ đánh giá (CLOSED)</strong> để ngưng nhận tự đánh giá và thẩm định mới.
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={closingCycle}
                  onClick={() => setBlockedDeleteTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
                {blockedDeleteTarget.status !== 'CLOSED' && (
                  <button
                    type="button"
                    disabled={closingCycle}
                    onClick={() => handleQuickCloseCycle(blockedDeleteTarget)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    <Lock size={14} />
                    <span>{closingCycle ? 'Đang chuyển...' : 'Chuyển sang Đã đóng'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirmation Modal: Xác nhận xóa kỳ đánh giá */}
      {deletingCycleTarget &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-150"
            onClick={() => !deleting && setDeletingCycleTarget(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 size={22} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    Xác nhận xóa Kỳ đánh giá?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bạn sắp xóa kỳ <strong>[{deletingCycleTarget.cycleCode}] {deletingCycleTarget.title}</strong>.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200/80 text-xs text-rose-900 space-y-1">
                <p className="font-semibold">⚠️ Cảnh báo hành động không thể hoàn tác:</p>
                <ul className="text-[11px] text-rose-800 list-disc list-inside space-y-0.5">
                  <li>Toàn bộ {deletingCycleTarget.totalReviews || 0} phiếu đánh giá (chưa duyệt) thuộc kỳ này sẽ bị xóa.</li>
                  <li>Các đề xuất nâng bậc kỹ năng chưa duyệt trong kỳ sẽ bị hủy.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeletingCycleTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmQuickDelete}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
