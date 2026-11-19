import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
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
  Clock,
  Layers,
  Activity,
  ChevronRight,
  Flag,
  Plus,
  Trash2,
  ListChecks,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import MilestoneFormModal from './components/MilestoneFormModal';
import MilestoneDodModal from './components/MilestoneDodModal';
import ProjectArchitectureDocsPanel from './components/ProjectArchitectureDocsPanel';
import ProjectEnvironmentsPanel from './components/ProjectEnvironmentsPanel';
import ProjectHealthPanel from './components/ProjectHealthPanel';
import ProjectFormModal from './components/ProjectFormModal';
import StaffingModal from './components/StaffingModal';
import TechProfileModal from './components/TechProfileModal';
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_ROLE_LABELS,
  MILESTONE_STATUS_CONFIG,
  formatDateVN,
  formatDateTimeVN,
  formatHours,
  computeTimelineHealth,
} from './techHelpers';

export default function TechProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [projectData, setProjectData] = useState(null);
  const [milestoneSummary, setMilestoneSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStaffingOpen, setIsStaffingOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isMilestoneFormOpen, setIsMilestoneFormOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState(null);
  const [deletingMilestone, setDeletingMilestone] = useState(false);
  const [completingMilestoneId, setCompletingMilestoneId] = useState(null);
  const [activeDodMilestone, setActiveDodMilestone] = useState(null);

  // Role permissions
  const isCeo = user?.role === 'ceo';
  const canManage =
    user?.role === 'truong_phong' ||
    user?.role === 'giam_doc_phong_ban' ||
    user?.role === 'admin';
  const canAnalyzeHealth = isCeo || canManage;

  const handleBack = () => {
    // If state has previous route or history available
    if (window.history.length > 1) {
      navigate(-1);
    } else if (isCeo) {
      navigate('/ceo/tech-projects');
    } else if (user?.role === 'giam_doc_phong_ban') {
      navigate('/director/tech-projects');
    } else if (user?.role === 'truong_phong') {
      navigate('/manager/tech-projects');
    } else {
      navigate('/employee/my-projects');
    }
  };

  const fetchProjectData = useCallback(
    async (isSilent = false) => {
      if (!id) return;
      try {
        if (!isSilent) {
          setLoading(true);
          setLoadingMilestones(true);
        }
        setRefreshing(true);

        const [projRes, msRes] = await Promise.allSettled([
          api.get(`/api/tech/projects/${id}`),
          api.get(`/api/tech/projects/${id}/milestones`),
        ]);

        if (projRes.status === 'fulfilled' && projRes.value?.data?.data) {
          setProjectData(projRes.value.data.data);
        } else if (!isSilent) {
          toast?.show('Lỗi', 'Không thể tải thông tin dự án', 'error');
        }

        if (msRes.status === 'fulfilled' && msRes.value?.data?.data) {
          setMilestoneSummary(msRes.value.data.data);
        }
      } catch (err) {
        console.error('Lỗi khi tải chi tiết dự án:', err);
        if (!isSilent) {
          toast?.show('Lỗi', 'Có lỗi xảy ra khi tải dữ liệu dự án', 'error');
        }
      } finally {
        if (!isSilent) {
          setLoading(false);
          setLoadingMilestones(false);
        }
        setRefreshing(false);
      }
    },
    [id, toast]
  );

  useEffect(() => {
    fetchProjectData();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [fetchProjectData]);

  const handleInspectEngineer = async (userId) => {
    try {
      const res = await api.get(`/api/tech/skills/profile/${userId}`);
      if (res.data?.data) {
        setSelectedProfile(res.data.data);
      }
    } catch (err) {
      console.error('Không thể tải Tech Profile:', err);
      toast?.show('Lỗi', 'Không thể tải hồ sơ kỹ sư', 'error');
    }
  };

  const handleQuickCompleteMilestone = async (ms) => {
    if (!canManage || completingMilestoneId) return;

    if (ms.dodPendingRequiredCount > 0) {
      toast?.show(
        'Chưa đạt tiêu chuẩn DoD',
        `Không thể nghiệm thu 100% vì còn ${ms.dodPendingRequiredCount} tiêu chí DoD bắt buộc chưa đạt. Vui lòng mở Checklist DoD để hoàn tất nghiệm thu.`,
        'warning'
      );
      setActiveDodMilestone(ms);
      return;
    }

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
      await fetchProjectData(true);
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
      await api.delete(
        `/api/tech/projects/${projectData.id}/milestones/${deleteMilestoneTarget.id}`
      );
      toast?.show('Đã xóa', `Đã xóa mốc "${deleteMilestoneTarget.title}"`, 'success');
      setDeleteMilestoneTarget(null);
      await fetchProjectData(true);
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể xóa mốc tiến độ', 'error');
    } finally {
      setDeletingMilestone(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-200" />
          <div className="space-y-2 flex-1">
            <div className="w-48 h-4 rounded-md bg-slate-200" />
            <div className="w-72 h-8 rounded-lg bg-slate-200" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl border border-slate-200" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không tìm thấy thông tin dự án</h2>
        <p className="text-sm text-slate-500">
          Dự án có thể đã bị xóa hoặc bạn không có quyền truy cập thông tin này.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="px-5 py-2.5 rounded-xl bg-[#0F2557] hover:bg-blue-900 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <ArrowLeft size={16} />
          <span>Quay lại danh sách</span>
        </button>
      </div>
    );
  }

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
  const completedMsCount =
    milestoneSummary?.completedCount ?? projectData.completedMilestonesCount ?? 0;
  const totalMsCount =
    milestoneSummary?.totalCount ?? projectData.milestonesCount ?? milestones.length;
  const usedWeightByOthers = editingMilestone
    ? Math.max(0, totalWeightPercent - (editingMilestone.weightPercent || 0))
    : totalWeightPercent;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-20">
      {/* Top Navigation & Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition flex items-center gap-2 cursor-pointer"
              title="Quay lại danh sách dự án"
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-bold">Quay lại danh sách</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-1.5">
              <span>Dự án Công nghệ</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="font-bold text-slate-800">{projectData.projectCode}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchProjectData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="px-3.5 py-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 size={14} />
                  <span>Chỉnh sửa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsStaffingOpen(true)}
                  className="px-4 py-2 text-xs font-bold bg-[#0F2557] hover:bg-blue-900 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Phân bổ Đội ngũ</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Project Header Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-[#0F2557] text-white border border-blue-900/60 tabular">
                {projectData.projectCode}
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {projectData.projectType === 'INTERNAL' ? 'Sản phẩm Nội bộ' : 'Dự án Khách hàng'}
              </span>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border whitespace-nowrap ${statusInfo.badgeClass}`}
              >
                {statusInfo.label}
              </span>
              {refreshing && (
                <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  Đang đồng bộ...
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {projectData.projectName}
            </h1>

            {projectData.description && (
              <p className="text-sm text-slate-600 leading-relaxed max-w-4xl text-pretty pt-1">
                {projectData.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 4 Metric Bento Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <UserCheck size={14} className="text-blue-600 shrink-0" />
            <span>Tech Lead</span>
          </span>
          <p
            className="text-sm font-bold text-slate-900 truncate"
            title={projectData.techLeadName || 'Chưa chỉ định'}
          >
            {projectData.techLeadName || 'Chưa chỉ định'}
          </p>
          {!projectData.techLeadName ? (
            <span className="text-[11px] font-semibold text-orange-600 block">Cần bổ nhiệm Lead</span>
          ) : (
            <span className="text-[11px] text-emerald-700 font-medium block">Trưởng nhóm kỹ thuật</span>
          )}
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-600 shrink-0" />
            <span>Mốc thời gian</span>
          </span>
          <p className="text-sm font-bold text-slate-900 tabular">
            {formatDateVN(projectData.startDate)} → {formatDateVN(projectData.endDate)}
          </p>
          <span
            className={`text-[11px] font-semibold block tabular ${
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

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Users size={14} className="text-blue-600 shrink-0" />
            <span>Quy mô nhân sự</span>
          </span>
          <p className="text-sm font-bold text-slate-900 tabular">
            {activeMembers.length} kỹ sư{' '}
            <span className="text-xs text-slate-500 font-normal">đang tham gia</span>
          </p>
          {formerMembers.length > 0 ? (
            <span className="text-[11px] text-slate-400 tabular block">
              {formerMembers.length} lượt đã luân chuyển
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 block">Chưa có luân chuyển</span>
          )}
        </div>

        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-1.5">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Activity size={14} className="text-blue-600 shrink-0" />
            <span>Công suất huy động</span>
          </span>
          <div className="flex items-baseline gap-2 tabular">
            <span className="text-base font-black text-blue-700">
              {projectData.totalAllocationSum || 0}%
            </span>
            <span className="text-xs font-medium text-slate-500">(~{fteEquivalent} FTE)</span>
          </div>
          {hasOverload ? (
            <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" />
              <span>{overloadedMembers.length} kỹ sư vượt 100% tải</span>
            </span>
          ) : (
            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} className="shrink-0" />
              <span>Tải các kỹ sư cân đối</span>
            </span>
          )}
        </div>
      </div>

      {/* Tiến độ Kép: Nghiệm thu Milestones vs Chu kỳ Lịch trình */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
            <span className="font-bold text-slate-800 flex items-center gap-2">
              <Flag size={14} className="text-[#0F2557] shrink-0" />
              <span>Tiến độ Nghiệm thu Thực tế (Milestones)</span>
            </span>
            <span className="font-extrabold text-[#0F2557] text-sm tabular">
              {actualProgress !== null
                ? `${actualProgress}% (${completedMsCount}/${totalMsCount} mốc)`
                : 'Chưa thiết lập mốc'}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0F2557] transition-all duration-300"
              style={{ width: `${actualProgress ?? 0}%` }}
            />
          </div>
        </div>

        {projectData.startDate && projectData.endDate && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
              <span className="font-semibold text-slate-700">Độ phủ lịch trình thực hiện</span>
              <span className="font-bold text-blue-700 tabular">
                {timeline.elapsedPercent}% chu kỳ thời gian
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
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

        <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100 flex-wrap gap-2 tabular">
          <span>
            Giờ công đã duyệt:{' '}
            <strong className="text-[#0F2557]">
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Flag size={18} className="text-blue-600" />
              <span>Mốc Tiến độ &amp; Bàn giao ({totalMsCount} mốc)</span>
            </h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 tabular">
              Trọng số: {totalWeightPercent}% / 100%
            </span>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => {
                setEditingMilestone(null);
                setIsMilestoneFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F2557] hover:bg-blue-900 text-white text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm mốc</span>
            </button>
          )}
        </div>

        {loadingMilestones && milestones.length === 0 ? (
          <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
            Đang tải danh sách mốc tiến độ...
          </div>
        ) : milestones.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center space-y-3">
            <p className="text-xs text-slate-500">
              Dự án này chưa có mốc nghiệm thu (Milestone) nào được thiết lập.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setEditingMilestone(null);
                  setIsMilestoneFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-blue-50 text-[#0F2557] border border-blue-200 text-xs font-bold transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Thiết lập mốc đầu tiên</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((ms) => {
              const msCfg = MILESTONE_STATUS_CONFIG[ms.status] || {
                label: ms.status,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              return (
                <div
                  key={ms.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${msCfg.badgeClass}`}
                        >
                          {msCfg.label}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-[#0F2557] border border-blue-200 tabular whitespace-nowrap shrink-0">
                          Trọng số {ms.weightPercent}%
                        </span>
                        {ms.isOverdue && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                            Quá hạn mốc
                          </span>
                        )}
                        {!ms.isOverdue && ms.isDueSoon && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap shrink-0">
                            Sắp đến hạn
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{ms.title}</h4>
                      {ms.description && (
                        <p className="text-xs text-slate-600 leading-relaxed text-pretty">
                          {ms.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0 space-y-1 tabular">
                      <p className="text-sm font-extrabold text-[#0F2557]">{ms.completionPercent}%</p>
                      <p className="text-xs text-slate-500">Hạn: {formatDateVN(ms.dueDate)}</p>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
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

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setActiveDodMilestone(ms)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border transition cursor-pointer ${
                          ms.dodPendingRequiredCount > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            : ms.dodTotalCount > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title="Xem và cập nhật các tiêu chí nghiệm thu Definition of Done"
                      >
                        <ListChecks size={14} />
                        <span>
                          Checklist DoD: {ms.dodCompletedCount || 0}/{ms.dodTotalCount || 0}
                        </span>
                        {ms.dodPendingRequiredCount > 0 && (
                          <span className="text-[11px] text-amber-700 font-extrabold">
                            (Còn {ms.dodPendingRequiredCount} bắt buộc)
                          </span>
                        )}
                      </button>

                      {ms.deliverableUrl ? (
                        <a
                          href={ms.deliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                        >
                          <span>Link nghiệm thu / Release</span>
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Chưa gắn link nghiệm thu</span>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2">
                        {ms.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            disabled={completingMilestoneId === ms.id}
                            onClick={() => handleQuickCompleteMilestone(ms)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 font-bold transition cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} />
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
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteMilestoneTarget(ms)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Xóa mốc"
                        >
                          <Trash2 size={15} />
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

      {/* Phân hệ 1: Tài liệu Kiến trúc, Specs & Runbook */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <ProjectArchitectureDocsPanel projectId={projectData.id} canManage={canManage} />
      </div>

      {/* Phân hệ 3: Môi trường Triển khai & Hạ tầng */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <ProjectEnvironmentsPanel projectId={projectData.id} canManage={canManage} />
      </div>

      {/* Đội ngũ Kỹ thuật tham gia */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <span>Đội ngũ Kỹ thuật tham gia ({activeMembers.length} thành viên)</span>
            </h3>
            {activeMembers.length > 0 && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                • Bấm vào thành viên để xem Tech Profile
              </span>
            )}
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setIsStaffingOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              <UserPlus size={14} />
              <span>Quản lý phân bổ</span>
            </button>
          )}
        </div>

        {activeMembers.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
            <p className="text-xs text-slate-500">Chưa có kỹ sư nào đang tham gia dự án này.</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setIsStaffingOpen(true)}
                className="px-4 py-2 bg-[#0F2557] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={14} />
                <span>Phân bổ nhân sự ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeMembers.map((member) => {
              const roleCfg = PROJECT_ROLE_LABELS[member.projectRole] || {
                label: member.projectRole,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              const isLead = member.projectRole === 'TECH_LEAD';

              return (
                <div
                  key={member.id}
                  onClick={() => handleInspectEngineer(member.userId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleInspectEngineer(member.userId);
                    }
                  }}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 bg-white transition flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isLead
                          ? 'bg-[#0F2557] text-white ring-2 ring-blue-200'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {member.userName ? member.userName.charAt(0).toUpperCase() : 'U'}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                          {member.userName}
                        </span>
                        {member.userMaNhanVien && (
                          <span className="text-[11px] text-slate-400 tabular">
                            ({member.userMaNhanVien})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${roleCfg.badgeClass}`}
                        >
                          {isLead ? 'Lead • ' : ''}
                          {roleCfg.shortLabel || roleCfg.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate">
                        {member.userEmail}
                        {member.joinedAt && ` • Tham gia: ${formatDateVN(member.joinedAt)}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-xs font-black text-blue-700 tabular whitespace-nowrap">
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
                        <AlertTriangle size={11} className="shrink-0" /> Quá tải (
                        {member.totalCurrentAllocation}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lịch sử thành viên đã rời dự án */}
        {formerMembers.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <details className="group text-xs">
              <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-between list-none select-none py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition">
                <span className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400 group-open:text-blue-600" />
                  <span>Lịch sử nhân sự đã rời dự án ({formerMembers.length} lượt)</span>
                </span>
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1 group-open:hidden">
                  Xem chi tiết <ChevronRight size={14} />
                </span>
              </summary>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3 pt-1">
                {formerMembers.map((member) => {
                  const roleCfg = PROJECT_ROLE_LABELS[member.projectRole] || {
                    label: member.projectRole,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <div
                      key={member.id}
                      className="p-3 rounded-xl border bg-slate-50/70 border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                          {member.userName ? member.userName.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-semibold text-xs text-slate-700 truncate">
                            {member.userName}
                          </p>
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-block ${roleCfg.badgeClass}`}
                          >
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

      {/* Tech Stack & Tài nguyên Kỹ thuật */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tech Stack */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Code2 size={16} className="text-blue-600" />
            <span>Hệ thống Công nghệ (Tech Stack)</span>
          </h3>
          {projectData.techStack && projectData.techStack.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {projectData.techStack.map((tech, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold"
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers size={16} className="text-blue-600" />
            <span>Tài nguyên &amp; Liên kết Kỹ thuật</span>
          </h3>
          <div className="space-y-2 pt-1">
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
                  className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl flex items-center justify-between gap-3 hover:bg-slate-100/70 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${resItem.iconBg}`}
                    >
                      <IconComp size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 block">
                        {resItem.title}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate block">
                        {resItem.subtitle}
                      </span>
                    </div>
                  </div>
                  {resItem.url ? (
                    <a
                      href={resItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-white rounded-lg transition shrink-0 border border-transparent hover:border-slate-200"
                      title={`Mở ${resItem.subtitle}`}
                    >
                      <span>Mở link</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic shrink-0">Chưa gắn link</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Project Health Brief (Dành cho Giám đốc / Trưởng phòng / CEO) */}
      {canAnalyzeHealth && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <ProjectHealthPanel projectId={projectData.id} />
        </div>
      )}

      {/* Audit trail footer */}
      <div className="bg-slate-100/70 rounded-2xl p-4 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
        <span>
          Mã định danh: <strong className="font-mono text-slate-700">#{projectData.id}</strong> •
          Khởi tạo bởi: <strong className="text-slate-700">{projectData.createdByName || 'Hệ thống'}</strong>
        </span>
        <div className="flex items-center gap-3 tabular">
          {projectData.createdAt && (
            <span>Tạo lúc: {formatDateTimeVN(projectData.createdAt)}</span>
          )}
          {projectData.updatedAt && (
            <span>Cập nhật: {formatDateTimeVN(projectData.updatedAt)}</span>
          )}
        </div>
      </div>

      {/* Modals & Sub-dialogs */}
      {/* Milestone Form Modal */}
      {canManage && (
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
          onSuccess={async () => {
            await fetchProjectData(true);
          }}
          onOpenDod={(ms) => {
            setActiveDodMilestone(ms);
          }}
        />
      )}

      {/* Delete Milestone Confirmation */}
      {canManage && deleteMilestoneTarget &&
        createPortal(
          <div
            data-tech-modal="true"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4 my-auto"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa mốc tiến độ</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Bạn có chắc chắn muốn xóa mốc{' '}
                    <strong className="text-slate-900">{deleteMilestoneTarget.title}</strong> không? Các
                    worklog từng gắn vào mốc này vẫn được giữ nguyên.
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

      {/* DoD Checklist Modal */}
      <MilestoneDodModal
        isOpen={Boolean(activeDodMilestone)}
        onClose={() => setActiveDodMilestone(null)}
        projectId={projectData?.id}
        milestone={activeDodMilestone}
        canManage={canManage}
        onDodUpdated={() => fetchProjectData(true)}
      />

      {/* Project Form Modal (Edit) */}
      {canManage && (
        <ProjectFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          initialData={projectData}
          onSuccess={async () => {
            setIsEditOpen(false);
            await fetchProjectData(true);
          }}
        />
      )}

      {/* Staffing Modal */}
      {canManage && (
        <StaffingModal
          isOpen={isStaffingOpen}
          onClose={() => setIsStaffingOpen(false)}
          project={projectData}
          onSuccess={async () => {
            setIsStaffingOpen(false);
            await fetchProjectData(true);
          }}
        />
      )}

      {/* Tech Profile Modal (Inspect Engineer) */}
      <TechProfileModal
        isOpen={Boolean(selectedProfile)}
        onClose={() => setSelectedProfile(null)}
        profile={selectedProfile}
        isReadOnly={!canManage}
      />
    </div>
  );
}
