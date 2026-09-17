import React, { forwardRef, useState, useId } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Input component — dùng chung toàn hệ thống.
 * Theo SKILL_frontend-design.md mục 4.
 *
 * Props:
 *   label: string — label hiển thị phía trên input
 *   error: string — message lỗi hiển thị phía dưới
 *   type: 'text' | 'email' | 'password' | ...
 *   placeholder, disabled, required, value, onChange, ...
 *   className: extend class nếu cần
 *
 * Tự động toggle show/hide cho type="password".
 */

const Input = forwardRef(function Input(
  {
    label,
    error,
    type = 'text',
    placeholder,
    disabled = false,
    required = false,
    className = '',
    startIcon,
    id: externalId,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const inputId = externalId || generatedId;

  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const baseInputClass = [
    'w-full h-9 px-3 py-2 text-sm',
    'bg-bg border rounded-md',
    'text-text placeholder:text-muted',
    'transition-colors duration-150',
    startIcon ? 'pl-10' : '',
    isPassword ? 'pr-10' : '',
    error
      ? 'border-danger focus:border-danger focus:ring-danger/30 focus:ring-2 focus:ring-offset-0'
      : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20 focus:ring-offset-0',
    disabled ? 'bg-bg-secondary text-muted cursor-not-allowed' : '',
    'outline-none',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className={[
            'text-xs font-medium',
            error ? 'text-danger' : 'text-text-secondary',
          ].join(' ')}
        >
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {startIcon && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          >
            {startIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={baseInputClass}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />

        {/* Toggle show/hide password */}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text-secondary transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          id={`${inputId}-error`}
          className="flex items-center gap-1 text-xs text-danger"
          role="alert"
        >
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
