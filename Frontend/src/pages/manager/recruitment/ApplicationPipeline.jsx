import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import { Star, ShieldAlert, ShieldCheck, ChevronLeft, ChevronRight, Briefcase, Users, MapPin, Clock, BarChart3, PieChart, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PIPELINE_COLUMNS = [
  { id: 'NEW', title: 'Chờ AI xử lý', color: 'bg-gray-100', barColor: '#94a3b8' },
  { id: 'PENDING_HR_CV_REVIEW', title: 'HR Duyệt CV', color: 'bg-amber-50', barColor: '#fbbf24' },
  { id: 'PENDING_TECH_CV_REVIEW', title: 'Chuyên môn', color: 'bg-blue-50', barColor: '#60a5fa' },
  { id: 'PENDING_INTERVIEW_1', title: 'Phỏng vấn 1', color: 'bg-purple-50', barColor: '#a78bfa' },
  { id: 'PENDING_CEO_EVALUATION', title: 'TGĐ Đánh giá', color: 'bg-indigo-50', barColor: '#818cf8' },
  { id: 'PENDING_INTERVIEW_2', title: 'Phỏng vấn 2', color: 'bg-pink-50', barColor: '#f472b6' },
  { id: 'PENDING_OFFER_APPROVAL', title: 'Duyệt Offer', color: 'bg-teal-50', barColor: '#2dd4bf' },
  { id: 'OFFER_APPROVED', title: 'Đã nhận việc', color: 'bg-emerald-50', barColor: '#34d399' },
  { id: 'REJECTED', title: 'Đã từ chối', color: 'bg-rose-50', barColor: '#f87171' } // Thêm cột từ chối cho biểu đồ
];

export default function ApplicationPipeline() {
  const navigate = useNavigate();
  const { role } = useAuth();
  
  // Level 1: Campaigns
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCamp, setLoadingCamp] = useState(true);
  const [campPage, setCampPage] = useState(0);
  const [totalCampPages, setTotalCampPages] = useState(0);
  const [totalCampElements, setTotalCampElements] = useState(0);
  const campPageSize = 6;

  // Filters for Level 1
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  // Level 2: Pipeline
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Fetch departments for filter
  useEffect(() => {
    api.get('/api/departments').then(res => {
      if (res.data.success) setDepartments(res.data.data);
    }).catch(console.error);
  }, []);

  // Fetch Level 1 (All campaigns paginated)
  const fetchCampaigns = () => {
    setLoadingCamp(true);
    let url = `/api/recruitment/jobs/stats/paginated?page=${campPage}&size=${campPageSize}&restrictToRequester=true`;
    if (selectedDeptId) url += `&departmentId=${selectedDeptId}`;
    if (selectedLevel) url += `&capBac=${selectedLevel}`;
    
    api.get(url)
      .then(res => {
        if (res.data.success) {
          setCampaigns(res.data.data.content);
          setTotalCampPages(res.data.data.totalPages);
          setTotalCampElements(res.data.data.totalElements);
        }
        setLoadingCamp(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingCamp(false);
      });
  };

  useEffect(() => {
    if (!selectedCampaign) {
      fetchCampaigns();
    }
  }, [campPage, selectedCampaign, selectedDeptId, selectedLevel]);

  // Fetch Level 2 (Applications for selected campaign)
  useEffect(() => {
    if (selectedCampaign) {
      setLoadingApps(true);
      api.get(`/api/recruitment/jobs/${selectedCampaign.jobPosting.id}/applications`)
        .then(res => {
          if (res.data.success) {
            setApplications(res.data.data);
          }
          setLoadingApps(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingApps(false);
        });
    }
  }, [selectedCampaign]);

  // --- RENDER LEVEL 1 ---
  if (!selectedCampaign) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Pipeline & Thống kê Chiến dịch</h1>
            <p className="text-sm text-slate-500 mt-1">Chọn một chiến dịch để xem bảng Kanban và biểu đồ thống kê chi tiết.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedDeptId}
                onChange={(e) => { setSelectedDeptId(e.target.value); setCampPage(0); }}
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
              onChange={(e) => { setSelectedLevel(e.target.value); setCampPage(0); }}
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

        {loadingCamp ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Không tìm thấy chiến dịch</h3>
            <p className="text-slate-500 mt-1">Không có chiến dịch nào phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((stat, idx) => {
                const job = stat.jobPosting;
                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedCampaign(stat)}
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
                      <p className="text-xs text-slate-500 mt-1">Cấp bậc: {job.capBac} • {job.hinhThucLamViec?.replace('_', '-')}</p>
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
                            <Star size={14} /> ỨNG VIÊN MỚI
                          </div>
                          <div className="text-2xl font-bold text-blue-700">{stat.newApps}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><MapPin size={12}/> {job.diaDiem || 'Toàn quốc'}</span>
                        <span className="flex items-center gap-1"><Clock size={12}/> {new Date(job.createdAt || job.ngayBatDau).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                    
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm font-medium text-blue-600 group-hover:bg-blue-50 transition-colors">
                      Xem Pipeline & Thống kê
                      <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalCampPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCampPage(prev => Math.max(0, prev - 1))}
                  disabled={campPage === 0}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[...Array(totalCampPages)].map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCampPage(idx)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                        campPage === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCampPage(prev => Math.min(totalCampPages - 1, prev + 1))}
                  disabled={campPage === totalCampPages - 1}
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

  // --- RENDER LEVEL 2 ---
  const job = selectedCampaign.jobPosting;
  const filteredApps = applications; // For the board, we might exclude REJECTED, but let's keep all for stats
  const boardColumns = PIPELINE_COLUMNS.filter(c => c.id !== 'REJECTED'); // Board doesn't show rejected
  
  // Prepare chart data
  const chartData = PIPELINE_COLUMNS.map(col => ({
    name: col.title,
    count: applications.filter(a => a.approvalStatus === col.id).length,
    color: col.barColor
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
          <p className="font-semibold text-slate-800 mb-1">{label}</p>
          <p className="text-blue-600 font-medium">Số lượng: {payload[0].value} hồ sơ</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 shrink-0">
        <button 
          onClick={() => setSelectedCampaign(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 w-max transition-colors"
        >
          <ChevronLeft size={16} /> Quay lại danh sách chiến dịch
        </button>

        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
              <span className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-medium"><Briefcase size={14}/> {selectedCampaign.departmentName}</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {job.diaDiem}</span>
              <span className="flex items-center gap-1"><Users size={14} /> Tổng {applications.length} ứng viên</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-10 hide-scrollbar">
        {/* TOP SECTION: KANBAN BOARD */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="text-blue-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Pipeline Tuyển dụng</h2>
          </div>
          
          {loadingApps ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar min-h-[400px]">
              {boardColumns.map(col => {
                const colApps = filteredApps.filter(a => a.approvalStatus === col.id);
                return (
                  <div key={col.id} className={`flex-shrink-0 w-72 rounded-xl border border-slate-200 flex flex-col ${col.color}`}>
                    <div className="p-3 border-b border-slate-200/50 flex justify-between items-center bg-white/50 rounded-t-xl">
                      <h3 className="font-semibold text-slate-700 text-sm">{col.title}</h3>
                      <span className="bg-white text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{colApps.length}</span>
                    </div>
                    <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                      {colApps.map(app => (
                        <div 
                          key={app.id} 
                          onClick={() => navigate(`/${role === 'giam_doc_phong_ban' || role === 'ceo' ? role === 'ceo' ? 'ceo' : 'director' : 'manager'}/recruitment/applications/${app.id}`)}
                          className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group"
                        >
                          <div className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">{app.fullName}</div>
                          
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                              <Star className={`w-3.5 h-3.5 ${app.fitScore >= 80 ? 'text-emerald-500 fill-emerald-500' : 'text-amber-500 fill-amber-500'}`} />
                              <span className="text-xs font-bold text-slate-700">{app.fitScore}%</span>
                            </div>
                            
                            {app.fraudFlagged ? (
                              <span className="text-rose-500" title="Phát hiện rủi ro/gian lận"><ShieldAlert size={14}/></span>
                            ) : (
                              <span className="text-emerald-500"><ShieldCheck size={14}/></span>
                            )}
                          </div>
                        </div>
                      ))}
                      {colApps.length === 0 && (
                        <div className="text-center p-3 text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                          Trống
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTTOM SECTION: CHARTS */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="text-indigo-600" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Tổng quan thống kê trạng thái hồ sơ</h2>
          </div>
          
          {loadingApps ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
