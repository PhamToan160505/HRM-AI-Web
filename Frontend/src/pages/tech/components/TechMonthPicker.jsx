import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatMonthShortVN } from '../techHelpers';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function formatMonthLabelVN(monthStr) {
  return `Tháng ${formatMonthShortVN(monthStr)}`;
}

function getCurrentYearMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    value: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

export default function TechMonthPicker({
  id,
  label = 'Tháng:',
  value,
  onChange,
  align = 'left',
}) {
  const current = getCurrentYearMonth();
  const parsedValid = value && /^\d{4}-\d{2}$/.test(String(value));
  const selectedYear = parsedValid ? Number(String(value).split('-')[0]) : current.year;
  const selectedMonth = parsedValid ? Number(String(value).split('-')[1]) : current.month;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedYear);
  const containerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setViewYear(selectedYear);
    }
  }, [open, selectedYear]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  const handleSelectMonth = (year, month) => {
    const formatted = `${year}-${String(month).padStart(2, '0')}`;
    if (onChange) {
      onChange(formatted);
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition duration-150 cursor-pointer select-none ${
          open
            ? 'bg-white border-[#1E3A8A] ring-2 ring-blue-500/15'
            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 hover:border-blue-300'
        }`}
      >
        {label && (
          <span className="font-semibold text-slate-600 whitespace-nowrap">{label}</span>
        )}
        <span className="font-bold text-slate-900 tabular whitespace-nowrap">
          {formatMonthLabelVN(value)}
        </span>
        <Calendar size={14} className="text-slate-500 shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Chọn tháng và năm"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`absolute top-full mt-1.5 z-50 w-64 bg-white rounded-2xl border border-slate-200 shadow-lg p-3 space-y-2.5 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {/* Year Navigation */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                aria-label="Năm trước"
                onClick={() => setViewYear((y) => Math.max(2000, y - 1))}
                className="size-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition duration-150 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="text-sm font-extrabold text-[#0F2557] tabular">
                Năm {viewYear}
              </span>

              <button
                type="button"
                aria-label="Năm sau"
                onClick={() => setViewYear((y) => Math.min(2100, y + 1))}
                className="size-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition duration-150 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 12-Month Numeric Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m) => {
                const isSelected = viewYear === selectedYear && m === selectedMonth;
                const isCurrent = viewYear === current.year && m === current.month;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelectMonth(viewYear, m)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition duration-150 cursor-pointer tabular ${
                      isSelected
                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A] font-bold shadow-2xs'
                        : isCurrent
                        ? 'bg-blue-50/80 text-[#1E3A8A] border-blue-300 hover:bg-blue-100/70'
                        : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:border-blue-200'
                    }`}
                  >
                    Tháng {m}
                  </button>
                );
              })}
            </div>

            {/* Quick Reset to Current Month */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 tabular">
                Hiện tại: Tháng {current.month} - {current.year}
              </span>
              <button
                type="button"
                onClick={() => handleSelectMonth(current.year, current.month)}
                className="font-bold text-[#1E3A8A] hover:underline cursor-pointer"
              >
                Tháng này
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
