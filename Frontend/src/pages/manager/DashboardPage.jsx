import React, { useState, useEffect } from 'react';
import { Users, ClipboardCheck, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '../../components/common/Card';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';

/**
 * Dashboard Trưởng phòng — placeholder.
 * Nội dung đầy đủ sẽ triển khai ở Bước 7.
 * Ghi nhớ: module Tuyển dụng KHÔNG lọc theo department_id (README mục 3).
 */
export default function ManagerDashboardPage() {
  const [profile, setProfile] = useState({});
  const [stats, setStats] = useState({
    pendingApplications: '—',
    pendingAttendances: '—',
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
  const isMissingInfo = hasLoadedProfile && (!profile.cccdFrontPublicId || !profile.phone || !profile.cccd || !profile.ngaySinh || !profile.queQuan || !profile.diaChi || !profile.ngayCapCccd || !profile.noiCapCccd);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-text">Tổng quan — Trưởng Phòng</h1>
          <p className="text-xs text-muted mt-0.5">Quản lý tuyển dụng & phòng ban</p>
        </div>
      </div>

      {isMissingInfo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div>
                  <h3 className="text-red-800 font-semibold text-sm">Hồ sơ cá nhân chưa hoàn thiện</h3>
                  <p className="text-red-600 text-sm mt-1 leading-relaxed">
                      Thông tin của bạn chưa đầy đủ. Vui lòng bấm vào avatar ở góc phải trên cùng, chọn <strong>"Hồ sơ cá nhân"</strong> để cập nhật đầy đủ hình ảnh CCCD và thông tin liên hệ.
                  </p>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Hồ sơ chờ duyệt', value: stats.pendingApplications, icon: Users, color: 'text-warning' },
          { label: 'Chấm công cần duyệt', value: stats.pendingAttendances, icon: ClipboardCheck, color: 'text-danger' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center gap-3">
              <div className={['w-9 h-9 rounded-md flex items-center justify-center bg-bg-secondary', color].join(' ')}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="text-lg font-bold text-text tabular">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

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
