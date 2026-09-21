import React from 'react';

/**
 * Card component — High-End Double-Bezel Architecture
 * 
 * Props:
 *   children
 *   className: applied to outer shell (for widths, margins, grids)
 *   innerClassName: applied to inner core (for flex, paddings)
 *   noPadding: boolean — bỏ padding mặc định
 */
export function Card({ children, className = '', innerClassName = '', noPadding = false, ...props }) {
  return (
    <div
      className={[
        'bg-black/5 ring-1 ring-black/5 p-1.5',
        'rounded-[2rem]', // Outer radius
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      <div 
        className={[
          'bg-surface shadow-[var(--shadow-card)] h-full w-full',
          'rounded-[calc(2rem-0.375rem)]', // Inner radius
          'transition-smooth',
          noPadding ? '' : 'p-6 md:p-8',
          innerClassName
        ].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * CardHeader — tiêu đề card
 */
export function CardHeader({ title, subtitle, eyebrow, action, className = '' }) {
  return (
    <div className={['flex items-start justify-between gap-4 mb-6', className].join(' ')}>
      <div>
        {eyebrow && (
          <span className="inline-block px-3 py-1 mb-3 text-[10px] uppercase tracking-[0.2em] font-bold bg-primary/10 text-primary rounded-full">
            {eyebrow}
          </span>
        )}
        {title && (
          <h2 className="text-lg md:text-xl font-bold text-text tracking-tight">{title}</h2>
        )}
        {subtitle && (
          <p className="text-sm text-text-secondary mt-1 max-w-[65ch]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default Card;
