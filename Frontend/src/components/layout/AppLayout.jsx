import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';
import { notificationService } from '../../services/notification.service';

/**
 * Layout chính — sidebar trái + header trên + vùng nội dung.
 * Theo SKILL_frontend-design.md mục 0: bố cục cố định, không thay đổi.
 *
 * Sidebar màu xanh đậm (--color-sidebar-bg: #1E3A8A).
 * Header trắng với tên user + placeholder chuông (NotificationBell sẽ thêm ở Bước 3).
 */

const roleLabels = {
  giam_doc: 'Giám Đốc',
  truong_phong: 'Trưởng Phòng',
  nhan_vien: 'Nhân Viên',
};

function NavItem({ to, icon: Icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium',
          'transition-colors duration-150 select-none',
          isActive
            ? 'bg-primary text-white'
            : 'text-[#C7D7FA] hover:bg-[#1D4ED8] hover:text-white',
        ].join(' ')
      }
    >
      <Icon size={16} className="shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarContent({ role, onClose }) {
  const directorNav = [
    { to: '/director/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/director/recruitment', icon: Users, label: 'Tuyển dụng' },
    { to: '/director/attendance', icon: ClipboardCheck, label: 'Chấm công' },
    { to: '/director/payroll', icon: Banknote, label: 'Tính lương' },
  ];
  const managerNav = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/manager/recruitment/overview', icon: Users, label: 'Tuyển dụng AI' },
    { to: '/manager/attendance', icon: ClipboardCheck, label: 'Chấm công' },
    { to: '/manager/payroll', icon: Banknote, label: 'Lương phòng' },
  ];
  const employeeNav = [
    { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/employee/attendance', icon: ClipboardCheck, label: 'Chấm công' },
    { to: '/employee/payroll', icon: Banknote, label: 'Phiếu lương' },
  ];

  const navItems =
    role === 'giam_doc' ? directorNav
    : role === 'truong_phong' ? managerNav
    : employeeNav;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#2563EB]/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center shadow-sm">
            <Building2 size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">HRM AI</p>
            <p className="text-[#93C5FD] text-[10px] mt-0.5">Hệ thống quản trị</p>
          </div>
        </div>
        {/* Nút đóng sidebar (mobile) */}
        {onClose && (
          <button onClick={onClose} className="text-[#93C5FD] hover:text-white lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Role badge ở cuối sidebar */}
      <div className="px-4 py-3 border-t border-[#2563EB]/40">
        <span className="text-[10px] font-medium text-[#93C5FD] uppercase tracking-wider">
          {roleLabels[role] || 'Người dùng'}
        </span>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { role, hoTen, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg-secondary">
      {/* ── Sidebar (desktop: luôn hiện, mobile: overlay) ─────────── */}
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1E3A8A] shrink-0">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#1E3A8A] z-50 flex flex-col lg:hidden">
            <SidebarContent role={role} onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-12 bg-surface border-b border-border flex items-center px-4 gap-3 shrink-0">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-text-secondary hover:text-text"
            aria-label="Mở menu"
          >
            <Menu size={18} />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Nút Test (chỉ hiện trong môi trường DEV) */}
          {import.meta.env.DEV && (
            <button
              onClick={() => notificationService.testSendNotification().catch(console.error)}
              className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold hover:bg-red-200 transition-colors"
              title="Nút giả lập gửi test - Chỉ dùng lúc dev, nhớ xóa!"
            >
              Test Gửi
            </button>
          )}

          <NotificationBell />

          {/* User menu */}
          <div className="relative">
            <button
              id="user-menu-btn"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-bg-secondary transition-colors"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              {/* Avatar placeholder */}
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">
                  {hoTen?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-xs font-medium text-text max-w-[120px] truncate hidden sm:block">
                {hoTen}
              </span>
              <ChevronDown
                size={12}
                className={['text-muted transition-transform duration-150', userMenuOpen ? 'rotate-180' : ''].join(' ')}
              />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-lg shadow-[var(--shadow-dropdown)] z-20 py-1">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-text truncate">{hoTen}</p>
                    <p className="text-[10px] text-muted mt-0.5">{roleLabels[role]}</p>
                  </div>
                  <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/5 transition-colors text-left"
                  >
                    <LogOut size={13} />
                    Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
