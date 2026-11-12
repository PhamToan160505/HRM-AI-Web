import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Calendar,
  BarChart3,
  Clock,
  Wallet,
  Layers,
  Users,
  ExternalLink,
  Filter,
  ShieldCheck,
  AlertTriangle,
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
import {
  PROJECT_STATUS_CONFIG,
  WORKLOG_TYPE_CONFIG,
  WORKLOG_STATUS_CONFIG,
  formatDateVN,
  formatHours,
  formatCurrencyVND,
} from './ceoTechHelpers';
import TechMonthPicker from '../components/TechMonthPicker';
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

const getShortName = (fullName) => {
  if (!fullName) return 'Kỹ sư';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
};

function CeoBurnTooltip({ active, payload }) {
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
          <span className="text-[10px] text-blue-200/80 block">Chờ duyệt</span>
          <span className="font-bold text-orange-300">{formatHours(item.pendingHours)}</span>
        </div>
        <div>
          <span className="text-[10px] text-blue-200/80 block">Hiệu suất Burn</span>
          <span className="font-bold text-white">{item.utilizationPercent ?? 0}%</span>
        </div>
      </div>
    </div>
  );
}

export default function CeoTimesheetTab({
  analytics,
  worklogs = [],
  worklogPageData = null,
  worklogQuery = null,
  worklogsLoading = false,
  onChangeWorklogQuery,
  projects = [],
  selectedMonth,
  onChangeMonth,
  onSelectProjectById,
  onInspectEngineer,
}) {
  const isServerPaginated = Boolean(worklogPageData && typeof onChangeWorklogQuery === 'function');
  const worklogTableRef = useRef(null);

  const [chartMode, setChartMode] = useState('projects');
  const [localFilterProjectId, setLocalFilterProjectId] = useState('');
  const [localFilterStatus, setLocalFilterStatus] = useState('');

  const filterProjectId = isServerPaginated ? worklogQuery?.projectId || '' : localFilterProjectId;
  const filterStatus = isServerPaginated ? worklogQuery?.status || '' : localFilterStatus;

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
        if ('status' in patch) setLocalFilterStatus(patch.status);
      }
    },
    [isServerPaginated, onChangeWorklogQuery]
  );

  const clearAllFilters = useCallback(() => {
    updateFilter({ projectId: '', status: '' });
  }, [updateFilter]);

  const filteredWorklogs = useMemo(() => {
    if (isServerPaginated) return worklogs;
    return worklogs.filter((w) => {
      if (filterProjectId && String(w.projectId) !== String(filterProjectId)) return false;
      if (filterStatus && w.approvalStatus !== filterStatus) return false;
      return true;
    });
  }, [isServerPaginated, worklogs, filterProjectId, filterStatus]);

  const totalElements = isServerPaginated
    ? Number(worklogPageData?.totalElements ?? filteredWorklogs.length)
    : filteredWorklogs.length;
  const currentPage = worklogPageData?.number ?? worklogQuery?.page ?? 0;
  const pageSize = worklogPageData?.size ?? worklogQuery?.size ?? 5;
  const totalPages = worklogPageData?.totalPages ?? 0;
  const hasActiveFilters = Boolean(filterProjectId || filterStatus);

  const handlePageChange = (nextPage) => {
    if (!isServerPaginated || worklogsLoading) return;
    const clamped = Math.max(0, Math.min(Math.max(0, totalPages - 1), nextPage));
    if (clamped === currentPage) return;
    onChangeWorklogQuery((prev) => ({ ...(prev || { size: pageSize }), page: clamped }));
    if (worklogTableRef.current) {
      scrollElementIntoViewCleanly(worklogTableRef.current, 'start');
    }
  };

  const handlePageSizeChange = (nextSize) => {
    if (!isServerPaginated || worklogsLoading) return;
    const parsedSize = Number(nextSize) || 5;
    onChangeWorklogQuery((prev) => ({ ...(prev || {}), page: 0, size: parsedSize }));
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
      name: getShortName(u.hoTen),
      fullTitle: u.hoTen,
      subLabel: `${u.chucVu || 'Kỹ sư'} • Phân bổ ${u.allocatedPercent || 0}% tải`,
      plannedHours: u.plannedHours || 0,
      approvedHours: u.approvedHours || 0,
      pendingHours: u.pendingHours || 0,
      utilizationPercent: u.utilizationPercent || 0,
    }));
  }, [analytics, chartMode]);

  const approvedHours = analytics?.totalApprovedHours ?? 0;
  const approvedManDays = analytics?.totalApprovedManDays ?? 0;
  const pendingHours = analytics?.totalPendingHours ?? 0;
  const billablePercent = analytics?.billablePercent ?? 0;
  const burnUtilization = analytics?.burnUtilizationPercent ?? 0;
  const hasEstimatedCost =
    analytics?.canViewCost &&
    analytics?.estimatedTotalLaborCost !== null &&
    analytics?.estimatedTotalLaborCost !== undefined;

  return (
    <div className="space-y-5">
      {/* 1. Executive Month Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] border border-blue-200 flex items-center justify-center shrink-0">
            <Calendar size={17} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Báo cáo Điều hành Giờ công &amp; Chi phí Dự án
            </h3>
            <p className="text-[11px] text-slate-500">
              Quy chuẩn 1.0 FTE = 176h/tháng • Số liệu chi phí tổng hợp theo từng dự án (không hiển thị đơn giá lương cá nhân)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold">
            <ShieldCheck size={13} />
            <span>Chỉ xem</span>
          </span>
          <TechMonthPicker
            id="ceo-analytics-month"
            label="Tháng:"
            value={selectedMonth}
            onChange={onChangeMonth}
            align="right"
          />
        </div>
      </div>

      {/* 2. 4 Executive Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Giờ công đã nghiệm thu</span>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-[#1E3A8A]">{formatHours(approvedHours)}</p>
            <span className="text-xs font-bold text-slate-600">{approvedManDays} Man-days</span>
          </div>
          <p className="text-[11px] text-slate-400 tabular">
            Kế hoạch FTE: {formatHours(analytics?.totalPlannedFteHours ?? 0)}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Tỷ lệ Billable Khách hàng</span>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className="text-2xl font-extrabold text-emerald-700">{billablePercent}%</p>
            <span className="text-[11px] font-semibold text-slate-500">
              {formatHours(analytics?.billableApprovedHours ?? 0)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, billablePercent)}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Hiệu suất Burn vs FTE</span>
          <div className="flex items-baseline justify-between gap-2 tabular">
            <p className={`text-2xl font-extrabold ${burnUtilization > 110 ? 'text-rose-600' : 'text-slate-900'}`}>
              {burnUtilization}%
            </p>
            <span className="text-[11px] font-semibold text-orange-600">
              Chờ duyệt: {formatHours(pendingHours)}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${burnUtilization > 110 ? 'bg-rose-600' : 'bg-[#1E3A8A]'}`}
              style={{ width: `${Math.min(100, burnUtilization)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Wallet size={13} className="text-[#1E3A8A]" />
            <span>Ước tính Chi phí Nhân công</span>
          </span>
          <div className="tabular">
            {hasEstimatedCost ? (
              <p className="text-xl font-extrabold text-slate-900">
                {formatCurrencyVND(analytics.estimatedTotalLaborCost)}
              </p>
            ) : (
              <p className="text-sm font-bold text-slate-600 pt-1">
                {approvedManDays} Man-days (Chưa cấu hình đơn giá lương)
              </p>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Tính trên giờ công đã phê duyệt trong tháng
          </p>
        </div>
      </div>

      {/* 3. Recharts Grouped BarChart */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center shrink-0">
              <BarChart3 size={16} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                So sánh Kế hoạch FTE &amp; Giờ công Thực tế ({selectedMonth})
              </h4>
              <p className="text-[11px] text-slate-500">
                Đánh giá mức độ tiêu thụ công suất so với kế hoạch phân bổ nhân sự
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
            Chưa có dữ liệu giờ công trong tháng {selectedMonth}.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: -12, bottom: 8 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip content={<CeoBurnTooltip />} cursor={{ fill: 'rgba(30, 58, 138, 0.04)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                <Bar dataKey="plannedHours" name="Kế hoạch FTE (giờ)" fill="#93C5FD" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="approvedHours" name="Giờ thực tế đã duyệt" fill="#1E3A8A" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 4. Project Burn-Rate & Milestones Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Tổng hợp Burn-Rate &amp; Chi phí cấp Dự án ({analytics?.projectBreakdowns?.length || 0} dự án)
            </h4>
            <p className="text-[11px] text-slate-500">
              Bấm vào tên dự án để mở chi tiết Milestones và AI Đánh giá Sức khỏe Dự án
            </p>
          </div>
        </div>

        {!analytics?.projectBreakdowns?.length ? (
          <div className="p-8 text-center text-xs text-slate-400">Chưa có dữ liệu dự án.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Dự án</th>
                  <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                  <th className="py-3 px-4 whitespace-nowrap">Nghiệm thu Mốc</th>
                  <th className="py-3 px-4 whitespace-nowrap">Kế hoạch / Thực tế</th>
                  <th className="py-3 px-4 whitespace-nowrap">Man-days</th>
                  <th className="py-3 px-4 whitespace-nowrap">Ước tính Chi phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {analytics.projectBreakdowns.map((item) => {
                  const statusCfg = PROJECT_STATUS_CONFIG[item.status] || {
                    label: item.status,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <tr
                      key={item.projectId}
                      onClick={() => onSelectProjectById && onSelectProjectById(item.projectId)}
                      className="hover:bg-blue-50/40 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {item.projectCode}
                          </span>
                          <span className="font-bold text-slate-900">{item.projectName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1E3A8A]">
                            {item.actualProgressPercent !== null && item.actualProgressPercent !== undefined
                              ? `${item.actualProgressPercent}%`
                              : 'Chưa có mốc'}
                          </span>
                          {item.overdueMilestonesCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                              <AlertTriangle size={10} /> {item.overdueMilestonesCount} quá hạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular">
                        <span className="font-semibold text-slate-500">{formatHours(item.plannedFteHours)}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <strong className="text-[#1E3A8A]">{formatHours(item.actualApprovedHours)}</strong>
                        <span className="text-[11px] text-slate-500 ml-1">({item.burnUtilizationPercent}%)</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular font-semibold text-slate-800">
                        {item.approvedManDays} ngày
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular">
                        {item.hasSalaryData && item.estimatedLaborCost !== null ? (
                          <strong className="text-slate-900">{formatCurrencyVND(item.estimatedLaborCost)}</strong>
                        ) : (
                          <span className="text-slate-400 italic">Chưa cấu hình lương</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Read-Only Worklog Audit Log */}
      <div
        ref={worklogTableRef}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#1E3A8A]" />
            <h4 className="text-sm font-bold text-slate-900">
              Tra cứu Nhật ký Giờ công ({totalElements} bản ghi)
            </h4>
            {worklogsLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 ml-1">
                <Loader2 size={12} className="animate-spin" />
                <span>Đang tải...</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter size={13} className="text-slate-400" />
            <select
              value={filterProjectId}
              onChange={(e) => updateFilter({ projectId: e.target.value })}
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
              value={filterStatus}
              onChange={(e) => updateFilter({ status: e.target.value })}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="APPROVED">Đã phê duyệt</option>
              <option value="PENDING">Chờ thẩm định</option>
              <option value="REJECTED">Từ chối</option>
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
        </div>

        {filteredWorklogs.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-slate-400">
              Không có nhật ký giờ công nào trong tháng {selectedMonth}.
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
                  <th className="py-3 px-4 whitespace-nowrap">Ngày / Kỹ sư</th>
                  <th className="py-3 px-4">Dự án &amp; Nội dung</th>
                  <th className="py-3 px-4 whitespace-nowrap">Số giờ</th>
                  <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
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
                  return (
                    <tr key={w.id} className="hover:bg-blue-50/30 transition">
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <p className="font-bold text-slate-900 tabular">{formatDateVN(w.workDate)}</p>
                        <button
                          type="button"
                          onClick={() => onInspectEngineer && onInspectEngineer(w.userId)}
                          className="font-semibold text-blue-700 hover:underline mt-0.5 cursor-pointer"
                        >
                          {w.userName}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-lg space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onSelectProjectById && onSelectProjectById(w.projectId)}
                            className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200 hover:bg-[#1E3A8A] hover:text-white transition cursor-pointer"
                          >
                            {w.projectCode}
                          </button>
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
                        <p className="text-slate-700 leading-relaxed text-pretty">{w.taskSummary}</p>
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
                        <strong className="text-sm text-[#1E3A8A]">{formatHours(w.hoursSpent)}</strong>
                      </td>
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </td>
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
                <label htmlFor="ceo-worklog-page-size" className="text-[11px] font-medium text-slate-500">
                  Số dòng:
                </label>
                <select
                  id="ceo-worklog-page-size"
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
              <nav className="inline-flex items-center gap-1 self-end sm:self-auto" aria-label="Phân trang nhật ký giờ công CEO">
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
                      key={`ceo-page-${item}`}
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
    </div>
  );
}

