import React from 'react';

/**
 * Card component — wrapper box với shadow, border, padding chuẩn.
 * Dùng cho login form, section nội dung, thẻ tóm tắt.
 *
 * Props:
 *   children
 *   className: extend nếu cần padding/size tùy chỉnh
 *   noPadding: boolean — bỏ padding mặc định (dùng khi card chứa table/list full-width)
 */
export function Card({ children, className = '', noPadding = false }) {
  return (
    <div
      className={[
        'bg-surface border border-border rounded-lg',
        'shadow-[var(--shadow-card)]',
        noPadding ? '' : 'p-5',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * CardHeader — tiêu đề card với optional action slot bên phải.
 */
export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={['flex items-start justify-between gap-3 mb-4', className].join(' ')}>
      <div>
        {title && (
          <h2 className="text-sm font-semibold text-text leading-snug">{title}</h2>
        )}
        {subtitle && (
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default Card;
