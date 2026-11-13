import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Calendar,
  Award,
  Users,
  AlertTriangle,
  CheckSquare,
  Square,
  Search,
  Sparkles,
  Lock,
  Clock,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { REVIEW_TYPE_OPTIONS, formatDateVN } from '../techHelpers';

function fmtIsoDate(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getTodayIso() {
  return fmtIsoDate(new Date());
}

function getDaysInMonth(year, month1Indexed) {
  return new Date(year, month1Indexed, 0).getDate();
}

function computeMonthRange(year, month1Indexed) {
  const mm = String(month1Indexed).padStart(2, '0');
  const lastDay = getDaysInMonth(year, month1Indexed);
  const dd = String(lastDay).padStart(2, '0');
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${dd}`,
    code: `T${mm}-${year}`,
    title: `Đánh giá Hiệu suất Kỹ sư Tháng ${mm}/${year}`,
  };
}

function computeQuarterRange(year, quarterNumber) {
  const qMap = {
    1: { startMonth: '01', endMonth: '03', lastDay: '31' },
    2: { startMonth: '04', endMonth: '06', lastDay: '30' },
    3: { startMonth: '07', endMonth: '09', lastDay: '30' },
    4: { startMonth: '10', endMonth: '12', lastDay: '31' },
  };
  const cfg = qMap[quarterNumber] || qMap[4];
  return {
    start: `${year}-${cfg.startMonth}-01`,
    end: `${year}-${cfg.endMonth}-${cfg.lastDay}`,
    code: `Q${quarterNumber}-${year}`,
    title: `Đánh giá Hiệu suất & Nâng bậc Kỹ sư Quý ${quarterNumber}/${year}`,
  };
}

function computeAnnualRange(year) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    code: `NAM-${year}`,
    title: `Đánh giá Tổng kết Năm & Xét Thăng tiến Kỹ sư ${year}`,
  };
}

function computeSuggestedDeadline(periodStart, periodEnd) {
  const today = getTodayIso();
  if (periodEnd >= today) {
    const endD = new Date(periodEnd);
    endD.setDate(endD.getDate() - 5);
    const candidate = fmtIsoDate(endD);
    if (candidate >= today && candidate >= periodStart) {
      return candidate;
    }
    return periodEnd >= today ? periodEnd : today;
  }
  const now = new Date();
  now.setDate(now.getDate() + 7);
  return fmtIsoDate(now);
}

function computeMaxDeadline(periodEnd, reviewType) {
  if (!periodEnd) return undefined;
  const today = getTodayIso();
  const baseDateStr = periodEnd > today ? periodEnd : today;
  const baseDate = new Date(baseDateStr);
  const extraDays = reviewType === 'ANNUAL' ? 30 : 15;
  baseDate.setDate(baseDate.getDate() + extraDays);
  return fmtIsoDate(baseDate);
}

function getMonthDiff(targetYear, targetMonth, currYear, currMonth) {
  return (targetYear - currYear) * 12 + (targetMonth - currMonth);
}

function isMonthAllowed(targetYear, targetMonth, currYear, currMonth) {
  const diff = getMonthDiff(targetYear, targetMonth, currYear, currMonth);
  return diff >= -1 && diff <= 1;
}

function getMonthSuffix(targetYear, targetMonth, currYear, currMonth) {
  const diff = getMonthDiff(targetYear, targetMonth, currYear, currMonth);
  if (diff === 0) return '(Hiện tại)';
  if (diff === -1) return '(Vừa kết thúc)';
  if (diff === 1) return '(Kế tiếp)';
  if (diff < -1) return '(Đã qua)';
  return '(Chưa tới)';
}

function isMonthlyYearAllowed(targetYear, currYear, currMonth) {
  for (let m = 1; m <= 12; m++) {
    if (isMonthAllowed(targetYear, m, currYear, currMonth)) return true;
  }
  return false;
}

function getQuarterDiff(targetYear, targetQuarter, currYear, currQuarter) {
  return (targetYear - currYear) * 4 + (targetQuarter - currQuarter);
}

function isQuarterAllowed(targetYear, targetQuarter, currYear, currQuarter) {
  const diff = getQuarterDiff(targetYear, targetQuarter, currYear, currQuarter);
  return diff >= -1 && diff <= 1;
}

function getQuarterSuffix(targetYear, targetQuarter, currYear, currQuarter) {
  const diff = getQuarterDiff(targetYear, targetQuarter, currYear, currQuarter);
  if (diff === 0) return '(Hiện tại)';
  if (diff === -1) return '(Vừa qua)';
  if (diff === 1) return '(Kế tiếp)';
  if (diff < -1) return '(Đã qua)';
  return '(Chưa tới)';
}

function isQuarterlyYearAllowed(targetYear, currYear, currQuarter) {
  for (let q = 1; q <= 4; q++) {
    if (isQuarterAllowed(targetYear, q, currYear, currQuarter)) return true;
  }
  return false;
}

export default function CreateEvaluationCycleModal({
  isOpen,
  onClose,
  benchUsers = [],
  onSuccess,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1; // 1-4
  const todayIso = getTodayIso();
  const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const [cycleCode, setCycleCode] = useState('');
  const [title, setTitle] = useState('');
  const [reviewType, setReviewType] = useState('QUARTERLY');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selfReviewDeadline, setSelfReviewDeadline] = useState('');
  const [includeManagers, setIncludeManagers] = useState(true);
  const [targetScope, setTargetScope] = useState('ALL'); // 'ALL' | 'SELECTED'
  const [selectedIds, setSelectedIds] = useState([]);
  const [memberKeyword, setMemberKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const formBodyRef = useRef(null);

  const reportError = (msg) => {
    setErrorMsg(msg);
    formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    toastRef.current?.show('Thông tin chưa hợp lệ', msg, 'error');
  };

  const applyQuarterConfig = useCallback((q, y) => {
    const range = computeQuarterRange(y, q);
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
    setCycleCode(range.code);
    setTitle(range.title);
    setSelfReviewDeadline(computeSuggestedDeadline(range.start, range.end));
  }, []);

  const applyMonthConfig = useCallback((m, y) => {
    const range = computeMonthRange(y, m);
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
    setCycleCode(range.code);
    setTitle(range.title);
    setSelfReviewDeadline(computeSuggestedDeadline(range.start, range.end));
  }, []);

  const applyAnnualConfig = useCallback((y) => {
    const range = computeAnnualRange(y);
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
    setCycleCode(range.code);
    setTitle(range.title);
    setSelfReviewDeadline(computeSuggestedDeadline(range.start, range.end));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setCycleCode('');
    setTitle('');
    setReviewType('QUARTERLY');
    setSelectedMonth(currentMonth);
    setSelectedQuarter(currentQuarter);
    setSelectedYear(currentYear);
    setPeriodStart('');
    setPeriodEnd('');
    setSelfReviewDeadline('');
    setIncludeManagers(true);
    setTargetScope('ALL');
    setSelectedIds([]);
    setMemberKeyword('');
    setErrorMsg('');
  }, [isOpen, currentMonth, currentQuarter, currentYear]);

  const handleApplyPreset = (mode) => {
    setErrorMsg('');
    if (mode === 'MONTHLY') {
      setReviewType('MONTHLY');
      setSelectedMonth(currentMonth);
      setSelectedYear(currentYear);
      applyMonthConfig(currentMonth, currentYear);
    } else if (mode === 'ANNUAL') {
      setReviewType('ANNUAL');
      setSelectedYear(currentYear);
      applyAnnualConfig(currentYear);
    } else {
      setReviewType('QUARTERLY');
      setSelectedQuarter(currentQuarter);
      setSelectedYear(currentYear);
      applyQuarterConfig(currentQuarter, currentYear);
    }
  };

  const handleReviewTypeChange = (newType) => {
    setReviewType(newType);
    setErrorMsg('');
    if (newType === 'MONTHLY') {
      let y = selectedYear;
      let m = selectedMonth;
      if (!isMonthlyYearAllowed(y, currentYear, currentMonth)) {
        y = currentYear;
      }
      if (!isMonthAllowed(y, m, currentYear, currentMonth)) {
        m = currentMonth;
      }
      setSelectedYear(y);
      setSelectedMonth(m);
      applyMonthConfig(m, y);
    } else if (newType === 'QUARTERLY') {
      let y = selectedYear;
      let q = selectedQuarter;
      if (!isQuarterlyYearAllowed(y, currentYear, currentQuarter)) {
        y = currentYear;
      }
      if (!isQuarterAllowed(y, q, currentYear, currentQuarter)) {
        q = currentQuarter;
      }
      setSelectedYear(y);
      setSelectedQuarter(q);
      applyQuarterConfig(q, y);
    } else if (newType === 'ANNUAL') {
      let y = selectedYear;
      if (y < currentYear - 1 || y > currentYear) {
        y = currentYear;
      }
      setSelectedYear(y);
      applyAnnualConfig(y);
    } else if (newType === 'PROBATION') {
      setPeriodStart('');
      setPeriodEnd('');
      setSelfReviewDeadline('');
      setCycleCode(`TV-${selectedYear}`);
      setTitle(`Đánh giá Kết thúc Thử việc Kỹ sư ${selectedYear}`);
    }
  };

  const handleMonthChange = (m, y) => {
    setSelectedMonth(m);
    setSelectedYear(y);
    applyMonthConfig(m, y);
  };

  const handleQuarterChange = (q, y) => {
    setSelectedQuarter(q);
    setSelectedYear(y);
    applyQuarterConfig(q, y);
  };

  const handleAnnualChange = (y) => {
    setSelectedYear(y);
    applyAnnualConfig(y);
  };

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      setTimeout(() => {
        const remaining = document.querySelectorAll('[data-tech-modal="true"]');
        if (remaining.length === 0) {
          document.body.style.overflow = 'unset';
        }
      }, 50);
    };
  }, [isOpen, submitting, onClose]);

  const filteredCandidates = useMemo(() => {
    const kw = memberKeyword.trim().toLowerCase();
    return benchUsers.filter((u) => {
      if (!kw) return true;
      return (
        u.hoTen?.toLowerCase().includes(kw) ||
        u.maNhanVien?.toLowerCase().includes(kw) ||
        u.chucVu?.toLowerCase().includes(kw)
      );
    });
  }, [benchUsers, memberKeyword]);

  const toggleMember = (userId) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!cycleCode.trim()) {
      reportError('Vui lòng nhập mã kỳ đánh giá (VD: Q4-2026).');
      return;
    }
    if (!title.trim()) {
      reportError('Vui lòng nhập tên kỳ đánh giá.');
      return;
    }
    if (!periodStart || !periodEnd) {
      reportError('Vui lòng xác định đầy đủ ngày bắt đầu và kết thúc kỳ đánh giá.');
      return;
    }
    if (periodEnd < periodStart) {
      reportError('Ngày kết thúc kỳ đánh giá không thể trước ngày bắt đầu.');
      return;
    }
    if (reviewType === 'MONTHLY') {
      const mDiff = getMonthDiff(selectedYear, selectedMonth, currentYear, currentMonth);
      if (mDiff < -1 || mDiff > 1) {
        reportError('Kỳ đánh giá theo tháng chỉ được mở trong phạm vi: Tháng trước, Tháng hiện tại hoặc Tháng kế tiếp.');
        return;
      }
    } else if (reviewType === 'QUARTERLY') {
      const qDiff = getQuarterDiff(selectedYear, selectedQuarter, currentYear, currentQuarter);
      if (qDiff < -1 || qDiff > 1) {
        reportError('Kỳ đánh giá theo quý chỉ được mở trong phạm vi: Quý trước, Quý hiện tại hoặc Quý kế tiếp.');
        return;
      }
    } else if (reviewType === 'ANNUAL') {
      const yDiff = selectedYear - currentYear;
      if (yDiff < -1 || yDiff > 0) {
        reportError('Kỳ đánh giá theo năm chỉ được mở cho năm trước (tổng kết) hoặc năm hiện tại.');
        return;
      }
    }
    if (selfReviewDeadline) {
      if (selfReviewDeadline < periodStart) {
        reportError(`Hạn tự đánh giá không thể trước ngày bắt đầu kỳ đánh giá (${formatDateVN(periodStart)}).`);
        return;
      }
      if (selfReviewDeadline < todayIso) {
        reportError(`Hạn tự đánh giá không được ở trong quá khứ (phải từ ngày hôm nay ${formatDateVN(todayIso)} trở đi).`);
        return;
      }
      const maxAllowed = computeMaxDeadline(periodEnd, reviewType);
      if (maxAllowed && selfReviewDeadline > maxAllowed) {
        reportError(
          `Hạn tự đánh giá không được vượt quá ngày ${formatDateVN(maxAllowed)} (tối đa ${reviewType === 'ANNUAL' ? '30' : '15'} ngày sau khi kết thúc kỳ đánh giá).`
        );
        return;
      }
    }
    if (targetScope === 'SELECTED' && selectedIds.length === 0) {
      reportError('Vui lòng chọn ít nhất 1 nhân sự khi chọn phạm vi theo nhóm.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        cycleCode: cycleCode.trim().toUpperCase(),
        title: title.trim(),
        reviewType,
        periodStart,
        periodEnd,
        selfReviewDeadline: selfReviewDeadline || periodEnd,
        includeManagers,
        targetEmployeeIds: targetScope === 'SELECTED' ? selectedIds : null,
      };
      const res = await api.post('/api/tech/reviews/cycles', payload);
      const created = res.data?.data;
      toastRef.current?.show(
        'Mở kỳ đánh giá thành công',
        `Đã khởi tạo kỳ "${created?.cycleCode || cycleCode}" và đồng bộ Telemetry cho ${created?.totalReviews ?? 0} nhân sự.`,
        'success'
      );
      if (onSuccess) await onSuccess(created);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể khởi tạo kỳ đánh giá hiệu suất.';
      reportError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isFixedPeriod = reviewType === 'MONTHLY' || reviewType === 'QUARTERLY' || reviewType === 'ANNUAL';

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9990] bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-cycle-modal-title"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
      >
        <div className="px-6 py-4 bg-[#0F2557] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Award size={19} className="text-blue-200" />
            </div>
            <div>
              <h2 id="create-cycle-modal-title" className="text-base font-bold text-white">
                Khởi tạo Kỳ Đánh giá Hiệu suất &amp; Nâng bậc
              </h2>
              <p className="text-[11px] text-blue-100/80">
                Hệ thống tự động tính Telemetry 4 trụ cột (60%) và gửi phiếu Tự đánh giá đến từng kỹ sư
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {errorMsg && (
            <div className="px-6 pt-3.5 pb-1 shrink-0">
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-medium text-rose-700 shadow-2xs"
              >
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          <div ref={formBodyRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            {/* Quick Presets */}
            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#0F2557] flex items-center gap-1.5 shrink-0">
                <Sparkles size={13} className="text-blue-600" />
                <span>Điền nhanh kỳ hiện tại:</span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('MONTHLY')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/70 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold transition cursor-pointer"
                >
                  Điền nhanh theo tháng
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('QUARTERLY')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/70 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold transition cursor-pointer"
                >
                  Điền nhanh theo quý
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('ANNUAL')}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-100/70 text-[#1E3A8A] border border-blue-200 text-[11px] font-bold transition cursor-pointer"
                >
                  Điền nhanh theo năm
                </button>
              </div>
            </div>

            {/* Cycle Code & Review Type */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-4 space-y-1">
                <label htmlFor="cycle-code" className="block text-xs font-bold text-slate-700">
                  Mã kỳ đánh giá <span className="text-rose-500">*</span>
                </label>
                <input
                  id="cycle-code"
                  type="text"
                  maxLength={40}
                  value={cycleCode}
                  onChange={(e) => setCycleCode(e.target.value)}
                  placeholder="VD: Q4-2026"
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 uppercase"
                />
              </div>

              <div className="sm:col-span-8 space-y-1">
                <label htmlFor="cycle-type" className="block text-xs font-bold text-slate-700">
                  Loại kỳ đánh giá <span className="text-rose-500">*</span>
                </label>
                <select
                  id="cycle-type"
                  value={reviewType}
                  onChange={(e) => handleReviewTypeChange(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
                >
                  {REVIEW_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Contextual Date Selectors for Fixed Cycles */}
            {reviewType === 'MONTHLY' && (
              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-sky-600" />
                    <span>Chọn Tháng &amp; Năm đánh giá:</span>
                  </span>
                  <span className="text-[11px] font-normal text-sky-700">
                    Cửa sổ: Tháng vừa qua, tháng này hoặc tháng kế tiếp
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value), selectedYear)}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-sky-200 rounded-lg outline-none text-slate-800 cursor-pointer focus:border-sky-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const allowed = isMonthAllowed(selectedYear, m, currentYear, currentMonth);
                      const suffix = getMonthSuffix(selectedYear, m, currentYear, currentMonth);
                      return (
                        <option
                          key={m}
                          value={m}
                          disabled={!allowed}
                          className={!allowed ? 'text-slate-400 bg-slate-50' : 'text-slate-800 font-semibold'}
                        >
                          Tháng {m} {suffix}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      let m = selectedMonth;
                      if (!isMonthAllowed(y, m, currentYear, currentMonth)) {
                        for (let candM = 1; candM <= 12; candM++) {
                          if (isMonthAllowed(y, candM, currentYear, currentMonth)) {
                            m = candM;
                            break;
                          }
                        }
                      }
                      handleMonthChange(m, y);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-sky-200 rounded-lg outline-none text-slate-800 cursor-pointer focus:border-sky-500"
                  >
                    {YEAR_OPTIONS.map((y) => {
                      const allowed = isMonthlyYearAllowed(y, currentYear, currentMonth);
                      return (
                        <option
                          key={y}
                          value={y}
                          disabled={!allowed}
                          className={!allowed ? 'text-slate-400 bg-slate-50' : 'text-slate-800 font-semibold'}
                        >
                          Năm {y} {y === currentYear ? '(Năm nay)' : (!allowed ? '(Ngoài phạm vi)' : '')}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {reviewType === 'QUARTERLY' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-blue-600" />
                    <span>Chọn Quý &amp; Năm đánh giá:</span>
                  </span>
                  <span className="text-[11px] font-normal text-blue-700">
                    Cửa sổ: Quý vừa qua, quý này hoặc quý kế tiếp
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={selectedQuarter}
                    onChange={(e) => handleQuarterChange(Number(e.target.value), selectedYear)}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-blue-200 rounded-lg outline-none text-slate-800 cursor-pointer focus:border-blue-500"
                  >
                    {[
                      { q: 1, label: 'Quý 1 (01/01 → 31/03)' },
                      { q: 2, label: 'Quý 2 (01/04 → 30/06)' },
                      { q: 3, label: 'Quý 3 (01/07 → 30/09)' },
                      { q: 4, label: 'Quý 4 (01/10 → 31/12)' },
                    ].map(({ q, label }) => {
                      const allowed = isQuarterAllowed(selectedYear, q, currentYear, currentQuarter);
                      const suffix = getQuarterSuffix(selectedYear, q, currentYear, currentQuarter);
                      return (
                        <option
                          key={q}
                          value={q}
                          disabled={!allowed}
                          className={!allowed ? 'text-slate-400 bg-slate-50' : 'text-slate-800 font-semibold'}
                        >
                          {label} {suffix}
                        </option>
                      );
                    })}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      const y = Number(e.target.value);
                      let q = selectedQuarter;
                      if (!isQuarterAllowed(y, q, currentYear, currentQuarter)) {
                        for (let candQ = 1; candQ <= 4; candQ++) {
                          if (isQuarterAllowed(y, candQ, currentYear, currentQuarter)) {
                            q = candQ;
                            break;
                          }
                        }
                      }
                      handleQuarterChange(q, y);
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-white border border-blue-200 rounded-lg outline-none text-slate-800 cursor-pointer focus:border-blue-500"
                  >
                    {YEAR_OPTIONS.map((y) => {
                      const allowed = isQuarterlyYearAllowed(y, currentYear, currentQuarter);
                      return (
                        <option
                          key={y}
                          value={y}
                          disabled={!allowed}
                          className={!allowed ? 'text-slate-400 bg-slate-50' : 'text-slate-800 font-semibold'}
                        >
                          Năm {y} {y === currentYear ? '(Năm nay)' : (!allowed ? '(Ngoài phạm vi)' : '')}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {reviewType === 'ANNUAL' && (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-600" />
                    <span>Chọn Năm đánh giá:</span>
                  </span>
                  <span className="text-[11px] font-normal text-emerald-700">
                    Chỉ mở cho năm vừa qua (tổng kết) hoặc năm nay
                  </span>
                </div>
                <select
                  value={selectedYear}
                  onChange={(e) => handleAnnualChange(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-bold bg-white border border-emerald-200 rounded-lg outline-none text-slate-800 cursor-pointer focus:border-emerald-500"
                >
                  <option value={currentYear - 1}>
                    Năm {currentYear - 1} (Năm vừa qua - Tổng kết)
                  </option>
                  <option value={currentYear}>
                    Năm {currentYear} (Năm nay)
                  </option>
                  <option value={currentYear + 1} disabled className="text-slate-400 bg-slate-50">
                    Năm {currentYear + 1} (Chưa tới)
                  </option>
                  <option value={currentYear + 2} disabled className="text-slate-400 bg-slate-50">
                    Năm {currentYear + 2} (Chưa tới)
                  </option>
                </select>
              </div>
            )}

            {reviewType === 'PROBATION' && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber-600" />
                  <span>Kỳ Đánh giá Kết thúc Thử việc:</span>
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Bạn có thể chọn ngày bắt đầu ở quá khứ (ngày nhân sự onboard thử việc). Ngày kết thúc phải sau ngày bắt đầu, và Hạn tự đánh giá phải từ hôm nay trở đi.
                </p>
              </div>
            )}

            {/* Cycle Title */}
            <div className="space-y-1">
              <label htmlFor="cycle-title" className="block text-xs font-bold text-slate-700">
                Tên kỳ đánh giá <span className="text-rose-500">*</span>
              </label>
              <input
                id="cycle-title"
                type="text"
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Đánh giá Hiệu suất & Nâng bậc Kỹ sư Quý 4/2026"
                className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            {/* 3 Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label htmlFor="period-start" className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Calendar size={12} className={isFixedPeriod ? 'text-slate-400' : 'text-blue-600'} />
                  <span>Từ ngày</span> <span className="text-rose-500">*</span>
                </label>
                {isFixedPeriod ? (
                  <div className="relative">
                    <input
                      id="period-start"
                      type="date"
                      disabled
                      value={periodStart}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed tabular"
                    />
                    <span className="absolute right-2.5 top-2.5 text-slate-400" title="Cố định theo loại kỳ">
                      <Lock size={13} />
                    </span>
                  </div>
                ) : (
                  <input
                    id="period-start"
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 tabular"
                  />
                )}
                {isFixedPeriod && (
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Cố định tự động
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="period-end" className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Calendar size={12} className={isFixedPeriod ? 'text-slate-400' : 'text-blue-600'} />
                  <span>Đến ngày</span> <span className="text-rose-500">*</span>
                </label>
                {isFixedPeriod ? (
                  <div className="relative">
                    <input
                      id="period-end"
                      type="date"
                      disabled
                      value={periodEnd}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed tabular"
                    />
                    <span className="absolute right-2.5 top-2.5 text-slate-400" title="Cố định theo loại kỳ">
                      <Lock size={13} />
                    </span>
                  </div>
                ) : (
                  <input
                    id="period-end"
                    type="date"
                    min={periodStart || undefined}
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 tabular"
                  />
                )}
                {isFixedPeriod && (
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Cố định tự động
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="self-deadline" className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Clock size={12} className="text-orange-600" />
                  <span>Hạn tự đánh giá</span>
                </label>
                {(() => {
                  const maxAllowed = computeMaxDeadline(periodEnd, reviewType);
                  return (
                    <>
                      <input
                        id="self-deadline"
                        type="date"
                        min={todayIso}
                        max={maxAllowed}
                        value={selfReviewDeadline}
                        onChange={(e) => setSelfReviewDeadline(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 tabular"
                      />
                      <span className="text-[10px] text-slate-500 font-medium block">
                        {maxAllowed
                          ? `Từ hôm nay (${formatDateVN(todayIso)}) đến tối đa ${formatDateVN(maxAllowed)}`
                          : `Tối thiểu từ hôm nay (${formatDateVN(todayIso)})`}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Scope selection */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users size={14} className="text-[#1E3A8A]" />
                  <span>Phạm vi nhân sự tham gia kỳ đánh giá</span>
                </span>

                <div className="inline-flex items-center p-1 bg-white rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTargetScope('ALL')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      targetScope === 'ALL'
                        ? 'bg-[#1E3A8A] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Toàn Phòng Công nghệ ({benchUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('SELECTED')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      targetScope === 'SELECTED'
                        ? 'bg-[#1E3A8A] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Chọn nhóm ({selectedIds.length})
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeManagers}
                  onChange={(e) => setIncludeManagers(e.target.checked)}
                  className="w-4 h-4 accent-[#1E3A8A] cursor-pointer"
                />
                <span>Bao gồm Trưởng phòng Công nghệ trong kỳ đánh giá (để Giám đốc / CEO thẩm định chéo)</span>
              </label>

              {targetScope === 'SELECTED' && (
                <div className="pt-2 border-t border-slate-200 space-y-2.5">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={memberKeyword}
                      onChange={(e) => setMemberKeyword(e.target.value)}
                      placeholder="Tìm kỹ sư theo tên, mã NV, chức vụ..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200 text-xs">
                    {filteredCandidates.length === 0 ? (
                      <p className="p-3 text-center text-slate-400">Không tìm thấy nhân sự phù hợp</p>
                    ) : (
                      filteredCandidates.map((u) => {
                        const isSelected = selectedIds.includes(u.userId);
                        return (
                          <div
                            key={u.userId}
                            onClick={() => toggleMember(u.userId)}
                            className="p-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isSelected ? (
                                <CheckSquare size={16} className="text-[#1E3A8A] shrink-0" />
                              ) : (
                                <Square size={16} className="text-slate-300 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{u.hoTen}</p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {u.maNhanVien} • {u.chucVu || 'Kỹ sư'}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 tabular">
                              {u.currentAllocationPercent ?? 0}% tải
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <span>{submitting ? 'Đang khởi tạo...' : 'Mở Kỳ & Gửi Phiếu Đánh giá'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
