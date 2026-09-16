import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Banknote,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Building2,
  Briefcase,
  UserSquare2,

  Calendar,
  Clock,
  Settings,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';
import { notificationService } from '../../services/notification.service';
import Button from '../common/Button';
import EmployeeProfileSummary from '../employee/EmployeeProfileSummary';
import CccdScannerModal from '../employee/CccdScannerModal';
import api from '../../services/api';
import { useToast } from '../common/Toast';
import ChatWidget from '../chat/ChatWidget';

const roleLabels = {
  ceo: 'Tổng Giám Đốc',
  giam_doc_phong_ban: 'Giám Đốc Phòng Ban',
  admin: 'Quản Trị Hệ Thống',
  truong_phong: 'Trưởng Phòng',
  nhan_vien: 'Nhân Viên',
  admin: 'Quản Trị Hệ Thống'
};

function NavItem({ to, icon: Icon, label, end = false, hasUnread = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
          'transition-all duration-200 select-none group relative overflow-hidden',
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-blue-200 hover:bg-white/10 hover:text-white',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {/* Active left border */}
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white rounded-r-full" />
          )}
          <Icon
            size={16}
            className={`shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`}
          />
          <span>{label}</span>
          {hasUnread && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full shadow-sm" />
          )}
        </>
      )}
    </NavLink>
  );
}

function NavButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 select-none group relative overflow-hidden text-blue-200 hover:bg-white/10 hover:text-white text-left"
    >
      <Icon
        size={16}
        className="shrink-0 transition-transform duration-200 group-hover:scale-110"
      />
      <span>{label}</span>
    </button>
  );
}

function SidebarContent({ role, onClose, hasUnreadChat }) {
  const adminNav = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Tổng quan hệ thống', end: true },
    { to: '/admin/departments', icon: Building2, label: 'Quản lý phòng ban' },
    { to: '/admin/users', icon: Users, label: 'Quản lý tài khoản' },
    { to: '/admin/settings', icon: Settings, label: 'Cấu hình hệ thống' },
    { to: '/admin/chat', icon: MessageSquare, label: 'Thảo luận', hasUnread: hasUnreadChat },
  ];
  const ceoNav = [
    { to: '/ceo/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/ceo/employees', icon: Users, label: 'Nhân sự' },
    { to: '/ceo/recruitment', icon: Briefcase, label: 'Tuyển dụng' },
    { to: '/ceo/attendance', icon: ClipboardCheck, label: 'Quản lý chấm công' },
    { to: '/ceo/requests', icon: FileText, label: 'Quản lý Đơn từ' },
    { to: '/ceo/payroll', icon: Banknote, label: 'Quản lý bảng lương' },
    { to: '/ceo/chat', icon: MessageSquare, label: 'Thảo luận', hasUnread: hasUnreadChat },
  ];
  const directorNav = [
    { to: '/director/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/director/employees', icon: Users, label: 'Nhân sự' },
    { to: '/director/recruitment', icon: Briefcase, label: 'Tuyển dụng' },
    { to: '/director/attendance', icon: ClipboardCheck, label: 'Quản lý chấm công' },
    { to: '/director/my-attendance', icon: Clock, label: 'Chấm công cá nhân' },
    { to: '/director/requests', icon: FileText, label: 'Quản lý Đơn từ' },
    { to: '/director/my-requests', icon: FileText, label: 'Đơn từ của tôi' },
    { to: '/director/payroll', icon: Banknote, label: 'Quản lý bảng lương' },
    { to: '/director/chat', icon: MessageSquare, label: 'Thảo luận', hasUnread: hasUnreadChat },
  ];
  const managerNav = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/manager/employees', icon: Users, label: 'Nhân sự' },
    { to: '/manager/recruitment', icon: Briefcase, label: 'Tuyển dụng' },
    { to: '/manager/attendance', icon: ClipboardCheck, label: 'Quản lý chấm công' },
    { to: '/manager/my-attendance', icon: Clock, label: 'Chấm công cá nhân' },
    { to: '/manager/requests', icon: FileText, label: 'Quản lý Đơn từ' },
    { to: '/manager/my-requests', icon: FileText, label: 'Đơn từ của tôi' },
    { to: '/manager/payroll', icon: Banknote, label: 'Lương' },
    { to: '/manager/chat', icon: MessageSquare, label: 'Thảo luận', hasUnread: hasUnreadChat },
  ];
  const employeeNav = [
    { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/employee/attendance', icon: ClipboardCheck, label: 'Chấm công' },
    { to: '/employee/requests', icon: FileText, label: 'Đơn từ' },
    { to: '/employee/payroll', icon: Banknote, label: 'Phiếu lương' },
    { to: '/employee/chat', icon: MessageSquare, label: 'Thảo luận', hasUnread: hasUnreadChat },
  ];

  const navItems =
    role === 'admin' ? adminNav
    : role === 'ceo' ? ceoNav
    : role === 'giam_doc_phong_ban' ? directorNav
    : role === 'truong_phong' ? managerNav
    : employeeNav;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">HRM AI</p>
            <p className="text-blue-300 text-[10px] mt-0.5 tracking-widest uppercase">Quản trị nhân sự</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition-colors lg:hidden p-1 rounded"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item, idx) => (
          <NavItem key={idx} {...item} />
        ))}
        
        <div className="my-4 border-t border-white/10 pt-4" />
        
        <NavItem 
            to="profile"
            icon={UserSquare2} 
            label="Hồ sơ cá nhân" 
        />
      </nav>

      {/* Role badge */}
      <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-medium text-blue-300 uppercase tracking-wider">
          {roleLabels[role] || 'Người dùng'}
        </span>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { logout, hoTen, role, userId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  
  useEffect(() => {
    const fetchUnreadChat = async () => {
        try {
            const res = await api.get('/api/chat/groups');
            if (res.data?.data) {
                const hasUnread = res.data.data.some(g => g.latestMessageId > 0 && (g.lastReadMessageId == null || g.lastReadMessageId < g.latestMessageId));
                setHasUnreadChat(hasUnread);
            }
        } catch(e) {}
    };
    fetchUnreadChat();
    const interval = setInterval(fetchUnreadChat, 30000);
    
    window.addEventListener('chatRead', fetchUnreadChat);
    return () => {
        clearInterval(interval);
        window.removeEventListener('chatRead', fetchUnreadChat);
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1E3A8A] shrink-0 shadow-xl">
        <SidebarContent role={role} hasUnreadChat={hasUnreadChat} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#1E3A8A] z-50 flex flex-col lg:hidden shadow-2xl animate-slide-in-right">
            <SidebarContent role={role} onClose={() => setSidebarOpen(false)} hasUnreadChat={hasUnreadChat} />
          </aside>
        </>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Mở menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          <NotificationBell />

          {/* User menu */}
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              {/* Avatar */}
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white text-[11px] font-bold">
                  {hoTen?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-700 max-w-[120px] truncate hidden sm:block">
                {hoTen}
              </span>
              <ChevronDown
                size={12}
                className={`text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-20 py-1 animate-fade-in-down overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-sm font-semibold text-slate-800 truncate">{hoTen}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{roleLabels[role]}</p>
                  </div>
                  <button
                    onClick={() => {
                        setUserMenuOpen(false);
                        navigate('profile');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
                  >
                    <UserSquare2 size={14} />
                    Hồ sơ cá nhân
                  </button>
                  <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut size={14} />
                    Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}

export default AppLayout;
