import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import logoImg from '../../assets/logo.jpg';
import { useAuth } from '../../context/AuthContext';
import { useLogin } from '../../hooks/useLogin';
import Input from '../../components/common/Input';
import './LoginPage.css';

const DEMO_ACCOUNTS = [
  { label: 'Quản trị viên', shortLabel: 'Admin', maNhanVien: '99000001' },
  { label: 'Tổng Giám đốc', shortLabel: 'CEO', maNhanVien: '99000002' },
  { label: 'Giám đốc phòng ban', shortLabel: 'Giám đốc', maNhanVien: '88000001' },
  { label: 'Trưởng phòng', shortLabel: 'Trưởng phòng', maNhanVien: '01000001' },
  { label: 'Nhân viên', shortLabel: 'Nhân viên', maNhanVien: '01000002' },
];

const LOGIN_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Dữ liệu nhất quán',
    description: 'Mọi nghiệp vụ nhân sự được kết nối trong một hệ thống.',
  },
  {
    icon: ArrowRight,
    title: 'Ra quyết định tốt hơn',
    description: 'AI hỗ trợ phân tích, con người luôn là người quyết định.',
  },
];

export default function LoginPage() {
  const { isAuthenticated, role } = useAuth();
  const { handleLogin, loading, error, clearError } = useLogin();

  const [maNhanVien, setMaNhanVien] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [activeTab, setActiveTab] = useState('login');

  if (isAuthenticated) {
    const redirectMap = {
      admin: '/admin/dashboard',
      ceo: '/ceo/dashboard',
      giam_doc_phong_ban: '/director/dashboard',
      truong_phong: '/manager/dashboard',
      nhan_vien: '/employee/dashboard',
    };

    if (!redirectMap[role]) {
      localStorage.removeItem('hrm_token');
      localStorage.removeItem('hrm_user');
      window.location.reload();
      return null;
    }

    return <Navigate to={redirectMap[role]} replace />;
  }

  const validate = () => {
    const errors = {};
    if (!maNhanVien.trim()) errors.maNhanVien = 'Vui lòng nhập mã nhân viên';
    if (!password) errors.password = 'Vui lòng nhập mật khẩu';
    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearError();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    await handleLogin(maNhanVien, password);
  };

  const updateField = (field, value) => {
    if (field === 'maNhanVien') setMaNhanVien(value);
    if (field === 'password') setPassword(value);
    setValidationErrors((current) => ({ ...current, [field]: undefined }));
    clearError();
  };

  const selectDemoAccount = (demoMaNhanVien) => {
    setMaNhanVien(demoMaNhanVien);
    setPassword('Admin@123');
    setValidationErrors({});
    clearError();
    setActiveTab('login');
  };

  return (
    <main className="hrm-login-page">
      <div className="hrm-login-shell">
        <section className="hrm-login-brand" aria-label="Giới thiệu HRM AI">
          <div className="hrm-login-brand-ring" aria-hidden="true" />
          <div className="hrm-login-brand-glow" aria-hidden="true" />

          <div className="hrm-login-logo">
            <span className="hrm-login-logo-mark overflow-hidden p-0.5">
              <img src={logoImg} alt="HRM AI Logo" className="w-full h-full object-cover rounded-xl" />
            </span>
            <span>
              <strong>HRM AI</strong>
              <small>QUẢN TRỊ NHÂN SỰ</small>
            </span>
          </div>

          <div className="hrm-login-brand-content">
            <div className="hrm-login-pill">
              <span>Vận hành đội ngũ trong một không gian</span>
            </div>

            <h1>
              Hiểu đội ngũ.
              <span>Vận hành tốt hơn.</span>
            </h1>

            <p className="hrm-login-brand-copy">
              Tuyển dụng, chấm công, tính lương và theo dõi vận hành — rõ ràng,
              liền mạch trong cùng một hệ thống.
            </p>

            <div className="hrm-login-benefits">
              {LOGIN_FEATURES.map(({ icon: Icon, title, description }) => (
                <article className="hrm-login-benefit" key={title}>
                  <Icon size={23} strokeWidth={1.8} />
                  <h2>{title}</h2>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </div>

          <p className="hrm-login-brand-footer">
            Một hệ thống thống nhất cho toàn bộ hành trình nhân sự.
          </p>
        </section>

        <section className="hrm-login-auth" aria-label="Đăng nhập hệ thống">
          <div className="hrm-login-auth-inner">
            <div className="hrm-login-mobile-logo">
              <span className="hrm-login-mobile-logo-mark overflow-hidden p-0.5">
                <img src={logoImg} alt="HRM AI Logo" className="w-full h-full object-cover rounded-lg" />
              </span>
              <span>
                <strong>HRM AI</strong>
                <small>QUẢN TRỊ NHÂN SỰ</small>
              </span>
            </div>

            <header className="hrm-login-heading">
              <p>CHÀO MỪNG TRỞ LẠI</p>
              <h2>Tiếp tục quản lý đội ngũ</h2>
              <span>Đăng nhập để truy cập không gian làm việc của bạn.</span>
            </header>

            <div className="hrm-login-card">
              <div className="hrm-login-tabs" role="tablist" aria-label="Tùy chọn đăng nhập">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'login'}
                  className={activeTab === 'login' ? 'is-active' : ''}
                  onClick={() => setActiveTab('login')}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'demo'}
                  className={activeTab === 'demo' ? 'is-active' : ''}
                  onClick={() => setActiveTab('demo')}
                >
                  Tài khoản demo
                </button>
              </div>

              {activeTab === 'login' ? (
                <form className="hrm-login-form" id="login-form" onSubmit={handleSubmit} noValidate>
                  {error && (
                    <div className="hrm-login-server-error" role="alert">
                      {error}
                    </div>
                  )}

                  <div className="hrm-login-field">
                    <Input
                      id="login-manhanvien"
                      label="Mã nhân viên"
                      type="text"
                      placeholder="Ví dụ: 99000001"
                      value={maNhanVien}
                      onChange={(event) => updateField('maNhanVien', event.target.value)}
                      error={validationErrors.maNhanVien}
                      startIcon={<UserRound size={19} strokeWidth={1.8} />}
                      className="hrm-login-input"
                      required
                      autoComplete="username"
                      autoFocus
                    />
                  </div>

                  <div className="hrm-login-field">
                    <Input
                      id="login-password"
                      label="Mật khẩu"
                      type="password"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(event) => updateField('password', event.target.value)}
                      error={validationErrors.password}
                      startIcon={<KeyRound size={19} strokeWidth={1.8} />}
                      className="hrm-login-input"
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <p className="hrm-login-account-note">
                    <BadgeCheck size={17} />
                    Dành cho tài khoản nội bộ đã được cấp quyền
                  </p>

                  <button className="hrm-login-submit" id="login-submit-btn" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="hrm-login-spinner" aria-hidden="true" />
                        Đang đăng nhập...
                      </>
                    ) : (
                      <>
                        Đăng nhập
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="hrm-login-demo-panel">
                  <div className="hrm-login-demo-note">
                    <UsersRound size={19} />
                    <p>Chọn vai trò để tự điền tài khoản. Mật khẩu mặc định là Admin@123.</p>
                  </div>

                  <div className="hrm-login-demo-grid">
                    {DEMO_ACCOUNTS.map(({ label, shortLabel, maNhanVien: demoMaNhanVien }) => {
                      const isSelected = maNhanVien === demoMaNhanVien;
                      return (
                        <button
                          key={demoMaNhanVien}
                          type="button"
                          className={isSelected ? 'is-selected' : ''}
                          onClick={() => selectDemoAccount(demoMaNhanVien)}
                        >
                          <span>
                            <strong>{shortLabel}</strong>
                            <small>{demoMaNhanVien}</small>
                          </span>
                          {isSelected ? <Check size={17} /> : <ArrowRight size={16} />}
                          <span className="hrm-login-sr-only">Chọn tài khoản {label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <footer className="hrm-login-footer">
              <span>© 2026 HRM AI</span>
              <i aria-hidden="true" />
              <span><ShieldCheck size={13} /> Hệ thống nội bộ doanh nghiệp</span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
