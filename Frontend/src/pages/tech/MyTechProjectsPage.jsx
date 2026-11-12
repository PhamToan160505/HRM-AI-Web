import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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
  Clock,
  Plus,
  Edit3,
  Trash2,
  Flag,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/Toast';
import MyTechProfileTab from './components/MyTechProfileTab';
import ProjectDetailModal from './components/ProjectDetailModal';
import WorklogModal from './components/WorklogModal';
import TechMonthPicker from './components/TechMonthPicker';
import {
  PROJECT_STATUS_CONFIG,
  PROJECT_ROLE_LABELS,
  WORKLOG_TYPE_CONFIG,
  WORKLOG_STATUS_CONFIG,
  formatDateVN,
  formatHours,
  getCurrentMonthStr,
  formatMonthShortVN,
  computeTimelineHealth,
  scrollElementIntoViewCleanly,
  matchWorklogFromFocusRequest,
} from './techHelpers';
import {
  isMatchingLiveNotificationNavToken,
  clearLiveNotificationNavToken,
} from '../../utils/notificationUtils';

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

const VALID_TABS = ['projects', 'timesheet', 'profile'];

export default function MyTechProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const initialTabFromQuery = VALID_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'projects';
  const queryMonthInit = searchParams.get('month');
  const initialMonthFromQuery =
    queryMonthInit && /^\d{4}-\d{2}$/.test(queryMonthInit)
      ? queryMonthInit
      : getCurrentMonthStr();

  const [activeTab, setActiveTab] = useState(initialTabFromQuery); // 'projects' | 'timesheet' | 'profile'
  const [projects, setProjects] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(initialMonthFromQuery);
  const selectedMonthRef = useRef(selectedMonth);
  selectedMonthRef.current = selectedMonth;
  const [worklogSummary, setWorklogSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const lastFetchTimeRef = useRef(0);

  const [keyword, setKeyword] = useState('');
  const [selectedDetailProject, setSelectedDetailProject] = useState(null);
  const [focusWorklogRequest, setFocusWorklogRequest] = useState(null);
  const [highlightState, setHighlightState] = useState(null);
  const highlightedWorklogId = highlightState?.id || null;
  const myWorklogTableRef = useRef(null);
  const lastAppliedFocusRef = useRef(0);
  const lastScrolledFocusRef = useRef(0);

  // Worklog Modal & Filters state
  const [isWorklogModalOpen, setIsWorklogModalOpen] = useState(false);
  const [worklogInitialProjectId, setWorklogInitialProjectId] = useState(null);
  const [editingWorklog, setEditingWorklog] = useState(null);
  const [wlProjectFilter, setWlProjectFilter] = useState('');
  const [wlStatusFilter, setWlStatusFilter] = useState('');
  const [wlMonthOnly, setWlMonthOnly] = useState(true);
  const [deleteWorklogTarget, setDeleteWorklogTarget] = useState(null);
  const [deletingWorklog, setDeletingWorklog] = useState(false);

  const loadAllData = useCallback(async ({ manual = false, quiet = false } = {}) => {
    try {
      if (manual) setRefreshing(true);
      else if (!quiet) setLoading(true);
      if (!quiet) setErrorMsg('');

      const activeMonth = selectedMonthRef.current || getCurrentMonthStr();
      const [projRes, profRes, wlRes] = await Promise.all([
        api.get('/api/tech/projects/my-projects'),
        api.get('/api/tech/skills/my-profile'),
        api.get('/api/tech/worklogs/my', { params: { month: activeMonth } }),
      ]);

      const freshProjects = projRes.data?.data || [];
      setProjects(freshProjects);
      setSelectedDetailProject((prev) =>
        prev ? freshProjects.find((p) => String(p.id) === String(prev.id)) || prev : prev
      );
      setMyProfile(profRes.data?.data || null);
      setWorklogSummary(wlRes.data?.data || null);
      setLastUpdated(new Date());
      lastFetchTimeRef.current = Date.now();
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

  const handleMonthChange = useCallback(async (newMonth) => {
    const safeMonth = newMonth || getCurrentMonthStr();
    selectedMonthRef.current = safeMonth;
    setSelectedMonth(safeMonth);
    try {
      const wlRes = await api.get('/api/tech/worklogs/my', { params: { month: safeMonth } });
      setWorklogSummary(wlRes.data?.data || null);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      toastRef.current?.show('Lỗi', err.response?.data?.message || 'Không thể tải nhật ký giờ công theo tháng', 'error');
    }
  }, []);

  const handleSelectTab = useCallback(
    (tabId) => {
      const nextTab = VALID_TABS.includes(tabId) ? tabId : 'projects';
      setActiveTab(nextTab);
      const nextParams = new URLSearchParams();
      if (nextTab !== 'projects') nextParams.set('tab', nextTab);
      setSearchParams(nextParams, { replace: true });
      if (Date.now() - lastFetchTimeRef.current > 1500) {
        loadAllData({ quiet: true });
      }
    },
    [setSearchParams, loadAllData]
  );

  const handleFocusHandled = useCallback(
    (handledToken) => {
      clearLiveNotificationNavToken(handledToken);
      if (
        searchParams.has('worklogId') ||
        searchParams.has('userId') ||
        location.state?.fromNotificationAt
      ) {
        const cleaned = new URLSearchParams(searchParams);
        cleaned.delete('worklogId');
        cleaned.delete('userId');
        const cleanSearch = cleaned.toString();
        navigate(
          { pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' },
          { replace: true, state: null }
        );
      }
    },
    [searchParams, location.pathname, location.state, navigate]
  );

  // Đồng bộ URL query (?tab=timesheet&worklogId=...&month=... hoặc ?tab=profile / projects) CHỈ khi bấm "Xem chi tiết" từ Thông báo
  useEffect(() => {
    const queryTab = searchParams.get('tab');
    const queryWorklogId = searchParams.get('worklogId');
    const queryUserId = searchParams.get('userId');
    const queryMonth = searchParams.get('month');
    const fromNotifAt = location.state?.fromNotificationAt;
    const isLiveNotifClick = isMatchingLiveNotificationNavToken(fromNotifAt);

    if (queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) && queryMonth !== selectedMonthRef.current) {
      selectedMonthRef.current = queryMonth;
      setSelectedMonth(queryMonth);
    }

    if (queryTab && VALID_TABS.includes(queryTab)) {
      setActiveTab(queryTab);
    }

    if (isLiveNotifClick) {
      if (queryTab === 'timesheet') {
        setFocusWorklogRequest({
          worklogId: queryWorklogId || null,
          requestedAt: fromNotifAt,
          notificationContent: location.state?.notificationContent || '',
        });
        if (lastFetchTimeRef.current > 0) {
          loadAllData({ quiet: true });
        }
      } else {
        clearLiveNotificationNavToken(fromNotifAt);
        if (lastFetchTimeRef.current > 0) {
          loadAllData({ quiet: true });
        }
      }
    } else if (queryWorklogId || queryUserId || fromNotifAt) {
      // Sau F5 hoặc không bấm "Xem chi tiết": không tự cuộn và làm sạch tham số focus cũ trên URL
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('worklogId');
      cleaned.delete('userId');
      const cleanSearch = cleaned.toString();
      navigate(
        { pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' },
        { replace: true, state: null }
      );
    }
  }, [searchParams, location.pathname, location.state, navigate, loadAllData]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Đồng bộ dữ liệu Realtime qua WebSocket (Worklog đã duyệt/từ chối, kỹ năng mới xác thực, phân bổ dự án mới)
  useEffect(() => {
    let timerId = null;
    const scheduleQuietRefresh = () => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        loadAllData({ quiet: true });
      }, 180);
    };

    const handleRealtimeNotification = (e) => {
      const notifType = String(e?.detail?.loai || '').toUpperCase();
      if (notifType.startsWith('TECH_')) {
        scheduleQuietRefresh();
      }
    };

    const handleTechSync = () => {
      scheduleQuietRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchTimeRef.current > 3000) {
        scheduleQuietRefresh();
      }
    };

    window.addEventListener('hrm:notification', handleRealtimeNotification);
    window.addEventListener('hrm:tech-sync', handleTechSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('hrm:notification', handleRealtimeNotification);
      window.removeEventListener('hrm:tech-sync', handleTechSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadAllData]);

  useEffect(() => {
    if (!deleteWorklogTarget) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !deletingWorklog) {
        e.stopPropagation();
        setDeleteWorklogTarget(null);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => {
      window.removeEventListener('keydown', handleEsc, true);
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [deleteWorklogTarget, deletingWorklog]);

  const handleConfirmDeleteWorklog = async () => {
    if (!deleteWorklogTarget || deletingWorklog) return;
    try {
      setDeletingWorklog(true);
      await api.delete(`/api/tech/worklogs/${deleteWorklogTarget.id}`);
      toastRef.current?.show('Đã xóa', 'Đã xóa bản ghi nhật ký giờ công', 'success');
      setDeleteWorklogTarget(null);
      await loadAllData({ quiet: true });
    } catch (err) {
      toastRef.current?.show('Thất bại', err.response?.data?.message || 'Không thể xóa nhật ký giờ công', 'error');
    } finally {
      setDeletingWorklog(false);
    }
  };

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

  const filteredWorklogs = useMemo(() => {
    const list = worklogSummary?.worklogs || [];
    return list.filter((w) => {
      if (wlMonthOnly && selectedMonth && w.workDate && !String(w.workDate).startsWith(selectedMonth)) {
        return false;
      }
      if (wlProjectFilter && String(w.projectId) !== String(wlProjectFilter)) return false;
      if (wlStatusFilter && w.approvalStatus !== wlStatusFilter) return false;
      return true;
    });
  }, [worklogSummary, wlMonthOnly, selectedMonth, wlProjectFilter, wlStatusFilter]);

  useEffect(() => {
    const reqAt = focusWorklogRequest?.requestedAt;
    if (!reqAt || reqAt === lastAppliedFocusRef.current) return;
    lastAppliedFocusRef.current = reqAt;
    setWlProjectFilter('');
    setWlStatusFilter('');
    setWlMonthOnly(true);
  }, [focusWorklogRequest]);

  const hasWlSubFilters = Boolean(wlProjectFilter || wlStatusFilter);

  const matchedWorklogId = useMemo(() => {
    if (!focusWorklogRequest?.requestedAt || hasWlSubFilters) return null;
    const row = matchWorklogFromFocusRequest(filteredWorklogs, focusWorklogRequest, 'engineer');
    return row ? String(row.id) : null;
  }, [focusWorklogRequest, hasWlSubFilters, filteredWorklogs]);

  const hiddenInOtherMonth = useMemo(() => {
    const targetId = focusWorklogRequest?.worklogId ? String(focusWorklogRequest.worklogId) : null;
    if (!targetId || !wlMonthOnly || matchedWorklogId) return false;
    const allWorklogs = worklogSummary?.worklogs || [];
    return allWorklogs.some((w) => String(w.id) === targetId);
  }, [focusWorklogRequest, wlMonthOnly, matchedWorklogId, worklogSummary]);

  useEffect(() => {
    if (activeTab !== 'timesheet' || loading || hasWlSubFilters) return;
    const reqAt = focusWorklogRequest?.requestedAt;
    if (!reqAt || lastScrolledFocusRef.current === reqAt) return;

    if (hiddenInOtherMonth) {
      setWlMonthOnly(false);
      return;
    }

    if (focusWorklogRequest.worklogId && !matchedWorklogId) {
      const waitTimer = setTimeout(() => {
        if (lastScrolledFocusRef.current !== reqAt && myWorklogTableRef.current) {
          lastScrolledFocusRef.current = reqAt;
          scrollElementIntoViewCleanly(myWorklogTableRef.current, 'start');
          handleFocusHandled(reqAt);
        }
      }, 2200);
      return () => clearTimeout(waitTimer);
    }

    const targetId = matchedWorklogId;
    let initialTimer = null;
    let retryTimer = null;
    let realignTimer = null;

    const attemptScroll = (retryCount = 0) => {
      const rowEl = targetId ? document.getElementById(`my-worklog-row-${targetId}`) : null;
      const anchorEl = rowEl || myWorklogTableRef.current;
      if (!anchorEl || (targetId && !rowEl && retryCount < 8)) {
        if (retryCount < 8) {
          retryTimer = setTimeout(() => attemptScroll(retryCount + 1), 100);
        }
        return;
      }

      lastScrolledFocusRef.current = reqAt;
      if (targetId) {
        setHighlightState({ id: targetId, at: reqAt });
      }
      scrollElementIntoViewCleanly(anchorEl, rowEl ? 'center' : 'start');
      handleFocusHandled(reqAt);

      realignTimer = setTimeout(() => {
        const freshRowEl = targetId ? document.getElementById(`my-worklog-row-${targetId}`) : null;
        const freshAnchor = freshRowEl || myWorklogTableRef.current;
        if (freshAnchor) {
          scrollElementIntoViewCleanly(freshAnchor, freshRowEl ? 'center' : 'start');
        }
      }, 320);
    };

    initialTimer = setTimeout(() => attemptScroll(0), 220);

    return () => {
      clearTimeout(initialTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (realignTimer) clearTimeout(realignTimer);
    };
  }, [
    activeTab,
    loading,
    focusWorklogRequest,
    matchedWorklogId,
    hiddenInOtherMonth,
    hasWlSubFilters,
    handleFocusHandled,
  ]);

  useEffect(() => {
    if (!highlightState?.id) return;
    const clearTimer = setTimeout(() => {
      setHighlightState((prev) => (prev && prev.at === highlightState.at ? null : prev));
    }, 5000);
    return () => clearTimeout(clearTimer);
  }, [highlightState]);

  const tabs = [
    {
      id: 'projects',
      label: 'Dự án đang tham gia',
      count: projects.length,
      icon: FolderGit2,
    },
    {
      id: 'timesheet',
      label: 'Nhật ký Giờ công',
      count: (worklogSummary?.worklogs || []).length,
      icon: Clock,
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
                  onClick={() => handleSelectTab('projects')}
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
                  onClick={() => handleSelectTab('profile')}
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
                  onClick={() => handleSelectTab('profile')}
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
                    onClick={() => handleSelectTab(tab.id)}
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
                          onClick={() => handleSelectTab('profile')}
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

                                  {(project.milestonesCount > 0 || (project.totalApprovedHours || 0) > 0) && (
                                    <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5 border-t border-slate-200/60 tabular">
                                      <span className="inline-flex items-center gap-1 text-[#1E3A8A] font-semibold">
                                        <Flag size={11} className="shrink-0" />
                                        <span>
                                          {project.actualProgressPercent !== null && project.actualProgressPercent !== undefined
                                            ? `Nghiệm thu: ${project.actualProgressPercent}% (${project.completedMilestonesCount || 0}/${project.milestonesCount} mốc)`
                                            : 'Chưa có mốc'}
                                        </span>
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
                                        <Clock size={11} className="text-slate-400 shrink-0" />
                                        <span>{formatHours(project.totalApprovedHours || 0)} dự án</span>
                                      </span>
                                    </div>
                                  )}

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

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingWorklog(null);
                                      setWorklogInitialProjectId(project.id);
                                      setIsWorklogModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                                  >
                                    <Plus size={13} />
                                    <span>Ghi giờ công</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDetailProject(project);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-[#1E3A8A] border border-blue-200 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                                  >
                                    <Eye size={13} />
                                    <span>Chi tiết</span>
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

                {activeTab === 'timesheet' && (
                  <div className="space-y-5">
                    {/* Personal Worklog Control Bar */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <TechMonthPicker
                          id="my-wl-month"
                          label="Tháng KPI:"
                          value={selectedMonth}
                          onChange={handleMonthChange}
                          align="left"
                        />

                        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={wlMonthOnly}
                            onChange={(e) => setWlMonthOnly(e.target.checked)}
                            className="w-3.5 h-3.5 accent-[#1E3A8A]"
                          />
                          <span className="tabular">Chỉ lọc tháng {formatMonthShortVN(selectedMonth)}</span>
                        </label>

                        <select
                          value={wlProjectFilter}
                          onChange={(e) => setWlProjectFilter(e.target.value)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Tất cả dự án</option>
                          {projects.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              [{p.projectCode}] {p.projectName}
                            </option>
                          ))}
                        </select>

                        <select
                          value={wlStatusFilter}
                          onChange={(e) => setWlStatusFilter(e.target.value)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Tất cả trạng thái</option>
                          <option value="PENDING">Chờ thẩm định</option>
                          <option value="APPROVED">Đã phê duyệt</option>
                          <option value="REJECTED">Từ chối</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        disabled={projects.length === 0}
                        onClick={() => {
                          setEditingWorklog(null);
                          setWorklogInitialProjectId(projects[0]?.id || null);
                          setIsWorklogModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1E3A8A] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <Plus size={14} />
                        <span>Ghi giờ công</span>
                      </button>
                    </div>

                    {/* 4 Personal Timesheet KPI Wells */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
                        <span className="text-xs font-semibold text-slate-500 tabular">
                          Đã duyệt tháng {formatMonthShortVN(selectedMonth)}
                        </span>
                        <div className="flex items-baseline justify-between gap-2 tabular">
                          <p className="text-2xl font-extrabold text-[#1E3A8A]">
                            {formatHours(worklogSummary?.currentMonthApprovedHours ?? 0)}
                          </p>
                          <span className="text-xs font-bold text-slate-600">
                            {worklogSummary?.currentMonthManDays ?? 0} Man-days
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 tabular">
                          Tổng lũy kế: {formatHours(worklogSummary?.totalApprovedHours ?? 0)}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
                        <span className="text-xs font-semibold text-slate-500">Chờ thẩm định (Tháng)</span>
                        <div className="flex items-baseline justify-between gap-2 tabular">
                          <p className="text-2xl font-extrabold text-orange-600">
                            {formatHours(worklogSummary?.currentMonthPendingHours ?? 0)}
                          </p>
                          <span className="text-[11px] font-semibold text-slate-500">
                            Bị từ chối: {formatHours(worklogSummary?.totalRejectedHours ?? 0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Tổng chờ duyệt: {formatHours(worklogSummary?.totalPendingHours ?? 0)}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
                        <span className="text-xs font-semibold text-slate-500">Giờ công tuần hiện tại</span>
                        <div className="flex items-baseline justify-between gap-2 tabular">
                          <p className="text-2xl font-extrabold text-slate-900">
                            {formatHours(worklogSummary?.currentWeekHours ?? 0)}
                          </p>
                          <span className="text-[11px] font-medium text-slate-500">Định mức 40h/tuần</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1E3A8A]"
                            style={{ width: `${Math.min(100, Math.round(((worklogSummary?.currentWeekHours || 0) / 40) * 100))}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-1.5 shadow-2xs">
                        <span className="text-xs font-semibold text-slate-500">Tỷ lệ Billable tháng</span>
                        <div className="flex items-baseline justify-between gap-2 tabular">
                          <p className="text-2xl font-extrabold text-emerald-700">
                            {worklogSummary?.billablePercent ?? 0}%
                          </p>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {formatHours(worklogSummary?.billableApprovedHours ?? 0)} tính phí
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${Math.min(100, worklogSummary?.billablePercent ?? 0)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Personal Worklogs Table */}
                    <div
                      ref={myWorklogTableRef}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
                    >
                      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Clock size={16} className="text-[#1E3A8A]" />
                          <span>Danh sách Nhật ký Giờ công ({filteredWorklogs.length} bản ghi)</span>
                        </h3>
                      </div>

                      {filteredWorklogs.length === 0 ? (
                        <div className="p-10 text-center space-y-2.5">
                          <Clock size={36} className="mx-auto text-slate-300" />
                          <p className="text-sm font-bold text-slate-700">Chưa có nhật ký giờ công phù hợp</p>
                          <p className="text-xs text-slate-400">
                            {projects.length === 0
                              ? 'Bạn cần đang tham gia ít nhất một dự án để ghi nhận giờ công.'
                              : 'Bấm "Ghi giờ công" để báo cáo giờ làm việc kỹ thuật hoặc bỏ lọc tháng để xem các tháng trước.'}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4 whitespace-nowrap">Ngày</th>
                                <th className="py-3 px-4">Dự án &amp; Hạng mục kỹ thuật</th>
                                <th className="py-3 px-4 whitespace-nowrap">Số giờ</th>
                                <th className="py-3 px-4 whitespace-nowrap">Trạng thái</th>
                                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                              {filteredWorklogs.map((w) => {
                                const typeCfg = WORKLOG_TYPE_CONFIG[w.workType] || {
                                  shortLabel: w.workType,
                                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                                };
                                const statusCfg = WORKLOG_STATUS_CONFIG[w.approvalStatus] || {
                                  label: w.approvalStatus,
                                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                                };
                                const isLocked = w.approvalStatus === 'APPROVED';
                                const isHighlighted = highlightedWorklogId === String(w.id);

                                return (
                                  <tr
                                    key={w.id}
                                    id={`my-worklog-row-${w.id}`}
                                    className={`transition duration-300 ${
                                      isHighlighted
                                        ? 'bg-blue-50/95 ring-2 ring-inset ring-blue-500'
                                        : 'hover:bg-blue-50/30'
                                    }`}
                                  >
                                    <td className="py-3.5 px-4 align-top whitespace-nowrap tabular font-bold text-slate-900">
                                      {formatDateVN(w.workDate)}
                                    </td>
                                    <td className="py-3.5 px-4 align-top max-w-lg space-y-1.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200">
                                          {w.projectCode}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${typeCfg.badgeClass}`}>
                                          {typeCfg.shortLabel}
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                                            w.isBillable
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : 'bg-slate-100 text-slate-600 border-slate-200'
                                          }`}
                                        >
                                          {w.isBillable ? 'Billable' : 'Internal'}
                                        </span>
                                      </div>

                                      {w.milestoneTitle && (
                                        <p className="text-[11px] font-semibold text-blue-700">
                                          Mốc: {w.milestoneTitle}
                                        </p>
                                      )}

                                      <p className="text-slate-700 leading-relaxed text-pretty">{w.taskSummary}</p>

                                      {w.referenceUrl && (
                                        <a
                                          href={w.referenceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                                        >
                                          <span>Link PR / Task</span>
                                          <ExternalLink size={11} />
                                        </a>
                                      )}

                                      {w.approvalStatus === 'REJECTED' && w.rejectionReason && (
                                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 space-y-1">
                                          <p className="font-bold text-rose-800">Lý do từ chối:</p>
                                          <p className="whitespace-pre-line leading-relaxed">{w.rejectionReason}</p>
                                          <p className="text-[10px] font-medium text-rose-600/90">
                                            Vui lòng sửa và gửi duyệt lại.
                                          </p>
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 align-top whitespace-nowrap tabular">
                                      <strong className="text-sm text-[#1E3A8A]">{formatHours(w.hoursSpent)}</strong>
                                    </td>

                                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${statusCfg.badgeClass}`}>
                                        {statusCfg.label}
                                      </span>
                                      {w.approverName && (
                                        <p className="text-[10px] text-slate-400 mt-1">Bởi {w.approverName}</p>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                                      {isLocked ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                                          <Lock size={12} />
                                          <span>Đã khóa duyệt</span>
                                        </span>
                                      ) : (
                                        <div className="inline-flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingWorklog(w);
                                              setWorklogInitialProjectId(w.projectId);
                                              setIsWorklogModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                          >
                                            <Edit3 size={12} />
                                            <span>{w.approvalStatus === 'REJECTED' ? 'Sửa & Gửi lại' : 'Sửa'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeleteWorklogTarget(w)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                            title="Xóa bản ghi"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
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

        {/* Popup Xem Chi tiết Dự án (Chế độ Read-Only cho Kỹ sư — Không hiển thị Sửa / Phân bổ / AI Health Brief) */}
        <ProjectDetailModal
          isOpen={!!selectedDetailProject}
          onClose={() => setSelectedDetailProject(null)}
          project={selectedDetailProject}
          canManageMilestones={false}
          canAnalyzeHealth={false}
        />

        {/* Modal Ghi nhận / Chỉnh sửa Giờ công */}
        <WorklogModal
          isOpen={isWorklogModalOpen}
          onClose={() => {
            setIsWorklogModalOpen(false);
            setEditingWorklog(null);
            setWorklogInitialProjectId(null);
          }}
          projects={projects}
          existingWorklogs={worklogSummary?.worklogs || []}
          initialProjectId={worklogInitialProjectId}
          initialData={editingWorklog}
          onSuccess={() => loadAllData({ quiet: true })}
        />

        {/* Dialog xác nhận xóa bản ghi giờ công */}
        {deleteWorklogTarget &&
          createPortal(
            <div
              data-tech-modal="true"
              className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
              onClick={(e) => {
                if (e.target === e.currentTarget && !deletingWorklog) {
                  setDeleteWorklogTarget(null);
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
                    <h3 className="text-sm font-bold text-slate-900">Xác nhận xóa nhật ký giờ công</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bạn có chắc muốn xóa bản ghi{' '}
                      <strong className="text-slate-900">{formatHours(deleteWorklogTarget.hoursSpent)}</strong> ngày{' '}
                      <strong className="text-slate-900 tabular">{formatDateVN(deleteWorklogTarget.workDate)}</strong> tại dự án{' '}
                      <strong>{deleteWorklogTarget.projectCode}</strong> không?
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={deletingWorklog}
                    onClick={() => setDeleteWorklogTarget(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={deletingWorklog}
                    onClick={handleConfirmDeleteWorklog}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {deletingWorklog ? 'Đang xóa...' : 'Xác nhận xóa'}
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