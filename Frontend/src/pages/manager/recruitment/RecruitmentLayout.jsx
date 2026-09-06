import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Briefcase, FileText, CheckSquare, Settings, BarChart2, Users, LayoutDashboard, List, Kanban } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';

export default function RecruitmentLayout() {
  const { role } = useAuth();
  
  // Xác định base path theo role
  let basePath = '/manager/recruitment';
  if (role === 'giam_doc_phong_ban') basePath = '/director/recruitment';
  if (role === 'ceo') basePath = '/ceo/recruitment';
  if (role === 'admin') basePath = '/admin/recruitment';

  const tabs = [
    { path: `${basePath}/requisitions`, label: 'Yêu cầu tuyển dụng', icon: <FileText size={18} /> },
    { path: `${basePath}/campaigns`, label: 'Chiến dịch tuyển dụng', icon: <Briefcase size={18} /> },
    { path: `${basePath}/applications`, label: 'Danh sách hồ sơ', icon: <List size={18} /> },
    { path: `${basePath}/pipeline`, label: 'Pipeline & Thống kê', icon: <Kanban size={18} /> },
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
