import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Plus,
  Search,
  Filter,
  Users,
  Code2,
  Calendar,
  ExternalLink,
  GitBranch,
  Kanban,
  Palette,
  Edit3,
  Trash2,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Activity,
  Briefcase
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import ProjectFormModal from './components/ProjectFormModal';
import StaffingModal from './components/StaffingModal';

const STATUS_CONFIG = {
  PLANNING: { label: 'Lên kế hoạch', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'Đang phát triển', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  MAINTENANCE: { label: 'Bảo trì & Hỗ trợ', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  PAUSED: { label: 'Tạm dừng', color: 'bg-red-100 text-red-700 border-red-200' },
};

export default function TechProjectListPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'bench'
  const [projects, setProjects] = useState([]);
  const [benchUsers, setBenchUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [staffingProject, setStaffingProject] = useState(null);

  useEffect(() => {
    fetchProjects();
    fetchBench();
  }, [statusFilter, keyword]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (keyword.trim()) params.keyword = keyword.trim();

      const res = await api.get('/api/tech/projects', { params });
      if (res.data?.data) {
        setProjects(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể tải danh sách dự án', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBench = async () => {
    try {
      const res = await api.get('/api/tech/projects/bench');
      if (res.data?.data) {
        setBenchUsers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProject = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa dự án "${name}" không? Toàn bộ phân bổ thành viên sẽ bị xóa.`)) {
      return;
    }
    try {
      await api.delete(`/api/tech/projects/${id}`);
      toast.show('Thành công', 'Đã xóa dự án thành công', 'success');
      fetchProjects();
      fetchBench();
    } catch (err) {
      console.error(err);
      toast.show('Lỗi', 'Không thể xóa dự án', 'error');
    }
  };

  // Stats calculation
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter(p => p.status === 'IN_PROGRESS').length;
  const benchCount = benchUsers.filter(u => u.availableCapacity > 0).length;
  const totalEngineers = benchUsers.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shadow-xs">
              <FolderGit2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Quản lý Dự án Công nghệ & Đội ngũ
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi tiến độ sản phẩm phần mềm, phân bổ kỹ sư và tối ưu nguồn lực ghế chờ (Bench)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingProject(null);
            setIsFormOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 text-sm font-semibold transition"
        >
          <Plus size={18} />
          <span>Khởi tạo Dự án Mới</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng số dự án</p>
            <p className="text-2xl font-extrabold text-slate-800">{totalProjects}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Đang phát triển</p>
            <p className="text-2xl font-extrabold text-emerald-600">{inProgressProjects}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng kỹ sư</p>
            <p className="text-2xl font-extrabold text-slate-800">{totalEngineers}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ghế chờ (Bench)</p>
            <p className="text-2xl font-extrabold text-amber-600">{benchCount} <span className="text-xs font-normal text-slate-400">người rảnh</span></p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
            activeTab === 'projects'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderGit2 size={16} />
          <span>Danh sách Dự án Công nghệ ({totalProjects})</span>
        </button>

        <button
          onClick={() => setActiveTab('bench')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
            activeTab === 'bench'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={16} />
          <span>Tải Kỹ sư & Ghế chờ Bench ({benchUsers.length})</span>
        </button>
      </div>

      {/* TAB 1: PROJECTS */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="Tìm tên dự án, mã PRJ-..."
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter size={15} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:border-blue-500 font-medium"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PLANNING">Lên kế hoạch</option>
                <option value="IN_PROGRESS">Đang phát triển</option>
                <option value="MAINTENANCE">Bảo trì</option>
                <option value="COMPLETED">Đã hoàn thành</option>
                <option value="PAUSED">Tạm dừng</option>
              </select>
            </div>
          </div>

          {/* Project Cards Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Đang tải danh sách dự án...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
              <FolderGit2 size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Chưa tìm thấy dự án nào</p>
              <p className="text-xs text-slate-400 mt-1">Bấm nút "Khởi tạo Dự án Mới" ở góc trên để tạo dự án đầu tiên.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {projects.map(project => {
                const statusInfo = STATUS_CONFIG[project.status] || {
                  label: project.status,
                  color: 'bg-slate-100 text-slate-700 border-slate-200'
                };
                const activeMembers = (project.members || []).filter(m => m.isActive);

                return (
                  <div
                    key={project.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden group"
                  >
                    {/* Card Top */}
                    <div className="p-5 flex-1 space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {project.projectCode}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              project.projectType === 'INTERNAL'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {project.projectType === 'INTERNAL' ? 'Sản phẩm Nội bộ' : 'Dự án Khách hàng'}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition">
                            {project.projectName}
                          </h3>
                        </div>

                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {project.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {project.description}
                        </p>
                      )}

                      {/* Tech Stack Pills */}
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

                      {/* Timeline & Tech Lead */}
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{project.startDate || 'Chưa định'} → {project.endDate || 'Chưa định'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={13} className="text-purple-600" />
                          <span>Lead: <strong>{project.techLeadName}</strong></span>
                        </div>
                      </div>

                      {/* External links */}
                      <div className="flex items-center gap-3 pt-1 text-xs text-slate-500">
                        {project.gitRepoUrl && (
                          <a
                            href={project.gitRepoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                          >
                            <GitBranch size={13} />
                            <span>Git</span>
                          </a>
                        )}
                        {project.jiraUrl && (
                          <a
                            href={project.jiraUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                          >
                            <Kanban size={13} />
                            <span>Jira</span>
                          </a>
                        )}
                        {project.figmaUrl && (
                          <a
                            href={project.figmaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-blue-600 transition"
                          >
                            <Palette size={13} />
                            <span>Palette</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Members & Actions */}
                    <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5 overflow-hidden">
                          {activeMembers.slice(0, 4).map((m, idx) => (
                            <div
                              key={idx}
                              title={`${m.userName} (${m.projectRole}) - ${m.allocationPercent}%`}
                              className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white"
                            >
                              {m.userName ? m.userName.charAt(0) : 'U'}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {activeMembers.length} nhân sự ({project.totalAllocationSum}% tải)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setStaffingProject(project)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg shadow-2xs transition flex items-center gap-1"
                        >
                          <UserPlus size={13} />
                          <span>Phân bổ</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingProject(project);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 rounded-lg transition"
                          title="Sửa dự án"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          onClick={() => handleDeleteProject(project.id, project.projectName)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Xóa dự án"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BENCH & CAPACITY MONITORING */}
      {activeTab === 'bench' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-blue-900">Giám sát Năng lực & Ghế chờ (Bench Management)</h3>
              <p className="text-xs text-blue-700/80 mt-0.5">
                Theo dõi mức độ sử dụng thời gian của kỹ sư trong phòng. Kỹ sư có dung lượng trống (&gt; 0%) sẵn sàng được bốc vào dự án mới.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-slate-500">Tỷ lệ rảnh việc:</span>
              <p className="text-lg font-extrabold text-blue-700">
                {benchCount} / {totalEngineers} <span className="text-xs font-normal">kỹ sư</span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Kỹ sư</th>
                    <th className="py-3 px-4">Chức vụ / Phòng ban</th>
                    <th className="py-3 px-4">Mức độ phân bổ (% Tải)</th>
                    <th className="py-3 px-4">Dung lượng còn trống</th>
                    <th className="py-3 px-4">Dự án đang làm</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {benchUsers.map(user => {
                    const isOverloaded = user.totalAllocation > 100;
                    const isFull = user.totalAllocation === 100;
                    const isAvailable = user.availableCapacity > 0;

                    return (
                      <tr key={user.userId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {user.hoTen ? user.hoTen.charAt(0) : 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{user.hoTen}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-medium text-slate-800">{user.chucVu || 'Kỹ sư phần mềm'}</p>
                          <p className="text-[11px] text-slate-400">{user.departmentName}</p>
                        </td>

                        <td className="py-3.5 px-4 w-44">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span>{user.totalAllocation}%</span>
                              <span className={isOverloaded ? 'text-red-600' : 'text-slate-400'}>
                                {isOverloaded ? 'Quá tải' : 'Tối đa 100%'}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isOverloaded
                                    ? 'bg-red-500'
                                    : isFull
                                    ? 'bg-emerald-500'
                                    : 'bg-blue-500'
                                }`}
                                style={{ width: `${Math.min(100, user.totalAllocation)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {user.availableCapacity > 0 ? (
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Rảnh {user.availableCapacity}%
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">Hết dung lượng</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {user.activeProjectNames && user.activeProjectNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {user.activeProjectNames.map((pName, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80"
                                >
                                  {pName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa có dự án (Đang ngồi Bench)</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isOverloaded ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                              <AlertTriangle size={11} /> Quá tải
                            </span>
                          ) : isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={11} /> Có thể gán việc
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                              <CheckCircle2 size={11} /> Full 100%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialData={editingProject}
        onSuccess={() => {
          fetchProjects();
          fetchBench();
        }}
      />

      <StaffingModal
        isOpen={!!staffingProject}
        onClose={() => setStaffingProject(null)}
        project={staffingProject}
        onSuccess={() => {
          fetchProjects();
          fetchBench();
          if (staffingProject) {
            // refresh project data for modal
            api.get(`/api/tech/projects/${staffingProject.id}`).then(res => {
              if (res.data?.data) setStaffingProject(res.data.data);
            });
          }
        }}
      />
    </div>
  );
}
