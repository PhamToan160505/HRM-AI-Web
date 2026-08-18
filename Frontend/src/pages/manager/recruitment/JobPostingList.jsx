import React, { useEffect, useState } from 'react';
import { Plus, Search, MapPin, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../../services/api';

export default function JobPostingList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Gọi API thật khi tích hợp, tạm thời mock data hoặc dùng fetch
    api.get('/api/recruitment/jobs')
      .then(res => {
        if (res.data.success) {
          setJobs(res.data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

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
        <div className="p-4 border-b border-slate-200 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm chiến dịch..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Chưa có chiến dịch tuyển dụng nào.</div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><MapPin size={14} /> Toàn quốc</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {new Date(job.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-800">Trạng thái</div>
                    <span className={`inline-flex mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      job.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {job.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-800">Public Link</div>
                    <a 
                      href={`/public/apply/${job.slug}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-1 block truncate max-w-xs"
                      title={`${window.location.origin}/public/apply/${job.slug}`}
                    >
                      {`${window.location.origin}/public/apply/${job.slug}`}
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
