import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function DirectorDashboardPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({});
  const [stats, setStats] = useState({
    totalEmployees: 0,
    openJobs: 0,
    pendingApplications: 0,
    pendingPayrolls: 0,
    todayAttendance: { present: 0, late: 0, absent: 0 },
    departmentDistribution: [],
    recentActivities: []
  });

  useEffect(() => {
    api.get('/api/employees/me').then(res => {
        if(res.data.success) {
            setProfile(res.data.data);
        }
    }).catch(console.error);
    api.get('/api/dashboard/director').then(res => {
        if(res.data.success) {
            setStats(res.data.data);
        }
    }).catch(console.error);
  }, []);

  const hasLoadedProfile = Object.keys(profile).length > 0;
  const isMissingInfo = hasLoadedProfile && (!profile.cccdFrontPublicId || !profile.phone || !profile.cccd || !profile.ngaySinh || !profile.queQuan || !profile.diaChi || !profile.ngayCapCccd || !profile.noiCapCccd);

  // Fake data for sparklines to look good
  const sparklineData = Array.from({length: 10}).map((_, i) => ({ value: Math.random() * 100 + 400 }));
  const barChartData = Array.from({length: 8}).map((_, i) => ({ value: Math.random() * 20 + 5 }));

  const attendanceData = [
    { name: 'Có mặt', value: stats.todayAttendance.present || 1, color: '#3b82f6' }, // Blue
    { name: 'Đi muộn', value: stats.todayAttendance.late || 0, color: '#f59e0b' }, // Amber
    { name: 'Vắng', value: stats.todayAttendance.absent || 0, color: '#ef4444' }, // Red
  ];

  const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#fcd34d', '#fbbf24'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Bảng điều khiển tổng quan</h1>
        </div>
      </div>

      {isMissingInfo && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 shadow-sm mb-6">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
              <div>
                  <h3 className="text-red-800 font-semibold text-sm">Hồ sơ cá nhân chưa hoàn thiện</h3>
                  <p className="text-red-600 text-sm mt-1 leading-relaxed">
                      Thông tin của bạn chưa đầy đủ. Vui lòng cập nhật đầy đủ hình ảnh CCCD và thông tin liên hệ.
                  </p>
              </div>
          </div>
      )}

      {/* Row 1: Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tổng nhân viên</p>
                <h2 className="text-4xl font-extrabold text-slate-800">{stats.totalEmployees}</h2>
            </div>
            <div className="w-24 h-16">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparklineData}>
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tuyển dụng đang mở</p>
                <h2 className="text-4xl font-extrabold text-slate-800">{stats.openJobs}</h2>
            </div>
            <div className="w-32 h-16">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData}>
                        <Bar dataKey="value" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
            <div className="flex-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chấm công hôm nay</p>
                <div className="space-y-1">
                    <p className="text-sm"><span className="font-bold text-slate-800">{stats.todayAttendance.present}</span> có mặt</p>
                    <p className="text-sm"><span className="font-bold text-slate-800">{stats.todayAttendance.late}</span> đi muộn</p>
                    <p className="text-sm"><span className="font-bold text-slate-800">{stats.todayAttendance.absent}</span> vắng</p>
                </div>
            </div>
            <div className="w-20 h-20">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={attendanceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={35}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {attendanceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Row 2: Middle Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Department Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Phân bổ phòng ban</p>
              <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={stats.departmentDistribution.length > 0 ? stats.departmentDistribution : [{name: 'No data', value: 1}]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                              {stats.departmentDistribution.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                          </Pie>
                          <Tooltip />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Hoạt động gần đây</p>
              <div className="space-y-6">
                  {stats.recentActivities.length > 0 ? stats.recentActivities.map((act, index) => (
                      <div key={index} className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                              {act.avatar}
                          </div>
                          <div>
                              <p className="text-sm font-medium text-slate-800">{act.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{act.time}</p>
                          </div>
                      </div>
                  )) : (
                      <div className="text-center text-slate-500 text-sm py-10">Không có hoạt động nào gần đây.</div>
                  )}
              </div>
          </div>
      </div>

      {/* Row 3: Action Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div 
              onClick={() => navigate('/director/recruitment/applications?status=PENDING_DIRECTOR')}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          >
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Star size={24} />
                  </div>
                  <div>
                      <p className="text-sm font-medium text-slate-500">Hồ sơ ứng viên chờ duyệt</p>
                      <h3 className="text-2xl font-bold text-slate-800">{stats.pendingApplications || 0}</h3>
                  </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-blue-500 transition-colors" size={24} />
          </div>

          <div 
              onClick={() => navigate('/director/payroll?status=DRAFT')}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          >
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <AlertCircle size={24} />
                  </div>
                  <div>
                      <p className="text-sm font-medium text-slate-500">Bảng lương chờ duyệt</p>
                      <h3 className="text-2xl font-bold text-slate-800">{stats.pendingPayrolls || 0}</h3>
                  </div>
              </div>
              <ChevronRight className="text-slate-400 group-hover:text-indigo-500 transition-colors" size={24} />
          </div>
      </div>

    </div>
  );
}
