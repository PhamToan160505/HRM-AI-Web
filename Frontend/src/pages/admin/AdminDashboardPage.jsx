import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Settings, Database, Activity } from 'lucide-react';
import api from '../../services/api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/admin/dashboard/stats');
        if (res.data.success) {
          setStats(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi tải thống kê:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống</h1>
        <p className="text-sm text-slate-500 mt-1">Trang quản trị dành riêng cho System Admin</p>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Tổng người dùng</p>
                  <h3 className="text-3xl font-bold text-slate-800 mt-2">{stats?.totalUsers || 0}</h3>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                  <Users size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Đang hoạt động</p>
                  <h3 className="text-3xl font-bold text-emerald-600 mt-2">{stats?.activeUsers || 0}</h3>
                </div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                  <Activity size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500">Đã khóa</p>
                  <h3 className="text-3xl font-bold text-rose-600 mt-2">{stats?.inactiveUsers || 0}</h3>
                </div>
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                  <ShieldCheck size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Phân bổ vai trò (Role)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats?.usersByRole && Object.entries(stats.usersByRole).map(([role, count]) => (
                <div key={role} className="bg-slate-50 rounded-lg p-4 text-center border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 mb-1">{role}</p>
                  <p className="text-2xl font-bold text-slate-800">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
