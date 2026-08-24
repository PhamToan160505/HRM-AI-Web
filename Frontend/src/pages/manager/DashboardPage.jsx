import React, { useState, useEffect } from 'react';
import { Users, ClipboardCheck, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '../../components/common/Card';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Dashboard Trưởng phòng
 * Ghi nhớ: module Tuyển dụng KHÔNG lọc theo department_id (README mục 3).
 */
export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({});
  const [stats, setStats] = useState({
    pendingApplications: 0,
    pendingAttendances: 0,
    payrollStatus: 'Đang tải...',
    todayCheckedIn: '—',
    todayNotCheckedIn: '—',
    openJobs: []
  });

  useEffect(() => {
    api.get('/api/employees/me').then(res => {
        if(res.data.success) {
            setProfile(res.data.data);
        }
    }).catch(console.error);

    api.get('/api/dashboard/manager').then(res => {
        if (res.data.success) {
            setStats(res.data.data);
        }
    }).catch(console.error);
  }, []);

  const hasLoadedProfile = Object.keys(profile).length > 0;
  const missingFields = [];
  if (hasLoadedProfile) {
      if (!profile.cccdFrontPublicId) missingFields.push("Hình ảnh CCCD");
      if (!profile.cccd) missingFields.push("Số CCCD");
      if (!profile.phone) missingFields.push("Số điện thoại");
      if (!profile.ngaySinh) missingFields.push("Ngày sinh");
      if (!profile.queQuan) missingFields.push("Quê quán");
      if (!profile.diaChi) missingFields.push("Địa chỉ thường trú");
      if (!profile.ngayCapCccd) missingFields.push("Ngày cấp");
      if (!profile.noiCapCccd) missingFields.push("Nơi cấp");
  }
  const isMissingInfo = hasLoadedProfile && missingFields.length > 0;

  const currentMonth = new Date().getMonth() + 1;

  const { role } = useAuth();
  const title = role === 'giam_doc_phong_ban' ? 'Tổng quan — Giám Đốc Phòng Ban' : 'Tổng quan — Trưởng Phòng';
  
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý tuyển dụng & nhân sự phòng ban</p>
        </div>
      </div>

      {isMissingInfo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-sm mb-6">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div>
                  <h3 className="text-red-800 font-semibold text-sm">Hồ sơ cá nhân chưa hoàn thiện</h3>
                  <p className="text-red-600 text-sm mt-1 leading-relaxed">
                      Thông tin của bạn chưa đầy đủ. Các mục còn thiếu: <strong>{missingFields.join(', ')}</strong>. 
                      Vui lòng vào <strong>Hồ sơ cá nhân</strong> để cập nhật đầy đủ (Lưu ý: số điện thoại phải nhập bằng tay vì CCCD không có).
                  </p>
              </div>
          </div>
      )}

      {/* Việc cần làm (To-Do Cards) */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Việc cần xử lý</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Đơn ngoại lệ cần duyệt */}
            <div 
                onClick={() => navigate('/manager/attendance?status=PENDING')}
                className="bg-white rounded-xl shadow-sm border border-orange-200 p-5 cursor-pointer hover:shadow-md hover:border-orange-300 transition-all group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-semibold text-orange-600 mb-1">Đơn từ cần duyệt</p>
                        <h2 className="text-3xl font-extrabold text-slate-800">{stats.pendingAttendances}</h2>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                        <ClipboardCheck size={20} />
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-4">Ngoại lệ chấm công & nghỉ phép</p>
            </div>

            {/* Hồ sơ ứng viên cần đánh giá */}
            <div 
                onClick={() => navigate('/manager/recruitment/applications')}
                className="bg-white rounded-xl shadow-sm border border-blue-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-semibold text-blue-600 mb-1">Ứng viên mới chờ duyệt</p>
                        <h2 className="text-3xl font-extrabold text-slate-800">{stats.pendingApplications}</h2>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                        <Users size={20} />
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-4">Hồ sơ ứng viên cần đánh giá sơ loại</p>
            </div>

            {/* Trạng thái lương */}
            <div 
                onClick={() => navigate('/manager/payroll')}
                className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between"
            >
                <div>
                    <p className="text-sm font-semibold text-emerald-600 mb-1">Trạng thái lương tháng {currentMonth}</p>
                    <h2 className="text-lg font-bold text-slate-800 mt-2">{stats.payrollStatus}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-4">Bấm để xem hoặc tính lương</p>
            </div>
        </div>
      </div>

      <div className="border-t border-slate-200 my-8"></div>

      {/* Module Tuyển dụng open jobs (optional) */}
      <Card>
        <CardHeader title="Module Tuyển dụng" subtitle="Các vị trí đang mở" />
        <div className="p-4 border-t border-gray-100">
            {stats.openJobs && stats.openJobs.length > 0 ? (
                <div className="space-y-3">
                    {stats.openJobs.map(job => (
                        <div key={job.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-800">{job.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">Hạn nộp: {new Date(job.hanNopHoSo).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <div className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                Cần tuyển {job.soLuongTuyen}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center h-32 text-muted text-sm">
                  Không có tin tuyển dụng nào đang mở.
                </div>
            )}
        </div>
      </Card>
    </div>
  );
}
