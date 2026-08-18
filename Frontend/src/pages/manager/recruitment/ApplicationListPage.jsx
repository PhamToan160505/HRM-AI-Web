import React, { useEffect, useState } from 'react';
import { Search, Filter, ShieldAlert, Star, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

export default function ApplicationListPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/recruitment/applications')
      .then(res => {
        if (res.data.success) {
          setApplications(res.data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_AI_REVIEW': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1 w-max"><Clock size={12}/> AI đang phân tích</span>;
      case 'PENDING': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1 w-max"><Clock size={12}/> Chờ duyệt</span>;
      case 'NEEDS_VERIFICATION': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1 w-max"><ShieldAlert size={12}/> Cần xác minh</span>;
      case 'APPROVED': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1 w-max"><CheckCircle size={12}/> Đã duyệt</span>;
      case 'REJECTED': return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 flex items-center gap-1 w-max"><XCircle size={12}/> Đã loại</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
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
              className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
            <Filter size={16} />
            Lọc
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Ứng viên</th>
                <th className="px-6 py-4">Chiến dịch</th>
                <th className="px-6 py-4">AI Fit Score</th>
                <th className="px-6 py-4">Gian lận</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
              ) : applications.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-500">Chưa có hồ sơ nào.</td></tr>
              ) : (
                applications.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{app.fullName}</div>
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
                        <span className="text-slate-400 text-xs font-medium">An toàn</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(app.decisionStatus)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/manager/recruitment/applications/${app.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                      >
                        Chi tiết
                      </button>
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
