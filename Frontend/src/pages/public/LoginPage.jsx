import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLogin } from '../../hooks/useLogin';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { Card } from '../../components/common/Card';

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
    <div className="min-h-screen flex bg-bg">
      {/* ── Panel trái — Brand ────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10"
        style={{ background: 'linear-gradient(160deg, #1E3A8A 0%, #2563EB 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">HRM AI</p>
            <p className="text-blue-200 text-xs mt-0.5">Human Resource Management</p>
          </div>
        </div>

        {/* Main brand copy */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight">
              Hệ thống quản trị<br />
              <span className="text-blue-200">nhân sự thông minh</span>
            </h1>
            <p className="text-blue-100/80 text-sm mt-4 leading-relaxed">
              Tuyển dụng AI · Chấm công khuôn mặt · Tính lương tự động
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Gemini AI', 'Bảo mật JWT', 'Real-time'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-white/10 rounded-full text-xs text-blue-100 border border-white/20"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-blue-200/60 text-xs">
          <Shield size={12} />
          <span>Dữ liệu bảo mật theo chuẩn doanh nghiệp</span>
        </div>
      </div>

      {/* ── Panel phải — Form đăng nhập ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-bg-secondary">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-text">HRM AI</span>
        </div>

        <div className="w-full max-w-sm">
          <Card className="p-8">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-text">Đăng nhập</h2>
              <p className="text-xs text-muted mt-1">
                Nhập thông tin tài khoản để tiếp tục
              </p>
            </div>

            <form id="login-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Global error từ server */}
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 px-3 py-2.5 bg-danger/8 border border-danger/20 rounded-md text-xs text-danger"
                >
                  <span className="shrink-0">⚠</span>
                  {error}
                </div>
              )}

              <Input
                id="login-manhanvien"
                label="Mã nhân viên"
                type="text"
                placeholder="Ví dụ: 100001"
                value={maNhanVien}
                onChange={(e) => setMaNhanVien(e.target.value)}
                error={validationErrors.maNhanVien}
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
                required
                autoComplete="current-password"
              />

              <div className="pt-1">
                <Button
                  id="login-submit-btn"
                  type="submit"
                  fullWidth
                  loading={loading}
                  size="md"
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </div>
            </form>

            {/* Gợi ý tài khoản demo */}
            <div className="mt-6 p-3 bg-primary-light rounded-md border border-primary/20">
              <p className="text-[10px] font-semibold text-primary-deeper mb-2 uppercase tracking-wide">
                Tài khoản demo
              </p>
              <div className="space-y-1">
                {[
                  { label: 'Admin (Quản trị)', maNhanVien: '23990002' },
                  { label: 'Tổng Giám đốc', maNhanVien: '23990001' },
                  { label: 'Giám đốc phòng ban', maNhanVien: '23010001' },
                  { label: 'Trưởng phòng', maNhanVien: '23010002' },
                  { label: 'Nhân viên', maNhanVien: '23010003' },
                ].map(({ label, maNhanVien: demoMaNhanVien }) => (
                  <button
                    key={demoMaNhanVien}
                    type="button"
                    onClick={() => {
                      setMaNhanVien(demoMaNhanVien);
                      setPassword('Admin@123');
                      setValidationErrors({});
                      clearError();
                    }}
                    className="w-full flex items-center justify-between text-[11px] text-primary hover:text-primary-dark transition-colors py-0.5 text-left"
                  >
                    <span className="font-medium">{label}</span>
                    <span className="text-muted font-mono">{demoMaNhanVien}</span>
                  </button>
                ))}
                <p className="text-[10px] text-muted mt-1.5">Mật khẩu: Admin@123</p>
              </div>
            </div>
          </Card>

          <p className="text-center text-[11px] text-muted mt-5">
            © 2026 HRM AI · Dành cho nội bộ doanh nghiệp
          </p>
        </div>
      </div>
    </div>
  );
}
