import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  FolderGit2,
  Users,
  Cpu,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/common/Toast';
import CeoPortfolioTab from './CeoPortfolioTab';
import CeoCapacityBenchTab from './CeoCapacityBenchTab';
import CeoCapabilityTab from './CeoCapabilityTab';
import CeoTimesheetTab from './CeoTimesheetTab';
import CeoPerformanceTab from './CeoPerformanceTab';
import CeoProjectDetailModal from './CeoProjectDetailModal';
import CeoTechProfileModal from './CeoTechProfileModal';
import TechReviewDetailModal from '../components/TechReviewDetailModal';
import { PROJECT_STATUS_CONFIG, computeTimelineHealth, getCurrentMonthStr } from './ceoTechHelpers';
import {
  isMatchingLiveNotificationNavToken,
  clearLiveNotificationNavToken,
} from '../../../utils/notificationUtils';

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

const VALID_TABS = ['projects', 'bench', 'skills', 'timesheet', 'reviews'];

export default function CeoTechProjectsPage() {
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

  // Data states
  const [projects, setProjects] = useState([]);
  const [benchUsers, setBenchUsers] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(initialMonthFromQuery);
  const selectedMonthRef = useRef(selectedMonth);
  selectedMonthRef.current = selectedMonth;
  const [worklogs, setWorklogs] = useState([]);
  const [worklogPageData, setWorklogPageData] = useState(null);
  const [worklogQuery, setWorklogQuery] = useState({
    page: 0,
    size: 5,
    projectId: '',
    status: '',
  });
  const worklogQueryRef = useRef(worklogQuery);
  worklogQueryRef.current = worklogQuery;
  const [worklogsLoading, setWorklogsLoading] = useState(false);
  const [worklogAnalytics, setWorklogAnalytics] = useState(null);
  const [expiringCerts, setExpiringCerts] = useState([]);
  const [reviewCycles, setReviewCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const selectedCycleIdRef = useRef(selectedCycleId);
  selectedCycleIdRef.current = selectedCycleId;
  const [reviews, setReviews] = useState([]);
  const [reviewPageData, setReviewPageData] = useState(null);
  const [reviewQuery, setReviewQuery] = useState({
    page: 0,
    size: 10,
    status: '',
    grade: '',
    keyword: '',
  });
  const reviewQueryRef = useRef(reviewQuery);
  reviewQueryRef.current = reviewQuery;
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewAnalytics, setReviewAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const lastFetchTimeRef = useRef(0);
  const initialLiveFocusReviewIdRef = useRef(
    initialTabFromQuery === 'reviews' &&
      isMatchingLiveNotificationNavToken(location.state?.fromNotificationAt)
      ? searchParams.get('reviewId') || null
      : null
  );

  // Navigation & filter states
  const [activeTab, setActiveTab] = useState(initialTabFromQuery); // 'projects' | 'bench' | 'skills' | 'timesheet' | 'reviews'
  const [projectStatusFilter, setProjectStatusFilter] = useState('');
  const [focusReviewRequest, setFocusReviewRequest] = useState(null);

  // Modal states (Nested support: ProjectDetail -> Engineer TechProfile, ReviewDetail -> Engineer TechProfile)
  const [selectedDetailProject, setSelectedDetailProject] = useState(null);
  const [selectedReview, setSelectedReview] = useState(null);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [loadingProfileId, setLoadingProfileId] = useState(null);

  const buildWorklogParams = useCallback((monthStr, queryObj) => {
    const q = queryObj || {};
    return {
      month: monthStr || getCurrentMonthStr(),
      page: q.page ?? 0,
      size: q.size ?? 5,
      ...(q.projectId ? { projectId: Number(q.projectId) } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
  }, []);

  const applyWorklogPageResponse = useCallback((pageDto) => {
    setWorklogPageData(pageDto || null);
    setWorklogs(pageDto?.content || []);
    if (
      pageDto &&
      typeof pageDto.number === 'number' &&
      pageDto.number !== worklogQueryRef.current.page
    ) {
      const synced = { ...worklogQueryRef.current, page: pageDto.number };
      worklogQueryRef.current = synced;
      setWorklogQuery(synced);
    }
  }, []);

  const buildReviewParams = useCallback((cycleIdStr, queryObj, focusId = null) => {
    const q = queryObj || {};
    return {
      ...(cycleIdStr ? { cycleId: Number(cycleIdStr) } : {}),
      page: q.page ?? 0,
      size: q.size ?? 10,
      ...(q.status ? { status: q.status } : {}),
      ...(q.grade ? { grade: q.grade } : {}),
      ...(q.keyword && q.keyword.trim() ? { keyword: q.keyword.trim() } : {}),
      ...(focusId ? { focusReviewId: Number(focusId) } : {}),
    };
  }, []);

  const applyReviewPageResponse = useCallback((pageDto) => {
    setReviewPageData(pageDto || null);
    setReviews(pageDto?.content || []);
    if (
      pageDto &&
      typeof pageDto.number === 'number' &&
      pageDto.number !== reviewQueryRef.current.page
    ) {
      const synced = { ...reviewQueryRef.current, page: pageDto.number };
      reviewQueryRef.current = synced;
      setReviewQuery(synced);
    }
  }, []);

  const loadAllData = useCallback(
    async ({ manual = false, quiet = false, focusReviewId = null } = {}) => {
      try {
        if (manual) setRefreshing(true);
        else if (!quiet) setLoading(true);
        if (!quiet) setErrorMsg('');

        const activeMonth = selectedMonthRef.current || getCurrentMonthStr();
        const [projRes, benchRes, matrixRes, skillsRes, wlRes, analyticsRes, expiringRes, cyclesRes] =
          await Promise.all([
            api.get('/api/tech/projects'),
            api.get('/api/tech/projects/bench'),
            api.get('/api/tech/skills/matrix'),
            api.get('/api/tech/skills'),
            api.get('/api/tech/worklogs/paginated', {
              params: buildWorklogParams(activeMonth, worklogQueryRef.current),
            }),
            api.get('/api/tech/worklogs/analytics', { params: { month: activeMonth } }),
            api.get('/api/tech/skills/certificates/expiring'),
            api.get('/api/tech/reviews/cycles'),
          ]);

        const freshProjects = projRes.data?.data || [];
        setProjects(freshProjects);
        setSelectedDetailProject((prev) =>
          prev ? freshProjects.find((p) => String(p.id) === String(prev.id)) || prev : prev
        );
        setBenchUsers(benchRes.data?.data || []);
        setMatrixData(matrixRes.data?.data || []);
        setAvailableSkills(skillsRes.data?.data || []);
        applyWorklogPageResponse(wlRes.data?.data);
        setWorklogAnalytics(analyticsRes.data?.data || null);
        setExpiringCerts(expiringRes.data?.data || []);

        const freshCycles = cyclesRes.data?.data || [];
        setReviewCycles(freshCycles);

        let targetCycleId = selectedCycleIdRef.current;
        if (focusReviewId) {
          try {
            const focusedRevRes = await api.get(`/api/tech/reviews/${focusReviewId}`);
            const revCycleId = focusedRevRes.data?.data?.cycleId;
            if (revCycleId) {
              targetCycleId = String(revCycleId);
            }
          } catch {
            // Keep existing or latest cycle fallback
          }
        }
        if (
          freshCycles.length > 0 &&
          (!targetCycleId || !freshCycles.some((c) => String(c.id) === String(targetCycleId)))
        ) {
          targetCycleId = String(freshCycles[0].id);
        } else if (freshCycles.length === 0) {
          targetCycleId = '';
        }

        if (targetCycleId !== selectedCycleIdRef.current) {
          selectedCycleIdRef.current = targetCycleId;
          setSelectedCycleId(targetCycleId);
        }

        if (freshCycles.length > 0) {
          const [revPageRes, revAnalyticsRes] = await Promise.all([
            api.get('/api/tech/reviews/paginated', {
              params: buildReviewParams(targetCycleId, reviewQueryRef.current, focusReviewId),
            }),
            api.get('/api/tech/reviews/analytics', {
              params: targetCycleId ? { cycleId: Number(targetCycleId) } : {},
            }),
          ]);
          applyReviewPageResponse(revPageRes.data?.data);
          setReviewAnalytics(revAnalyticsRes.data?.data || null);
        } else {
          applyReviewPageResponse(null);
          setReviewAnalytics(null);
        }

        setLastUpdated(new Date());
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        console.error('Lỗi tải dữ liệu giám sát công nghệ:', err);
        const msg = err.response?.data?.message || 'Không thể kết nối máy chủ để tải dữ liệu phòng Công nghệ.';
        if (!quiet) setErrorMsg(msg);
        toastRef.current?.show('Lỗi tải dữ liệu', msg, 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildWorklogParams, applyWorklogPageResponse, buildReviewParams, applyReviewPageResponse]
  );

  const handleChangeWorklogQuery = useCallback(
    async (nextOrUpdater) => {
      const nextQuery =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(worklogQueryRef.current)
          : nextOrUpdater;
      worklogQueryRef.current = nextQuery;
      setWorklogQuery(nextQuery);
      try {
        setWorklogsLoading(true);
        const activeMonth = selectedMonthRef.current || getCurrentMonthStr();
        const wlRes = await api.get('/api/tech/worklogs/paginated', {
          params: buildWorklogParams(activeMonth, nextQuery),
        });
        applyWorklogPageResponse(wlRes.data?.data);
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        toastRef.current?.show(
          'Lỗi',
          err.response?.data?.message || 'Không thể tải danh sách nhật ký giờ công',
          'error'
        );
      } finally {
        setWorklogsLoading(false);
      }
    },
    [buildWorklogParams, applyWorklogPageResponse]
  );

  const handleMonthChange = useCallback(
    async (newMonth) => {
      const safeMonth = newMonth || getCurrentMonthStr();
      selectedMonthRef.current = safeMonth;
      setSelectedMonth(safeMonth);
      const resetPageQuery = { ...worklogQueryRef.current, page: 0 };
      worklogQueryRef.current = resetPageQuery;
      setWorklogQuery(resetPageQuery);
      try {
        setWorklogsLoading(true);
        const [wlRes, analyticsRes] = await Promise.all([
          api.get('/api/tech/worklogs/paginated', {
            params: buildWorklogParams(safeMonth, resetPageQuery),
          }),
          api.get('/api/tech/worklogs/analytics', { params: { month: safeMonth } }),
        ]);
        applyWorklogPageResponse(wlRes.data?.data);
        setWorklogAnalytics(analyticsRes.data?.data || null);
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        toastRef.current?.show('Lỗi', err.response?.data?.message || 'Không thể tải dữ liệu giờ công theo tháng', 'error');
      } finally {
        setWorklogsLoading(false);
      }
    },
    [buildWorklogParams, applyWorklogPageResponse]
  );

  const handleChangeReviewQuery = useCallback(
    async (nextOrUpdater) => {
      const nextQuery =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(reviewQueryRef.current)
          : nextOrUpdater;
      reviewQueryRef.current = nextQuery;
      setReviewQuery(nextQuery);
      try {
        setReviewsLoading(true);
        const revPageRes = await api.get('/api/tech/reviews/paginated', {
          params: buildReviewParams(selectedCycleIdRef.current, nextQuery),
        });
        applyReviewPageResponse(revPageRes.data?.data);
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        toastRef.current?.show(
          'Lỗi',
          err.response?.data?.message || 'Không thể tải danh sách phiếu đánh giá',
          'error'
        );
      } finally {
        setReviewsLoading(false);
      }
    },
    [buildReviewParams, applyReviewPageResponse]
  );

  const handleChangeCycle = useCallback(
    async (nextCycleId) => {
      const safeId = nextCycleId ? String(nextCycleId) : '';
      selectedCycleIdRef.current = safeId;
      setSelectedCycleId(safeId);
      const resetPageQuery = { ...reviewQueryRef.current, page: 0 };
      reviewQueryRef.current = resetPageQuery;
      setReviewQuery(resetPageQuery);
      try {
        setReviewsLoading(true);
        const [revPageRes, revAnalyticsRes] = await Promise.all([
          api.get('/api/tech/reviews/paginated', {
            params: buildReviewParams(safeId, resetPageQuery),
          }),
          api.get('/api/tech/reviews/analytics', {
            params: safeId ? { cycleId: Number(safeId) } : {},
          }),
        ]);
        applyReviewPageResponse(revPageRes.data?.data);
        setReviewAnalytics(revAnalyticsRes.data?.data || null);
        lastFetchTimeRef.current = Date.now();
      } catch (err) {
        toastRef.current?.show(
          'Lỗi',
          err.response?.data?.message || 'Không thể tải dữ liệu kỳ đánh giá',
          'error'
        );
      } finally {
        setReviewsLoading(false);
      }
    },
    [buildReviewParams, applyReviewPageResponse]
  );

  const handleFocusHandled = useCallback(
    (handledToken) => {
      clearLiveNotificationNavToken(handledToken);
      if (
        searchParams.has('worklogId') ||
        searchParams.has('userId') ||
        searchParams.has('reviewId') ||
        location.state?.fromNotificationAt
      ) {
        const cleaned = new URLSearchParams(searchParams);
        cleaned.delete('worklogId');
        cleaned.delete('userId');
        cleaned.delete('reviewId');
        const cleanSearch = cleaned.toString();
        navigate(
          { pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' },
          { replace: true, state: null }
        );
      }
    },
    [searchParams, location.pathname, location.state, navigate]
  );

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

  useEffect(() => {
    const queryTab = searchParams.get('tab');
    const queryMonth = searchParams.get('month');
    const queryWorklogId = searchParams.get('worklogId');
    const queryUserId = searchParams.get('userId');
    const queryReviewId = searchParams.get('reviewId');
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
      if (queryTab === 'reviews') {
        const resetRevQuery = {
          ...reviewQueryRef.current,
          page: 0,
          status: '',
          grade: '',
          keyword: '',
        };
        reviewQueryRef.current = resetRevQuery;
        setReviewQuery(resetRevQuery);
        setFocusReviewRequest({
          reviewId: queryReviewId || null,
          requestedAt: fromNotifAt,
        });
        if (lastFetchTimeRef.current > 0) {
          loadAllData({ quiet: true, focusReviewId: queryReviewId || null });
        }
      } else {
        clearLiveNotificationNavToken(fromNotifAt);
        if (lastFetchTimeRef.current > 0) {
          loadAllData({ quiet: true });
        }
        if (queryWorklogId || queryUserId || queryReviewId || fromNotifAt) {
          const cleaned = new URLSearchParams(searchParams);
          cleaned.delete('worklogId');
          cleaned.delete('userId');
          cleaned.delete('reviewId');
          const cleanSearch = cleaned.toString();
          navigate(
            { pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' },
            { replace: true, state: null }
          );
        }
      }
    } else if (queryWorklogId || queryUserId || queryReviewId || fromNotifAt) {
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('worklogId');
      cleaned.delete('userId');
      cleaned.delete('reviewId');
      const cleanSearch = cleaned.toString();
      navigate(
        { pathname: location.pathname, search: cleanSearch ? `?${cleanSearch}` : '' },
        { replace: true, state: null }
      );
    }
  }, [searchParams, location.pathname, location.state, navigate, loadAllData]);

  useEffect(() => {
    loadAllData({ focusReviewId: initialLiveFocusReviewIdRef.current });
  }, [loadAllData]);

  // Đồng bộ Realtime khi có thay đổi Dự án / Worklog / Kỹ năng từ Kỹ sư hoặc Trưởng phòng
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

  const handleInspectEngineer = useCallback(async (userId) => {
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
  }, [loadingProfileId]);

  // Executive KPIs & Real Portfolio Metrics
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

    // Real risk signals count
    let overdueProjects = 0;
    let missingLeadProjects = 0;
    let overdueMilestones = 0;
    projects.forEach((p) => {
      if (p.status === 'COMPLETED' || p.status === 'PAUSED') return;
      const health = computeTimelineHealth(p);
      if (health.tone === 'overdue') overdueProjects += 1;
      if (!p.techLeadName) missingLeadProjects += 1;
      if ((p.overdueMilestonesCount || 0) > 0) overdueMilestones += p.overdueMilestonesCount;
    });

    const riskCount = overloadedEngineers + overdueProjects + missingLeadProjects + overdueMilestones;

    // Status distribution for Donut chart
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
      overdueProjects,
      missingLeadProjects,
      riskCount,
      avgUtilization,
      totalDeployedFte,
      totalBenchFte,
      statusBreakdown,
    };
  }, [projects, benchUsers]);

  const tabs = [
    {
      id: 'projects',
      label: 'Danh mục Dự án',
      count: telemetry.totalProjects,
      icon: FolderGit2,
    },
    {
      id: 'bench',
      label: 'Công suất & Bench',
      count: telemetry.totalEngineers,
      icon: Activity,
    },
    {
      id: 'skills',
      label: 'Ma trận Năng lực',
      count: matrixData.length,
      icon: Cpu,
    },
    {
      id: 'timesheet',
      label: 'Giờ công & Hiệu suất',
      count: worklogPageData?.monthTotalCount ?? worklogs.length,
      icon: Clock,
    },
    {
      id: 'reviews',
      label: 'Đánh giá & Phê duyệt',
      count: reviewAnalytics?.totalReviews ?? 0,
      pendingCount: Number(reviewAnalytics?.directorApprovalPendingCount ?? 0),
      icon: TrendingUp,
    },
  ];

  const handleSelectStatusFromChart = (statusKey) => {
    setProjectStatusFilter((prev) => (prev === statusKey ? '' : statusKey));
    handleSelectTab('projects');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* 1. Executive Command Header */}
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
                Giám sát Dự án &amp; Nguồn lực Công nghệ
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 text-pretty">
                Bức tranh điều hành tổng thể về danh mục dự án phần mềm, hiệu suất kỹ sư và độ sẵn sàng năng lực kỹ thuật
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

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 text-[#1E3A8A] border border-blue-200 text-xs font-bold shrink-0">
              <ShieldCheck size={15} className="text-blue-600 shrink-0" />
              <span>Giám sát Điều hành (Chỉ xem)</span>
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
              onClick={() => loadAllData({ manual: false })}
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
            {/* 2. Executive Bento Telemetry Overview */}
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
                    handleSelectTab('projects');
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
                  onClick={() => handleSelectTab('bench')}
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
                  onClick={() => handleSelectTab('bench')}
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

                {/* Well 4: Bench & Attention Signals */}
                <button
                  type="button"
                  onClick={() => handleSelectTab(telemetry.riskCount > 0 ? 'projects' : 'bench')}
                  className="p-4 rounded-xl bg-slate-50/75 hover:bg-blue-50/50 border border-slate-200/75 hover:border-blue-300 text-left transition flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-600">Ghế chờ &amp; Tín hiệu Rủi ro</span>
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
                            {telemetry.riskCount} điểm cần lưu ý (quá tải / hạn chót)
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
                      {/* Center Donut Readout */}
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
            <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-1.5 flex flex-wrap items-center gap-1 shadow-2xs">
              {tabs.map((tab) => {
                const IconComp = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`relative flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isActive ? 'text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="ceo-tech-active-tab-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 bg-[#1E3A8A] rounded-xl shadow-xs"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <IconComp size={15} className="shrink-0" />
                      <span>{tab.label}</span>
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded-full tabular ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {tab.count}
                      </span>
                      {tab.pendingCount > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular ${
                            isActive
                              ? 'bg-orange-500 text-white'
                              : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}
                          title="Phiếu đánh giá & thăng cấp chờ CEO phê duyệt"
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
                  <CeoPortfolioTab
                    projects={projects}
                    statusFilter={projectStatusFilter}
                    onChangeStatusFilter={setProjectStatusFilter}
                    onSelectProject={setSelectedDetailProject}
                    expiringCerts={expiringCerts}
                    onInspectEngineer={handleInspectEngineer}
                  />
                )}

                {activeTab === 'bench' && (
                  <CeoCapacityBenchTab
                    benchUsers={benchUsers}
                    onInspectEngineer={handleInspectEngineer}
                  />
                )}

                {activeTab === 'skills' && (
                  <CeoCapabilityTab
                    matrixData={matrixData}
                    availableSkills={availableSkills}
                    onInspectEngineer={handleInspectEngineer}
                  />
                )}

                {activeTab === 'timesheet' && (
                  <CeoTimesheetTab
                    analytics={worklogAnalytics}
                    worklogs={worklogs}
                    worklogPageData={worklogPageData}
                    worklogQuery={worklogQuery}
                    worklogsLoading={worklogsLoading}
                    onChangeWorklogQuery={handleChangeWorklogQuery}
                    projects={projects}
                    selectedMonth={selectedMonth}
                    onChangeMonth={handleMonthChange}
                    onSelectProjectById={(pid) => {
                      const found = projects.find((p) => String(p.id) === String(pid));
                      if (found) setSelectedDetailProject(found);
                    }}
                    onInspectEngineer={handleInspectEngineer}
                  />
                )}

                {activeTab === 'reviews' && (
                  <CeoPerformanceTab
                    cycles={reviewCycles}
                    selectedCycleId={selectedCycleId}
                    onChangeCycle={handleChangeCycle}
                    analytics={reviewAnalytics}
                    reviews={reviews}
                    reviewPageData={reviewPageData}
                    reviewQuery={reviewQuery}
                    reviewsLoading={reviewsLoading}
                    onChangeReviewQuery={handleChangeReviewQuery}
                    expiringCerts={expiringCerts}
                    currentUserId={user?.userId}
                    onSelectReview={setSelectedReview}
                    onInspectEngineer={handleInspectEngineer}
                    focusReviewRequest={focusReviewRequest}
                    onFocusHandled={handleFocusHandled}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* Modals (Read-Only Portfolio + CEO Performance Escalation Approval + Nested Engineer TechProfile) */}
        <CeoProjectDetailModal
          isOpen={!!selectedDetailProject}
          onClose={() => setSelectedDetailProject(null)}
          project={selectedDetailProject}
          onInspectEngineer={handleInspectEngineer}
          hasTopModalOpen={!!selectedProfile || !!selectedReview}
        />

        <TechReviewDetailModal
          isOpen={!!selectedReview}
          onClose={() => setSelectedReview(null)}
          reviewId={selectedReview?.id}
          initialReview={selectedReview}
          viewerRole="ceo"
          currentUserId={user?.userId}
          readOnlyMode={false}
          onInspectEngineer={handleInspectEngineer}
          onSuccess={() => loadAllData({ quiet: true })}
          hasTopModalOpen={!!selectedProfile}
        />

        <CeoTechProfileModal
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          zIndexClass={selectedReview ? 'z-[9995]' : 'z-[9990]'}
        />
      </div>
    </MotionConfig>
  );
}
