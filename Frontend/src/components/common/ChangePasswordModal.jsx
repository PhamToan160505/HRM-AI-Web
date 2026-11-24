import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './Toast';

/**
 * Modal Đổi mật khẩu dùng chung cho mọi vai trò.
 * - isFirstLogin = true: Tự động bật khi nhân viên mới (được HR xác nhận đi làm) đăng nhập lần đầu.
 * - isFirstLogin = false: Mở chủ động từ menu tài khoản hoặc trang Hồ sơ cá nhân.
 */
export default function ChangePasswordModal({ isOpen, onClose, isFirstLogin = false }) {
  const { clearMustChangePassword } = useAuth();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedNew = newPassword.trim();
  const hasMinLen = trimmedNew.length >= 8;
  const hasLetter = /[A-Za-zÀ-ỹ]/.test(trimmedNew);
  const hasDigit = /\d/.test(trimmedNew);
  const matchesConfirm = trimmedNew.length > 0 && trimmedNew === confirmPassword.trim();
  const diffFromCurrent = trimmedNew.length > 0 && trimmedNew !== currentPassword;
  const canSubmit =
    !submitting &&
    currentPassword.length > 0 &&
    hasMinLen &&
    hasLetter &&
    hasDigit &&
    matchesConfirm &&
    diffFromCurrent;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword: trimmedNew,
        confirmPassword: confirmPassword.trim(),
      });
      clearMustChangePassword();
      toast.show('Thành công', 'Đổi mật khẩu thành công! Mật khẩu mới đã được áp dụng.', 'success');
      onClose?.(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isFirstLogin ? 'Đổi mật khẩu lần đầu đăng nhập' : 'Đổi mật khẩu tài khoản'}
              </h3>
              <p className="text-xs text-blue-100">
                {isFirstLogin
                  ? 'Bảo vệ tài khoản nhân viên mới của bạn'
                  : 'Cập nhật mật khẩu đăng nhập hệ thống HRM AI'}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose?.(false)}
            className="rounded-lg p-1.5 text-blue-100 hover:bg-white/15 hover:text-white transition cursor-pointer"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {isFirstLogin && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                Chào mừng bạn gia nhập công ty! Tài khoản mới đang dùng <strong>mật khẩu tạm gửi qua email</strong>. Vui lòng đổi sang mật khẩu cá nhân dễ nhớ và an toàn hơn.
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Mật khẩu hiện tại */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              {isFirstLogin ? 'Mật khẩu tạm (từ email) *' : 'Mật khẩu hiện tại *'}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={isFirstLogin ? 'Nhập mật khẩu 12 ký tự nhận qua email' : 'Nhập mật khẩu hiện tại'}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Mật khẩu mới */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Mật khẩu mới *</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 8 ký tự, gồm chữ và số"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Xác nhận mật khẩu mới *</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                className={`w-full rounded-xl border py-2.5 pl-3.5 pr-10 text-sm text-slate-800 outline-none transition ${
                  confirmPassword && !matchesConfirm
                    ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Checklist tiêu chuẩn mật khẩu */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1.5 text-[11px]">
            {[
              [hasMinLen, 'Tối thiểu 8 ký tự'],
              [hasLetter && hasDigit, 'Bao gồm cả chữ cái và chữ số'],
              [diffFromCurrent, 'Khác với mật khẩu hiện tại'],
              [matchesConfirm, 'Khớp với ô xác nhận mật khẩu mới'],
            ].map(([ok, label]) => (
              <div key={label} className={`flex items-center gap-2 ${ok ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                <CheckCircle2 size={13} className={ok ? 'text-emerald-600' : 'text-slate-300'} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => onClose?.(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              {isFirstLogin ? 'Để sau' : 'Hủy'}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{submitting ? 'Đang lưu...' : 'Đổi mật khẩu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
