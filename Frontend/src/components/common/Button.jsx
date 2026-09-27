import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Button component — High-End Design System
 * 
 * Props:
 *   variant: 'primary' | 'outline' | 'danger' | 'ghost'
 *   size: 'sm' | 'md' | 'lg'
 *   loading: boolean
 *   disabled: boolean
 *   fullWidth: boolean
 *   trailingIcon: ReactNode (icon to be nested in the circle)
 *   leadingIcon: ReactNode
 *   type: 'button' | 'submit' | 'reset'
 */

const variantClasses = {
  primary: [
    'bg-primary text-white',
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_4px_12px_rgba(37,99,235,0.2)]',
    'hover:bg-primary-dark hover:shadow-[0_8px_20px_rgba(37,99,235,0.3)]',
    'disabled:bg-primary/50 disabled:cursor-not-allowed disabled:shadow-none',
  ].join(' '),

  outline: [
    'bg-transparent text-primary border border-primary/20',
    'hover:bg-primary/5 hover:border-primary/40',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-danger text-white',
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_4px_12px_rgba(220,38,38,0.2)]',
    'hover:bg-red-700 hover:shadow-[0_8px_20px_rgba(220,38,38,0.3)]',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
  ].join(' '),

  ghost: [
    'bg-transparent text-text-secondary',
    'hover:bg-black/5',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
};

const sizeClasses = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-11 px-6 text-sm',
  lg: 'h-14 px-8 text-base',
};

const iconCircleSizes = {
  sm: 'w-6 h-6 right-1',
  md: 'w-8 h-8 right-1.5',
  lg: 'w-11 h-11 right-1.5',
};

const trailingPadding = {
  sm: 'pr-10',
  md: 'pr-14',
  lg: 'pr-16',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  trailingIcon = null,
  leadingIcon = null,
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
        'group relative inline-flex items-center justify-center font-medium',
        'rounded-full select-none',
        'transition-smooth',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        variantClasses[variant] || variantClasses.primary,
        sizeClasses[size] || sizeClasses.md,
        trailingIcon ? trailingPadding[size] || trailingPadding.md : '',
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin shrink-0 mr-2" />}
      
      {!loading && leadingIcon && (
        <span className="mr-2 inline-flex items-center shrink-0 group-hover:-translate-x-0.5 transition-smooth">{leadingIcon}</span>
      )}
      
      <span className="inline-flex items-center">{children}</span>

      {!loading && trailingIcon && (
        <span className={[
          'absolute flex items-center justify-center rounded-full',
          'bg-black/10 dark:bg-white/20',
          'group-hover:bg-black/20 group-hover:scale-105 transition-smooth',
          iconCircleSizes[size] || iconCircleSizes.md
        ].filter(Boolean).join(' ')}>
          {trailingIcon}
        </span>
      )}
    </button>
  );
}

export default Button;
