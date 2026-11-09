import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  UserPlus,
  Search,
  Info,
  CheckCircle2,
  FolderGit2,
} from 'lucide-react';

export default function ProjectSelectModal({
  isOpen,
  onClose,
  candidate,
  projects = [],
  onSelectProject,
  zIndexClass = 'z-[9994]',
}) {
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setKeyword('');
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
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
  }, [isOpen, onClose]);

  const categorized = useMemo(() => {
    if (!candidate) return { joinedProjects: [], availableProjects: [], filtered: [], searchedInJoined: [] };

    const candidateId = candidate.userId;
    const isCandidateInProject = (p) => {
      if (!candidateId) return false;
      return (p.members || []).some(
        (m) => (m.isActive ?? true) && String(m.userId) === String(candidateId)
      );
    };

    const activeProjects = projects.filter((p) => p.status !== 'COMPLETED' && p.status !== 'PAUSED');
    const joinedProjects = activeProjects.filter(isCandidateInProject);
    const availableProjects = activeProjects.filter((p) => !isCandidateInProject(p));

    const kw = keyword.trim().toLowerCase();
    const matchesKeyword = (p) => {
      if (!kw) return true;
      return (
        p.projectName?.toLowerCase().includes(kw) ||
        p.projectCode?.toLowerCase().includes(kw) ||
        (p.techStack || []).some((t) => t.toLowerCase().includes(kw))
      );
    };

    return {
      joinedProjects,
      availableProjects,
      filtered: availableProjects.filter(matchesKeyword),
      searchedInJoined: kw ? joinedProjects.filter(matchesKeyword) : [],
    };
  }, [candidate, projects, keyword]);

  if (!isOpen || !candidate) return null;

  const candidateSkillNames = (candidate.skills || []).map((s) =>
    (s.skillName || s.name || '').toLowerCase()
  );

  return createPortal(
    <div
      data-tech-modal="true"
      className={`fixed inset-0 ${zIndexClass} overflow-y-auto bg-slate-900/55 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-select-modal-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto max-h-[88vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Deep Sapphire */}
        <div className="shrink-0 px-6 py-4.5 bg-[#0F2557] text-white flex items-center justify-between border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <UserPlus size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 id="project-select-modal-title" className="font-bold text-base text-white">
                Chọn Dự án để Phân bổ Kỹ sư
              </h3>
              <p className="text-xs text-blue-100/80 truncate mt-0.5 tabular">
                Kỹ sư: <strong className="text-white">{candidate.hoTen}</strong>
                {candidate.chucVu ? ` • ${candidate.chucVu}` : ''} •{' '}
                <span className={candidate.availableCapacity > 0 ? 'text-emerald-300 font-semibold' : 'text-blue-200'}>
                  {candidate.availableCapacity > 0
                    ? `Còn trống: ${candidate.availableCapacity}%`
                    : 'Đã full 100% tải'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Đóng cửa sổ (Esc)"
            aria-label="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col p-6 space-y-4 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên dự án, mã PRJ-, công nghệ Tech Stack..."
              className="w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Xóa tìm kiếm"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Excluded banner */}
          {categorized.joinedProjects.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 px-3.5 py-2.5 rounded-xl shrink-0">
              <Info size={14} className="text-blue-600 shrink-0" />
              <span className="truncate">
                Đã tự động ẩn <strong className="tabular">{categorized.joinedProjects.length}</strong> dự án kỹ sư đang tham gia:{' '}
                <span className="font-semibold text-blue-950">
                  {categorized.joinedProjects.map((p) => p.projectName).join(', ')}
                </span>
              </span>
            </div>
          )}

          {/* Project list */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {categorized.filtered.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                <FolderGit2 size={34} className="mx-auto text-slate-300" />
                {categorized.searchedInJoined.length > 0 ? (
                  <p className="text-xs text-orange-700 font-semibold">
                    Dự án &quot;{categorized.searchedInJoined.map((p) => p.projectName).join(', ')}&quot; đã có kỹ sư này tham gia nên không thể phân bổ trùng.
                  </p>
                ) : categorized.availableProjects.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {categorized.joinedProjects.length > 0
                      ? `Kỹ sư ${candidate.hoTen} hiện đã tham gia toàn bộ dự án đang mở.`
                      : 'Hiện chưa có dự án nào đang mở để phân bổ nhân sự.'}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">Không tìm thấy dự án nào khớp với từ khóa tìm kiếm.</p>
                )}
              </div>
            ) : (
              categorized.filtered.map((proj) => {
                const matchedTechs = (proj.techStack || []).filter((t) =>
                  candidateSkillNames.some(
                    (cs) => cs && (cs.includes(t.toLowerCase()) || t.toLowerCase().includes(cs))
                  )
                );
                const isHighMatch = matchedTechs.length > 0;
                const activeCount = (proj.members || []).filter((m) => m.isActive).length || proj.totalMembersCount || 0;

                return (
                  <div
                    key={proj.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isHighMatch
                        ? 'bg-blue-50/50 border-blue-200 hover:border-blue-400'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular">
                          {proj.projectCode}
                        </span>
                        <h4 className="font-bold text-xs text-slate-900 truncate">{proj.projectName}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-600">
                          {proj.projectType === 'INTERNAL' ? 'Nội bộ' : 'Khách hàng'}
                        </span>
                      </div>

                      {proj.techStack && proj.techStack.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] text-slate-400">Tech Stack:</span>
                          {proj.techStack.map((tech, tIdx) => {
                            const isMatched = matchedTechs.includes(tech);
                            return (
                              <span
                                key={tIdx}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                                  isMatched
                                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}
                              >
                                {tech}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5 tabular flex-wrap">
                        {isHighMatch && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                            <span>Tương thích {matchedTechs.length} công nghệ</span>
                          </span>
                        )}
                        <span>
                          Đội ngũ: <strong className="text-slate-700">{activeCount}</strong> nhân sự
                        </span>
                        <span>
                          Tổng tải: <strong className="text-slate-700">{proj.totalAllocationSum || 0}%</strong>
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectProject(proj)}
                        className="px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <UserPlus size={14} />
                        <span>Chọn dự án này</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
          >
            Đóng cửa sổ
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

