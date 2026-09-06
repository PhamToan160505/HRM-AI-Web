import React, { useState, useCallback, createContext, useContext } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Toast Context ──────────────────────────────────────────────────────────
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

// ─── Icon per type ──────────────────────────────────────────────────────────
const ICONS = {
  success: <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />,
  error:   <XCircle     size={18} className="text-rose-500   shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
  info:    <Info          size={18} className="text-blue-500  shrink-0" />,
};

const BG = {
  success: 'border-l-emerald-500',
  error:   'border-l-rose-500',
  warning: 'border-l-amber-500',
  info:    'border-l-blue-500',
};

// ─── Single Toast item ──────────────────────────────────────────────────────
function Toast({ id, title, message, type = 'info', onDismiss }) {
  return (
    <div
      className={`
        toast-enter flex items-start gap-3 
        bg-white rounded-xl shadow-lg border border-slate-100 border-l-4 ${BG[type]}
        px-4 py-3 min-w-[280px] max-w-[360px] w-full
        pointer-events-auto
      `}
      role="alert"
    >
      {ICONS[type]}
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-slate-800 leading-tight">{title}</p>}
        {message && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{message}</p>}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors mt-0.5"
        aria-label="Đóng"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Toast Container ────────────────────────────────────────────────────────
export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Toast key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Toast Provider ─────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((title, message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const toastAPI = {
    show,
    dismiss,
    success: (msg, title = 'Thành công') => show(title, msg, 'success'),
    error: (msg, title = 'Lỗi') => show(title, msg, 'error'),
    warning: (msg, title = 'Cảnh báo') => show(title, msg, 'warning'),
    info: (msg, title = 'Thông báo') => show(title, msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toastAPI}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
