import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Calendar,
  Code2,
  Users,
  GitBranch,
  Kanban,
  Palette,
  ExternalLink,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  UserPlus,
  FileText,
  Clock,
  Layers,
  Activity,
  ChevronRight,
  Flag,
  Plus,
  Trash2,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import MilestoneFormModal from './MilestoneFormModal';
import ProjectHealthPanel from './ProjectHealthPanel';
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_ROLE_LABELS,
  MILESTONE_STATUS_CONFIG,
  formatDateVN,
  formatDateTimeVN,
  formatHours,
  computeTimelineHealth,
} from '../techHelpers';

export default function ProjectDetailModal({
  isOpen,
  onClose,
  project,
  onOpenStaffing,
  onOpenEdit,
  onInspectEngineer,
  hasTopModalOpen = false,
  canManageMilestones = false,
  canAnalyzeHealth = false,
  onProjectDataUpdated,
}) {
  const toast = useToast();
  const [projectData, setProjectData] = useState(project);
  const [milestoneSummary, setMilestoneSummary] = useState(null);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Milestone CRUD state
  const [isMilestoneFormOpen, setIsMilestoneFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState(null);
  const [deletingMilestone, setDeletingMilestone] = useState(false);
  const [completingMilestoneId, setCompletingMilestoneId] = useState(null);

  const fetchFreshDetail = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      setRefreshing(true);
      setLoadingMilestones(true);
      const [projRes, msRes] = await Promise.allSettled([
        api.get(`/api/tech/projects/${projectId}`),
        api.get(`/api/tech/projects/${projectId}/milestones`),
      ]);
      if (projRes.status === 'fulfilled' && projRes.value?.data?.data) {
        setProjectData(projRes.value.data.data);
      }
      if (msRes.status === 'fulfilled' && msRes.value?.data?.data) {
        setMilestoneSummary(msRes.value.data.data);
      }
    } catch (err) {
      console.error('Không thể tải chi tiết dự án mới nhất:', err);
    } finally {
      setRefreshing(false);
      setLoadingMilestones(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && project?.id) {
      setProjectData(project);
      setMilestoneSummary(null);
      setIsMilestoneFormOpen(false);
      setEditingMilestone(null);
      setDeleteMilestoneTarget(null);
      fetchFreshDetail(project.id);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [isOpen, project, fetchFreshDetail]);

  const effectiveTopModalOpen = hasTopModalOpen || isMilestoneFormOpen || !!deleteMilestoneTarget;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !effectiveTopModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, effectiveTopModalOpen, onClose]);

  useEffect(() => {
    if (!deleteMilestoneTarget) return;
    const handleDeleteEsc = (e) => {
      if (e.key === 'Escape' && !deletingMilestone) {
        e.stopPropagation();
        setDeleteMilestoneTarget(null);
      }
    };
    window.addEventListener('keydown', handleDeleteEsc, true);
    return () => window.removeEventListener('keydown', handleDeleteEsc, true);
  }, [deleteMilestoneTarget, deletingMilestone]);

  const refreshAfterMilestoneChange = async () => {
    if (!projectData?.id) return;
    await fetchFreshDetail(projectData.id);
    if (onProjectDataUpdated) await onProjectDataUpdated();
  };

  const handleQuickCompleteMilestone = async (ms) => {
    if (!canManageMilestones || completingMilestoneId) return;
    try {
      setCompletingMilestoneId(ms.id);
      await api.put(`/api/tech/projects/${projectData.id}/milestones/${ms.id}`, {
        title: ms.title,
        description: ms.description,
        dueDate: ms.dueDate,
        status: 'COMPLETED',
        weightPercent: ms.weightPercent ?? 0,
        completionPercent: 100,
        deliverableUrl: ms.deliverableUrl,
      });
      toast?.show('Thành công', `Đã nghiệm thu hoàn tất 100% mốc "${ms.title}"`, 'success');
      await refreshAfterMilestoneChange();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể nghiệm thu mốc tiến độ', 'error');
    } finally {
      setCompletingMilestoneId(null);
    }
  };

  const handleConfirmDeleteMilestone = async () => {
    if (!deleteMilestoneTarget || deletingMilestone) return;
    try {
      setDeletingMilestone(true);
      await api.delete(`/api/tech/projects/${projectData.id}/milestones/${deleteMilestoneTarget.id}`);
      toast?.show('Đã xóa', `Đã xóa mốc "${deleteMilestoneTarget.title}"`, 'success');
      setDeleteMilestoneTarget(null);
      await refreshAfterMilestoneChange();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa mốc tiến độ', 'error');
    } finally {
      setDeletingMilestone(false);
    }
  };

  if (!isOpen || !projectData) return null;

  const statusInfo = PROJECT_STATUS_CONFIG[projectData.status] || {
    label: projectData.status,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const members = projectData.members || [];
  const activeMembers = members.filter((m) => m.isActive);
  const formerMembers = members.filter((m) => !m.isActive);
  const overloadedMembers = activeMembers.filter(
    (m) => m.isOverloaded || (m.totalCurrentAllocation && m.totalCurrentAllocation > 100)
  );
  const hasOverload = overloadedMembers.length > 0;
  const fteEquivalent = ((projectData.totalAllocationSum || 0) / 100).toFixed(1);
  const timeline = computeTimelineHealth(projectData);

  const milestones = milestoneSummary?.milestones || [];
  const actualProgress =
    milestoneSummary?.actualProgressPercent ?? projectData.actualProgressPercent ?? null;
  const totalWeightPercent = milestoneSummary?.totalWeightPercent ?? 0;
  const completedMsCount = milestoneSummary?.completedCount ?? projectData.completedMilestonesCount ?? 0;
  const totalMsCount = milestoneSummary?.totalCount ?? projectData.milestonesCount ?? milestones.length;
  const usedWeightByOthers = editingMilestone
    ? Math.max(0, totalWeightPercent - (editingMilestone.weightPercent || 0))
    : totalWeightPercent;

  return (
    <>
      {createPortal(
        <div
          data-tech-modal="true"
          className="fixed inset-0 z-[9980] bg-slate-900/55 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tech-project-detail-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header — Corporate Deep Sapphire */}
        <div className="bg-[#0F2557] px-6 py-5 text-white flex items-start justify-between gap-4 shrink-0 border-b border-blue-900/60">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-white/10 text-blue-100 border border-white/20 tabular">
                {projectData.projectCode}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-100 border border-blue-400/30">
                {projectData.projectType === 'INTERNAL' ? 'Sản phẩm Nội bộ' : 'Dự án Khách hàng'}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
              {refreshing && (
                <span className="text-[10px] text-blue-200/80 ml-1">Đang đồng bộ...</span>
              )}
            </div>

            <h2
              id="tech-project-detail-title"
              className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug text-balance"
            >
              {projectData.projectName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100/75 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
            title="Đóng cửa sổ (Esc)"
            aria-label="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 4 Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <UserCheck size={13} className="text-blue-600 shrink-0" />
                <span>Tech Lead</span>
              </span>
              <p className="text-xs font-bold text-slate-900 truncate" title={projectData.techLeadName || 'Chưa chỉ định'}>
                {projectData.techLeadName || 'Chưa chỉ định'}
              </p>
              {!projectData.techLeadName && (
                <span className="text-[10px] font-semibold text-orange-600 block">Cần bổ nhiệm Lead</span>
              )}
            </div>

            <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-600 shrink-0" />
                <span>Mốc thời gian</span>
              </span>
              <p className="text-xs font-bold text-slate-900 tabular">
                {formatDateVN(projectData.startDate)} → {formatDateVN(projectData.endDate)}
              </p>
              <span
                className={`text-[10px] font-semibold block tabular ${
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

            <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Users size={13} className="text-blue-600 shrink-0" />
                <span>Quy mô nhân sự</span>
              </span>
              <p className="text-xs font-bold text-slate-900 tabular">
                {activeMembers.length} kỹ sư{' '}
                <span className="text-[11px] text-slate-500 font-normal">đang tham gia</span>
              </p>
              {formerMembers.length > 0 && (
                <span className="text-[10px] text-slate-400 tabular block">
                  {formerMembers.length} lượt đã luân chuyển
                </span>
              )}
            </div>

            <div className="p-3.5 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Activity size={13} className="text-blue-600 shrink-0" />
                <span>Công suất huy động</span>
              </span>
              <div className="flex items-baseline gap-1.5 tabular">
                <span className="text-sm font-extrabold text-blue-700">
                  {projectData.totalAllocationSum || 0}%
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  (~{fteEquivalent} FTE)
                </span>
              </div>
              {hasOverload ? (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 pt-0.5">
                  <AlertTriangle size={11} className="shrink-0" />
                  <span>{overloadedMembers.length} kỹ sư vượt 100% tải</span>
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1 pt-0.5">
                  <CheckCircle2 size={11} className="shrink-0" />
                  <span>Tải các kỹ sư cân đối</span>
                </span>
              )}
            </div>
          </div>

          {/* Tiến độ Kép: Nghiệm thu Milestones vs Chu kỳ Lịch trình */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Flag size={13} className="text-[#1E3A8A] shrink-0" />
                  <span>Tiến độ Nghiệm thu Thực tế (Milestones)</span>
                </span>
                <span className="font-bold text-[#1E3A8A] tabular">
                  {actualProgress !== null
                    ? `${actualProgress}% (${completedMsCount}/${totalMsCount} mốc)`
                    : 'Chưa thiết lập mốc'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white border border-blue-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1E3A8A] transition-all duration-300"
                  style={{ width: `${actualProgress ?? 0}%` }}
                />
              </div>
            </div>

            {projectData.startDate && projectData.endDate && (
              <div className="space-y-1.5 pt-1 border-t border-blue-100/80">
                <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                  <span className="font-semibold text-slate-700">Độ phủ lịch trình thực hiện</span>
                  <span className="font-bold text-blue-700 tabular">
                    {timeline.elapsedPercent}% chu kỳ thời gian
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white border border-blue-100 overflow-hidden">
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
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-blue-100/80 flex-wrap gap-2 tabular">
              <span>
                Giờ công đã duyệt:{' '}
                <strong className="text-[#1E3A8A]">
                  {formatHours(projectData.totalApprovedHours || 0)}
                </strong>
              </span>
              {(projectData.totalPendingHours || 0) > 0 && (
                <span className="text-orange-700 font-semibold">
                  Chờ thẩm định: {formatHours(projectData.totalPendingHours)}
                </span>
              )}
            </div>
          </div>

          {/* Mốc Tiến độ & Bàn giao (Milestones) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Flag size={14} className="text-blue-600" />
                  <span>Mốc Tiến độ &amp; Bàn giao ({totalMsCount} mốc)</span>
                </h4>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 tabular whitespace-nowrap">
                  Trọng số: {totalWeightPercent}% / 100%
                </span>
              </div>

              {canManageMilestones && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMilestone(null);
                    setIsMilestoneFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition cursor-pointer whitespace-nowrap"
                >
                  <Plus size={13} />
                  <span>Thêm mốc</span>
                </button>
              )}
            </div>

            {loadingMilestones && milestones.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500">
                Đang tải danh sách mốc tiến độ...
              </div>
            ) : milestones.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Dự án này chưa có mốc nghiệm thu (Milestone) nào được thiết lập.
                </p>
                {canManageMilestones && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMilestone(null);
                      setIsMilestoneFormOpen(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-[#1E3A8A] border border-blue-200 text-xs font-bold transition cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Thiết lập mốc đầu tiên</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {milestones.map((ms) => {
                  const msCfg = MILESTONE_STATUS_CONFIG[ms.status] || {
                    label: ms.status,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <div
                      key={ms.id}
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-white space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${msCfg.badgeClass}`}
                            >
                              {msCfg.label}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200 tabular whitespace-nowrap shrink-0">
                              Trọng số {ms.weightPercent}%
                            </span>
                            {ms.isOverdue && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                                Quá hạn mốc
                              </span>
                            )}
                            {!ms.isOverdue && ms.isDueSoon && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap shrink-0">
                                Sắp đến hạn
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-bold text-slate-900">{ms.title}</h5>
                          {ms.description && (
                            <p className="text-[11px] text-slate-600 leading-relaxed text-pretty">
                              {ms.description}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-1 tabular">
                          <p className="text-xs font-extrabold text-[#1E3A8A]">{ms.completionPercent}%</p>
                          <p className="text-[11px] text-slate-500">Hạn: {formatDateVN(ms.dueDate)}</p>
                        </div>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            ms.status === 'COMPLETED'
                              ? 'bg-emerald-600'
                              : ms.isOverdue || ms.status === 'DELAYED'
                              ? 'bg-rose-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${ms.completionPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                        <div>
                          {ms.deliverableUrl ? (
                            <a
                              href={ms.deliverableUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                            >
                              <span>Link nghiệm thu / Release</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Chưa gắn link nghiệm thu</span>
                          )}
                        </div>

                        {canManageMilestones && (
                          <div className="flex items-center gap-1.5">
                            {ms.status !== 'COMPLETED' && (
                              <button
                                type="button"
                                disabled={completingMilestoneId === ms.id}
                                onClick={() => handleQuickCompleteMilestone(ms)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-bold transition cursor-pointer disabled:opacity-50"
                              >
                                <CheckCircle2 size={12} />
                                <span>
                                  {completingMilestoneId === ms.id ? 'Đang lưu...' : 'Nghiệm thu 100%'}
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMilestone(ms);
                                setIsMilestoneFormOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Chỉnh sửa mốc"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteMilestoneTarget(ms)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Xóa mốc"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Project Health Brief (Chỉ dành cho Giám đốc / Trưởng phòng / CEO) */}
          {canAnalyzeHealth && <ProjectHealthPanel projectId={projectData.id} />}

          {/* Mô tả & Mục tiêu */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              <span>Mô tả &amp; Mục tiêu Dự án</span>
            </h4>
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap text-pretty">
              {projectData.description || 'Chưa có mô tả chi tiết cho dự án này.'}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Code2 size={14} className="text-blue-600" />
              <span>Hệ thống Công nghệ (Tech Stack)</span>
            </h4>
            {projectData.techStack && projectData.techStack.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {projectData.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-semibold"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Chưa xác định danh mục công nghệ.</p>
            )}
          </div>

          {/* Tài nguyên & Liên kết Kỹ thuật */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers size={14} className="text-blue-600" />
              <span>Tài nguyên &amp; Liên kết Kỹ thuật</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: 'Source Code',
                  subtitle: 'Git Repository',
                  url: projectData.gitRepoUrl,
                  icon: GitBranch,
                  iconBg: 'bg-slate-100 text-slate-700',
                },
                {
                  title: 'Tasks & Sprints',
                  subtitle: 'Jira Board',
                  url: projectData.jiraUrl,
                  icon: Kanban,
                  iconBg: 'bg-blue-50 text-blue-600',
                },
                {
                  title: 'UI/UX Design',
                  subtitle: 'Figma Prototype',
                  url: projectData.figmaUrl,
                  icon: Palette,
                  iconBg: 'bg-sky-50 text-sky-700',
                },
              ].map((resItem, idx) => {
                const IconComp = resItem.icon;
                return (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 hover:border-blue-300 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${resItem.iconBg}`}>
                        <IconComp size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-slate-400 block">{resItem.title}</span>
                        <span className="text-xs font-semibold text-slate-800 truncate block">{resItem.subtitle}</span>
                      </div>
                    </div>
                    {resItem.url ? (
                      <a
                        href={resItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition shrink-0"
                        title={`Mở ${resItem.subtitle}`}
                      >
                        <span>Mở</span>
                        <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic shrink-0">Chưa có</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Đội ngũ Kỹ thuật tham gia */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Users size={14} className="text-blue-600" />
                  <span>Đội ngũ Kỹ thuật tham gia ({activeMembers.length} thành viên)</span>
                </h4>
                {onInspectEngineer && activeMembers.length > 0 && (
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    • Bấm vào thành viên để xem Tech Profile
                  </span>
                )}
              </div>

              {onOpenStaffing && (
                <button
                  type="button"
                  onClick={() => onOpenStaffing(projectData)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  <UserPlus size={13} />
                  <span>Quản lý phân bổ</span>
                </button>
              )}
            </div>

            {activeMembers.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2.5">
                <p className="text-xs text-slate-500">Chưa có kỹ sư nào đang tham gia dự án này.</p>
                {onOpenStaffing && (
                  <button
                    type="button"
                    onClick={() => onOpenStaffing(projectData)}
                    className="px-3.5 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus size={13} />
                    <span>Phân bổ nhân sự ngay</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeMembers.map((member) => {
                  const roleCfg = PROJECT_ROLE_LABELS[member.projectRole] || {
                    label: member.projectRole,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isLead = member.projectRole === 'TECH_LEAD';
                  const Wrapper = onInspectEngineer ? 'button' : 'div';

                  return (
                    <Wrapper
                      key={member.id}
                      {...(onInspectEngineer
                        ? { type: 'button', onClick: () => onInspectEngineer(member.userId) }
                        : {})}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 bg-white border-slate-200/90 ${
                        onInspectEngineer ? 'hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer group' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isLead
                              ? 'bg-[#1E3A8A] text-white ring-2 ring-blue-200'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {member.userName ? member.userName.charAt(0).toUpperCase() : 'U'}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`font-bold text-xs text-slate-900 truncate ${
                                onInspectEngineer ? 'group-hover:text-blue-700 transition-colors' : ''
                              }`}
                            >
                              {member.userName}
                            </span>
                            {member.userMaNhanVien && (
                              <span className="text-[10px] text-slate-400 tabular">({member.userMaNhanVien})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${roleCfg.badgeClass}`}>
                              {isLead ? 'Lead • ' : ''}
                              {roleCfg.shortLabel || roleCfg.label}
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-400 truncate">
                            {member.userEmail}
                            {member.joinedAt && ` • Tham gia: ${formatDateVN(member.joinedAt)}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-xs font-extrabold text-blue-700 tabular whitespace-nowrap">
                          {member.allocationPercent}% tải
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap shrink-0">
                          Đang tham gia
                        </span>
                        {member.isOverloaded && (
                          <span
                            className="text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            title={`Tổng tải cá nhân qua tất cả các dự án: ${member.totalCurrentAllocation}%`}
                          >
                            <AlertTriangle size={10} className="shrink-0" /> Quá tải ({member.totalCurrentAllocation}%)
                          </span>
                        )}
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            )}

            {/* Lịch sử thành viên đã rời dự án */}
            {formerMembers.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <details className="group text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-between list-none select-none py-2 px-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition">
                    <span className="flex items-center gap-2">
                      <Clock size={13} className="text-slate-400 group-open:text-blue-600" />
                      <span>Lịch sử nhân sự đã rời dự án ({formerMembers.length} lượt)</span>
                    </span>
                    <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-0.5 group-open:hidden">
                      Xem chi tiết <ChevronRight size={13} />
                    </span>
                  </summary>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-1">
                    {formerMembers.map((member) => {
                      const roleCfg = PROJECT_ROLE_LABELS[member.projectRole] || {
                        label: member.projectRole,
                        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                      return (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-xl border bg-slate-50/70 border-slate-200/70 flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {member.userName ? member.userName.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-semibold text-xs text-slate-700 truncate">{member.userName}</p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-block ${roleCfg.badgeClass}`}>
                                {roleCfg.shortLabel || roleCfg.label}
                              </span>
                              <p className="text-[10px] text-slate-400 tabular">
                                {member.joinedAt && `Vào: ${formatDateVN(member.joinedAt)}`}
                                {member.leftAt && ` • Rời: ${formatDateVN(member.leftAt)}`}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full border border-slate-300 whitespace-nowrap shrink-0 tabular">
                            Đã rời ({member.allocationPercent}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Audit trail */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
            <span>
              Khởi tạo bởi: <strong className="text-slate-600">{projectData.createdByName || 'Hệ thống'}</strong>
            </span>
            {projectData.createdAt && <span className="tabular">Tạo lúc: {formatDateTimeVN(projectData.createdAt)}</span>}
            {projectData.updatedAt && <span className="tabular">Cập nhật: {formatDateTimeVN(projectData.updatedAt)}</span>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3 flex-wrap">
          <div className="text-xs text-slate-500">
            Mã định danh: <span className="font-mono font-bold text-slate-700 tabular">#{projectData.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>

            {onOpenEdit && (
              <button
                type="button"
                onClick={() => onOpenEdit(projectData)}
                className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Chỉnh sửa</span>
              </button>
            )}

            {onOpenStaffing && (
              <button
                type="button"
                onClick={() => onOpenStaffing(projectData)}
                className="px-4 py-2 text-xs font-bold bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Phân bổ Đội ngũ</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
        document.body
      )}

      {canManageMilestones && (
        <MilestoneFormModal
          isOpen={isMilestoneFormOpen}
          onClose={() => {
            setIsMilestoneFormOpen(false);
            setEditingMilestone(null);
          }}
          projectId={projectData.id}
          projectName={projectData.projectName}
          initialData={editingMilestone}
          usedWeightByOthers={usedWeightByOthers}
          onSuccess={refreshAfterMilestoneChange}
        />
      )}

      {canManageMilestones &&
        deleteMilestoneTarget &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deletingMilestone) {
                setDeleteMilestoneTarget(null);
              }
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa mốc tiến độ</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bạn có chắc chắn muốn xóa mốc{' '}
                    <strong className="text-slate-900">{deleteMilestoneTarget.title}</strong> không? Các worklog từng gắn vào mốc này vẫn được giữ nguyên.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={deletingMilestone}
                  onClick={() => setDeleteMilestoneTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={deletingMilestone}
                  onClick={handleConfirmDeleteMilestone}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {deletingMilestone ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
}
