import React, { forwardRef, useState, useId } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/**
 * Input component — High-End Design System
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
    'w-full h-11 px-4 text-[15px]',
    'bg-surface border border-border/80 rounded-xl',
    'text-text placeholder:text-muted',
    'transition-smooth',
    startIcon ? 'pl-11' : '',
    isPassword ? 'pr-11' : '',
    error
      ? 'border-danger focus:border-danger focus:ring-[3px] focus:ring-danger/20 focus:ring-offset-0'
      : 'focus:border-primary focus:ring-[3px] focus:ring-primary/15 focus:ring-offset-0',
    disabled ? 'bg-bg-secondary text-muted cursor-not-allowed opacity-70' : 'hover:border-primary/40',
    'outline-none shadow-sm',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={[
            'text-[13px] font-semibold tracking-tight',
            error ? 'text-danger' : 'text-text-secondary',
          ].join(' ')}
        >
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      <div className="relative group">
        {startIcon && (
          <span
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text-secondary transition-smooth p-1 rounded-md"
            tabIndex={-1}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          id={`${inputId}-error`}
          className="flex items-center gap-1.5 text-[13px] text-danger animate-fade-in-up"
          role="alert"
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
