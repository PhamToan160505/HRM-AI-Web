import React, { useEffect, useState } from 'react';
import { Search, CheckCircle, XCircle, ChevronRight, Star, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DirectorRecruitmentPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING_DIRECTOR');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/api/recruitment/applications')
      .then(res => {
        if (res.data.success) {
          // Only fetch applications relevant to Director
          const relevantApps = res.data.data.filter(app => 
            app.approvalStatus === 'PENDING_DIRECTOR' || 
            app.approvalStatus === 'APPROVED' || 
            app.approvalStatus === 'REJECTED'
          );
          setApplications(relevantApps);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredApps = applications.filter(app => {
    const matchesTab = activeTab === 'HISTORY' 
      ? (app.approvalStatus === 'APPROVED' || app.approvalStatus === 'REJECTED')
      : app.approvalStatus === activeTab;
    
    const matchesSearch = app.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          app.jobPosting?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesTab && matchesSearch;
  }).sort((a, b) => {
    if (activeTab === 'PENDING_DIRECTOR') {
      return (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0);
    }
    return 0; // for history, could sort by date if we had it
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Phê duyệt Tuyển dụng</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý và phê duyệt các hồ sơ do Trưởng phòng trình lên.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Tìm theo tên ứng viên, vị trí..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('PENDING_DIRECTOR')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'PENDING_DIRECTOR'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <Clock size={16} />
          Chờ phê duyệt
          {applications.filter(a => a.approvalStatus === 'PENDING_DIRECTOR').length > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs py-0.5 px-2 rounded-full">
              {applications.filter(a => a.approvalStatus === 'PENDING_DIRECTOR').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'HISTORY'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-lg'
          }`}
        >
          <CheckCircle size={16} />
          Lịch sử phê duyệt
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            Đang tải dữ liệu...
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-slate-300" />
            </div>
            <p className="text-lg font-medium text-slate-600">Không có hồ sơ nào.</p>
            <p className="text-sm text-slate-400 mt-1">Danh sách trống theo bộ lọc hiện tại.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredApps.map(app => (
              <div key={app.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 flex gap-4">
                  <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
                    {app.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-base">{app.fullName}</h3>
                      {app.isPriority && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 font-bold tracking-wide flex items-center gap-1">
                          <Star className="w-3 h-3 fill-red-700" /> ƯU TIÊN
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mt-1 flex items-center gap-4">
                      <span>Vị trí: <span className="font-medium text-slate-700">{app.jobPosting?.title || 'Chưa phân bổ'}</span></span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>Điểm AI: <span className="font-bold text-blue-600">{app.fitScore}/100</span></span>
                      
                      {activeTab === 'HISTORY' && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          {app.approvalStatus === 'APPROVED' ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle size={14}/> Đã duyệt</span>
                          ) : (
                            <span className="text-rose-600 font-medium flex items-center gap-1"><XCircle size={14}/> Đã từ chối</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => navigate(`/director/recruitment/applications/${app.id}`)}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg font-medium transition-all shadow-sm"
                >
                  Xem chi tiết <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
