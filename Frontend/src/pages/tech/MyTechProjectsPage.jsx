import React, { useState, useEffect } from 'react';
import {
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
  Activity,
  Layers
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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

export default function MyTechProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyProjects();
  }, []);

  const fetchMyProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/tech/projects/my-projects');
      if (res.data?.data) {
        setProjects(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Find user's member object in a project
  const getMyMembership = (project) => {
    return (project.members || []).find(m => m.isActive && (m.userEmail === user?.email || m.userId === user?.userId));
  };

  const totalMyAllocation = projects.reduce((sum, p) => {
    const mem = getMyMembership(p);
    return sum + (mem?.allocationPercent || 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shadow-xs">
              <FolderGit2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Dự án Công nghệ của tôi
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Các dự án phần mềm bạn đang trực tiếp tham gia phát triển, vai trò và tài nguyên kỹ thuật
              </p>
            </div>
          </div>
        </div>

        {/* Workload badge */}
        <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">Tổng tải công việc</span>
            <span className="text-sm font-extrabold text-blue-700">
              {totalMyAllocation}% / 100%
            </span>
          </div>
        </div>
      </div>

      {/* Projects Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Đang tải danh sách dự án của bạn...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
          <Layers size={44} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-base font-bold text-slate-700">Bạn hiện chưa tham gia dự án nào</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Hiện tại bạn đang ở trạng thái <strong>Ghế chờ (Bench)</strong> với 100% dung lượng trống. Trưởng phòng Công nghệ sẽ phân bổ dự án phù hợp với kỹ năng của bạn sớm nhất!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map(project => {
            const statusInfo = STATUS_CONFIG[project.status] || {
              label: project.status,
              color: 'bg-slate-100 text-slate-700 border-slate-200'
            };
            const myMem = getMyMembership(project);
            const roleConfig = myMem ? (PROJECT_ROLE_LABELS[myMem.projectRole] || { label: myMem.projectRole, color: 'bg-blue-100 text-blue-700' }) : null;
            const isLead = myMem?.projectRole === 'TECH_LEAD';
            const teammates = (project.members || []).filter(m => m.isActive);

            return (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden"
              >
                {/* Header card */}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {project.projectCode}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">{project.projectName}</h2>
                    </div>

                    {/* My Role Badge */}
                    {roleConfig && (
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-bold px-3 py-1 rounded-lg border block ${roleConfig.color}`}>
                          {isLead ? '★ ' : ''}{roleConfig.label}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">
                          Phân bổ: <strong>{myMem.allocationPercent}% tải</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Tech Stack */}
                  {project.techStack && project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {project.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tech Lead & Timeline */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Tech Lead</span>
                      <span className="font-bold text-purple-700 flex items-center gap-1 mt-0.5">
                        <Sparkles size={12} />
                        {project.techLeadName}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">Thời gian</span>
                      <span className="font-medium text-slate-700 mt-0.5 block">
                        {project.startDate || 'N/A'} → {project.endDate || 'Hiện tại'}
                      </span>
                    </div>
                  </div>

                  {/* Teammates List */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Đồng đội cùng dự án ({teammates.length} người)
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {teammates.map(m => (
                        <div
                          key={m.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700"
                        >
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                            {m.userName ? m.userName.charAt(0) : 'U'}
                          </div>
                          <span className="font-medium">{m.userName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({m.projectRole})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* External Links Bar */}
                <div className="px-5 py-3 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500">Truy cập công cụ:</span>
                  <div className="flex items-center gap-3">
                    {project.gitRepoUrl ? (
                      <a
                        href={project.gitRepoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 font-medium transition"
                      >
                        <GitBranch size={14} />
                        <span>Git Repository</span>
                      </a>
                    ) : (
                      <span className="text-slate-300">Không có Git</span>
                    )}

                    {project.jiraUrl && (
                      <a
                        href={project.jiraUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 font-medium transition"
                      >
                        <Kanban size={14} />
                        <span>Jira Board</span>
                      </a>
                    )}

                    {project.figmaUrl && (
                      <a
                        href={project.figmaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-600 font-medium transition"
                      >
                        <Palette size={14} />
                        <span>Palette Design</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
