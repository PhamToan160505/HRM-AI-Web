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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';
import { notificationService } from '../../services/notification.service';
import Button from '../common/Button';
import EmployeeProfileSummary from '../employee/EmployeeProfileSummary';
import CccdScannerModal from '../employee/CccdScannerModal';
import api from '../../services/api';
import { useToast } from '../common/Toast';

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

function SidebarContent({ role, onClose }) {
  const directorNav = [
    { to: '/director/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/director/employees', icon: Users, label: 'Nhân sự' },
    { to: '/director/recruitment', icon: Briefcase, label: 'Tuyển dụng' },
    { to: '/director/attendance', icon: ClipboardCheck, label: 'Chấm công' },
    { to: '/director/payroll', icon: Banknote, label: 'Tính lương' },
    { to: '/director/holidays', icon: Calendar, label: 'Cấu hình ngày lễ' },
  ];
  const managerNav = [
    { to: '/manager/dashboard', icon: LayoutDashboard, label: 'Tổng quan', end: true },
    { to: '/manager/employees', icon: Users, label: 'Nhân sự' },
    { to: '/manager/recruitment/overview', icon: Briefcase, label: 'Tuyển dụng AI' },
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
        
        <NavButton 
            icon={UserSquare2} 
            label="Hồ sơ cá nhân" 
            onClick={() => {
                if(onClose) onClose();
                // trigger a custom event that AppLayout listens to
                window.dispatchEvent(new CustomEvent('open-profile-modal'));
            }} 
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
  
  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [myCccdImages, setMyCccdImages] = useState({ frontUrl: null, backUrl: null });
  const [isCccdModalOpen, setIsCccdModalOpen] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const handleOpenPersonalProfile = async () => {
    setIsProfileModalOpen(true);
    setIsLoadingProfile(true);
    setMyProfile(null);
    setMyCccdImages({ frontUrl: null, backUrl: null });
    try {
        const [profileRes, cccdRes] = await Promise.all([
            api.get('/api/employees/me').catch(() => null),
            api.get(`/api/employees/${userId}/cccd-image-url`).catch(() => null)
        ]);
        
        if (profileRes?.data?.success) {
            setMyProfile(profileRes.data.data);
        }
        if (cccdRes?.data?.success) {
            setMyCccdImages({ frontUrl: cccdRes.data.data.frontUrl, backUrl: cccdRes.data.data.backUrl });
        }
    } catch (err) {
        console.error("Lỗi khi tải hồ sơ:", err);
        toast.show("Lỗi", "Không thể tải thông tin hồ sơ", "error");
    } finally {
        setIsLoadingProfile(false);
    }
  };

  const handleUpdateProfileData = async (data) => {
      try {
          const res = await api.put('/api/employees/me', data);
          if(res.data.success) {
              setMyProfile(res.data.data);
              toast.show("Thành công", "Cập nhật thông tin thành công!", "success");
          }
      } catch (err) {
          toast.show("Lỗi", "Không thể cập nhật thông tin", "error");
      }
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOpenProfile = () => handleOpenPersonalProfile();
    window.addEventListener('open-profile-modal', handleOpenProfile);
    return () => window.removeEventListener('open-profile-modal', handleOpenProfile);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-[#1E3A8A] shrink-0 shadow-xl">
        <SidebarContent role={role} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#1E3A8A] z-50 flex flex-col lg:hidden shadow-2xl animate-slide-in-right">
            <SidebarContent role={role} onClose={() => setSidebarOpen(false)} />
          </aside>
        </>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Mở menu"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          {/* DEV test button */}
          {import.meta.env.DEV && (
            <button
              onClick={() => notificationService.testSendNotification().catch(console.error)}
              className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
              title="Gửi test notification"
            >
              Test
            </button>
          )}

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
                        handleOpenPersonalProfile();
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5 animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Personal Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-50 rounded-xl p-6 w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto relative">
                <button 
                    onClick={() => setIsProfileModalOpen(false)}
                    className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                >
                    <X size={20} />
                </button>
                <h2 className="text-xl font-bold mb-6 text-gray-900">Hồ sơ cá nhân của tôi</h2>
                
                {isLoadingProfile ? (
                    <div className="py-8 text-center text-gray-500">Đang tải hồ sơ...</div>
                ) : myProfile ? (
                    <>
                        <div className="mb-4">
                            <EmployeeProfileSummary 
                                profile={myProfile} 
                                isEditable={true}
                                onUpdate={handleUpdateProfileData}
                            />
                        </div>

                        {!myProfile.cccdFrontPublicId && (
                            <div className="mt-4 flex justify-center pb-4">
                                <Button variant="primary" onClick={() => setIsCccdModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm text-white">
                                    <UserSquare2 size={18} /> Cập nhật hình ảnh CCCD bằng AI
                                </Button>
                            </div>
                        )}

                        {myProfile.cccdFrontPublicId && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-center border-b pb-2">Mặt trước CCCD</h3>
                                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg min-h-[200px] p-2">
                                        {myCccdImages.frontUrl ? (
                                            <img src={myCccdImages.frontUrl} alt="Mặt trước" className="max-w-full max-h-[250px] object-contain rounded-md shadow-sm" />
                                        ) : (
                                            <span className="text-gray-400 text-sm animate-pulse">Đang tải ảnh...</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-center border-b pb-2">Mặt sau CCCD</h3>
                                    <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg min-h-[200px] p-2">
                                        {myCccdImages.backUrl ? (
                                            <img src={myCccdImages.backUrl} alt="Mặt sau" className="max-w-full max-h-[250px] object-contain rounded-md shadow-sm" />
                                        ) : (
                                            <span className="text-gray-400 text-sm animate-pulse">Đang tải ảnh...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-8 text-center text-rose-500">Không tìm thấy thông tin hồ sơ.</div>
                )}
                
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={() => setIsProfileModalOpen(false)}>Đóng</Button>
                </div>
            </div>
        </div>
      )}
      
      {/* CCCD Upload Modal */}
      {isCccdModalOpen && (
          <CccdScannerModal 
              userId={userId} 
              onClose={() => setIsCccdModalOpen(false)} 
              onSuccess={() => {
                  setIsCccdModalOpen(false);
                  handleOpenPersonalProfile();
              }} 
          />
      )}
    </div>
  );
}

export default AppLayout;
