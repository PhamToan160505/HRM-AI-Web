import React, { useEffect, useState } from 'react';
import { Plus, Search, MapPin, Clock, Users, ChevronDown, XCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';

export default function JobPostingList() {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, jobId: null, title: '', message: '' });
  const { showNotification } = useNotification();

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/api/recruitment/jobs'),
      api.get('/api/recruitment/applications')
    ])
    .then(([jobsRes, appsRes]) => {
      if (jobsRes.data.success) setJobs(jobsRes.data.data);
      if (appsRes.data.success) setApplications(appsRes.data.data);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getApplicantCount = (jobId) => {
    return applications.filter(app => app.jobPosting && app.jobPosting.id === jobId).length;
  };

  const handleCloseJob = async (id) => {
    try {
      const res = await api.patch(`/api/recruitment/jobs/${id}/status`, { status: 'CLOSED' });
      if (res.data.success) {
        showNotification('Thành công', 'Đã đóng chiến dịch', 'success');
        fetchData();
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
        fetchData();
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
        fetchData();
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Chiến dịch tuyển dụng</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý các tin đăng tuyển và chia sẻ public link.</p>
        </div>
        <Link 
          to="/manager/recruitment/campaigns/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Plus size={18} />
          Tạo chiến dịch mới
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm chiến dịch..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {loading ? (
            /* Skeleton loader */
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton h-5 w-48" />
                  <div className="skeleton h-5 w-16" />
                </div>
                <div className="flex gap-4">
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-4 w-24" />
                  <div className="skeleton h-4 w-20" />
                </div>
              </div>
            ))
          ) : jobs.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Chưa có chiến dịch tuyển dụng nào</p>
              <p className="text-slate-400 text-xs mt-1">Bấm "Tạo chiến dịch mới" để bắt đầu</p>
            </div>
          ) : (
            jobs.map(job => {
              const isExpanded = expandedJobId === job.id;
              const appCount = getApplicantCount(job.id);
              
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
                        {/* Status badge with dot */}
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'OPEN' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {job.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-5 mt-2 text-sm text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400" /> {job.diaDiem || 'Toàn quốc'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-slate-400" /> {new Date(job.createdAt || job.ngayBatDau).toLocaleDateString('vi-VN')}
                        </span>
                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${
                          appCount > 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Users size={12} /> {appCount} ứng viên
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
                          title={`${window.location.origin}/public/apply/${job.slug}`}
                        >
                          /public/apply/{job.slug}
                        </a>
                      </div>
                      <div className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={18} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 animate-fade-in-up">
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80">
                        {/* Info cards */}
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-1">Số lượng tuyển</p>
                          <p className="text-sm font-semibold text-slate-800">{job.soLuongTuyen} người</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-1">Mức lương</p>
                          <p className="text-sm font-semibold text-slate-800">{job.coThoaThuan ? 'Thỏa thuận' : (job.mucLuong || '—')}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-1">Hình thức</p>
                          <p className="text-sm font-semibold text-slate-800">{job.hinhThucLamViec?.replace('_', '-') || '—'}</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-100">
                          <p className="text-xs text-slate-400 mb-1">Hạn nộp hồ sơ</p>
                          <p className="text-sm font-semibold text-slate-800">{new Date(job.hanNopHoSo).toLocaleDateString('vi-VN')}</p>
                        </div>
                      </div>

                      <div className="px-5 pb-4 border-t border-slate-100 bg-white flex justify-end gap-2 pt-3">
                        <Link 
                          to={`/manager/recruitment/campaigns/edit/${job.id}`}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium text-sm transition-colors border border-blue-200"
                        >
                          Sửa
                        </Link>
                        {job.status === 'OPEN' ? (
                          <button 
                            onClick={(e) => openConfirm(e, 'CLOSE', job.id, 'Xác nhận đóng chiến dịch', 'Bạn có chắc chắn muốn đóng chiến dịch này? Ứng viên sẽ không thể nộp hồ sơ nữa.')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-medium text-sm transition-colors border border-amber-200"
                          >
                            <XCircle size={16} /> Đóng đợt đăng ký
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => openConfirm(e, 'OPEN', job.id, 'Xác nhận mở lại chiến dịch', 'Bạn có chắc chắn muốn mở lại chiến dịch này? Ứng viên sẽ có thể tiếp tục nộp hồ sơ.')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-medium text-sm transition-colors border border-emerald-200"
                          >
                            <CheckCircle2 size={16} /> Mở lại đợt đăng ký
                          </button>
                        )}
                        <button 
                          onClick={(e) => openConfirm(e, 'DELETE', job.id, 'Xác nhận xóa chiến dịch', 'Bạn có CHẮC CHẮN muốn xóa chiến dịch này không? TẤT CẢ hồ sơ ứng viên thuộc chiến dịch này cũng sẽ bị xóa vĩnh viễn!')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-medium text-sm transition-colors border border-rose-200"
                        >
                          <Trash2 size={16} /> Xóa chiến dịch
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}></div>
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in-up">
            <h3 className={`text-lg font-semibold mb-2 ${
              confirmDialog.type === 'DELETE' ? 'text-rose-600' : 
              confirmDialog.type === 'OPEN' ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              {confirmDialog.title}
            </h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmDialog.type === 'DELETE' ? 'bg-rose-600 hover:bg-rose-700' : 
                  confirmDialog.type === 'OPEN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
