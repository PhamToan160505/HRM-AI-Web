import React, { useEffect, useState } from 'react';
import { Search, Filter, ShieldAlert, ShieldCheck, Star, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';
import { useAuth } from '../../../context/AuthContext';

export default function ApplicationListPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { showNotification } = useNotification();
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState(role === 'giam_doc' ? 'PENDING_DIRECTOR' : 'ALL');

  useEffect(() => {
    Promise.all([
      api.get('/api/recruitment/applications'),
      api.get('/api/recruitment/jobs')
    ]).then(([appRes, jobRes]) => {
      if (appRes.data.success) {
        setApplications(appRes.data.data);
      }
      if (jobRes.data.success) {
        setJobs(jobRes.data.data);
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          app.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesJob = selectedJobId === 'ALL' || (app.jobPosting?.id && app.jobPosting.id.toString() === selectedJobId);
    
    // Tab "Cần xác minh": Chỉ hiện những hồ sơ đang chờ HR xử lý (PENDING) và bị cắm cờ
    if (selectedStatus === 'NEEDS_VERIFICATION') {
      return matchesSearch && matchesJob && app.needsVerification && app.approvalStatus === 'PENDING';
    }
    
    // Tab "Chờ xử lý": Chỉ hiện những hồ sơ PENDING mà KHÔNG bị cắm cờ
    if (selectedStatus === 'PENDING') {
      return matchesSearch && matchesJob && app.approvalStatus === 'PENDING' && !app.needsVerification;
    }
    
    const matchesStatus = selectedStatus === 'ALL' || app.approvalStatus === selectedStatus;
    return matchesSearch && matchesJob && matchesStatus;
  });

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa hồ sơ này? Hành động này không thể hoàn tác.')) {
      try {
        const res = await api.delete(`/api/recruitment/applications/${id}`);
        if (res.data.success) {
          showNotification('Thành công', 'Đã xóa hồ sơ ứng viên', 'success');
          setApplications(prev => prev.filter(app => app.id !== id));
        }
      } catch (error) {
        showNotification('Lỗi', 'Không thể xóa hồ sơ', 'error');
      }
    }
  };

  const STATUS_MAP = {
    'PENDING':           { label: 'Chờ xử lý', color: 'bg-amber-100 text-amber-700' },
    'PENDING_DIRECTOR':  { label: 'Chờ GĐ duyệt', color: 'bg-blue-100 text-blue-700' },
    'APPROVED':          { label: 'Đã duyệt', color: 'bg-emerald-100 text-emerald-700' },
    'REJECTED':          { label: 'Đã loại', color: 'bg-rose-100 text-rose-700' },
  };

  const getStatusBadge = (app) => {
    if (app.needsVerification && app.approvalStatus === 'PENDING') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-max bg-purple-100 text-purple-700">Cần xác minh</span>;
    }
    const s = STATUS_MAP[app.approvalStatus];
    if (s) return <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-max ${s.color}`}>{s.label}</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{app.approvalStatus}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Hồ sơ</h1>
          <p className="text-sm text-slate-500 mt-1">Danh sách hồ sơ ứng viên được AI đánh giá sơ bộ.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <select 
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="ALL">Tất cả chiến dịch</option>
            {jobs.map(job => (
              <option key={job.id} value={job.id.toString()}>{job.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200">
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'PENDING', label: 'Chờ xử lý', roles: ['truong_phong'] },
          { id: 'PENDING_DIRECTOR', label: 'Chờ GĐ duyệt' },
          { id: 'APPROVED', label: 'Đã duyệt' },
          { id: 'REJECTED', label: 'Đã loại' },
          { id: 'NEEDS_VERIFICATION', label: 'Cần xác minh', roles: ['truong_phong'] },
        ]
        .filter(tab => !tab.roles || tab.roles.includes(role))
        .map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedStatus(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedStatus === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Ứng viên</th>
                <th className="px-6 py-4">Chiến dịch</th>
                <th className="px-6 py-4">Điểm phù hợp (AI)</th>
                <th className="px-6 py-4">Gian lận</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
              ) : filteredApplications.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Không tìm thấy hồ sơ nào.</td></tr>
              ) : (
                filteredApplications.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {app.fullName}
                        {app.isPriority && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full border border-red-200 font-bold tracking-wide flex items-center gap-1">
                            <Star className="w-3 h-3 fill-red-700" /> ƯU TIÊN
                          </span>
                        )}
                        {app.needsVerification && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">Cần xác minh</span>
                        )}
                        {(() => {
                           let gender = '';
                           if (app.extractedData) {
                              try {
                                const ext = typeof app.extractedData === 'string' ? JSON.parse(app.extractedData) : app.extractedData;
                                if (ext.gender?.value) gender = ext.gender.value;
                              } catch(e) {}
                           }
                           if (gender) {
                             return <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{gender}</span>;
                           }
                           return null;
                        })()}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">{app.email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{app.jobPosting?.title || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Star className={`w-4 h-4 ${app.fitScore >= 80 ? 'text-emerald-500 fill-emerald-500' : app.fitScore >= 50 ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                        <span className="font-bold text-slate-700">{app.fitScore}/100</span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${app.fitScore >= 80 ? 'bg-emerald-500' : app.fitScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${app.fitScore}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {app.fraudFlagged ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-1 rounded font-medium text-xs border border-rose-100">
                          <ShieldAlert size={14}/> Phát hiện
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-medium text-xs border border-emerald-100">
                          <ShieldCheck size={14}/> An toàn
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(app)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/${role === 'giam_doc' ? 'director' : 'manager'}/recruitment/applications/${app.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                        >
                          Chi tiết
                        </button>
                        {role !== 'giam_doc' && (
                          <button 
                            onClick={() => handleDelete(app.id)}
                            className="text-rose-600 hover:text-rose-800 font-medium bg-rose-50 hover:bg-rose-100 p-1.5 rounded transition-colors"
                            title="Xóa hồ sơ"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
