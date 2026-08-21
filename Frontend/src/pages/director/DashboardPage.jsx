import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function DirectorDashboardPage() {
  const navigate = useNavigate();
  const [pendingApps, setPendingApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [profile, setProfile] = useState({});
  const [stats, setStats] = useState({
    totalEmployees: 0,
    openJobs: 0,
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
    
    api.get('/api/recruitment/applications').then(res => {
        if (res.data.success) {
          const apps = res.data.data.filter(app => app.approvalStatus === 'PENDING_DIRECTOR');
          apps.sort((a, b) => (b.isPriority ? 1 : 0) - (a.isPriority ? 1 : 0));
          setPendingApps(apps);
        }
        setLoadingApps(false);
    }).catch(() => setLoadingApps(false));
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

      {/* Row 3: Approvals (Keeping this for functionality) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hồ sơ chờ phê duyệt</p>
        </div>
        <div className="divide-y divide-slate-100">
          {loadingApps ? (
            <div className="p-8 text-center text-slate-500">Đang tải dữ liệu...</div>
          ) : pendingApps.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Không có hồ sơ nào chờ duyệt.</div>
          ) : (
            pendingApps.map(app => (
              <div key={app.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-800 text-base">{app.fullName}</h3>
                    {app.isPriority && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 font-bold tracking-wide flex items-center gap-1">
                        <Star className="w-3 h-3 fill-red-700" /> ƯU TIÊN
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    Vị trí: <span className="font-medium text-slate-700">{app.jobPosting?.title}</span> • Điểm AI: <span className="font-bold text-blue-600">{app.fitScore}/100</span>
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/director/recruitment/applications/${app.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors text-sm"
                >
                  Xem chi tiết <ChevronRight size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
