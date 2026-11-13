import React, { useState, useMemo } from 'react';
import {
  Search,
  FolderGit2,
  Calendar,
  GitBranch,
  Kanban,
  Palette,
  Eye,
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  Table2,
  UserCheck,
  UserPlus,
  Edit3,
  Trash2,
  Users,
  X,
  ArrowUpRight,
  Plus,
  Flag,
  Clock,
  Award,
  Bell,
} from 'lucide-react';
import {
  PROJECT_STATUS_CONFIG,
  formatDateVN,
  formatHours,
  computeTimelineHealth,
  getCertExpiryInfo,
} from '../techHelpers';

export default function ProjectsPortfolioTab({
  projects = [],
  statusFilter = '',
  onChangeStatusFilter,
  onSelectProject,
  onOpenStaffing,
  onOpenEdit,
  onRequestDelete,
  onOpenCreate,
  isReadOnly = false,
  expiringCerts = [],
  onRemindCert,
  remindingCertId = null,
  onInspectEngineer,
}) {
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Tín hiệu cần chú ý cho Giám đốc / Trưởng phòng điều hành
  const attentionSignals = useMemo(() => {
    const signals = [];
    projects.forEach((p) => {
      if (p.status === 'COMPLETED' || p.status === 'PAUSED') return;

      const timeline = computeTimelineHealth(p);
      const activeMembers = (p.members || []).filter((m) => m.isActive);
      const overloadedCount = activeMembers.filter(
        (m) => m.isOverloaded || (m.totalCurrentAllocation && m.totalCurrentAllocation > 100)
      ).length;

      if (timeline.tone === 'overdue') {
        signals.push({
          key: `overdue-${p.id}`,
          severity: 'high',
          badge: timeline.text,
          reason: 'Chưa hoàn tất theo hạn chót',
          project: p,
        });
      } else if (timeline.tone === 'dueSoon') {
        signals.push({
          key: `duesoon-${p.id}`,
          severity: 'medium',
          badge: timeline.text,
          reason: 'Sắp chạm mốc bàn giao',
          project: p,
        });
      }

      if (overloadedCount > 0) {
        signals.push({
          key: `overload-${p.id}`,
          severity: 'high',
          badge: `${overloadedCount} kỹ sư >100%`,
          reason: 'Có nhân sự đang quá tải công việc',
          project: p,
        });
      }

      if (p.status === 'IN_PROGRESS' && activeMembers.length === 0) {
        signals.push({
          key: `empty-${p.id}`,
          severity: 'high',
          badge: '0 nhân sự',
          reason: 'Dự án đang phát triển nhưng chưa có kỹ sư',
          project: p,
        });
      }

      if (!p.techLeadName) {
        signals.push({
          key: `lead-${p.id}`,
          severity: 'medium',
          badge: 'Thiếu Lead',
          reason: 'Chưa chỉ định Tech Lead phụ trách',
          project: p,
        });
      }

      if ((p.overdueMilestonesCount || 0) > 0) {
        signals.push({
          key: `ms-overdue-${p.id}`,
          severity: 'high',
          badge: `${p.overdueMilestonesCount} mốc quá hạn`,
          reason: 'Mốc bàn giao (Milestone) đã vượt hạn chót',
          project: p,
        });
      } else if ((p.dueSoonMilestonesCount || 0) > 0) {
        signals.push({
          key: `ms-duesoon-${p.id}`,
          severity: 'medium',
          badge: `${p.dueSoonMilestonesCount} mốc sắp hạn`,
          reason: 'Có mốc nghiệm thu sắp đến hạn trong 7 ngày',
          project: p,
        });
      }
    });

    return signals.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (typeFilter && p.projectType !== typeFilter) return false;
      if (!kw) return true;

      const matchName = p.projectName?.toLowerCase().includes(kw);
      const matchCode = p.projectCode?.toLowerCase().includes(kw);
      const matchLead = p.techLeadName?.toLowerCase().includes(kw);
      const matchTech = (p.techStack || []).some((t) => t.toLowerCase().includes(kw));
      return matchName || matchCode || matchLead || matchTech;
    });
  }, [projects, statusFilter, typeFilter, keyword]);

  const statusTabs = [
    { key: '', label: 'Tất cả', count: projects.length },
    {
      key: 'IN_PROGRESS',
      label: 'Đang phát triển',
      count: projects.filter((p) => p.status === 'IN_PROGRESS').length,
    },
    {
      key: 'PLANNING',
      label: 'Lên kế hoạch',
      count: projects.filter((p) => p.status === 'PLANNING').length,
    },
    {
      key: 'MAINTENANCE',
      label: 'Bảo trì',
      count: projects.filter((p) => p.status === 'MAINTENANCE').length,
    },
    {
      key: 'COMPLETED',
      label: 'Hoàn thành',
      count: projects.filter((p) => p.status === 'COMPLETED').length,
    },
    {
      key: 'PAUSED',
      label: 'Tạm dừng',
      count: projects.filter((p) => p.status === 'PAUSED').length,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 1. Radar Cảnh báo Vận hành */}
      {attentionSignals.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(30,58,138,0.05)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tín hiệu Cần Xử lý Vận hành ({attentionSignals.length})
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp dự án quá hạn, thiếu Tech Lead hoặc nhân sự vượt tải • Bấm vào thẻ để xem chi tiết và điều phối
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {attentionSignals.slice(0, 6).map((sig) => {
              const isHigh = sig.severity === 'high';
              return (
                <button
                  type="button"
                  key={sig.key}
                  onClick={() => onSelectProject(sig.project)}
                  className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-2.5 cursor-pointer group ${
                    isHigh
                      ? 'bg-rose-50/45 border-rose-200/90 hover:border-rose-400 hover:bg-rose-50/75'
                      : 'bg-orange-50/45 border-orange-200/90 hover:border-orange-400 hover:bg-orange-50/75'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-slate-600">
                        {sig.project.projectCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          isHigh
                            ? 'bg-rose-100/80 text-rose-700 border-rose-200'
                            : 'bg-orange-100/80 text-orange-700 border-orange-200'
                        }`}
                      >
                        {sig.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                      {sig.project.projectName}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">{sig.reason}</p>
                  </div>
                  <ArrowUpRight size={15} className="text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        projects.length > 0 && (
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl px-4 py-3 flex items-center gap-3 text-xs text-emerald-900">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Danh mục dự án ổn định:</strong> Hiện chưa phát hiện dự án quá hạn, thiếu Tech Lead hay kỹ sư vượt ngưỡng công suất.
            </span>
          </div>
        )
      )}

      {/* 1b. Radar Tuân thủ Chứng chỉ Quốc tế (Sắp hết hạn / Hết hạn trong 30 ngày) */}
      {expiringCerts.length > 0 && (
        <div className="bg-white rounded-2xl border border-orange-200/90 shadow-[0_4px_20px_-4px_rgba(234,88,12,0.06)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shrink-0">
                <Award size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Radar Gia hạn Chứng chỉ Kỹ sư ({expiringCerts.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Theo dõi chứng chỉ sắp hết hạn trong 30 ngày tới hoặc đã hết hạn để đảm bảo tiêu chuẩn dự án &amp; điểm Năng lực đánh giá kỳ
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {expiringCerts.map((cert) => {
              const expInfo = getCertExpiryInfo(cert);
              const isExpired = expInfo.status === 'EXPIRED';
              return (
                <div
                  key={`radar-cert-${cert.certId}`}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 text-xs ${
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
                    <div className="flex justify-end pt-1.5 border-t border-slate-200/60">
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

      {/* 2. Filter & View Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm tên dự án, mã PRJ-, công nghệ, Tech Lead..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/60 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                aria-label="Xóa từ khóa"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Lọc theo loại dự án"
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Tất cả loại hình</option>
              <option value="INTERNAL">Sản phẩm Nội bộ</option>
              <option value="CLIENT">Dự án Khách hàng</option>
            </select>

            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={14} />
                <span>Thẻ điều hành</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table2 size={14} />
                <span>Bảng tổng hợp</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                type="button"
                key={tab.key || 'all'}
                onClick={() => onChangeStatusFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  active
                    ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full tabular ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Empty State or Content */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-2.5">
          <FolderGit2 size={38} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">Chưa tìm thấy dự án nào phù hợp</p>
          <p className="text-xs text-slate-400">
            {projects.length === 0 && !isReadOnly
              ? 'Bấm "Khởi tạo Dự án Mới" để tạo dự án đầu tiên cho Phòng Công nghệ.'
              : 'Hãy thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm khác.'}
          </p>
          {projects.length === 0 && !isReadOnly && onOpenCreate && (
            <button
              type="button"
              onClick={onOpenCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Khởi tạo Dự án Mới</span>
            </button>
          )}
          {(statusFilter || typeFilter || keyword) && (
            <button
              type="button"
              onClick={() => {
                setKeyword('');
                setTypeFilter('');
                onChangeStatusFilter('');
              }}
              className="mt-2 px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition cursor-pointer"
            >
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* GRID CARD VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const statusInfo = PROJECT_STATUS_CONFIG[project.status] || {
              label: project.status,
              badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
            };
            const activeMembers = (project.members || []).filter((m) => m.isActive);
            const timeline = computeTimelineHealth(project);
            const fte = ((project.totalAllocationSum || 0) / 100).toFixed(1);
            const techList = project.techStack || [];
            const visibleTech = techList.slice(0, 5);
            const extraTechCount = Math.max(0, techList.length - visibleTech.length);

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectProject(project);
                  }
                }}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_-6px_rgba(37,99,235,0.14)] transition flex flex-col overflow-hidden group cursor-pointer text-left"
              >
                <div className="p-5 flex-1 space-y-4">
                  {/* Top Badges & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular">
                          {project.projectCode}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            project.projectType === 'INTERNAL'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {project.projectType === 'INTERNAL' ? 'Sản phẩm Nội bộ' : 'Dự án Khách hàng'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                        {project.projectName}
                      </h3>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap ${statusInfo.badgeClass}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed min-h-[2.25rem]">
                    {project.description || 'Chưa có mô tả chi tiết cho dự án này.'}
                  </p>

                  {/* Tech Stack */}
                  {techList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {visibleTech.map((tech, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/80"
                        >
                          {tech}
                        </span>
                      ))}
                      {extraTechCount > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 tabular">
                          +{extraTechCount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Timeline & Lead */}
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium tabular">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>
                          {formatDateVN(project.startDate)} → {formatDateVN(project.endDate)}
                        </span>
                      </span>
                      <span
                        className={`font-bold tabular whitespace-nowrap ${
                          timeline.tone === 'overdue'
                            ? 'text-rose-600'
                            : timeline.tone === 'dueSoon'
                            ? 'text-orange-600'
                            : timeline.tone === 'completed'
                            ? 'text-blue-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {timeline.text}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          timeline.tone === 'overdue'
                            ? 'bg-rose-500'
                            : timeline.tone === 'dueSoon'
                            ? 'bg-orange-500'
                            : timeline.tone === 'completed'
                            ? 'bg-emerald-600'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${timeline.elapsedPercent}%` }}
                      />
                    </div>

                    {/* Milestone Delivery & Approved Hours Pill Row */}
                    {(project.milestonesCount > 0 || (project.totalApprovedHours || 0) > 0) && (
                      <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5 border-t border-slate-200/60 tabular">
                        <span className="inline-flex items-center gap-1 text-[#1E3A8A] font-semibold">
                          <Flag size={11} className="shrink-0" />
                          <span>
                            {project.actualProgressPercent !== null && project.actualProgressPercent !== undefined
                              ? `Nghiệm thu: ${project.actualProgressPercent}% (${project.completedMilestonesCount || 0}/${project.milestonesCount} mốc)`
                              : 'Chưa có mốc'}
                          </span>
                          {(project.overdueMilestonesCount || 0) > 0 && (
                            <span className="text-[10px] font-bold text-rose-600">
                              • {project.overdueMilestonesCount} quá hạn
                            </span>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          <span>{formatHours(project.totalApprovedHours || 0)} đã duyệt</span>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 truncate">
                        <UserCheck size={13} className="text-blue-600 shrink-0" />
                        <span className="truncate">
                          Lead:{' '}
                          <strong className={project.techLeadName ? 'text-slate-900' : 'text-orange-600'}>
                            {project.techLeadName || 'Chưa chỉ định'}
                          </strong>
                        </span>
                      </span>

                      <div className="flex items-center gap-2 shrink-0 text-slate-500">
                        {project.gitRepoUrl && (
                          <a
                            href={project.gitRepoUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                            title="Mở Git Repo"
                          >
                            <GitBranch size={12} />
                            <span>Git</span>
                          </a>
                        )}
                        {project.jiraUrl && (
                          <a
                            href={project.jiraUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                            title="Mở Jira Board"
                          >
                            <Kanban size={12} />
                            <span>Jira</span>
                          </a>
                        )}
                        {project.figmaUrl && (
                          <a
                            href={project.figmaUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                            title="Mở Figma"
                          >
                            <Palette size={12} />
                            <span>Figma</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer with Operational Actions */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                      {activeMembers.slice(0, 4).map((m, idx) => (
                        <div
                          key={idx}
                          title={`${m.userName} (${m.allocationPercent}%)`}
                          className="w-7 h-7 rounded-full bg-[#1E3A8A] text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white"
                        >
                          {m.userName ? m.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                      ))}
                      {activeMembers.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center ring-2 ring-white tabular">
                          +{activeMembers.length - 4}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 truncate tabular">
                      {activeMembers.length} kỹ sư • {project.totalAllocationSum || 0}% (~{fte} FTE)
                    </span>
                  </div>

                  {isReadOnly ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(project);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Xem chi tiết</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(project);
                        }}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                        title="Xem chi tiết dự án"
                        aria-label="Xem chi tiết dự án"
                      >
                        <Eye size={15} />
                      </button>

                      {onOpenStaffing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenStaffing(project);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-[#1E3A8A] text-[#1E3A8A] hover:text-white border border-blue-200 hover:border-[#1E3A8A] rounded-xl shadow-2xs transition flex items-center gap-1 whitespace-nowrap cursor-pointer"
                        >
                          <UserPlus size={13} />
                          <span>Phân bổ</span>
                        </button>
                      )}

                      {onOpenEdit && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEdit(project);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                          title="Chỉnh sửa dự án"
                          aria-label="Chỉnh sửa dự án"
                        >
                          <Edit3 size={15} />
                        </button>
                      )}

                      {onRequestDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestDelete(project.id, project.projectName);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Xóa dự án"
                          aria-label="Xóa dự án"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Dự án</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Tech Lead</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Nhân sự &amp; FTE</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Mốc hạn &amp; Tiến độ</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredProjects.map((project) => {
                  const statusInfo = PROJECT_STATUS_CONFIG[project.status] || {
                    label: project.status,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const activeMembers = (project.members || []).filter((m) => m.isActive);
                  const timeline = computeTimelineHealth(project);
                  const fte = ((project.totalAllocationSum || 0) / 100).toFixed(1);

                  return (
                    <tr
                      key={project.id}
                      onClick={() => onSelectProject(project)}
                      className="hover:bg-blue-50/40 transition cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {project.projectCode}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {project.projectType === 'INTERNAL' ? 'Nội bộ' : 'Khách hàng'}
                            </span>
                          </div>
                          <p className="font-bold text-slate-900 truncate">{project.projectName}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={project.techLeadName ? 'font-semibold text-slate-800' : 'text-orange-600 font-semibold'}>
                          {project.techLeadName || 'Chưa chỉ định'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap tabular">
                        <div className="flex items-center gap-2">
                          <Users size={13} className="text-blue-600 shrink-0" />
                          <span className="font-bold text-slate-900">{activeMembers.length} người</span>
                          <span className="text-slate-500">
                            ({project.totalAllocationSum || 0}% / ~{fte} FTE)
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap tabular">
                        <div>
                          <p className="font-medium text-slate-800">
                            {formatDateVN(project.startDate)} → {formatDateVN(project.endDate)}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] mt-0.5">
                            <span
                              className={`font-semibold ${
                                timeline.tone === 'overdue'
                                  ? 'text-rose-600'
                                  : timeline.tone === 'dueSoon'
                                  ? 'text-orange-600'
                                  : timeline.tone === 'completed'
                                  ? 'text-blue-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {timeline.text}
                            </span>
                            {project.actualProgressPercent !== null && project.actualProgressPercent !== undefined && (
                              <span className="font-bold text-[#1E3A8A]">
                                • Mốc: {project.actualProgressPercent}%
                              </span>
                            )}
                            {(project.totalApprovedHours || 0) > 0 && (
                              <span className="text-slate-500">
                                • {formatHours(project.totalApprovedHours)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.badgeClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProject(project);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Xem chi tiết"
                          >
                            <Eye size={14} />
                          </button>

                          {!isReadOnly && onOpenStaffing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenStaffing(project);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-[#1E3A8A] hover:text-white border border-blue-200 rounded-lg transition cursor-pointer whitespace-nowrap"
                            >
                              <UserPlus size={12} />
                              <span>Phân bổ</span>
                            </button>
                          )}

                          {!isReadOnly && onOpenEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEdit(project);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}

                          {!isReadOnly && onRequestDelete && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRequestDelete(project.id, project.projectName);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa dự án"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

