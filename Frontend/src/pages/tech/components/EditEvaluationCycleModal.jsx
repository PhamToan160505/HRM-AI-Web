import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Calendar,
  Award,
  AlertTriangle,
  Save,
  Clock,
  Lock,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { REVIEW_TYPE_CONFIG, formatDateVN } from '../techHelpers';

function computeMaxDeadline(periodEnd, reviewType) {
  if (!periodEnd) return undefined;
  const today = new Date().toISOString().split('T')[0];
  const baseDateStr = periodEnd > today ? periodEnd : today;
  const baseDate = new Date(baseDateStr);
  const extraDays = reviewType === 'ANNUAL' ? 30 : 15;
  baseDate.setDate(baseDate.getDate() + extraDays);
  return baseDate.toISOString().split('T')[0];
}

export default function EditEvaluationCycleModal({
  isOpen,
  onClose,
  cycle = null,
  onSuccess,
}) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [title, setTitle] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selfReviewDeadline, setSelfReviewDeadline] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const formBodyRef = useRef(null);

  const reportError = (msg) => {
    setErrorMsg(msg);
    formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    toastRef.current?.show('Thông tin chưa hợp lệ', msg, 'error');
  };

  useEffect(() => {
    if (!isOpen || !cycle) return;
    setTitle(cycle.title || '');
    setPeriodEnd(cycle.periodEnd || '');
    setSelfReviewDeadline(cycle.selfReviewDeadline || '');
    setStatus(cycle.status || 'OPEN');
    setErrorMsg('');
  }, [isOpen, cycle]);

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

  const todayIso = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cycle) return;
    setErrorMsg('');

    if (!title.trim()) {
      reportError('Vui lòng nhập tên kỳ đánh giá.');
      return;
    }
    if (!periodEnd) {
      reportError('Vui lòng xác định ngày kết thúc kỳ đánh giá.');
      return;
    }
    if (cycle.periodStart && periodEnd < cycle.periodStart) {
      reportError(`Ngày kết thúc không được trước ngày bắt đầu (${formatDateVN(cycle.periodStart)}).`);
      return;
    }
    if (selfReviewDeadline) {
      if (cycle.periodStart && selfReviewDeadline < cycle.periodStart) {
        reportError(`Hạn tự đánh giá không thể trước ngày bắt đầu kỳ đánh giá (${formatDateVN(cycle.periodStart)}).`);
        return;
      }
      if (status === 'OPEN' && selfReviewDeadline < todayIso) {
        reportError(`Hạn tự đánh giá không được ở trong quá khứ khi kỳ đang mở (phải từ ngày hôm nay ${formatDateVN(todayIso)} trở đi).`);
        return;
      }
      const maxAllowed = computeMaxDeadline(periodEnd || cycle.periodEnd, cycle.reviewType);
      if (maxAllowed && selfReviewDeadline > maxAllowed) {
        reportError(
          `Hạn tự đánh giá không được vượt quá ngày ${formatDateVN(maxAllowed)} (tối đa ${cycle.reviewType === 'ANNUAL' ? '30' : '15'} ngày sau khi kết thúc kỳ đánh giá).`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        title: title.trim(),
        periodEnd,
        selfReviewDeadline: selfReviewDeadline || null,
        status,
      };

      const res = await api.put(`/api/tech/reviews/cycles/${cycle.id}`, payload);
      const updated = res.data?.data;
      toastRef.current?.show(
        'Đã cập nhật kỳ đánh giá',
        `Kỳ "${cycle.cycleCode}" đã được cập nhật thành công.`,
        'success'
      );
      if (onSuccess) await onSuccess(updated);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể cập nhật kỳ đánh giá hiệu suất.';
      reportError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !cycle) return null;

  const typeCfg = REVIEW_TYPE_CONFIG[cycle.reviewType] || REVIEW_TYPE_CONFIG.QUARTERLY;

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9995] bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-cycle-modal-title"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
      >
        <div className="px-6 py-4 bg-[#0F2557] text-white flex items-center justify-between shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Award size={19} className="text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 border border-white/20 text-blue-100">
                  {cycle.cycleCode}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.badgeClass}`}>
                  {typeCfg.shortLabel}
                </span>
              </div>
              <h2 id="edit-cycle-modal-title" className="text-base font-bold text-white mt-0.5 truncate">
                Chỉnh sửa Kỳ Đánh giá Hiệu suất
              </h2>
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
            {/* Quick Summary Pill */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">Quy mô hiện tại:</span>
                <span className="font-bold text-slate-900 tabular">
                  {cycle.totalReviews ?? 0} phiếu đánh giá
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">Tự đánh giá:</span>
                <span className="font-bold text-blue-700 tabular">
                  {cycle.selfReviewSubmittedCount ?? 0}/{cycle.totalReviews ?? 0} ({cycle.selfReviewRatePercent ?? 0}%)
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[11px] text-slate-500 block">Đã hoàn tất:</span>
                <span className="font-bold text-emerald-700 tabular">
                  {cycle.approvedCount ?? 0}/{cycle.totalReviews ?? 0} ({cycle.approvedRatePercent ?? 0}%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <div className="sm:col-span-5 space-y-1">
                <label className="block text-xs font-bold text-slate-700">Mã kỳ đánh giá</label>
                <input
                  type="text"
                  disabled
                  value={cycle.cycleCode}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed uppercase"
                />
              </div>

              <div className="sm:col-span-7 space-y-1">
                <label htmlFor="edit-cycle-status" className="block text-xs font-bold text-slate-700">
                  Trạng thái kỳ đánh giá <span className="text-rose-500">*</span>
                </label>
                <select
                  id="edit-cycle-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
                >
                  <option value="OPEN">Đang mở (OPEN) — Cho phép tự đánh giá & thẩm định</option>
                  <option value="CLOSED">Đã đóng (CLOSED) — Khóa nhận đánh giá mới</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-cycle-title" className="block text-xs font-bold text-slate-700">
                Tên kỳ đánh giá <span className="text-rose-500">*</span>
              </label>
              <input
                id="edit-cycle-title"
                type="text"
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Đánh giá Hiệu suất & Nâng bậc Kỹ sư Quý 4/2026"
                className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Calendar size={12} className="text-slate-400" />
                  <span>Từ ngày (Cố định)</span>
                </label>
                <input
                  type="date"
                  disabled
                  value={cycle.periodStart || ''}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed tabular"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-period-end" className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Calendar size={12} className={cycle.reviewType !== 'PROBATION' ? 'text-slate-400' : 'text-blue-600'} />
                  <span>Đến ngày</span> <span className="text-rose-500">*</span>
                </label>
                {cycle.reviewType !== 'PROBATION' ? (
                  <div className="relative">
                    <input
                      id="edit-period-end"
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
                    id="edit-period-end"
                    type="date"
                    min={cycle.periodStart || undefined}
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 tabular"
                  />
                )}
                {cycle.reviewType !== 'PROBATION' && (
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Cố định theo {typeCfg.shortLabel}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-self-deadline" className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Clock size={12} className="text-orange-600" />
                  <span>Hạn tự đánh giá</span>
                </label>
                {(() => {
                  const maxAllowed = computeMaxDeadline(periodEnd || cycle.periodEnd, cycle.reviewType);
                  return (
                    <>
                      <input
                        id="edit-self-deadline"
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

            <p className="text-[11px] text-slate-500 leading-relaxed bg-blue-50/60 border border-blue-200/70 p-3 rounded-xl">
              💡 <strong>Lưu ý nghiệp vụ:</strong> Khi cần cho kỹ sư thêm thời gian hoàn thành tự đánh giá, bạn có thể điều chỉnh <strong>Hạn tự đánh giá</strong>. Các phiếu đánh giá chưa chốt trong kỳ sẽ tự động được cập nhật thời hạn mới tương ứng.
            </p>
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <Save size={14} />
              <span>{submitting ? 'Đang lưu...' : 'Lưu Thay đổi'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
