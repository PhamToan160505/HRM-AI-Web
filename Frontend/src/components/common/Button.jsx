import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button component — dùng chung toàn hệ thống.
 * Theo SKILL_frontend-design.md mục 4: nút hành động quan trọng luôn có chữ.
 *
 * Props:
 *   variant: 'primary' | 'outline' | 'danger' | 'ghost'
 *   size: 'sm' | 'md' | 'lg'
 *   loading: boolean — hiện spinner, disable click
 *   disabled: boolean
 *   fullWidth: boolean
 *   type: 'button' | 'submit' | 'reset'
 *   onClick, children, className (extend nếu cần)
 */

const variantClasses = {
  primary: [
    'bg-primary text-white border-transparent',
    'hover:bg-primary-dark',
    'disabled:bg-primary/50 disabled:cursor-not-allowed',
  ].join(' '),

  outline: [
    'bg-transparent text-primary border-primary',
    'hover:bg-primary-light hover:border-primary-dark',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-danger text-white border-transparent',
    'hover:bg-red-700',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  ghost: [
    'bg-transparent text-text-secondary border-transparent',
    'hover:bg-bg-secondary hover:text-text',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
};

const sizeClasses = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2.5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  children,
  className = '',
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium',
        'rounded-md border select-none',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin shrink-0" />}
      {children}
    </button>
  );
}

export default Button;
