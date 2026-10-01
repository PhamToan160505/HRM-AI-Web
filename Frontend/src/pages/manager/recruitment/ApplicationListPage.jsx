import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldAlert, ChevronLeft, Briefcase, Users, UserPlus, UserCheck, ChevronRight, Trash2, Clock, Filter, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';

export default function ApplicationListPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { showNotification } = useNotification();
  
  // Level 1: Campaigns
  const [campaignStats, setCampaignStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [campaignPage, setCampaignPage] = useState(0);
  const [totalCampPages, setTotalCampPages] = useState(0);
  const campaignPageSize = 6;
  
  // Filters for Level 1
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  // Level 2: Applications Drill-down
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  
  // Pagination & Filtering for Level 2
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(role === 'giam_doc' ? 'PENDING_DIRECTOR' : 'ALL');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [sortMode, setSortMode] = useState('TIME');
  const [minEvidence, setMinEvidence] = useState('');
  const [mustHaveOnly, setMustHaveOnly] = useState(false);
  const [aiByApplication, setAiByApplication] = useState({});
  const [loadingAi, setLoadingAi] = useState(false);
  const pageSize = 5;

  // Fetch departments for filter
  useEffect(() => {
    api.get('/api/departments').then(res => {
      if (res.data.success) setDepartments(res.data.data);
    }).catch(console.error);
  }, []);

  const fetchCampaignStats = async () => {
    setLoadingStats(true);
    try {
      let url = `/api/recruitment/jobs/stats/paginated?page=${campaignPage}&size=${campaignPageSize}&restrictToRequester=true`;
      if (selectedDeptId) url += `&departmentId=${selectedDeptId}`;
      if (selectedLevel) url += `&capBac=${selectedLevel}`;
      
      const res = await api.get(url);
      if (res.data.success) {
        setCampaignStats(res.data.data.content);
        setTotalCampPages(res.data.data.totalPages);
      }
    } catch (err) {
      console.error(err);
      showNotification('Lỗi', 'Không thể lấy thống kê chiến dịch', 'error');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!selectedCampaign) {
      fetchCampaignStats();
    }
  }, [selectedCampaign, campaignPage, selectedDeptId, selectedLevel]);

  // Handle Search Debounce
  useEffect(() => {
    if (selectedCampaign) {
      const delayDebounceFn = setTimeout(() => {
        fetchApplications();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchApplications();
    }
  }, [selectedCampaign, currentPage, selectedStatus, sortMode, minEvidence, mustHaveOnly]);

  useEffect(() => {
    if (!selectedCampaign) {
      setAiByApplication({});
      setSortMode('TIME');
      setMinEvidence('');
      setMustHaveOnly(false);
      return;
    }
    let active = true;
    setLoadingAi(true);
    api.get(`/api/recruitment/jobs/${selectedCampaign.jobPosting.id}/ai-analyses/current`)
      .then(response => {
        if (!active) return;
        const comparable = (response.data.data || []).reduce((result, analysis) => {
          const previous = result[analysis.applicationId];
          if (!previous || new Date(analysis.completedAt || analysis.createdAt) > new Date(previous.completedAt || previous.createdAt)) {
            result[analysis.applicationId] = analysis;
          }
          return result;
        }, {});
        setAiByApplication(comparable);
      })
      .catch(() => { if (active) setAiByApplication({}); })
      .finally(() => { if (active) setLoadingAi(false); });
    return () => { active = false; };
  }, [selectedCampaign]);

  const displayedApplications = useMemo(() => {
    if (sortMode !== 'AI_EVIDENCE') return applications;
    return [...applications].sort((left, right) => {
      const leftScore = Number(aiByApplication[left.id]?.evidenceScore ?? -1);
      const rightScore = Number(aiByApplication[right.id]?.evidenceScore ?? -1);
      if (rightScore !== leftScore) return rightScore - leftScore;
      return new Date(left.createdAt) - new Date(right.createdAt);
    });
  }, [applications, aiByApplication, sortMode]);

  const fetchApplications = async () => {
    setLoadingApps(true);
    try {
      const params = new URLSearchParams({
        jobPostingId: selectedCampaign.jobPosting.id,
        page: currentPage,
        size: pageSize
      });
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchTerm) params.append('search', searchTerm);
      if (sortMode === 'AI_EVIDENCE') params.append('sortBy', sortMode);
      if (minEvidence) params.append('minEvidence', minEvidence);
      if (mustHaveOnly) params.append('mustHaveOnly', 'true');

      const res = await api.get(`/api/recruitment/applications?${params.toString()}`);
      if (res.data.success) {
        setApplications(res.data.data.content);
        setTotalPages(res.data.data.totalPages);
        setTotalElements(res.data.data.totalElements);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hồ sơ này? Hành động này không thể hoàn tác.')) {
      try {
        const res = await api.delete(`/api/recruitment/applications/${id}`);
        if (res.data.success) {
          showNotification('Thành công', 'Đã xóa hồ sơ ứng viên', 'success');
          fetchApplications();
          fetchCampaignStats(); // Refresh stats
        }
      } catch (error) {
        showNotification('Lỗi', 'Không thể xóa hồ sơ', 'error');
      }
    }
  };

  const STATUS_MAP = {
    'PENDING_HR_CV_REVIEW':    { label: 'HR Duyệt CV', color: 'bg-amber-100 text-amber-700' },
    'PENDING_TECH_CV_REVIEW':  { label: 'Chuyên môn Duyệt CV', color: 'bg-blue-100 text-blue-700' },
    'PENDING_INTERVIEW_1':     { label: 'Phỏng vấn 1', color: 'bg-purple-100 text-purple-700' },
    'PENDING_INTERVIEW_2':     { label: 'Phỏng vấn 2', color: 'bg-pink-100 text-pink-700' },
    'PENDING_HR_OFFER':        { label: 'HR soạn Offer', color: 'bg-cyan-100 text-cyan-700' },
    'PENDING_OFFER_APPROVAL':  { label: 'Chờ duyệt Offer', color: 'bg-teal-100 text-teal-700' },
    'OFFER_INTERNALLY_APPROVED': { label: 'Offer đã duyệt nội bộ', color: 'bg-emerald-100 text-emerald-700' },
    'OFFER_SENT':              { label: 'Đã gửi Offer', color: 'bg-sky-100 text-sky-700' },
    'OFFER_ACCEPTED':          { label: 'Ứng viên đã chấp nhận', color: 'bg-green-100 text-green-700' },
    'TALENT_POOL':             { label: 'Talent Pool', color: 'bg-violet-100 text-violet-700' },
    'WITHDRAWN':               { label: 'Đã rút hồ sơ', color: 'bg-slate-100 text-slate-700' },
    'OFFER_DECLINED':          { label: 'Từ chối Offer', color: 'bg-orange-100 text-orange-700' },
    'OFFER_EXPIRED':           { label: 'Offer hết hạn', color: 'bg-slate-100 text-slate-700' },
    'OFFER_REVOKED':           { label: 'Offer đã thu hồi', color: 'bg-red-100 text-red-700' },
    'REJECTED':                { label: 'Đã loại', color: 'bg-rose-100 text-rose-700' },
  };

  const getStatusBadge = (app) => {
    if (app.needsVerification && app.approvalStatus === 'PENDING_HR_CV_REVIEW') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-max bg-purple-100 text-purple-700">Cần xác minh</span>;
    }
    const s = STATUS_MAP[app.approvalStatus];
    if (s) return <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-max ${s.color}`}>{s.label}</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{app.approvalStatus}</span>;
  };

  const getMustSummary = (analysis) => {
    const mustCriteria = (analysis?.computedResult?.criteria || [])
      .filter((criterion) => criterion.type === 'MUST');
    const passed = mustCriteria.filter((criterion) => (
      criterion.evidence_level === 'MENTIONED_IN_EXPERIENCE'
      || criterion.evidence_level === 'DEMONSTRATED'
    )).length;
    return { passed, total: mustCriteria.length };
  };

  const getFitBand = (score) => {
    if (score >= 70) return { label: 'Phù hợp cao', color: 'text-emerald-700 bg-emerald-50' };
    if (score >= 40) return { label: 'Cần xem xét', color: 'text-amber-700 bg-amber-50' };
    return { label: 'Ít bằng chứng', color: 'text-slate-600 bg-slate-100' };
  };

  // ----- RENDER LEVEL 1: CAMPAIGN GRID -----
  if (!selectedCampaign) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Quản lý Hồ sơ theo Chiến dịch</h1>
            <p className="text-sm text-slate-500 mt-1">Chọn một chiến dịch tuyển dụng để xem danh sách hồ sơ chi tiết.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedDeptId}
                onChange={(e) => { setSelectedDeptId(e.target.value); setCampaignPage(0); }}
                className="pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm min-w-[160px]"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.tenPhong}</option>
                ))}
              </select>
            </div>
            
            <select
              value={selectedLevel}
              onChange={(e) => { setSelectedLevel(e.target.value); setCampaignPage(0); }}
              className="px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm min-w-[140px]"
            >
              <option value="">Tất cả cấp bậc</option>
              <option value="Thực tập sinh (Intern)">Thực tập sinh (Intern)</option>
              <option value="Nhân viên (Junior)">Nhân viên (Junior)</option>
              <option value="Chuyên viên (Middle)">Chuyên viên (Middle)</option>
              <option value="Chuyên viên cao cấp (Senior)">Chuyên viên cao cấp (Senior)</option>
              <option value="Quản lý (Manager)">Quản lý (Manager)</option>
              <option value="Trưởng phòng (Head)">Trưởng phòng (Head)</option>
              <option value="Giám đốc (Director)">Giám đốc (Director)</option>
            </select>
          </div>
        </div>

        {loadingStats ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : campaignStats.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Không tìm thấy chiến dịch</h3>
            <p className="text-slate-500 mt-1">Không có chiến dịch nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaignStats.map((stat, idx) => {
                const job = stat.jobPosting;
                return (
                  <div 
                    key={idx}
                    onClick={() => {
                      setSelectedCampaign(stat);
                      setCurrentPage(0);
                    }}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col"
                  >
                    <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-transparent">
                      <div className="flex justify-between items-start mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                          <Briefcase size={14} /> {stat.departmentName?.toLowerCase().includes('phòng') || stat.departmentName === 'Phòng ban' ? stat.departmentName : `Phòng ${stat.departmentName}`}
                        </span>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                          job.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {job.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {job.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Cấp bậc: {job.capBac}</p>
                    </div>
                    
                    <div className="p-5 flex-1">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-1">
                            <Users size={14} /> TỔNG HỒ SƠ
                          </div>
                          <div className="text-2xl font-bold text-slate-800">{stat.totalApps}</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-1.5 text-blue-600 text-xs font-medium mb-1">
                            <UserPlus size={14} /> ỨNG VIÊN MỚI
                          </div>
                          <div className="text-2xl font-bold text-blue-700">{stat.newApps}</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500"><Clock size={13} className="text-amber-500"/> Chờ HR duyệt</span>
                          <span className="font-semibold text-slate-700">{stat.pendingHrApps}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500"><Clock size={13} className="text-blue-500"/> Chờ chuyên môn</span>
                          <span className="font-semibold text-slate-700">{stat.pendingTechApps}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center gap-1.5 text-slate-500"><UserCheck size={13} className="text-emerald-500"/> Đã nhận việc</span>
                          <span className="font-semibold text-slate-700">{stat.approvedApps}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm font-medium text-blue-600 group-hover:bg-blue-50 transition-colors">
                      Xem chi tiết {stat.totalApps} hồ sơ
                      <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Level 1 Pagination */}
            {totalCampPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCampaignPage(prev => Math.max(0, prev - 1))}
                  disabled={campaignPage === 0}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalCampPages)].map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCampaignPage(idx)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                        campaignPage === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCampaignPage(prev => Math.min(totalCampPages - 1, prev + 1))}
                  disabled={campaignPage === totalCampPages - 1}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ----- RENDER LEVEL 2: APPLICATIONS LIST -----
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setSelectedCampaign(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 w-max transition-colors"
        >
          <ChevronLeft size={16} /> Quay lại danh sách chiến dịch
        </button>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                <Briefcase size={14} /> {selectedCampaign.departmentName}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{selectedCampaign.jobPosting.title}</h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý {totalElements} hồ sơ ứng viên</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Filters Level 2 */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm theo tên ứng viên, email, số điện thoại..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(0); }}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
            >
              <option value="ALL">Tất cả trạng thái</option>
              {Object.keys(STATUS_MAP).map(status => (
                <option key={status} value={status}>{STATUS_MAP[status].label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={loadingAi}
            onClick={() => {
              setSortMode(current => current === 'TIME' ? 'AI_EVIDENCE' : 'TIME');
              setCurrentPage(0);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${sortMode === 'AI_EVIDENCE' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}
            title="Chỉ dùng kết quả cùng cặp phiên bản tiêu chí và scoring profile của chiến dịch"
          >
            <Sparkles size={16} /> {sortMode === 'AI_EVIDENCE' ? 'Đang xếp theo bằng chứng AI' : 'Sắp theo bằng chứng AI'}
          </button>
        </div>

        {sortMode === 'AI_EVIDENCE' && (
          <div className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs leading-5 text-blue-800">
              AI xếp hạng trên toàn chiến dịch theo bằng chứng trong CV. Đây là công cụ hỗ trợ; quyết định tuyển dụng vẫn do người có thẩm quyền thực hiện.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={minEvidence}
                onChange={(event) => { setMinEvidence(event.target.value); setCurrentPage(0); }}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Tất cả mức bằng chứng</option>
                <option value="40">Bằng chứng từ 40%</option>
                <option value="60">Bằng chứng từ 60%</option>
                <option value="80">Bằng chứng từ 80%</option>
              </select>
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={mustHaveOnly}
                  onChange={(event) => { setMustHaveOnly(event.target.checked); setCurrentPage(0); }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Đủ bằng chứng cho toàn bộ MUST
              </label>
            </div>
          </div>
        )}

        {/* Table Level 2 */}
        <div className="overflow-x-auto flex-1">
          {loadingApps ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : applications.length === 0 ? (
            <div className="text-center p-12">
              <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900">Không tìm thấy hồ sơ</h3>
              <p className="text-slate-500 mt-1">Hãy thử thay đổi điều kiện tìm kiếm.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Ứng viên</th>
                  <th className="p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Liên hệ</th>
                  <th className="p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Bằng chứng AI</th>
                  <th className="p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Trạng thái</th>
                  <th className="p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedApplications.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                          {app.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {app.fullName}
                            {app.fraudFlagged && (
                              <span title="Phát hiện rủi ro/gian lận trong CV (AI)" className="text-rose-500">
                                <ShieldAlert size={14} />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">Nộp: {new Date(app.createdAt).toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-700">{app.email}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{app.phone}</div>
                    </td>
                    <td className="p-4">
                      {aiByApplication[app.id]?.status === 'DONE' ? (
                        (() => {
                          const analysis = aiByApplication[app.id];
                          const score = Number(analysis.evidenceScore || 0);
                          const must = getMustSummary(analysis);
                          const fitBand = getFitBand(score);
                          return (
                            <div className="min-w-44 space-y-1.5">
                              <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Độ phủ lời khai</span><strong className="text-blue-700">{Number(analysis.claimCoverage || 0).toFixed(0)}%</strong></div>
                              <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Mức bằng chứng</span><strong className="text-indigo-700">{score.toFixed(0)}%</strong></div>
                              {must.total > 0 && (
                                <div className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">Tiêu chí MUST</span><strong className={must.passed === must.total ? 'text-emerald-700' : 'text-amber-700'}>{must.passed}/{must.total}</strong></div>
                              )}
                              <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${fitBand.color}`}>{fitBand.label}</span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-slate-400 italic">Chưa có kết quả cùng version</span>
                      )}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(app)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/${role === 'giam_doc_phong_ban' || role === 'ceo' ? role === 'ceo' ? 'ceo' : 'director' : 'manager'}/recruitment/applications/${app.id}`)}
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
                        >
                          Chi tiết
                        </button>
                        {(role === 'truong_phong' || role === 'admin') && (
                          <button
                            onClick={() => handleDelete(app.id)}
                            className="p-1.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa hồ sơ"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Level 2 Pagination */}
        {totalPages > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="text-sm text-slate-500">
              Hiển thị <span className="font-medium text-slate-700">{applications.length}</span> trên <span className="font-medium text-slate-700">{totalElements}</span> hồ sơ
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))} 
                disabled={currentPage === 0} 
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, idx) => {
                  if (totalPages > 5 && idx !== 0 && idx !== totalPages - 1 && Math.abs(idx - currentPage) > 1) {
                    if (Math.abs(idx - currentPage) === 2) return <span key={idx} className="px-2 text-slate-400">...</span>;
                    return null;
                  }
                  return (
                    <button 
                      key={idx} 
                      onClick={() => setCurrentPage(idx)} 
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${currentPage === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))} 
                disabled={currentPage === totalPages - 1} 
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
