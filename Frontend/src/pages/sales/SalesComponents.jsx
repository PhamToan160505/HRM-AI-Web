import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { labels } from './salesUtils';

export const buttonClass = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed';
export const primaryClass = `${buttonClass} !border-blue-700 !bg-blue-700 !text-white hover:!bg-blue-800`;
export const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

export function Field({ label, children, ...props }) {
  return <label className="block space-y-1.5 text-sm font-medium text-slate-700">
    <span>{label}{props.required && ' *'}</span>
    {children || <input {...props} className={inputClass} />}
  </label>;
}

export function Select({ options, ...props }) {
  return <select {...props} className={inputClass}>
    <option value="">Chọn…</option>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}

export function Status({ value }) {
  const tone = ['WON', 'ACCEPTED', 'APPROVED', 'CONFIRMED'].includes(value) ? 'bg-emerald-50 text-emerald-800'
    : ['LOST', 'DECLINED', 'RETURNED'].includes(value) ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800';
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>{labels[value] || value}</span>;
}

export function DataTable({ rows, columns, empty = 'Chưa có dữ liệu. Thêm bản ghi đầu tiên để bắt đầu.' }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const filtered = rows.filter(row => Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, totalPages - 1);
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
      <label className="relative w-full sm:w-80"><Search size={16} className="absolute left-3 top-3 text-slate-500" />
        <input aria-label="Tìm trong danh sách" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Tìm trong danh sách…" className={`${inputClass} pl-9`} />
      </label><span className="text-sm text-slate-600">{filtered.length} bản ghi</span>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{columns.map(column => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">{column.label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{filtered.slice(current * 10, current * 10 + 10).map(row => <tr key={row.id} className="hover:bg-blue-50/30">{columns.map(column => <td key={column.key} className="max-w-sm px-4 py-3 align-top">{column.render ? column.render(row) : row[column.key] || '—'}</td>)}</tr>)}</tbody>
    </table></div>
    {filtered.length === 0 && <p className="px-6 py-14 text-center text-sm text-slate-600">{search ? 'Không tìm thấy kết quả phù hợp.' : empty}</p>}
    <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-3 text-sm text-slate-600">
      <button type="button" className={buttonClass} disabled={current === 0} aria-label="Trang trước" onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button>
      <span>{current + 1} / {totalPages}</span>
      <button type="button" className={buttonClass} disabled={current + 1 === totalPages} aria-label="Trang sau" onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button>
    </div>
  </div>;
}

export function Dialog({ title, onClose, children, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><h2 className="text-lg font-bold">{title}</h2><button type="button" disabled={busy} onClick={onClose} className={buttonClass} aria-label="Đóng"><X size={18} /></button></div>
    <div className="p-6">{children}</div>
  </dialog>;
}
