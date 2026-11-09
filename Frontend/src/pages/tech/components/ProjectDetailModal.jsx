import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FolderGit2,
  Calendar,
  Code2,
  Users,
  GitBranch,
  Kanban,
  Palette,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  UserPlus,
  FileText,
  Clock,
  Briefcase,
  Layers,
  UserCheck,
  User,
  Activity
} from 'lucide-react';
import api from '../../../services/api';

const STATUS_CONFIG = {
  PLANNING: { label: 'Lên kế hoạch', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'Đang phát triển', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  MAINTENANCE: { label: 'Bảo trì & Vận hành', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  PAUSED: { label: 'Tạm dừng', color: 'bg-red-100 text-red-700 border-red-200' },
};

const PROJECT_ROLE_LABELS = {
  TECH_LEAD: { label: 'Tech Lead (Trưởng nhóm kỹ thuật)', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  BACKEND_DEV: { label: 'Backend Developer', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  FRONTEND_DEV: { label: 'Frontend Developer', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FULLSTACK_DEV: { label: 'Fullstack Developer', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  MOBILE_DEV: { label: 'Mobile Developer', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  QA_TESTER: { label: 'QA / Automation Tester', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  DEVOPS: { label: 'DevOps / Cloud Engineer', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  UI_UX_DESIGNER: { label: 'UI/UX Designer', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

// Định dạng ngày dd/MM/yyyy
const formatDateVN = (dateStr) => {
  if (!dateStr) return 'Chưa định';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

// Định dạng thời gian đầy đủ dd/MM/yyyy HH:mm
const formatDateTimeVN = (isoStr) => {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return isoStr;
  }
};

export default function ProjectDetailModal({
  isOpen,
  onClose,
  project,
  onOpenStaffing,
  onOpenEdit
}) {
  const [projectData, setProjectData] = useState(project);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && project?.id) {
      setProjectData(project);
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
  }, [isOpen, project]);

  const fetchFreshDetail = async (projectId) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/tech/projects/${projectId}`);
      if (res.data?.data) {
        setProjectData(res.data.data);
      }
    } catch (err) {
      console.error('Không thể tải chi tiết dự án mới nhất:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !projectData) return null;

  const statusInfo = STATUS_CONFIG[projectData.status] || {
    label: projectData.status,
    color: 'bg-slate-100 text-slate-700 border-slate-200'
  };

  const members = projectData.members || [];
  const activeMembers = members.filter(m => m.isActive);
  const formerMembers = members.filter(m => !m.isActive);
  const overloadedMembers = activeMembers.filter(m => m.isOverloaded || (m.totalCurrentAllocation && m.totalCurrentAllocation > 100));
  const hasOverload = overloadedMembers.length > 0;
  const fteEquivalent = ((projectData.totalAllocationSum || 0) / 100).toFixed(1);

  // Tính số ngày còn lại hoặc quá hạn
  const computeDaysRemaining = () => {
    if (!projectData.endDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(projectData.endDate);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = computeDaysRemaining();

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9980] bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center animate-fadeIn overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* ── 1. Modal Header ──────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white flex items-start justify-between gap-4 shrink-0 border-b border-slate-800">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white/10 text-white border border-white/20">
                {projectData.projectCode}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                projectData.projectType === 'INTERNAL'
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
              }`}>
                {projectData.projectType === 'INTERNAL' ? 'Sản phẩm Nội bộ' : 'Dự án Khách hàng'}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
              {projectData.projectName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
            title="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── 2. Modal Body (Scrollable) ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Tech Lead */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-purple-600" />
                Tech Lead
              </span>
              <p className="text-xs font-bold text-slate-900 truncate">
                {projectData.techLeadName || 'Chưa chỉ định'}
              </p>
            </div>

            {/* Timeline */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={12} className="text-blue-600" />
                Thời gian
              </span>
              <p className="text-xs font-bold text-slate-900">
                {formatDateVN(projectData.startDate)} → {formatDateVN(projectData.endDate)}
              </p>
              {daysRemaining !== null && (
                <span className={`text-[10px] font-medium block ${
                  daysRemaining < 0
                    ? 'text-rose-600 font-semibold'
                    : daysRemaining <= 7
                    ? 'text-amber-600 font-semibold'
                    : 'text-emerald-600'
                }`}>
                  {daysRemaining < 0
                    ? `Đã quá hạn ${Math.abs(daysRemaining)} ngày`
                    : daysRemaining === 0
                    ? 'Hôm nay đến hạn'
                    : `Còn ${daysRemaining} ngày`}
                </span>
              )}
            </div>

            {/* Đội ngũ */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users size={12} className="text-indigo-600" />
                Đội ngũ kỹ thuật
              </span>
              <p className="text-xs font-bold text-slate-900">
                {activeMembers.length} thành viên <span className="text-[11px] text-slate-400 font-normal">đang hoạt động</span>
              </p>
            </div>

            {/* Tổng công suất huy động */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Activity size={12} className="text-blue-600" />
                Tổng công suất huy động
              </span>
              <div className="flex items-baseline gap-1.5">
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
                  Có {overloadedMembers.length} kỹ sư quá tải cá nhân
                </span>
              ) : (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 pt-0.5">
                  <CheckCircle2 size={11} className="shrink-0" />
                  Tải các kỹ sư cân đối
                </span>
              )}
            </div>
          </div>

          {/* Mô tả & Mục tiêu dự án */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              Mô tả &amp; Mục tiêu Dự án
            </h4>
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {projectData.description || 'Chưa có mô tả chi tiết cho dự án này.'}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 size={14} className="text-indigo-600" />
              Hệ thống Công nghệ (Tech Stack)
            </h4>
            {projectData.techStack && projectData.techStack.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {projectData.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-bold shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
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
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-slate-600" />
              Tài nguyên &amp; Liên kết Kỹ thuật
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Git Repo */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <GitBranch size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Source Code</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">Git Repository</span>
                  </div>
                </div>
                {projectData.gitRepoUrl ? (
                  <a
                    href={projectData.gitRepoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Mở Git Repository"
                  >
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Chưa có</span>
                )}
              </div>

              {/* Jira Board */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Kanban size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Tasks &amp; Sprints</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">Jira Board</span>
                  </div>
                </div>
                {projectData.jiraUrl ? (
                  <a
                    href={projectData.jiraUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Mở Jira Board"
                  >
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Chưa có</span>
                )}
              </div>

              {/* Figma UI/UX */}
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Palette size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">UI/UX Design</span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">Figma Prototype</span>
                  </div>
                </div>
                {projectData.figmaUrl ? (
                  <a
                    href={projectData.figmaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                    title="Mở Figma"
                  >
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Chưa có</span>
                )}
              </div>
            </div>
          </div>

          {/* Đội ngũ Kỹ thuật tham gia */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-blue-600" />
                Đội ngũ Kỹ thuật tham gia ({activeMembers.length} thành viên)
              </h4>
              {onOpenStaffing && (
                <button
                  type="button"
                  onClick={() => onOpenStaffing(projectData)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <UserPlus size={13} />
                  <span>Quản lý phân bổ</span>
                </button>
              )}
            </div>

            {activeMembers.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-2">
                <p className="text-xs text-slate-500">Chưa có kỹ sư nào đang tham gia dự án này.</p>
                {onOpenStaffing && (
                  <button
                    type="button"
                    onClick={() => onOpenStaffing(projectData)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition inline-flex items-center gap-1.5"
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
                    color: 'bg-slate-100 text-slate-700 border-slate-200'
                  };
                  const isLead = member.projectRole === 'TECH_LEAD';

                  return (
                    <div
                      key={member.id}
                      className="p-3 rounded-xl border transition flex items-center justify-between gap-3 bg-white border-slate-200/90 shadow-2xs hover:border-blue-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                          isLead
                            ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white ring-2 ring-purple-200'
                            : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        }`}>
                          {member.userName ? member.userName.charAt(0) : 'U'}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {member.userName}
                            </span>
                            {member.userMaNhanVien && (
                              <span className="text-[10px] text-slate-400">({member.userMaNhanVien})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md border ${roleCfg.color}`}>
                              {isLead ? '★ ' : ''}{roleCfg.label}
                            </span>
                          </div>

                          <p className="text-[10px] text-slate-400">
                            {member.userEmail}
                            {member.joinedAt && ` • Tham gia: ${formatDateVN(member.joinedAt)}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-blue-700 block">
                          {member.allocationPercent}% tải
                        </span>
                        <div className="flex flex-col items-end gap-0.5 mt-0.5">
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                            Đang tham gia
                          </span>
                          {member.isOverloaded && (
                            <span
                              className="text-[9px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded flex items-center gap-0.5"
                              title={`Tổng tải cá nhân qua tất cả các dự án: ${member.totalCurrentAllocation}%`}
                            >
                              <AlertTriangle size={9} /> Quá tải cá nhân ({member.totalCurrentAllocation}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lịch sử thành viên đã rời dự án (nếu có) */}
            {formerMembers.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <details className="group text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-between list-none select-none py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition">
                    <span className="flex items-center gap-2">
                      <Clock size={13} className="text-slate-400 group-open:text-blue-600" />
                      <span>Lịch sử thành viên đã rời dự án ({formerMembers.length} lượt)</span>
                    </span>
                    <span className="text-[11px] text-blue-600 font-medium group-open:hidden">Xem chi tiết</span>
                  </summary>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-1">
                    {formerMembers.map((member) => {
                      const roleCfg = PROJECT_ROLE_LABELS[member.projectRole] || {
                        label: member.projectRole,
                        color: 'bg-slate-100 text-slate-700 border-slate-200'
                      };
                      return (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-xl border bg-slate-50/70 border-slate-200/70 flex items-center justify-between gap-2.5 opacity-80"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {member.userName ? member.userName.charAt(0) : 'U'}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-semibold text-xs text-slate-700 truncate">{member.userName}</p>
                              <span className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${roleCfg.color}`}>
                                {roleCfg.label}
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {member.joinedAt && `Vào: ${formatDateVN(member.joinedAt)}`}
                                {member.leftAt && ` • Rời: ${formatDateVN(member.leftAt)}`}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full border border-slate-300 block">
                              Đã rời ({member.allocationPercent}%)
                            </span>
                          </div>
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
            <span>Khởi tạo bởi: <strong className="text-slate-600">{projectData.createdByName || 'Hệ thống'}</strong></span>
            {projectData.createdAt && (
              <span>Thời gian tạo: {formatDateTimeVN(projectData.createdAt)}</span>
            )}
            {projectData.updatedAt && (
              <span>Cập nhật: {formatDateTimeVN(projectData.updatedAt)}</span>
            )}
          </div>
        </div>

        {/* ── 3. Modal Footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Mã định danh: <span className="font-mono font-bold text-slate-700">#{projectData.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition"
            >
              Đóng
            </button>

            {onOpenEdit && (
              <button
                type="button"
                onClick={() => onOpenEdit(projectData)}
                className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl shadow-2xs transition flex items-center gap-1.5"
              >
                <Edit3 size={13} />
                <span>Chỉnh sửa</span>
              </button>
            )}

            {onOpenStaffing && (
              <button
                type="button"
                onClick={() => onOpenStaffing(projectData)}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <UserPlus size={13} />
                <span>Phân bổ Đội ngũ</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

