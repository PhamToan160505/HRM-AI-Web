import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderGit2,
  Plus,
  Users,
  Cpu,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Activity,
  Layers,
  CheckCircle2,
  Trash2,
  X,
  Briefcase,
} from 'lucide-react';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import { PROJECT_STATUS_CONFIG, computeTimelineHealth } from './techHelpers';
import ProjectsPortfolioTab from './components/ProjectsPortfolioTab';
import CapacityBenchTab from './components/CapacityBenchTab';
import SkillsMatrixTab from './components/SkillsMatrixTab';
import ProjectFormModal from './components/ProjectFormModal';
import StaffingModal from './components/StaffingModal';
import ProjectDetailModal from './components/ProjectDetailModal';
import TechProfileModal from './components/TechProfileModal';
import ProjectSelectModal from './components/ProjectSelectModal';

function StatusDonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white px-3 py-2 rounded-xl shadow-lg border border-blue-800 text-xs tabular">
      <p className="font-bold">{d.label}</p>
      <p className="text-blue-100 mt-0.5">
        <strong className="text-white">{d.value}</strong> dự án ({d.percent}%)
      </p>
    </div>
  );
}

export default function TechProjectListPage() {
  const { user } = useAuth();
  const roleNormalized = user?.role?.toLowerCase() || '';
  const isCeo = roleNormalized === 'ceo';
  const isReadOnly = isCeo;

  const roleBadgeLabel =
    roleNormalized === 'giam_doc_phong_ban'
      ? 'Giám đốc Công nghệ • Điều hành'
      : roleNormalized === 'truong_phong'
      ? 'Trưởng phòng Công nghệ • Điều phối'
      : isCeo
      ? 'Giám sát Điều hành (Chỉ xem)'
      : 'Quản lý Công nghệ';

  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Data states
  const [projects, setProjects] = useState([]);
  const [benchUsers, setBenchUsers] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Navigation & filter states
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'bench' | 'skills'
  const [projectStatusFilter, setProjectStatusFilter] = useState('');

  // Nested / Stacked Modals
  const [selectedDetailProject, setSelectedDetailProject] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [staffingProject, setStaffingProject] = useState(null);
  const [staffingInitialUserId, setStaffingInitialUserId] = useState(null);
  const [staffingInitialAllocation, setStaffingInitialAllocation] = useState(null);

  // Engineer Tech Profile & Quick Project Selection
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loadingProfileId, setLoadingProfileId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [projectSelectCandidate, setProjectSelectCandidate] = useState(null);

  // Delete Confirm Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    projectId: null,
    projectName: '',
  });
  const [deleting, setDeleting] = useState(false);

  const loadAllData = useCallback(async ({ manual = false, quiet = false } = {}) => {
    try {
      if (manual) setRefreshing(true);
      else if (!quiet) setLoading(true);
      if (!quiet) setErrorMsg('');

      const [projRes, benchRes, matrixRes, skillsRes] = await Promise.all([
        api.get('/api/tech/projects'),
        api.get('/api/tech/projects/bench'),
        api.get('/api/tech/skills/matrix'),
        api.get('/api/tech/skills'),
      ]);

      setProjects(projRes.data?.data || []);
      setBenchUsers(benchRes.data?.data || []);
      setMatrixData(matrixRes.data?.data || []);
      setAvailableSkills(skillsRes.data?.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Lỗi tải dữ liệu dự án công nghệ:', err);
      const msg = err.response?.data?.message || 'Không thể kết nối máy chủ để tải dữ liệu phòng Công nghệ.';
      if (!quiet) setErrorMsg(msg);
      toastRef.current?.show('Lỗi tải dữ liệu', msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Body overflow + Esc key management for Delete Confirm Dialog
  useEffect(() => {
    if (!deleteConfirm.isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) {
        e.stopPropagation();
        setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' });
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
  }, [deleteConfirm.isOpen, deleting]);

  const handleInspectEngineer = useCallback(
    async (userId) => {
      if (!userId || loadingProfileId === userId) return;
      try {
        setLoadingProfileId(userId);
        const res = await api.get(`/api/tech/skills/profile/${userId}`);
        if (res.data?.data) {
          setSelectedProfile(res.data.data);
        }
      } catch (err) {
        console.error('Lỗi tải Tech Profile:', err);
        toastRef.current?.show('Lỗi', 'Không thể tải hồ sơ năng lực kỹ sư', 'error');
      } finally {
        setLoadingProfileId(null);
      }
    },
    [loadingProfileId]
  );

  const handleVerifySkill = useCallback(
    async (userTechSkillId, hoTen, skillName) => {
      if (isReadOnly || !userTechSkillId || verifyingId === userTechSkillId) return;
      try {
        setVerifyingId(userTechSkillId);
        await api.put(`/api/tech/skills/${userTechSkillId}/verify`);
        toastRef.current?.show(
          'Xác thực thành công',
          `Đã cấp tích xanh xác thực kỹ năng "${skillName}" cho ${hoTen}!`,
          'success'
        );

        await loadAllData({ quiet: true });
        if (selectedProfile?.userId) {
          const profileRes = await api.get(`/api/tech/skills/profile/${selectedProfile.userId}`);
          if (profileRes.data?.data) {
            setSelectedProfile(profileRes.data.data);
          }
        }
      } catch (err) {
        console.error('Lỗi xác thực kỹ năng:', err);
        toastRef.current?.show('Thất bại', err.response?.data?.message || 'Không thể xác thực kỹ năng', 'error');
      } finally {
        setVerifyingId(null);
      }
    },
    [isReadOnly, verifyingId, selectedProfile, loadAllData]
  );

  const handleOpenProjectSelect = useCallback((candidate) => {
    if (!candidate) return;
    setProjectSelectCandidate(candidate);
  }, []);

  const handleOpenProjectSelectFromBench = useCallback(
    (benchUser) => {
      if (!benchUser) return;
      const profileMatch = matrixData.find((m) => String(m.userId) === String(benchUser.userId));
      setProjectSelectCandidate({
        ...benchUser,
        skills: profileMatch?.skills || [],
      });
    },
    [matrixData]
  );

  const handleSelectProjectForCandidate = useCallback(
    (selectedProject) => {
      if (!projectSelectCandidate || !selectedProject) return;
      setStaffingInitialUserId(projectSelectCandidate.userId);
      setStaffingInitialAllocation(
        projectSelectCandidate.availableCapacity > 0 ? projectSelectCandidate.availableCapacity : 50
      );
      setStaffingProject(selectedProject);
      setProjectSelectCandidate(null);
    },
    [projectSelectCandidate]
  );

  const requestDeleteProject = useCallback((id, name) => {
    setDeleteConfirm({
      isOpen: true,
      projectId: id,
      projectName: name,
    });
  }, []);

  const handleConfirmDeleteProject = async () => {
    if (!deleteConfirm.projectId) return;
    try {
      setDeleting(true);
      const deletedId = deleteConfirm.projectId;
      await api.delete(`/api/tech/projects/${deletedId}`);
      toastRef.current?.show('Thành công', `Đã xóa dự án "${deleteConfirm.projectName}" thành công!`, 'success');
      setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' });
      if (selectedDetailProject && String(selectedDetailProject.id) === String(deletedId)) {
        setSelectedDetailProject(null);
      }
      await loadAllData({ quiet: true });
    } catch (err) {
      console.error(err);
      toastRef.current?.show('Lỗi', err.response?.data?.message || 'Không thể xóa dự án', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Telemetry KPIs & Real Portfolio Metrics
  const telemetry = useMemo(() => {
    const totalProjects = projects.length;
    const inProgress = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const planning = projects.filter((p) => p.status === 'PLANNING').length;
    const totalEngineers = benchUsers.length;

    const totalAllocatedPercent = benchUsers.reduce((acc, u) => acc + (u.totalAllocation || 0), 0);
    const totalAvailablePercent = benchUsers.reduce((acc, u) => acc + (u.availableCapacity || 0), 0);
    const benchCount = benchUsers.filter((u) => (u.availableCapacity || 0) > 0).length;
    const overloadedEngineers = benchUsers.filter((u) => (u.totalAllocation || 0) > 100 || u.isOverloaded).length;

    const avgUtilization = totalEngineers > 0 ? Math.round(totalAllocatedPercent / totalEngineers) : 0;
    const totalDeployedFte = (totalAllocatedPercent / 100).toFixed(1);
    const totalBenchFte = (totalAvailablePercent / 100).toFixed(1);

    let overdueProjects = 0;
    let missingLeadProjects = 0;
    projects.forEach((p) => {
      if (p.status === 'COMPLETED' || p.status === 'PAUSED') return;
      const health = computeTimelineHealth(p);
      if (health.tone === 'overdue') overdueProjects += 1;
      if (!p.techLeadName) missingLeadProjects += 1;
    });

    const riskCount = overloadedEngineers + overdueProjects + missingLeadProjects;

    const pendingSkillsCount = matrixData.reduce(
      (sum, prof) => sum + (prof.skills || []).filter((s) => !s.isVerified).length,
      0
    );

    const statusOrder = ['IN_PROGRESS', 'PLANNING', 'MAINTENANCE', 'COMPLETED', 'PAUSED'];
    const statusBreakdown = statusOrder
      .map((key) => {
        const count = projects.filter((p) => p.status === key).length;
        const cfg = PROJECT_STATUS_CONFIG[key];
        return {
          key,
          label: cfg.label,
          shortLabel: cfg.shortLabel,
          value: count,
          percent: totalProjects > 0 ? Math.round((count / totalProjects) * 100) : 0,
          color: cfg.chartColor,
        };
      })
      .filter((item) => item.value > 0);

    return {
      totalProjects,
      inProgress,
      planning,
      totalEngineers,
      totalAllocatedPercent,
      benchCount,
      overloadedEngineers,
      riskCount,
      pendingSkillsCount,
      avgUtilization,
      totalDeployedFte,
      totalBenchFte,
      statusBreakdown,
    };
  }, [projects, benchUsers, matrixData]);

  const tabs = [
    {
      id: 'projects',
      label: 'Danh mục Dự án',
      count: telemetry.totalProjects,
      icon: FolderGit2,
    },
    {
      id: 'bench',
      label: 'Công suất & Ghế chờ Bench',
      count: telemetry.totalEngineers,
      icon: Activity,
    },
    {
      id: 'skills',
      label: 'Ma trận Năng lực & Ghép nối',
      count: matrixData.length,
      pendingCount: !isReadOnly ? telemetry.pendingSkillsCount : 0,
      icon: Cpu,
    },
  ];

  const handleSelectStatusFromChart = (statusKey) => {
    setProjectStatusFilter((prev) => (prev === statusKey ? '' : statusKey));
    setActiveTab('projects');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* 1. Command Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#1E3A8A] text-white flex items-center justify-center shadow-sm shrink-0">
              <FolderGit2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight text-balance">
                  {isReadOnly ? 'Giám sát Dự án & Nguồn lực Công nghệ' : 'Quản lý Dự án & Đội ngũ Công nghệ'}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold whitespace-nowrap">
                  {isReadOnly ? <ShieldCheck size={12} /> : <Briefcase size={12} />}
                  <span>{roleBadgeLabel}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 text-pretty">
                {isReadOnly
                  ? 'Theo dõi tổng thể tiến độ dự án phần mềm, hiệu suất sử dụng kỹ sư và năng lực chuyên môn toàn phòng'
                  : 'Điều hành danh mục dự án phần mềm, phân bổ kỹ sư, duyệt kỹ năng chuyên môn và tối ưu ghế chờ (Bench)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {lastUpdated && (
              <span className="text-[11px] text-slate-400 tabular hidden sm:inline">
                Cập nhật lúc{' '}
                {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <button
              type="button"
              onClick={() => loadAllData({ manual: true })}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-600' : 'text-slate-500'} />
              <span>{refreshing ? 'Đang đồng bộ' : 'Làm mới'}</span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setEditingProject(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl shadow-xs text-xs sm:text-sm font-bold transition shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Plus size={17} />
                <span>Khởi tạo Dự án Mới</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-800">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => loadAllData()}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition cursor-pointer shrink-0"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 h-56 skeleton rounded-2xl" />
              <div className="lg:col-span-5 h-56 skeleton rounded-2xl" />
            </div>
            <div className="h-12 skeleton rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-60 skeleton rounded-2xl" />
              <div className="h-60 skeleton rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* 2. Bento Telemetry Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
            >
              {/* Left (7 cols): 4 Architectural Telemetry Wells */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(30,58,138,0.06)] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Well 1: Portfolio */}
                <button
                  type="button"
                  onClick={() => {
                    setProjectStatusFilter('');
                    setActiveTab('projects');
                  }}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Danh mục Dự án</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
                      <Layers size={16} />
                    </div>
                  </div>
                  <div className="tabular">
                    <p className="text-3xl font-extrabold text-slate-900">{telemetry.totalProjects}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      <strong className="text-emerald-700">{telemetry.inProgress} đang phát triển</strong> •{' '}
                      {telemetry.planning} lên kế hoạch
                    </p>
                  </div>
                </button>

                {/* Well 2: Deployed FTE */}
                <button
                  type="button"
                  onClick={() => setActiveTab('bench')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Nguồn lực Huy động</span>
                    <div className="w-8 h-8 rounded-lg bg-[#1E3A8A]/10 text-[#1E3A8A] flex items-center justify-center">
                      <Users size={16} />
                    </div>
                  </div>
                  <div className="tabular">
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-extrabold text-[#1E3A8A]">{telemetry.totalDeployedFte}</p>
                      <span className="text-xs font-bold text-slate-500">FTE đang chạy</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Quy mô đội ngũ: <strong className="text-slate-800">{telemetry.totalEngineers} kỹ sư</strong> ({telemetry.totalAllocatedPercent}% tải)
                    </p>
                  </div>
                </button>

                {/* Well 3: Utilization Rate */}
                <button
                  type="button"
                  onClick={() => setActiveTab('bench')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Hiệu suất Công suất Phòng</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border tabular ${
                        telemetry.avgUtilization > 100
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : telemetry.avgUtilization >= 80
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {telemetry.avgUtilization > 100 ? 'Căng tải' : telemetry.avgUtilization >= 80 ? 'Tối ưu' : 'Còn trống'}
                    </span>
                  </div>
                  <div className="space-y-2 tabular">
                    <div className="flex items-baseline justify-between">
                      <p className="text-2xl font-extrabold text-slate-900">{telemetry.avgUtilization}%</p>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        Ghế chờ trống: {telemetry.totalBenchFte} FTE
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          telemetry.avgUtilization > 100 ? 'bg-rose-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, telemetry.avgUtilization)}%` }}
                      />
                    </div>
                  </div>
                </button>

                {/* Well 4: Bench & Actionable Signals */}
                <button
                  type="button"
                  onClick={() => setActiveTab(telemetry.riskCount > 0 ? 'projects' : telemetry.pendingSkillsCount > 0 && !isReadOnly ? 'skills' : 'bench')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Ghế chờ &amp; Tín hiệu Vận hành</span>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        telemetry.riskCount > 0
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {telemetry.riskCount > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                  </div>
                  <div className="tabular flex items-end justify-between gap-2">
                    <div>
                      <p className="text-2xl font-extrabold text-emerald-700">
                        {telemetry.benchCount}{' '}
                        <span className="text-xs font-semibold text-slate-500">kỹ sư rảnh</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {telemetry.riskCount > 0 ? (
                          <span className="text-orange-700 font-semibold">
                            {telemetry.riskCount} điểm cần xử lý (quá tải / hạn chót)
                          </span>
                        ) : telemetry.pendingSkillsCount > 0 && !isReadOnly ? (
                          <span className="text-blue-700 font-semibold">
                            {telemetry.pendingSkillsCount} kỹ năng đang chờ thẩm định
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Vận hành an toàn, không có quá tải</span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Right (5 cols): Interactive Project Status Donut */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(30,58,138,0.06)] p-5 flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Phân bổ Trạng thái Dự án</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Bấm vào trạng thái bên phải để lọc nhanh danh mục dự án
                    </p>
                  </div>
                  {projectStatusFilter && (
                    <button
                      type="button"
                      onClick={() => setProjectStatusFilter('')}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer shrink-0"
                    >
                      Bỏ lọc
                    </button>
                  )}
                </div>

                {telemetry.statusBreakdown.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-8">
                    Chưa có dự án công nghệ nào trong hệ thống.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 flex-1">
                    {/* Donut Chart */}
                    <div className="sm:col-span-5 h-44 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={telemetry.statusBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={72}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                            onClick={(entry) => handleSelectStatusFromChart(entry.key)}
                            className="cursor-pointer"
                          >
                            {telemetry.statusBreakdown.map((entry) => (
                              <Cell
                                key={entry.key}
                                fill={entry.color}
                                opacity={
                                  !projectStatusFilter || projectStatusFilter === entry.key ? 1 : 0.3
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<StatusDonutTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none tabular">
                        <span className="text-2xl font-extrabold text-slate-900 leading-none">
                          {telemetry.totalProjects}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 mt-1">Dự án</span>
                      </div>
                    </div>

                    {/* Interactive Status Legend */}
                    <div className="sm:col-span-7 space-y-1.5">
                      {telemetry.statusBreakdown.map((item) => {
                        const isSelected = projectStatusFilter === item.key;
                        return (
                          <button
                            type="button"
                            key={item.key}
                            onClick={() => handleSelectStatusFromChart(item.key)}
                            className={`w-full px-3 py-2 rounded-xl border text-left transition flex items-center justify-between gap-2 text-xs cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50 border-blue-400'
                                : 'bg-slate-50/70 border-slate-200/70 hover:border-blue-300 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-semibold text-slate-800 truncate">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 tabular">
                              <span className="font-bold text-slate-900">{item.value}</span>
                              <span className="text-[11px] text-slate-400 w-9 text-right">
                                {item.percent}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* 3. Segmented Executive Navigation Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-1.5 inline-flex flex-wrap items-center gap-1 shadow-2xs">
              {tabs.map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                      isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="mgr-tech-active-tab-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-[#1E3A8A] rounded-xl shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <IconComp size={16} />
                      <span>{tab.label}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full tabular ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                      {tab.pendingCount > 0 && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular ${
                            isActive
                              ? 'bg-orange-500 text-white'
                              : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}
                          title={`${tab.pendingCount} kỹ năng chờ duyệt xác thực`}
                        >
                          {tab.pendingCount} chờ duyệt
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 4. Active Tab Workspace */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeTab === 'projects' && (
                  <ProjectsPortfolioTab
                    projects={projects}
                    statusFilter={projectStatusFilter}
                    onChangeStatusFilter={setProjectStatusFilter}
                    onSelectProject={setSelectedDetailProject}
                    onOpenStaffing={!isReadOnly ? (proj) => setStaffingProject(proj) : undefined}
                    onOpenEdit={
                      !isReadOnly
                        ? (proj) => {
                            setEditingProject(proj);
                            setIsFormOpen(true);
                          }
                        : undefined
                    }
                    onRequestDelete={!isReadOnly ? requestDeleteProject : undefined}
                    onOpenCreate={
                      !isReadOnly
                        ? () => {
                            setEditingProject(null);
                            setIsFormOpen(true);
                          }
                        : undefined
                    }
                    isReadOnly={isReadOnly}
                  />
                )}

                {activeTab === 'bench' && (
                  <CapacityBenchTab
                    benchUsers={benchUsers}
                    onInspectEngineer={handleInspectEngineer}
                    onQuickAssign={!isReadOnly ? handleOpenProjectSelectFromBench : undefined}
                    isReadOnly={isReadOnly}
                  />
                )}

                {activeTab === 'skills' && (
                  <SkillsMatrixTab
                    matrixData={matrixData}
                    availableSkills={availableSkills}
                    isReadOnly={isReadOnly}
                    onInspectEngineer={handleInspectEngineer}
                    onOpenProjectSelect={!isReadOnly ? handleOpenProjectSelect : undefined}
                    onVerifySkill={!isReadOnly ? handleVerifySkill : undefined}
                    verifyingId={verifyingId}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* ── Stacked Operational Modals ───────────────────────────────────── */}
        {!isReadOnly && (
          <>
            <ProjectFormModal
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              initialData={editingProject}
              onSuccess={async () => {
                await loadAllData({ quiet: true });
                if (selectedDetailProject?.id) {
                  try {
                    const res = await api.get(`/api/tech/projects/${selectedDetailProject.id}`);
                    if (res.data?.data) setSelectedDetailProject(res.data.data);
                  } catch (err) {
                    console.error(err);
                  }
                }
              }}
            />

            <StaffingModal
              isOpen={!!staffingProject}
              onClose={() => {
                setStaffingProject(null);
                setStaffingInitialUserId(null);
                setStaffingInitialAllocation(null);
              }}
              project={staffingProject}
              initialUserId={staffingInitialUserId}
              initialAllocation={staffingInitialAllocation}
              onSuccess={async () => {
                const targetProjectId = staffingProject?.id;
                await loadAllData({ quiet: true });
                if (targetProjectId) {
                  try {
                    const res = await api.get(`/api/tech/projects/${targetProjectId}`);
                    if (res.data?.data) {
                      setStaffingProject(res.data.data);
                      if (selectedDetailProject && String(selectedDetailProject.id) === String(targetProjectId)) {
                        setSelectedDetailProject(res.data.data);
                      }
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }
                if (selectedProfile?.userId) {
                  try {
                    const profRes = await api.get(`/api/tech/skills/profile/${selectedProfile.userId}`);
                    if (profRes.data?.data) setSelectedProfile(profRes.data.data);
                  } catch (err) {
                    console.error(err);
                  }
                }
              }}
            />

            <ProjectSelectModal
              isOpen={!!projectSelectCandidate}
              onClose={() => setProjectSelectCandidate(null)}
              candidate={projectSelectCandidate}
              projects={projects}
              onSelectProject={handleSelectProjectForCandidate}
            />
          </>
        )}

        {/* Level 1 Modal: Project Detail (supports nested Tech Profile, Staffing, Form) */}
        <ProjectDetailModal
          isOpen={!!selectedDetailProject}
          onClose={() => setSelectedDetailProject(null)}
          project={selectedDetailProject}
          onInspectEngineer={handleInspectEngineer}
          onOpenStaffing={!isReadOnly ? (proj) => setStaffingProject(proj) : undefined}
          onOpenEdit={
            !isReadOnly
              ? (proj) => {
                  setEditingProject(proj);
                  setIsFormOpen(true);
                }
              : undefined
          }
          hasTopModalOpen={
            isFormOpen ||
            !!staffingProject ||
            !!selectedProfile ||
            !!projectSelectCandidate ||
            deleteConfirm.isOpen
          }
        />

        {/* Level 1/2 Modal: Engineer 6-Axis Tech Profile (with Verify Skill & Allocate actions) */}
        <TechProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          isReadOnly={isReadOnly}
          onVerifySkill={!isReadOnly ? handleVerifySkill : undefined}
          verifyingId={verifyingId}
          onOpenProjectSelect={!isReadOnly ? handleOpenProjectSelect : undefined}
          zIndexClass={selectedDetailProject ? 'z-[9990]' : 'z-[9985]'}
          hasTopModalOpen={!!projectSelectCandidate || !!staffingProject}
        />

        {/* Level 3 Confirm Dialog: Delete Project */}
        {!isReadOnly &&
          deleteConfirm.isOpen &&
          createPortal(
            <div
              data-tech-modal="true"
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget && !deleting) {
                  setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' });
                }
              }}
            >
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden border border-slate-200 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                    <Trash2 size={22} />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h3 className="text-base font-bold text-slate-900">Xác nhận xóa dự án</h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      Bạn có chắc chắn muốn xóa dự án{' '}
                      <strong className="text-slate-800">{deleteConfirm.projectName}</strong> không? Toàn bộ danh sách thành viên phân bổ sẽ được giải phóng và hoàn trả % công suất về ghế chờ (Bench).
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' })}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                    aria-label="Đóng hộp thoại"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' })}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleConfirmDeleteProject}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa dự án'}</span>
                  </button>
                </div>
              </motion.div>
            </div>,
            document.body
          )}
      </div>
    </MotionConfig>
  );
}