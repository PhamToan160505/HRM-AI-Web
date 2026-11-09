import React, { useState, useEffect } from 'react';
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
  FileText,
  Clock,
  Layers,
  Activity,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import api from '../../../services/api';
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_ROLE_LABELS,
  formatDateVN,
  formatDateTimeVN,
  computeTimelineHealth,
} from './ceoTechHelpers';

export default function CeoProjectDetailModal({
  isOpen,
  onClose,
  project,
  onInspectEngineer,
  hasTopModalOpen = false,
}) {
  const [projectData, setProjectData] = useState(project);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !hasTopModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasTopModalOpen, onClose]);

  const fetchFreshDetail = async (projectId) => {
    try {
      setRefreshing(true);
      const res = await api.get(`/api/tech/projects/${projectId}`);
      if (res.data?.data) {
        setProjectData(res.data.data);
      }
    } catch (err) {
      console.error('Không thể tải chi tiết dự án:', err);
    } finally {
      setRefreshing(false);
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

  return createPortal(
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
        aria-labelledby="ceo-project-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header — Deep Corporate Sapphire */}
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
              id="ceo-project-modal-title"
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
                  <span>Tải đội ngũ cân đối</span>
                </span>
              )}
            </div>
          </div>

          {/* Tiến độ thời gian trực quan */}
          {projectData.startDate && projectData.endDate && (
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Độ phủ lịch trình thực hiện</span>
                <span className="font-bold text-blue-700 tabular">{timeline.elapsedPercent}% chu kỳ thời gian</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white border border-blue-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-transform duration-300 origin-left ${
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
              <span>Kiến trúc &amp; Công nghệ sử dụng (Tech Stack)</span>
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
              <p className="text-xs text-slate-400 italic">Chưa khai báo công nghệ.</p>
            )}
          </div>

          {/* Tài nguyên kỹ thuật */}
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

          {/* Đội ngũ tham gia */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Users size={14} className="text-blue-600" />
                <span>Đội ngũ Kỹ thuật tham gia ({activeMembers.length} thành viên)</span>
              </h4>
              {onInspectEngineer && activeMembers.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  Bấm vào thành viên để xem Tech Profile
                </span>
              )}
            </div>

            {activeMembers.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <p className="text-xs text-slate-500">Chưa có kỹ sư nào đang tham gia dự án này.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeMembers.map((member) => {
                  const roleCfg = PROJECT_ROLE_LABELS[member.projectRole] || {
                    label: member.projectRole,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const isLead = member.projectRole === 'TECH_LEAD';

                  return (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => onInspectEngineer && onInspectEngineer(member.userId)}
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
                            <span className="font-bold text-xs text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                              {member.userName}
                            </span>
                            {member.userMaNhanVien && (
                              <span className="text-[10px] text-slate-400 tabular">({member.userMaNhanVien})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${roleCfg.badgeClass}`}>
                              {isLead ? 'Lead • ' : ''}{roleCfg.shortLabel || roleCfg.label}
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
                    </button>
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
                      Xem lịch sử <ChevronRight size={13} />
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
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span>Chế độ Giám sát Điều hành (Chỉ xem) • Mã #{projectData.id}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
