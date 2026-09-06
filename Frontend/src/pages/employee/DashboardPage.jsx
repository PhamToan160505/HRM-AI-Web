import React, { useState, useEffect } from 'react';
import { UserSquare2, AlertCircle } from 'lucide-react';
import { CardHeader } from '../../components/common/Card';
import Button from '../../components/common/Button';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';

/**
 * Dashboard Nhân viên.
 */
export default function EmployeeDashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profile, setProfile] = useState({});
  const [todayAttendance, setTodayAttendance] = useState(null);
  const toast = useToast();
  const { user } = useAuth();

  useEffect(() => {
    // Tạm lấy profile để hiển thị
    api.get('/api/employees/me').then(res => {
        if(res.data.success) {
            setProfile(res.data.data);
        }
    }).catch(console.error);

    api.get('/api/dashboard/employee').then(res => {
        if(res.data.success && res.data.data.todayAttendance) {
            setTodayAttendance(res.data.data.todayAttendance);
        }
    }).catch(console.error);
  }, []);

  const hasLoadedProfile = Object.keys(profile).length > 0;
  const isMissingInfo = hasLoadedProfile && (!profile.cccdFrontPublicId || !profile.phone || !profile.cccd || !profile.ngaySinh || !profile.queQuan || !profile.diaChi || !profile.ngayCapCccd || !profile.noiCapCccd);

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-text">Tổng quan — Nhân viên {user?.tenPhong ? (user.tenPhong.toLowerCase().startsWith('phòng ') ? user.tenPhong.substring(6) : user.tenPhong) : ''}</h1>
          <p className="text-xs text-muted mt-0.5">Hồ sơ và thông tin cá nhân</p>
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

      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <UserSquare2 size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Xin chào, {profile.hoTen || 'Nhân viên'}!</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          Chào mừng bạn đến với hệ thống quản trị nhân sự HRM AI. Bạn có thể xem thông tin cá nhân của mình bằng cách nhấn vào menu tài khoản ở góc trên bên phải.
        </p>

        {todayAttendance ? (
          <div className="bg-emerald-50 border border-emerald-100 px-6 py-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
              <div className="text-emerald-600 bg-emerald-100 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                ✓
              </div>
              <div className="text-left">
                  <h3 className="font-semibold text-emerald-800">Trạng thái chấm công hôm nay</h3>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    Bạn đã check-in thành công lúc <strong>{todayAttendance.timeIn}</strong>.
                    {todayAttendance.timeOut ? ` Check-out lúc ${todayAttendance.timeOut}.` : ' Đừng quên check-out khi ra về nhé!'}
                  </p>
              </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 px-6 py-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
              <AlertCircle className="text-amber-600" size={28} />
              <div className="text-left">
                  <h3 className="font-semibold text-amber-800">Bạn chưa chấm công hôm nay!</h3>
                  <p className="text-sm text-amber-700 mt-0.5">
                    Hãy truy cập mục "Chấm công" ở menu bên trái để thực hiện check-in bằng khuôn mặt (AI).
                  </p>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
