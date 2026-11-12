import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  CheckSquare,
  Calendar,
  ExternalLink,
  Layers,
  Users,
  Wallet,
  X,
  Filter,
  Home,
  Link2Off,
  Gauge,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/Toast';
import TechMonthPicker from './TechMonthPicker';
import WorklogAuditBadges from './WorklogAuditBadges';
import {
  WORKLOG_TYPE_CONFIG,
  WORKLOG_STATUS_CONFIG,
  formatDateVN,
  formatHours,
  formatCurrencyVND,
  getShortEngineerName,
  scrollElementIntoViewCleanly,
  matchWorklogFromFocusRequest,
} from '../techHelpers';

function BurnComparisonTooltip({ active, payload, mode }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white p-3 rounded-xl shadow-xl border border-blue-800/80 text-xs max-w-xs space-y-1.5">
      <div>
        <p className="font-bold text-white">{item.fullTitle}</p>
        {item.subLabel && <p className="text-[11px] text-blue-200">{item.subLabel}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-800/80 tabular">
        <div>
          <span className="text-[10px] text-blue-200/80 block">Kế hoạch FTE</span>
          <span className="font-extrabold text-sm text-sky-300">{formatHours(item.plannedHours)}</span>
        </div>
        <div>
          <span className="text-[10px] text-blue-200/80 block">Đã duyệt thực tế</span>
          <span className="font-extrabold text-sm text-emerald-300">{formatHours(item.approvedHours)}</span>
        </div>
        <div>
          <span className="text-[10px] text-blue-200/80 block">Đang chờ duyệt</span>
          <span className="font-bold text-orange-300">{formatHours(item.pendingHours)}</span>
        </div>
        <div>
          <span className="text-[10px] text-blue-200/80 block">
            {mode === 'projects' ? 'Burn Rate / Plan' : 'Hiệu suất'}
          </span>
          <span className="font-bold text-white">{item.utilizationPercent ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}

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

export default function TimesheetAnalyticsTab({
  analytics,
  worklogs = [],
  worklogPageData = null,
  worklogQuery = null,
  worklogsLoading = false,
  onChangeWorklogQuery,
  projects = [],
  benchUsers = [],
  selectedMonth,
  onChangeMonth,
  onRefresh,
  onSelectProjectById,
  onInspectEngineer,
  isReadOnly = false,
  focusWorklogRequest = null,
  onFocusHandled,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const currentUserId = user?.userId;

  const isServerPaginated = Boolean(worklogPageData && typeof onChangeWorklogQuery === 'function');

  const [chartMode, setChartMode] = useState('projects'); // 'projects' | 'engineers'
  const [localFilterProjectId, setLocalFilterProjectId] = useState('');
  const [localFilterUserId, setLocalFilterUserId] = useState('');
  const [localFilterStatus, setLocalFilterStatus] = useState('');
  const [localFilterAudit, setLocalFilterAudit] = useState('');
  const [expandedAuditIds, setExpandedAuditIds] = useState({});
  const [highlightState, setHighlightState] = useState(null);
  const highlightedWorklogId = highlightState?.id || null;
  const worklogTableRef = useRef(null);
  const lastAppliedFocusRef = useRef(0);
  const lastScrolledFocusRef = useRef(0);

  const filterProjectId = isServerPaginated ? worklogQuery?.projectId || '' : localFilterProjectId;
  const filterUserId = isServerPaginated ? worklogQuery?.userId || '' : localFilterUserId;
  const filterStatus = isServerPaginated ? worklogQuery?.status || '' : localFilterStatus;
  const filterAudit = isServerPaginated ? worklogQuery?.auditFilter || '' : localFilterAudit;

  const updateFilter = useCallback(
    (patch) => {
      if (isServerPaginated) {
        onChangeWorklogQuery((prev) => ({
          ...(prev || { page: 0, size: 5 }),
          ...patch,
          page: 0,
        }));
      } else {
        if ('projectId' in patch) setLocalFilterProjectId(patch.projectId);
        if ('userId' in patch) setLocalFilterUserId(patch.userId);
        if ('status' in patch) setLocalFilterStatus(patch.status);
        if ('auditFilter' in patch) setLocalFilterAudit(patch.auditFilter);
      }
    },
    [isServerPaginated, onChangeWorklogQuery]
  );

  const clearAllFilters = useCallback(() => {
    updateFilter({ projectId: '', userId: '', status: '', auditFilter: '' });
  }, [updateFilter]);

  const [selectedIds, setSelectedIds] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Reject Reason Modal state
  const [rejectModal, setRejectModal] = useState({ isOpen: false, worklog: null });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Khi nhảy từ thông báo vào tab Giờ công: xóa bộ lọc đang che khuất bản ghi đích
  useEffect(() => {
    const reqAt = focusWorklogRequest?.requestedAt;
    if (!reqAt || reqAt === lastAppliedFocusRef.current) return;
    lastAppliedFocusRef.current = reqAt;
    if (!isServerPaginated) {
      setLocalFilterProjectId('');
      setLocalFilterUserId('');
      setLocalFilterStatus('');
      setLocalFilterAudit('');
    } else if (filterProjectId || filterUserId || filterStatus || filterAudit) {
      clearAllFilters();
    }
  }, [
    focusWorklogRequest,
    isServerPaginated,
    filterProjectId,
    filterUserId,
    filterStatus,
    filterAudit,
    clearAllFilters,
  ]);

  // Reset selected checkboxes when list changes
  useEffect(() => {
    setSelectedIds((prev) =>
      prev.filter((id) => worklogs.some((w) => w.id === id && w.approvalStatus === 'PENDING'))
    );
  }, [worklogs]);

  const closeRejectModal = useCallback(() => {
    if (!rejectSubmitting) {
      setRejectModal({ isOpen: false, worklog: null });
      setRejectReason('');
    }
  }, [rejectSubmitting]);

  useEffect(() => {
    if (!rejectModal.isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRejectModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [rejectModal.isOpen, closeRejectModal]);

  const auditSummary = useMemo(() => {
    if (worklogPageData) {
      return {
        warningCount: Number(worklogPageData.warningCount ?? 0),
        missingEvidenceCount: Number(worklogPageData.missingEvidenceCount ?? 0),
        allocationOverloadCount: Number(worklogPageData.allocationOverloadCount ?? 0),
        wfhOrOtCount: Number(worklogPageData.wfhOrOtCount ?? 0),
        attendanceIssueCount: Number(worklogPageData.attendanceIssueCount ?? 0),
      };
    }

    let warningCount = 0;
    let missingEvidenceCount = 0;
    let allocationOverloadCount = 0;
    let wfhOrOtCount = 0;
    let attendanceIssueCount = 0;

    worklogs.forEach((w) => {
      const alerts = w.auditAlerts || [];
      if (w.hasAuditWarning) warningCount += 1;
      if (alerts.some((a) => a.code === 'MISSING_EVIDENCE_URL')) missingEvidenceCount += 1;
      if (alerts.some((a) => a.code === 'ALLOCATION_OVERLOAD')) allocationOverloadCount += 1;
      if (
        [
          'ATTENDANCE_WFH',
          'ATTENDANCE_WFH_OVER_HOURS',
          'ATTENDANCE_HALF_DAY',
          'ATTENDANCE_HALF_DAY_EXCEEDED',
          'ATTENDANCE_OVERTIME',
        ].includes(w.attendanceContextCode)
      ) {
        wfhOrOtCount += 1;
      }
      if (alerts.some((a) => a.category === 'ATTENDANCE' && (a.severity === 'WARNING' || a.severity === 'DANGER'))) {
        attendanceIssueCount += 1;
      }
    });

    return {
      warningCount,
      missingEvidenceCount,
      allocationOverloadCount,
      wfhOrOtCount,
      attendanceIssueCount,
    };
  }, [worklogs, worklogPageData]);

  const filteredWorklogs = useMemo(() => {
    if (isServerPaginated) return worklogs;
    return worklogs.filter((w) => {
      if (filterProjectId && String(w.projectId) !== String(filterProjectId)) return false;
      if (filterUserId && String(w.userId) !== String(filterUserId)) return false;
      if (filterStatus && w.approvalStatus !== filterStatus) return false;
      if (filterAudit) {
        const alerts = w.auditAlerts || [];
        if (filterAudit === 'WARNING_ONLY' && !w.hasAuditWarning) return false;
        if (
          filterAudit === 'WFH_OT' &&
          ![
            'ATTENDANCE_WFH',
            'ATTENDANCE_WFH_OVER_HOURS',
            'ATTENDANCE_HALF_DAY',
            'ATTENDANCE_HALF_DAY_EXCEEDED',
            'ATTENDANCE_OVERTIME',
          ].includes(w.attendanceContextCode)
        ) {
          return false;
        }
        if (filterAudit === 'MISSING_EVIDENCE' && !alerts.some((a) => a.code === 'MISSING_EVIDENCE_URL')) {
          return false;
        }
        if (filterAudit === 'ALLOCATION_OVERLOAD' && !alerts.some((a) => a.code === 'ALLOCATION_OVERLOAD')) {
          return false;
        }
        if (
          filterAudit === 'ATTENDANCE_ISSUE' &&
          !alerts.some((a) => a.category === 'ATTENDANCE' && (a.severity === 'WARNING' || a.severity === 'DANGER'))
        ) {
          return false;
        }
      }
      return true;
    });
  }, [isServerPaginated, worklogs, filterProjectId, filterUserId, filterStatus, filterAudit]);

  const totalElements = isServerPaginated
    ? Number(worklogPageData?.totalElements ?? filteredWorklogs.length)
    : filteredWorklogs.length;
  const monthTotalCount = worklogPageData
    ? Number(worklogPageData.monthTotalCount ?? worklogs.length)
    : worklogs.length;
  const currentPage = worklogPageData?.number ?? worklogQuery?.page ?? 0;
  const pageSize = worklogPageData?.size ?? worklogQuery?.size ?? 5;
  const totalPages = worklogPageData?.totalPages ?? 0;

  const handlePageChange = (nextPage) => {
    if (!isServerPaginated || worklogsLoading) return;
    const clamped = Math.max(0, Math.min(Math.max(0, totalPages - 1), nextPage));
    if (clamped === currentPage) return;
    setSelectedIds([]);
    onChangeWorklogQuery((prev) => ({ ...(prev || { size: pageSize }), page: clamped }));
    if (worklogTableRef.current) {
      scrollElementIntoViewCleanly(worklogTableRef.current, 'start');
    }
  };

  const handlePageSizeChange = (nextSize) => {
    if (!isServerPaginated || worklogsLoading) return;
    const parsedSize = Number(nextSize) || 5;
    setSelectedIds([]);
    onChangeWorklogQuery((prev) => ({ ...(prev || {}), page: 0, size: parsedSize }));
  };

  const hasActiveFilters = Boolean(filterProjectId || filterUserId || filterStatus || filterAudit);

  const matchedWorklogId = useMemo(() => {
    if (!focusWorklogRequest?.requestedAt || hasActiveFilters) return null;
    const row = matchWorklogFromFocusRequest(filteredWorklogs, focusWorklogRequest, 'manager');
    return row ? String(row.id) : null;
  }, [focusWorklogRequest, hasActiveFilters, filteredWorklogs]);

  useEffect(() => {
    if (worklogsLoading) return;
    const reqAt = focusWorklogRequest?.requestedAt;
    if (!reqAt || lastScrolledFocusRef.current === reqAt || hasActiveFilters) return;

    if (focusWorklogRequest.worklogId && !matchedWorklogId) {
      // Đợi loadAllData tải xong bản ghi mới / đúng trang từ API trước khi cuộn fallback
      const waitTimer = setTimeout(() => {
        if (lastScrolledFocusRef.current !== reqAt && worklogTableRef.current) {
          lastScrolledFocusRef.current = reqAt;
          scrollElementIntoViewCleanly(worklogTableRef.current, 'start');
          if (onFocusHandled) onFocusHandled(reqAt);
        }
      }, 2200);
      return () => clearTimeout(waitTimer);
    }

    const targetId = matchedWorklogId;
    let initialTimer = null;
    let retryTimer = null;
    let realignTimer = null;

    const attemptScroll = (retryCount = 0) => {
      const rowEl = targetId ? document.getElementById(`tech-worklog-row-${targetId}`) : null;
      const anchorEl = rowEl || worklogTableRef.current;
      if (!anchorEl || (targetId && !rowEl && retryCount < 6)) {
        if (retryCount < 6) {
          retryTimer = setTimeout(() => attemptScroll(retryCount + 1), 100);
        }
        return;
      }

      // Chỉ đánh dấu đã cuộn khi thực sự cuộn (an toàn trước React StrictMode & loadAllData ngầm)
      lastScrolledFocusRef.current = reqAt;
      if (targetId) {
        setHighlightState({ id: targetId, at: reqAt });
      }
      scrollElementIntoViewCleanly(anchorEl, rowEl ? 'center' : 'start');
      if (onFocusHandled) {
        onFocusHandled(reqAt);
      }

      // Căn lại nhẹ sau khi Recharts / hiệu ứng chuyển tab ổn định chiều cao
      realignTimer = setTimeout(() => {
        const freshRowEl = targetId ? document.getElementById(`tech-worklog-row-${targetId}`) : null;
        const freshAnchor = freshRowEl || worklogTableRef.current;
        if (freshAnchor) {
          scrollElementIntoViewCleanly(freshAnchor, freshRowEl ? 'center' : 'start');
        }
      }, 320);
    };

    initialTimer = setTimeout(() => attemptScroll(0), 180);

    return () => {
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (realignTimer) clearTimeout(realignTimer);
    };
  }, [focusWorklogRequest, matchedWorklogId, hasActiveFilters, worklogsLoading, onFocusHandled]);

  useEffect(() => {
    if (!highlightState?.id) return;
    const clearTimer = setTimeout(() => {
      setHighlightState((prev) => (prev && prev.at === highlightState.at ? null : prev));
    }, 5000);
    return () => clearTimeout(clearTimer);
  }, [highlightState]);

  const toggleExpandAudit = useCallback((id) => {
    setExpandedAuditIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectablePendingIds = useMemo(() => {
    return filteredWorklogs
      .filter((w) => w.approvalStatus === 'PENDING' && String(w.userId) !== String(currentUserId))
      .map((w) => w.id);
  }, [filteredWorklogs, currentUserId]);

  const allSelectableChecked =
    selectablePendingIds.length > 0 && selectablePendingIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectablePendingIds);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleApproveSingle = async (worklog) => {
    if (isReadOnly || processingId) return;
    try {
      setProcessingId(worklog.id);
      await api.put(`/api/tech/worklogs/${worklog.id}/approve`);
      toast?.show('Đã duyệt', `Đã phê duyệt ${formatHours(worklog.hoursSpent)} của ${worklog.userName}`, 'success');
      if (onRefresh) await onRefresh();
    } catch (err) {
      toast?.show('Thất bại', err.response?.data?.message || 'Không thể phê duyệt bản ghi giờ công', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const toggleQuickRejectAlert = (detail) => {
    const cleanDetail = (detail || '').trim();
    if (!cleanDetail) return;

    setRejectReason((prev) => {
      const current = prev || '';
      if (current.includes(cleanDetail)) {
        const remainingLines = current
          .split(/\r?\n/)
          .filter((line) => !line.includes(cleanDetail));
        return remainingLines.join('\n').replace(/^\n+|\n+$/g, '');
      }

      const nextLine = `- ${cleanDetail}`;
      const base = current.replace(/\s+$/, '');
      const nextValue = base ? `${base}\n${nextLine}` : nextLine;
      if (nextValue.length > 500) {
        toast?.show('Quá giới hạn ký tự', 'Lý do từ chối tối đa 500 ký tự.', 'warning');
        return prev;
      }
      return nextValue;
    });
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.worklog || !rejectReason.trim()) {
      toast?.show('Thiếu thông tin', 'Vui lòng nhập lý do từ chối bản ghi giờ công', 'warning');
      return;
    }
    try {
      setRejectSubmitting(true);
      await api.put(`/api/tech/worklogs/${rejectModal.worklog.id}/reject`, {
        rejectionReason: rejectReason.trim(),
      });
      toast?.show('Đã từ chối', `Đã từ chối nhật ký giờ công của ${rejectModal.worklog.userName}`, 'success');
      setRejectModal({ isOpen: false, worklog: null });
      setRejectReason('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      toast?.show('Thất bại', err.response?.data?.message || 'Không thể từ chối bản ghi giờ công', 'error');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleBatchApprove = async () => {
    if (isReadOnly || selectedIds.length === 0 || batchSubmitting) return;
    try {
      setBatchSubmitting(true);
      await api.put('/api/tech/worklogs/batch-approve', { worklogIds: selectedIds });
      toast?.show('Thành công', `Đã phê duyệt hàng loạt ${selectedIds.length} nhật ký giờ công!`, 'success');
      setSelectedIds([]);
      if (onRefresh) await onRefresh();
    } catch (err) {
      toast?.show('Thất bại', err.response?.data?.message || 'Không thể phê duyệt hàng loạt', 'error');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const chartData = useMemo(() => {
    if (!analytics) return [];
    if (chartMode === 'projects') {
      return (analytics.projectBreakdowns || []).map((p) => ({
        name: p.projectCode,
        fullTitle: `[${p.projectCode}] ${p.projectName}`,
        subLabel: `Phân bổ ${p.allocatedPercentSum || 0}% tải`,
        plannedHours: p.plannedFteHours || 0,
        approvedHours: p.actualApprovedHours || 0,
        pendingHours: p.pendingHours || 0,
        utilizationPercent: p.burnUtilizationPercent || 0,
      }));
    }
    return (analytics.engineerBreakdowns || []).map((u) => ({
      name: getShortEngineerName(u.hoTen),
      fullTitle: u.hoTen,
      subLabel: `${u.chucVu || 'Kỹ sư'} • Phân bổ ${u.allocatedPercent || 0}% tải`,
      plannedHours: u.plannedHours || 0,
      approvedHours: u.approvedHours || 0,
      pendingHours: u.pendingHours || 0,
      utilizationPercent: u.utilizationPercent || 0,
    }));
  }, [analytics, chartMode]);

  const approvedHours = analytics?.totalApprovedHours ?? 0;
  const pendingHours = analytics?.totalPendingHours ?? 0;
  const billablePercent = analytics?.billablePercent ?? 0;
  const burnUtilization = analytics?.burnUtilizationPercent ?? 0;
  const approvedManDays = analytics?.totalApprovedManDays ?? 0;
  const canViewCost = Boolean(analytics?.canViewCost);

  return (
    <div className="space-y-5">
      {/* 1. Month Toolbar + Optional Executive Cost Badge */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] border border-blue-200 flex items-center justify-center shrink-0">
            <Calendar size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Thống kê Giờ công &amp; Hiệu suất FTE</h3>
            <p className="text-[11px] text-slate-500">
              Quy chuẩn: 1.0 FTE = 176 giờ/tháng • 1 Man-day = 8 giờ công đã duyệt
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canViewCost && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs tabular">
              <Wallet size={14} className="text-[#1E3A8A] shrink-0" />
              <span className="text-slate-600 font-medium">Ước tính chi phí nhân công tháng:</span>
              <strong className="text-[#1E3A8A]">
                {analytics?.estimatedTotalLaborCost !== null && analytics?.estimatedTotalLaborCost !== undefined
                  ? formatCurrencyVND(analytics.estimatedTotalLaborCost)
                  : 'Chưa cấu hình đơn giá lương'}
              </strong>
            </div>
          )}

          <TechMonthPicker
            id="tech-analytics-month"
            label="Tháng:"
            value={selectedMonth}
            onChange={onChangeMonth}
            align="right"
          />
        </div>
      </div>

      {/* 2. 4 Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Tổng giờ đã duyệt</span>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-[#1E3A8A]">{formatHours(approvedHours)}</p>
            <span className="text-xs font-bold text-slate-600">{approvedManDays} Man-days</span>
          </div>
          <p className="text-[11px] text-slate-400 tabular">
            Kế hoạch phân bổ: {formatHours(analytics?.totalPlannedFteHours ?? 0)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Giờ chờ thẩm định</span>
            {pendingHours > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-orange-600">{formatHours(pendingHours)}</p>
            <span className="text-xs font-semibold text-slate-500">
              {analytics?.totalPendingManDays ?? 0} Man-days
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Từ chối trong tháng: <strong className="text-slate-600 tabular">{formatHours(analytics?.totalRejectedHours ?? 0)}</strong>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Tỷ lệ Billable</span>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-emerald-700">{billablePercent}%</p>
            <span className="text-[11px] font-semibold text-slate-500">
              {formatHours(analytics?.billableApprovedHours ?? 0)} tính phí
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, billablePercent)}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Burn Rate vs Kế hoạch FTE</span>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p
              className={`text-2xl font-extrabold ${
                burnUtilization > 110 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {burnUtilization}%
            </p>
            <span className="text-[11px] font-semibold text-slate-500">
              Nội bộ: {formatHours(analytics?.internalApprovedHours ?? 0)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${burnUtilization > 110 ? 'bg-rose-600' : 'bg-[#1E3A8A]'}`}
              style={{ width: `${Math.min(100, burnUtilization)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Recharts Grouped BarChart: Planned FTE vs Actual Approved Hours */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center shrink-0">
              <BarChart3 size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Đối chiếu Kế hoạch FTE &amp; Giờ công Thực tế ({selectedMonth})
              </h4>
              <p className="text-[11px] text-slate-500">
                So sánh quỹ giờ phân bổ kế hoạch với số giờ đã được nghiệm thu trong tháng
              </p>
            </div>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMode('projects')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                chartMode === 'projects' ? 'bg-white text-[#1E3A8A] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={13} />
              <span>Theo Dự án</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('engineers')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                chartMode === 'engineers' ? 'bg-white text-[#1E3A8A] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={13} />
              <span>Theo Kỹ sư</span>
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Chưa có dữ liệu phân bổ hoặc nhật ký giờ công trong tháng {selectedMonth}.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 8 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip content={<BurnComparisonTooltip mode={chartMode} />} cursor={{ fill: 'rgba(30, 58, 138, 0.04)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                <Bar dataKey="plannedHours" name="Kế hoạch FTE (giờ)" fill="#93C5FD" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="approvedHours" name="Giờ thực tế đã duyệt" fill="#1E3A8A" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 4. Worklog Approval Queue Table */}
      <div
        ref={worklogTableRef}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[#1E3A8A]" />
              <h4 className="text-sm font-bold text-slate-900">
                Nhật ký Giờ công Phòng Công nghệ ({totalElements} bản ghi)
              </h4>
              {worklogsLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 ml-1">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Đang tải...</span>
                </span>
              )}
            </div>

            {!isReadOnly && selectedIds.length > 0 && (
              <button
                type="button"
                disabled={batchSubmitting}
                onClick={handleBatchApprove}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <CheckSquare size={14} />
                <span>
                  {batchSubmitting ? 'Đang duyệt...' : `Duyệt hàng loạt (${selectedIds.length} mục)`}
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Filter size={13} />
              <span>Bộ lọc:</span>
            </div>

            <select
              value={filterProjectId}
              onChange={(e) => updateFilter({ projectId: e.target.value })}
              aria-label="Lọc theo dự án"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả dự án</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  [{p.projectCode}] {p.projectName}
                </option>
              ))}
            </select>

            <select
              value={filterUserId}
              onChange={(e) => updateFilter({ userId: e.target.value })}
              aria-label="Lọc theo kỹ sư"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả kỹ sư</option>
              {benchUsers.map((u) => (
                <option key={u.userId} value={String(u.userId)}>
                  {u.hoTen}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => updateFilter({ status: e.target.value })}
              aria-label="Lọc theo trạng thái duyệt"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ thẩm định</option>
              <option value="APPROVED">Đã phê duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>

            <select
              value={filterAudit}
              onChange={(e) => updateFilter({ auditFilter: e.target.value })}
              aria-label="Lọc theo cảnh báo đối chiếu"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả đối chiếu</option>
              <option value="WARNING_ONLY">Cần kiểm tra ({auditSummary.warningCount})</option>
              <option value="WFH_OT">Có đơn WFH / OT / Nghỉ 1/2 ngày</option>
              <option value="MISSING_EVIDENCE">Thiếu link PR / Jira ({auditSummary.missingEvidenceCount})</option>
              <option value="ALLOCATION_OVERLOAD">Lệch tải phân bổ ({auditSummary.allocationOverloadCount})</option>
              <option value="ATTENDANCE_ISSUE">Bất thường chấm công / Phép ({auditSummary.attendanceIssueCount})</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Xóa lọc
              </button>
            )}
          </div>

          {monthTotalCount > 0 && (
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => updateFilter({ auditFilter: filterAudit === 'WARNING_ONLY' ? '' : 'WARNING_ONLY' })}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer tabular ${
                    filterAudit === 'WARNING_ONLY'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : auditSummary.warningCount > 0
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ShieldAlert size={12} />
                  <span>Cần kiểm tra: {auditSummary.warningCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateFilter({ auditFilter: filterAudit === 'MISSING_EVIDENCE' ? '' : 'MISSING_EVIDENCE' })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer tabular ${
                    filterAudit === 'MISSING_EVIDENCE'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : auditSummary.missingEvidenceCount > 0
                      ? 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Link2Off size={12} />
                  <span>Thiếu PR/Jira: {auditSummary.missingEvidenceCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    updateFilter({ auditFilter: filterAudit === 'ALLOCATION_OVERLOAD' ? '' : 'ALLOCATION_OVERLOAD' })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer tabular ${
                    filterAudit === 'ALLOCATION_OVERLOAD'
                      ? 'bg-orange-600 text-white border-orange-600'
                      : auditSummary.allocationOverloadCount > 0
                      ? 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Gauge size={12} />
                  <span>Lệch tải phân bổ: {auditSummary.allocationOverloadCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateFilter({ auditFilter: filterAudit === 'WFH_OT' ? '' : 'WFH_OT' })}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer tabular ${
                    filterAudit === 'WFH_OT'
                      ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                      : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                  }`}
                >
                  <Home size={12} />
                  <span>WFH / OT / Nghỉ 1/2 ngày hợp lệ: {auditSummary.wfhOrOtCount}</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-400">
                Nhãn cảnh báo chỉ hỗ trợ thẩm định — không chặn duyệt đối với đơn WFH / OT hợp lệ.
              </span>
            </div>
          )}
        </div>

        {filteredWorklogs.length === 0 ? (
          <div className="p-10 text-center space-y-2.5">
            <p className="text-xs text-slate-400">
              Không có nhật ký giờ công nào khớp với điều kiện lọc trong tháng {selectedMonth}.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] border border-blue-200 text-xs font-semibold transition cursor-pointer"
              >
                <span>Xóa bộ lọc để xem toàn bộ</span>
              </button>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${worklogsLoading ? 'opacity-60' : 'opacity-100'}`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {!isReadOnly && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={allSelectableChecked}
                        disabled={selectablePendingIds.length === 0}
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả bản ghi chờ duyệt"
                        className="w-4 h-4 accent-[#1E3A8A] cursor-pointer disabled:opacity-40"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4 whitespace-nowrap">Ngày / Kỹ sư</th>
                  <th className="py-3 px-4">Dự án &amp; Hạng mục</th>
                  <th className="py-3 px-4 whitespace-nowrap">Số giờ</th>
                  <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                  {!isReadOnly && <th className="py-3 px-4 text-right whitespace-nowrap">Thẩm định</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredWorklogs.map((w) => {
                  const typeCfg = WORKLOG_TYPE_CONFIG[w.workType] || {
                    shortLabel: w.workType,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const statusCfg = WORKLOG_STATUS_CONFIG[w.approvalStatus] || {
                    label: w.approvalStatus,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isSelf = String(w.userId) === String(currentUserId);
                  const canApproveRow = !isReadOnly && w.approvalStatus === 'PENDING' && !isSelf;
                  const isHighlighted = highlightedWorklogId === String(w.id);

                  return (
                    <tr
                      key={w.id}
                      id={`tech-worklog-row-${w.id}`}
                      className={`transition-colors duration-500 ${
                        isHighlighted
                          ? 'bg-blue-50/95 ring-2 ring-inset ring-blue-500'
                          : 'hover:bg-blue-50/30'
                      }`}
                    >
                      {!isReadOnly && (
                        <td className="py-3.5 px-4 align-top">
                          {canApproveRow ? (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(w.id)}
                              onChange={() => toggleSelectOne(w.id)}
                              aria-label={`Chọn worklog ${w.id}`}
                              className="w-4 h-4 accent-[#1E3A8A] cursor-pointer mt-0.5"
                            />
                          ) : (
                            <span className="inline-block w-4 h-4" />
                          )}
                        </td>
                      )}

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-bold text-slate-900 tabular">{formatDateVN(w.workDate)}</p>
                        {onInspectEngineer ? (
                          <button
                            type="button"
                            onClick={() => onInspectEngineer(w.userId)}
                            className="font-semibold text-blue-700 hover:underline mt-0.5 cursor-pointer block text-left"
                          >
                            {w.userName}
                          </button>
                        ) : (
                          <p className="font-semibold text-slate-700 mt-0.5">{w.userName}</p>
                        )}
                        {w.userMaNhanVien && (
                          <span className="text-[10px] text-slate-400 tabular">{w.userMaNhanVien}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top max-w-md space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {onSelectProjectById ? (
                            <button
                              type="button"
                              onClick={() => onSelectProjectById(w.projectId)}
                              className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200 hover:bg-[#1E3A8A] hover:text-white transition cursor-pointer"
                            >
                              {w.projectCode}
                            </button>
                          ) : (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {w.projectCode}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${typeCfg.badgeClass}`}>
                            {typeCfg.shortLabel}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                              w.isBillable
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {w.isBillable ? 'Billable' : 'Internal'}
                          </span>
                        </div>

                        {w.milestoneTitle && (
                          <p className="text-[11px] font-semibold text-blue-700">
                            Mốc: {w.milestoneTitle}
                          </p>
                        )}

                        <p className="text-slate-700 leading-relaxed text-pretty">{w.taskSummary}</p>

                        <WorklogAuditBadges
                          worklog={w}
                          expanded={Boolean(expandedAuditIds[w.id])}
                          onToggleExpand={() => toggleExpandAudit(w.id)}
                        />

                        {w.referenceUrl && (
                          <a
                            href={w.referenceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                          >
                            <span>Link PR / Task</span>
                            <ExternalLink size={11} />
                          </a>
                        )}

                        {w.approvalStatus === 'REJECTED' && w.rejectionReason && (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 space-y-0.5">
                            <p className="font-bold text-rose-800">Lý do từ chối:</p>
                            <p className="whitespace-pre-line leading-relaxed">{w.rejectionReason}</p>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap tabular">
                        <span className="text-sm font-extrabold text-[#1E3A8A]">{formatHours(w.hoursSpent)}</span>
                        {w.dailyLoggedHours != null && Number(w.dailyLoggedHours) > Number(w.hoursSpent) && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Tổng ngày: {formatHours(w.dailyLoggedHours)}
                          </p>
                        )}
                        {w.projectAllocationPercent != null && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Giao {w.projectAllocationPercent}% tải
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                        {w.approverName && (
                          <p className="text-[10px] text-slate-400 mt-1">Bởi {w.approverName}</p>
                        )}
                      </td>

                      {!isReadOnly && (
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          {w.approvalStatus === 'PENDING' ? (
                            isSelf ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-semibold"
                                title="Nguyên tắc kiểm soát: Người thực hiện không thể tự duyệt giờ công của chính mình"
                              >
                                <AlertTriangle size={12} />
                                <span>Không tự duyệt</span>
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={processingId === w.id}
                                  onClick={() => handleApproveSingle(w)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Duyệt</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId === w.id}
                                  onClick={() => {
                                    setRejectReason('');
                                    setRejectModal({ isOpen: true, worklog: w });
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                  <XCircle size={12} />
                                  <span>Từ chối</span>
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isServerPaginated && totalElements > 0 && (
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular">
              <span>
                Hiển thị{' '}
                <strong className="text-slate-900">{currentPage * pageSize + 1}</strong> –{' '}
                <strong className="text-slate-900">
                  {Math.min((currentPage + 1) * pageSize, totalElements)}
                </strong>{' '}
                trong tổng số <strong className="text-slate-900">{totalElements}</strong> bản ghi
              </span>

              <div className="inline-flex items-center gap-1.5">
                <label htmlFor="tech-worklog-page-size" className="text-[11px] font-medium text-slate-500">
                  Số dòng:
                </label>
                <select
                  id="tech-worklog-page-size"
                  value={String(pageSize)}
                  disabled={worklogsLoading}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                >
                  <option value="5">5 / trang</option>
                  <option value="10">10 / trang</option>
                  <option value="20">20 / trang</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <nav className="inline-flex items-center gap-1 self-end sm:self-auto" aria-label="Phân trang nhật ký giờ công">
                <button
                  type="button"
                  disabled={currentPage === 0 || worklogsLoading}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  <span className="hidden sm:inline">Trước</span>
                </button>

                {buildPageItems(currentPage, totalPages).map((item, idx) =>
                  typeof item === 'string' ? (
                    <span key={`${item}-${idx}`} className="px-1.5 text-xs text-slate-400 select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      key={`page-${item}`}
                      type="button"
                      disabled={worklogsLoading}
                      onClick={() => handlePageChange(item)}
                      aria-current={item === currentPage ? 'page' : undefined}
                      className={`min-w-[30px] h-[30px] px-2 rounded-lg text-xs font-bold tabular transition cursor-pointer disabled:cursor-not-allowed ${
                        item === currentPage
                          ? 'bg-[#1E3A8A] text-white border border-[#1E3A8A] shadow-2xs'
                          : 'bg-white hover:bg-blue-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {item + 1}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={currentPage >= totalPages - 1 || worklogsLoading}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <span className="hidden sm:inline">Sau</span>
                  <ChevronRight size={14} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>

      {/* Reject Reason Modal (Stacked Portal with Capture-Phase Esc) */}
      {rejectModal.isOpen &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[9995] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeRejectModal();
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-worklog-title"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="bg-[#0F2557] px-5 py-4 text-white flex items-center justify-between">
                <h3 id="reject-worklog-title" className="text-sm font-bold">
                  Từ chối Nhật ký Giờ công
                </h3>
                <button
                  type="button"
                  disabled={rejectSubmitting}
                  onClick={closeRejectModal}
                  className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  aria-label="Đóng"
                >
                  <X size={16} />
                </button>
              </div>

              <form noValidate onSubmit={handleConfirmReject} className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <p className="font-bold text-slate-900">
                    {rejectModal.worklog?.userName} • {formatHours(rejectModal.worklog?.hoursSpent)} ({formatDateVN(rejectModal.worklog?.workDate)})
                  </p>
                  <p className="text-slate-600 line-clamp-2">{rejectModal.worklog?.taskSummary}</p>
                </div>

                {(rejectModal.worklog?.auditAlerts || []).some(
                  (a) => a.severity === 'WARNING' || a.severity === 'DANGER'
                ) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="block text-[11px] font-bold text-slate-600">
                        Điền nhanh từ cảnh báo kiểm tra:
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Mỗi lý do tự tách thành 1 dòng riêng
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(rejectModal.worklog?.auditAlerts || [])
                        .filter((a) => a.severity === 'WARNING' || a.severity === 'DANGER')
                        .map((alert) => {
                          const isSelected = Boolean(alert.detail) && rejectReason.includes(alert.detail.trim());
                          return (
                            <button
                              key={`quick-reject-${alert.code}`}
                              type="button"
                              onClick={() => toggleQuickRejectAlert(alert.detail)}
                              title={isSelected ? 'Bấm để bỏ chọn lý do này' : 'Bấm để thêm thành 1 dòng lý do'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600 shadow-2xs'
                                  : 'bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200'
                              }`}
                            >
                              {isSelected ? <CheckCircle2 size={12} /> : <span>+</span>}
                              <span>{alert.label}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="wl-reject-reason" className="block text-xs font-bold text-slate-700">
                      Lý do từ chối <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 tabular">{rejectReason.length}/500</span>
                  </div>
                  <textarea
                    id="wl-reject-reason"
                    rows={4}
                    maxLength={500}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nhập rõ lý do cần kỹ sư bổ sung mô tả hoặc điều chỉnh số giờ..."
                    className="w-full px-3.5 py-2.5 text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 resize-y"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={rejectSubmitting}
                    onClick={closeRejectModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={rejectSubmitting}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {rejectSubmitting ? 'Đang gửi...' : 'Xác nhận từ chối'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
}

