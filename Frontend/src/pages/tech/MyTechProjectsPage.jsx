import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FolderGit2,
  GitBranch,
  Kanban,
  Palette,
  Layers,
  Award,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Calendar,
  Eye,
  Search,
  X,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import MyTechProfileTab from './components/MyTechProfileTab';
import ProjectDetailModal from './components/ProjectDetailModal';
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_ROLE_LABELS,
  formatDateVN,
  computeTimelineHealth,
} from './techHelpers';

const SLICE_PALETTE = ['#1E3A8A', '#2563EB', '#0284C7', '#0D9488', '#EA580C'];

function WorkloadDonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0F2557] text-white px-3 py-2 rounded-xl shadow-lg border border-blue-800 text-xs tabular max-w-xs">
      <p className="font-bold truncate">{d.label}</p>
      <p className="text-blue-100 mt-0.5">
        Tỷ trọng công suất: <strong className="text-white">{d.value}%</strong>
      </p>
    </div>
  );
}

export default function MyTechProjectsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'profile'
  const [projects, setProjects] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [keyword, setKeyword] = useState('');
  const [selectedDetailProject, setSelectedDetailProject] = useState(null);

  const loadAllData = useCallback(async ({ manual = false, quiet = false } = {}) => {
    try {
      if (manual) setRefreshing(true);
      else if (!quiet) setLoading(true);
      if (!quiet) setErrorMsg('');

      const [projRes, profRes] = await Promise.all([
        api.get('/api/tech/projects/my-projects'),
        api.get('/api/tech/skills/my-profile'),
      ]);

      setProjects(projRes.data?.data || []);
      setMyProfile(profRes.data?.data || null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Lỗi tải dữ liệu dự án cá nhân:', err);
      const msg = err.response?.data?.message || 'Không thể tải dữ liệu dự án và hồ sơ năng lực của bạn.';
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

  const getMyMembership = useCallback(
    (project) => {
      return (project.members || []).find(
        (m) => m.isActive && (m.userEmail === user?.email || m.userId === user?.userId)
      );
    },
    [user]
  );

  const telemetry = useMemo(() => {
    const activeAlloc = projects.reduce((sum, p) => {
      const mem = getMyMembership(p);
      return sum + (mem?.allocationPercent || 0);
    }, 0);

    const inProgressCount = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const leadCount = projects.filter((p) => getMyMembership(p)?.projectRole === 'TECH_LEAD').length;
    const freeCapacity = Math.max(0, 100 - activeAlloc);

    const skills = myProfile?.skills || [];
    const totalSkills = myProfile?.totalSkills ?? skills.length;
    const verifiedSkills = myProfile?.verifiedSkills ?? skills.filter((s) => s.isVerified).length;
    const verifyRate = totalSkills > 0 ? Math.round((verifiedSkills / totalSkills) * 100) : 0;

    const certs = myProfile?.certificates || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const validCertCount = certs.filter((c) => !c.expiryDate || c.expiryDate >= todayStr).length;

    // Donut slices directly from real memberships + free Bench
    const slices = projects
      .map((p, idx) => {
        const mem = getMyMembership(p);
        const val = mem?.allocationPercent || 0;
        if (val <= 0) return null;
        return {
          key: `proj-${p.id}`,
          project: p,
          label: p.projectName,
          code: p.projectCode,
          value: val,
          color: SLICE_PALETTE[idx % SLICE_PALETTE.length],
        };
      })
      .filter(Boolean);

    if (freeCapacity > 0) {
      slices.push({
        key: 'free-bench',
        project: null,
        label: 'Dung lượng trống (Bench)',
        code: 'BENCH',
        value: freeCapacity,
        color: '#E2E8F0',
      });
    }

    return {
      activeAlloc,
      freeCapacity,
      inProgressCount,
      leadCount,
      totalSkills,
      verifiedSkills,
      verifyRate,
      totalCerts: certs.length,
      validCertCount,
      slices,
    };
  }, [projects, myProfile, getMyMembership]);

  const filteredProjects = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return projects;
    return projects.filter((p) => {
      const matchName = p.projectName?.toLowerCase().includes(kw);
      const matchCode = p.projectCode?.toLowerCase().includes(kw);
      const matchLead = p.techLeadName?.toLowerCase().includes(kw);
      const matchTech = (p.techStack || []).some((t) => t.toLowerCase().includes(kw));
      return matchName || matchCode || matchLead || matchTech;
    });
  }, [projects, keyword]);

  const tabs = [
    {
      id: 'projects',
      label: 'Dự án đang tham gia',
      count: projects.length,
      icon: FolderGit2,
    },
    {
      id: 'profile',
      label: 'Hồ sơ Năng lực Kỹ thuật',
      count: telemetry.totalSkills,
      icon: Award,
    },
  ];

  const isOverloaded = telemetry.activeAlloc > 100;
  const isFull = telemetry.activeAlloc === 100;

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
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight text-balance">
                Dự án Công nghệ &amp; Năng lực của tôi
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 text-pretty">
                Theo dõi các dự án phần mềm đang tham gia, vai trò chuyên môn, tài nguyên kỹ thuật và hồ sơ năng lực cá nhân
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

            <div
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold tabular shrink-0 ${
                isOverloaded
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isFull
                  ? 'bg-blue-50 text-[#1E3A8A] border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              <Activity size={14} className="shrink-0" />
              <span>
                Tải cá nhân: {telemetry.activeAlloc}% / 100%
              </span>
            </div>
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

        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 h-52 skeleton rounded-2xl" />
              <div className="lg:col-span-5 h-52 skeleton rounded-2xl" />
            </div>
            <div className="h-12 skeleton rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-64 skeleton rounded-2xl" />
              <div className="h-64 skeleton rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* 2. Personal Telemetry & Workload Breakdown Bento */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5"
            >
              {/* Left (7 cols): 4 Personal KPI Wells */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(30,58,138,0.06)] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Well 1 */}
                <button
                  type="button"
                  onClick={() => setActiveTab('projects')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Dự án đang tham gia</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
                      <Layers size={16} />
                    </div>
                  </div>
                  <div className="tabular">
                    <p className="text-3xl font-extrabold text-slate-900">{projects.length}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      <strong className="text-emerald-700">{telemetry.inProgressCount} đang phát triển</strong>
                      {telemetry.leadCount > 0 && ` • ${telemetry.leadCount} vai trò Tech Lead`}
                    </p>
                  </div>
                </button>

                {/* Well 2 */}
                <div className="p-4 rounded-xl bg-slate-50/75 border border-slate-200/75 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Công suất Công việc</span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                        isOverloaded
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : isFull
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isOverloaded ? 'Quá tải' : isFull ? 'Full 100%' : `Còn trống ${telemetry.freeCapacity}%`}
                    </span>
                  </div>
                  <div className="space-y-2 tabular">
                    <div className="flex items-baseline justify-between">
                      <p
                        className={`text-2xl font-extrabold ${
                          isOverloaded ? 'text-rose-600' : 'text-[#1E3A8A]'
                        }`}
                      >
                        {telemetry.activeAlloc}%
                      </p>
                      <span className="text-[11px] font-medium text-slate-500">Định mức 100%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isOverloaded ? 'bg-rose-600' : isFull ? 'bg-blue-600' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, telemetry.activeAlloc)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Well 3 */}
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Kỹ năng đã Xác thực</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <CheckCircle2 size={16} />
                    </div>
                  </div>
                  <div className="tabular">
                    <p className="text-2xl font-extrabold text-slate-900">
                      {telemetry.verifiedSkills}{' '}
                      <span className="text-sm font-semibold text-slate-400">/ {telemetry.totalSkills}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Đạt tỷ lệ thẩm định <strong className="text-blue-700">{telemetry.verifyRate}%</strong>
                    </p>
                  </div>
                </button>

                {/* Well 4 */}
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Chứng chỉ Quốc tế</span>
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Award size={16} />
                    </div>
                  </div>
                  <div className="tabular">
                    <p className="text-2xl font-extrabold text-slate-900">{telemetry.totalCerts}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      <strong className="text-emerald-700">{telemetry.validCertCount} chứng chỉ</strong> đang còn hiệu lực
                    </p>
                  </div>
                </button>
              </div>

              {/* Right (5 cols): Interactive Personal Workload Breakdown Donut */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_24px_-4px_rgba(30,58,138,0.06)] p-5 flex flex-col justify-between space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Cơ cấu Công suất theo Dự án</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bấm vào tên dự án bên phải để mở xem thông tin chi tiết
                  </p>
                </div>

                {telemetry.slices.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-8">
                    Chưa có dữ liệu phân bổ công việc.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-3 flex-1">
                    <div className="sm:col-span-5 h-44 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={telemetry.slices}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                            onClick={(entry) => {
                              if (entry?.project) setSelectedDetailProject(entry.project);
                            }}
                            className="cursor-pointer"
                          >
                            {telemetry.slices.map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<WorkloadDonutTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none tabular">
                        <span
                          className={`text-xl font-extrabold leading-none ${
                            isOverloaded ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {telemetry.activeAlloc}%
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 mt-1">Tổng tải</span>
                      </div>
                    </div>

                    <div className="sm:col-span-7 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {telemetry.slices.map((item) => {
                        const ClickTag = item.project ? 'button' : 'div';
                        return (
                          <ClickTag
                            key={item.key}
                            {...(item.project
                              ? { type: 'button', onClick: () => setSelectedDetailProject(item.project) }
                              : {})}
                            className={`w-full px-3 py-2 rounded-xl border text-left transition flex items-center justify-between gap-2 text-xs ${
                              item.project
                                ? 'bg-slate-50/80 border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer'
                                : 'bg-slate-50/40 border-slate-200/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="font-semibold text-slate-800 truncate">{item.label}</span>
                            </div>
                            <span className="font-bold text-slate-900 shrink-0 tabular">{item.value}%</span>
                          </ClickTag>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* 3. Segmented Navigation Tabs */}
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
                        layoutId="emp-tech-active-tab-pill"
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
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 4. Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeTab === 'projects' && (
                  <div className="space-y-4">
                    {projects.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="Tìm tên dự án, mã PRJ-, công nghệ Tech Stack..."
                            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
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
                        <span className="text-xs text-slate-500 tabular">
                          Hiển thị <strong className="text-slate-800">{filteredProjects.length}</strong> / {projects.length} dự án
                        </span>
                      </div>
                    )}

                    {projects.length === 0 ? (
                      <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
                        <Layers size={42} className="mx-auto text-slate-300" />
                        <h3 className="text-base font-bold text-slate-800">Bạn hiện chưa tham gia dự án nào</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                          Hiện tại bạn đang ở trạng thái <strong>Ghế chờ (Bench)</strong> với 100% dung lượng sẵn sàng. Hãy cập nhật đầy đủ kỹ năng và chứng chỉ để Trưởng phòng ghép nối dự án phù hợp nhất!
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('profile')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          <Award size={14} />
                          <span>Cập nhật Hồ sơ Kỹ năng ngay</span>
                        </button>
                      </div>
                    ) : filteredProjects.length === 0 ? (
                      <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-6 space-y-2">
                        <FolderGit2 size={34} className="mx-auto text-slate-300" />
                        <p className="text-sm font-bold text-slate-700">Không tìm thấy dự án khớp từ khóa</p>
                        <button
                          type="button"
                          onClick={() => setKeyword('')}
                          className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Xóa tìm kiếm
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredProjects.map((project) => {
                          const statusInfo = PROJECT_STATUS_CONFIG[project.status] || {
                            label: project.status,
                            badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                          };
                          const myMem = getMyMembership(project);
                          const roleConfig = myMem
                            ? PROJECT_ROLE_LABELS[myMem.projectRole] || {
                                label: myMem.projectRole,
                                shortLabel: myMem.projectRole,
                                badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
                              }
                            : null;
                          const isLead = myMem?.projectRole === 'TECH_LEAD';
                          const teammates = (project.members || []).filter((m) => m.isActive);
                          const timeline = computeTimelineHealth(project);

                          return (
                            <div
                              key={project.id}
                              onClick={() => setSelectedDetailProject(project)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedDetailProject(project);
                                }
                              }}
                              className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_28px_-6px_rgba(37,99,235,0.14)] transition flex flex-col overflow-hidden group cursor-pointer text-left"
                            >
                              <div className="p-5 flex-1 space-y-4">
                                {/* Top Badges & My Role */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular">
                                        {project.projectCode}
                                      </span>
                                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${statusInfo.badgeClass}`}>
                                        {statusInfo.label}
                                      </span>
                                    </div>
                                    <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                                      {project.projectName}
                                    </h2>
                                  </div>

                                  {roleConfig && (
                                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap ${roleConfig.badgeClass}`}>
                                        {isLead && <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />}
                                        {roleConfig.shortLabel || roleConfig.label}
                                      </span>
                                      <span className="text-[11px] font-bold text-blue-700 tabular">
                                        Phân bổ: {myMem.allocationPercent}% tải
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed min-h-[2.25rem]">
                                  {project.description || 'Chưa có mô tả chi tiết cho dự án này.'}
                                </p>

                                {/* Tech Stack */}
                                {project.techStack && project.techStack.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {project.techStack.map((tech, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200/80"
                                      >
                                        {tech}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Timeline Progress & Tech Lead */}
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

                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-0.5">
                                    <UserCheck size={13} className="text-blue-600 shrink-0" />
                                    <span>
                                      Tech Lead:{' '}
                                      <strong className={project.techLeadName ? 'text-slate-900' : 'text-orange-600'}>
                                        {project.techLeadName || 'Chưa chỉ định'}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                {/* Teammates List */}
                                <div className="space-y-1.5">
                                  <span className="text-[11px] font-bold text-slate-500 block">
                                    Đồng đội cùng dự án ({teammates.length} người)
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {teammates.map((m) => {
                                      const tmRole = PROJECT_ROLE_LABELS[m.projectRole]?.shortLabel || m.projectRole;
                                      return (
                                        <div
                                          key={m.id}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700"
                                        >
                                          <div className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {m.userName ? m.userName.charAt(0).toUpperCase() : 'U'}
                                          </div>
                                          <span className="font-semibold text-slate-800">{m.userName}</span>
                                          <span className="text-[10px] text-slate-500">({tmRole})</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* External Links + View Detail Footer */}
                              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-3 text-slate-600 flex-wrap">
                                  {project.gitRepoUrl && (
                                    <a
                                      href={project.gitRepoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 hover:text-blue-600 font-medium transition"
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
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 hover:text-blue-600 font-medium transition"
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
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 hover:text-blue-600 font-medium transition"
                                    >
                                      <Palette size={13} />
                                      <span>Figma Design</span>
                                    </a>
                                  )}

                                  {!project.gitRepoUrl && !project.jiraUrl && !project.figmaUrl && (
                                    <span className="text-[11px] text-slate-400 italic">Chưa gắn link công cụ</span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDetailProject(project);
                                  }}
                                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#1E3A8A] text-[#1E3A8A] hover:text-white border border-blue-200 hover:border-[#1E3A8A] rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                                >
                                  <Eye size={13} />
                                  <span>Xem chi tiết</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'profile' && (
                  <MyTechProfileTab
                    externalProfile={myProfile}
                    onRefreshProfile={() => loadAllData({ quiet: true })}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* Popup Xem Chi tiết Dự án (Chế độ Read-Only cho Kỹ sư — Không hiển thị Sửa / Phân bổ / Tech Profile đồng đội) */}
        <ProjectDetailModal
          isOpen={!!selectedDetailProject}
          onClose={() => setSelectedDetailProject(null)}
          project={selectedDetailProject}
        />
      </div>
    </MotionConfig>
  );
}