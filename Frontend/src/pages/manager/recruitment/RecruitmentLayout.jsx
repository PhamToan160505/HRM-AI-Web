import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Briefcase, FileText, CheckSquare, Settings, BarChart2, Users, LayoutDashboard } from 'lucide-react';

export default function RecruitmentLayout() {
  const tabs = [
    { path: '/manager/recruitment/overview', label: 'Tổng quan', icon: <LayoutDashboard size={18} /> },
    { path: '/manager/recruitment/review', label: 'Đánh giá', icon: <CheckSquare size={18} /> },
    { path: '/manager/recruitment/campaigns', label: 'Chiến dịch tuyển dụng', icon: <Briefcase size={18} /> },
    { path: '/manager/recruitment/applications', label: 'Quản lý', icon: <Users size={18} /> },
    { path: '/manager/recruitment/approvals', label: 'Phê duyệt', icon: <FileText size={18} /> },
    { path: '/manager/recruitment/reports', label: 'Báo cáo', icon: <BarChart2 size={18} /> },
    { path: '/manager/recruitment/settings', label: 'Thiết lập', icon: <Settings size={18} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 pt-4 flex space-x-6 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex items-center gap-2 pb-3 px-1 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`
            }
          >
            {tab.icon}
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
