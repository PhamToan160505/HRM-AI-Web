import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLogin } from '../../hooks/useLogin';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { Card } from '../../components/common/Card';

const DEMO_ACCOUNTS = [
  { label: 'Quản trị viên', shortLabel: 'Admin', maNhanVien: '99000001' },
  { label: 'Tổng Giám đốc', shortLabel: 'CEO', maNhanVien: '99000002' },
  { label: 'Giám đốc phòng ban', shortLabel: 'Giám đốc', maNhanVien: '88000001' },
  { label: 'Trưởng phòng', shortLabel: 'Trưởng phòng', maNhanVien: '01000001' },
  { label: 'Nhân viên', shortLabel: 'Nhân viên', maNhanVien: '01000002' },
];

const HIGHLIGHTS = [
  'Tuyển dụng với trợ lý AI',
  'Chấm công khuôn mặt chính xác',
  'Tự động hóa tính lương và báo cáo',
];

/**
 * Trang đăng nhập — public, không cần JWT.
 * Thiết kế: split layout — panel trái (brand) + panel phải (form).
 * Bảng màu: xanh dương & trắng theo SKILL_frontend-design.md mục 0.
 */
export default function LoginPage() {
  const { isAuthenticated, role } = useAuth();
  const { handleLogin, loading, error, clearError } = useLogin();

  const [maNhanVien, setMaNhanVien] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Nếu đã đăng nhập, redirect về dashboard tương ứng
  if (isAuthenticated) {
    const redirectMap = {
      admin: '/admin/dashboard',
      ceo: '/ceo/dashboard',
      giam_doc_phong_ban: '/director/dashboard',
      truong_phong: '/manager/dashboard',
      nhan_vien: '/employee/dashboard',
    };
    
    if (!redirectMap[role]) {
      // Clear old/invalid token to break redirect loop
      localStorage.removeItem('hrm_token');
      localStorage.removeItem('hrm_user');
      window.location.reload();
      return null;
    }
    
    return <Navigate to={redirectMap[role]} replace />;
  }

  const validate = () => {
    const errors = {};
    if (!maNhanVien.trim()) {
      errors.maNhanVien = 'Vui lòng nhập mã nhân viên';
    }
    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    await handleLogin(maNhanVien, password);
  };

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(460px,0.92fr)_1.08fr]">
      {/* ── Panel trái — Brand ────────────────────────────────────── */}
      <section className="relative hidden min-h-screen overflow-hidden bg-gradient-to-br from-[#102a67] via-[#1748b5] to-[#2870ed] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute -right-32 -top-28 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute -bottom-44 -left-24 h-[30rem] w-[30rem] rounded-full bg-blue-950/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'linear-gradient(to bottom, black, transparent 82%)',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg shadow-blue-950/20 backdrop-blur-sm">
            <Building2 size={21} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-lg font-bold leading-none tracking-tight">HRM AI</p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-blue-100/75">
              HUMAN RESOURCE MANAGEMENT
            </p>
          </div>
        </div>

        {/* Main brand copy */}
        <div className="relative z-10 my-12 max-w-xl">
          <h1 className="max-w-lg text-[2.6rem] font-bold leading-[1.12] tracking-[-0.035em] xl:text-5xl">
            Quản trị nhân sự
            <span className="mt-1 block text-sky-200">thông minh hơn mỗi ngày</span>
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-blue-100/80 xl:text-[15px]">
            Một không gian làm việc thống nhất giúp doanh nghiệp vận hành đội ngũ hiệu quả,
            minh bạch và an toàn.
          </p>

          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-blue-50/90">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300/20 text-cyan-100">
                  <Check size={12} strokeWidth={3} />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-2 text-xs text-blue-100/65">
          <ShieldCheck size={15} />
          <span>Dữ liệu được mã hóa và bảo vệ theo tiêu chuẩn doanh nghiệp</span>
        </div>
      </section>

      {/* ── Panel phải — Form đăng nhập ───────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-100/60 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-56 w-56 rounded-full bg-indigo-100/50 blur-3xl" />

        <div className="relative z-10 w-full max-w-[440px] animate-fade-in-up">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-600/25">
              <Building2 size={21} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none text-slate-900">HRM AI</p>
              <p className="mt-1 text-[10px] font-medium tracking-wide text-slate-400">HUMAN RESOURCE MANAGEMENT</p>
            </div>
          </div>

          <Card className="rounded-3xl border-white/80 bg-white/95 p-7 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.28)] backdrop-blur-sm sm:p-9">
            <div className="mb-7">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                Chào mừng trở lại
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Đăng nhập để tiếp tục vào không gian làm việc của bạn.
              </p>
            </div>

            <form id="login-form" onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Global error từ server */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-700"
                >
                  <span className="mt-0.5 shrink-0">⚠</span>
                  {error}
                </div>
              )}

              <Input
                id="login-manhanvien"
                label="Mã nhân viên"
                type="text"
                placeholder="Nhập mã nhân viên"
                value={maNhanVien}
                onChange={(e) => setMaNhanVien(e.target.value)}
                error={validationErrors.maNhanVien}
                startIcon={<UserRound size={17} />}
                className="h-12 rounded-xl border-slate-200 bg-slate-50/70 text-[13px] focus:bg-white"
                required
                autoComplete="username"
                autoFocus
              />

              <Input
                id="login-password"
                label="Mật khẩu"
                type="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={validationErrors.password}
                startIcon={<KeyRound size={17} />}
                className="h-12 rounded-xl border-slate-200 bg-slate-50/70 text-[13px] focus:bg-white"
                required
                autoComplete="current-password"
              />

              <Button
                id="login-submit-btn"
                type="submit"
                fullWidth
                loading={loading}
                size="lg"
                className="h-12 rounded-xl border-0 bg-gradient-to-r from-blue-700 to-blue-600 text-sm font-semibold shadow-lg shadow-blue-600/20 hover:from-blue-800 hover:to-blue-700"
              >
                {loading ? (
                  'Đang đăng nhập...'
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>

            {/* Gợi ý tài khoản demo */}
            <details className="group mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 open:bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold text-slate-600 marker:content-none">
                <span className="flex items-center gap-2">
                  Dùng tài khoản trải nghiệm
                </span>
                <ChevronDown size={15} className="text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                <p className="mb-3 text-[11px] leading-4 text-slate-400">
                  Chọn một vai trò để hệ thống tự điền thông tin đăng nhập.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map(({ label, shortLabel, maNhanVien: demoMaNhanVien }) => {
                    const isSelected = maNhanVien === demoMaNhanVien;
                    return (
                      <button
                        key={demoMaNhanVien}
                        type="button"
                        title={label}
                        onClick={() => {
                          setMaNhanVien(demoMaNhanVien);
                          setPassword('Admin@123');
                          setValidationErrors({});
                          clearError();
                        }}
                        className={`flex min-h-10 items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
                        }`}
                      >
                        <span className="truncate">{shortLabel}</span>
                        {isSelected && <Check size={13} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </details>
          </Card>

          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-center text-[11px] text-slate-400 sm:flex-row sm:gap-3">
            <span>© 2026 HRM AI</span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={12} />
              Hệ thống dành riêng cho nội bộ doanh nghiệp
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
