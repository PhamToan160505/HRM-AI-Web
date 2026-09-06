import React, { useEffect, useState } from 'react';
import { Plus, Search, MapPin, Clock, Users, ChevronDown, XCircle, Trash2, CheckCircle2, ChevronLeft, ChevronRight, Briefcase, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';

export default function JobPostingList() {
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const { user } = useAuth();
  
  const isHR = user?.tenPhong === 'Nhân sự' || user?.tenPhong === 'Nhân Su' || user?.tenPhong === 'Phòng Nhân sự';
  const isHRManager = user?.role === 'truong_phong' && isHR;
  const canManageCampaigns = user?.role === 'ceo' || user?.role === 'admin' || 
                             ((user?.role === 'truong_phong' || user?.role === 'giam_doc_phong_ban') && isHR);

  // Level 1: Departments
  const [departments, setDepartments] = useState([]);
  const [deptPage, setDeptPage] = useState(0);
  const deptPageSize = 6;

  // Level 2: Campaigns drill-down
  const [selectedDept, setSelectedDept] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campPage, setCampPage] = useState(0);
  const [totalCampPages, setTotalCampPages] = useState(0);
  const [totalCampElements, setTotalCampElements] = useState(0);
  const campPageSize = 5;

  const [expandedJobId, setExpandedJobId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, jobId: null, title: '', message: '' });
  const [selectedFilterDept, setSelectedFilterDept] = useState('');

  // Fetch Level 1 data
  const fetchDepartments = () => {
    setLoading(true);
    api.get('/api/recruitment/jobs/stats')
    .then((res) => {
      if (res.data.success) {
        const grouped = {};
        res.data.data.forEach(stat => {
          const deptId = stat.jobPosting.departmentId || 0;
          let deptName = stat.departmentName;
          deptName = deptName?.toLowerCase().includes('phòng') || deptName === 'Phòng ban' ? deptName : `Phòng ${deptName}`;
          
          if (!grouped[deptId]) {
            grouped[deptId] = {
              id: deptId,
              name: deptName,
              totalCampaigns: 0,
              activeCampaigns: 0,
              totalApps: 0,
              newApps: 0
            };
          }
          grouped[deptId].totalCampaigns += 1;
          if (stat.jobPosting.status === 'OPEN') grouped[deptId].activeCampaigns += 1;
          grouped[deptId].totalApps += stat.totalApps;
          grouped[deptId].newApps += stat.newApps;
        });
        setDepartments(Object.values(grouped));
      }
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!selectedDept) {
      fetchDepartments();
    }
  }, [selectedDept]);

  // Fetch Level 2 data
  const fetchCampaigns = () => {
    if (!selectedDept) return;
    setLoadingCampaigns(true);
    let url = `/api/recruitment/jobs/stats/paginated?page=${campPage}&size=${campPageSize}`;
    if (selectedDept.id !== 0) {
      url += `&departmentId=${selectedDept.id}`;
    }
    
    api.get(url)
    .then(res => {
      if (res.data.success) {
        setCampaigns(res.data.data.content);
        setTotalCampPages(res.data.data.totalPages);
        setTotalCampElements(res.data.data.totalElements);
      }
      setLoadingCampaigns(false);
    })
    .catch(err => {
      console.error(err);
      setLoadingCampaigns(false);
    });
  };

  useEffect(() => {
    if (selectedDept) {
      fetchCampaigns();
    }
  }, [selectedDept, campPage]);

  // Handle Actions
  const handleCloseJob = async (id) => {
    try {
      const res = await api.patch(`/api/recruitment/jobs/${id}/status`, { status: 'CLOSED' });
      if (res.data.success) {
        showNotification('Thành công', 'Đã đóng chiến dịch', 'success');
        fetchCampaigns();
      }
    } catch (err) {
      showNotification('Lỗi', 'Không thể đóng chiến dịch', 'error');
    }
  };

  const handleOpenJob = async (id) => {
    try {
      const res = await api.patch(`/api/recruitment/jobs/${id}/status`, { status: 'OPEN' });
      if (res.data.success) {
        showNotification('Thành công', 'Đã mở lại chiến dịch', 'success');
        fetchCampaigns();
      }
    } catch (err) {
      showNotification('Lỗi', 'Không thể mở lại chiến dịch', 'error');
    }
  };

  const handleDeleteJob = async (id) => {
    try {
      const res = await api.delete(`/api/recruitment/jobs/${id}`);
      if (res.data.success) {
        showNotification('Thành công', 'Đã xóa chiến dịch', 'success');
        fetchCampaigns();
        fetchDepartments();
      }
    } catch (err) {
      showNotification('Lỗi', 'Không thể xóa chiến dịch', 'error');
    }
  };

  const handleConfirmAction = async () => {
    const { type, jobId } = confirmDialog;
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    if (type === 'CLOSE') {
      await handleCloseJob(jobId);
    } else if (type === 'OPEN') {
      await handleOpenJob(jobId);
    } else if (type === 'DELETE') {
      await handleDeleteJob(jobId);
    }
  };

  const openConfirm = (e, type, jobId, title, message) => {
    e.stopPropagation();
    setConfirmDialog({ isOpen: true, type, jobId, title, message });
  };

  const toggleExpand = (id) => {
    setExpandedJobId(expandedJobId === id ? null : id);
  };

  // ----- RENDER LEVEL 1: DEPARTMENTS -----
  if (!selectedDept) {
    const filteredDepts = selectedFilterDept 
      ? departments.filter(d => d.id.toString() === selectedFilterDept) 
      : departments;
    
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Chiến dịch tuyển dụng</h1>
            <p className="text-sm text-slate-500 mt-1">Quản lý các tin đăng tuyển theo phòng ban.</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <select
                value={selectedFilterDept}
                onChange={(e) => { setSelectedFilterDept(e.target.value); setDeptPage(0); }}
                className="pl-4 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm min-w-[200px]"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
            {isHRManager && (
              <Link 
                to="/manager/recruitment/campaigns/new"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
              >
                <Plus size={16} /> Tạo chiến dịch
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : filteredDepts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Briefcase className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Chưa có chiến dịch nào</h3>
            <p className="text-slate-500 mt-1">Hiện chưa có chiến dịch tuyển dụng nào được tạo.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepts.slice(deptPage * deptPageSize, (deptPage + 1) * deptPageSize).map(dept => (
                <div 
                  key={dept.id}
                  onClick={() => {
                    setSelectedDept(dept);
                    setCampPage(0);
                  }}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col"
                >
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-transparent">
                    <div className="flex justify-between items-start mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                        <Briefcase size={14} /> Phòng ban
                      </span>
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                        dept.activeCampaigns > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {dept.activeCampaigns > 0 ? 'Đang hoạt động' : 'Tất cả đã đóng'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                      {dept.name}
                    </h3>
                  </div>
                  
                  <div className="p-5 flex-1">
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium mb-1">
                          <MapPin size={14} /> TỔNG CHIẾN DỊCH
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{dept.totalCampaigns}</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <div className="flex items-center gap-1.5 text-blue-600 text-xs font-medium mb-1">
                          <UserPlus size={14} /> ỨNG VIÊN MỚI
                        </div>
                        <div className="text-2xl font-bold text-blue-700">{dept.newApps}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-slate-500 mt-4 px-1">
                      <span className="flex items-center gap-1.5"><Users size={14}/> Tổng ứng viên</span>
                      <span className="font-semibold text-slate-700">{dept.totalApps}</span>
                    </div>
                  </div>
                  
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-sm font-medium text-blue-600 group-hover:bg-blue-50 transition-colors">
                    Xem {dept.totalCampaigns} chiến dịch
                    <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Dept Pagination */}
            {Math.ceil(filteredDepts.length / deptPageSize) > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setDeptPage(prev => Math.max(0, prev - 1))}
                  disabled={deptPage === 0}
                  className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-1">
                  {[...Array(Math.ceil(filteredDepts.length / deptPageSize))].map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setDeptPage(idx)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                        deptPage === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setDeptPage(prev => Math.min(Math.ceil(filteredDepts.length / deptPageSize) - 1, prev + 1))}
                  disabled={deptPage === Math.ceil(filteredDepts.length / deptPageSize) - 1}
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

  // ----- RENDER LEVEL 2: CAMPAIGNS IN DEPARTMENT -----
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setSelectedDept(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 w-max transition-colors"
        >
          <ChevronLeft size={16} /> Quay lại danh sách phòng ban
        </button>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{selectedDept.name}</h1>
            <p className="text-sm text-slate-500 mt-1">Tất cả {totalCampElements} chiến dịch của phòng ban.</p>
          </div>
          {isHRManager && (
            <Link 
              to="/manager/recruitment/campaigns/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
            >
              <Plus size={16} /> Tạo chiến dịch mới
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="divide-y divide-slate-100 flex-1">
          {loadingCampaigns ? (
            <div className="p-12 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : campaigns.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Chưa có chiến dịch tuyển dụng nào</p>
            </div>
          ) : (
            campaigns.map(stat => {
              const job = stat.jobPosting;
              const isExpanded = expandedJobId === job.id;
              
              return (
                <div key={job.id} className={`border-b border-slate-100 last:border-0 transition-colors ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'}`}>
                  <div 
                    onClick={() => toggleExpand(job.id)}
                    className="p-5 cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-base font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {job.title}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {job.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-5 mt-2 text-sm text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /> {job.diaDiem || 'Toàn quốc'}</span>
                        <span className="flex items-center gap-1.5"><Clock size={13} className="text-slate-400" /> {new Date(job.createdAt || job.ngayBatDau).toLocaleDateString('vi-VN')}</span>
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${
                          stat.totalApps > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Users size={12} /> {stat.totalApps} ứng viên
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right mr-4 hidden md:block" onClick={(e) => e.stopPropagation()}>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Public Link</div>
                        <a 
                          href={`/public/apply/${job.slug}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 hover:underline block truncate max-w-[180px] transition-colors"
                        >
                          /public/apply/{job.slug}
                        </a>
                      </div>
                      <div className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><ChevronDown size={18} /></div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 animate-fade-in-up">
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80">
                        <div className="bg-white rounded-lg p-3 border border-slate-100"><p className="text-xs text-slate-400 mb-1">Số lượng tuyển</p><p className="text-sm font-semibold text-slate-800">{job.soLuongTuyen} người</p></div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100"><p className="text-xs text-slate-400 mb-1">Mức lương</p><p className="text-sm font-semibold text-slate-800">{job.coThoaThuan ? 'Thỏa thuận' : (job.mucLuong || '—')}</p></div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100"><p className="text-xs text-slate-400 mb-1">Hình thức</p><p className="text-sm font-semibold text-slate-800">{job.hinhThucLamViec?.replace('_', '-') || '—'}</p></div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100"><p className="text-xs text-slate-400 mb-1">Hạn nộp hồ sơ</p><p className="text-sm font-semibold text-slate-800">{new Date(job.hanNopHoSo).toLocaleDateString('vi-VN')}</p></div>
                      </div>

                      {canManageCampaigns && (
                        <div className="px-5 pb-4 border-t border-slate-100 bg-white flex justify-end gap-2 pt-3">
                          <Link to={`/manager/recruitment/campaigns/edit/${job.id}`} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium text-sm transition-colors border border-blue-200">Sửa</Link>
                          {job.status === 'OPEN' ? (
                            <button onClick={(e) => openConfirm(e, 'CLOSE', job.id, 'Xác nhận đóng', 'Bạn có chắc chắn muốn đóng chiến dịch này?')} className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-medium text-sm border border-amber-200"><XCircle size={16} /> Đóng đợt</button>
                          ) : (
                            <Link to={`/manager/recruitment/campaigns/edit/${job.id}?reopen=true`} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium text-sm border border-emerald-200"><CheckCircle2 size={16} /> Mở đợt</Link>
                          )}
                          <button onClick={(e) => openConfirm(e, 'DELETE', job.id, 'Xác nhận xóa', 'Bạn có CHẮC CHẮN muốn xóa chiến dịch này không?')} className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-medium text-sm border border-rose-200"><Trash2 size={16} /> Xóa</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        {/* Campaign Pagination */}
        {totalCampPages > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="text-sm text-slate-500">Hiển thị <span className="font-medium text-slate-700">{campaigns.length}</span> trên <span className="font-medium text-slate-700">{totalCampElements}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCampPage(prev => Math.max(0, prev - 1))} disabled={campPage === 0} className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 transition-colors"><ChevronLeft size={20} /></button>
              <div className="flex gap-1">
                {[...Array(totalCampPages)].map((_, idx) => {
                  if (totalCampPages > 5 && idx !== 0 && idx !== totalCampPages - 1 && Math.abs(idx - campPage) > 1) {
                    if (Math.abs(idx - campPage) === 2) return <span key={idx} className="px-2 text-slate-400">...</span>;
                    return null;
                  }
                  return (
                    <button key={idx} onClick={() => setCampPage(idx)} className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${campPage === idx ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}>{idx + 1}</button>
                  );
                })}
              </div>
              <button onClick={() => setCampPage(prev => Math.min(totalCampPages - 1, prev + 1))} disabled={campPage === totalCampPages - 1} className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-50 transition-colors"><ChevronRight size={20} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in-up">
            <h3 className={`text-lg font-semibold mb-2 ${confirmDialog.type === 'DELETE' ? 'text-rose-600' : confirmDialog.type === 'OPEN' ? 'text-emerald-600' : 'text-amber-600'}`}>{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Hủy</button>
              <button onClick={handleConfirmAction} className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${confirmDialog.type === 'DELETE' ? 'bg-rose-600 hover:bg-rose-700' : confirmDialog.type === 'OPEN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
