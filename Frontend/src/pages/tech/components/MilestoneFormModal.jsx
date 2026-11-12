import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Flag,
  Calendar,
  Percent,
  Link2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { MILESTONE_STATUS_OPTIONS } from '../techHelpers';

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function MilestoneFormModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  initialData = null,
  usedWeightByOthers = 0,
  onSuccess,
}) {
  const toast = useToast();
  const formBodyRef = useRef(null);
  const isEditing = Boolean(initialData?.id);
  const todayStr = getTodayStr();
  const maxAllowedWeight = Math.max(0, 100 - usedWeightByOthers);
  const statusOptions = isEditing
    ? MILESTONE_STATUS_OPTIONS
    : MILESTONE_STATUS_OPTIONS.filter((opt) => opt.value === 'NOT_STARTED' || opt.value === 'IN_PROGRESS');
  const minDueDate = !isEditing || !initialData?.dueDate || initialData.dueDate >= todayStr ? todayStr : undefined;

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: getTodayStr(),
    status: 'NOT_STARTED',
    weightPercent: 25,
    completionPercent: 0,
    deliverableUrl: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    setFieldErrors({});
    if (initialData?.id) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        dueDate: initialData.dueDate || getTodayStr(),
        status: initialData.status || 'NOT_STARTED',
        weightPercent: initialData.weightPercent ?? 0,
        completionPercent: initialData.completionPercent ?? 0,
        deliverableUrl: initialData.deliverableUrl || '',
      });
    } else {
      setFormData({
        title: '',
        description: '',
        dueDate: getTodayStr(),
        status: 'NOT_STARTED',
        weightPercent: Math.min(25, maxAllowedWeight),
        completionPercent: 0,
        deliverableUrl: '',
      });
    }
  }, [isOpen, initialData, maxAllowedWeight]);

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
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
  }, [isOpen, handleClose]);

  if (!isOpen || !projectId) return null;

  const handleStatusChange = (newStatus) => {
    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      completionPercent: newStatus === 'COMPLETED' ? 100 : prev.completionPercent,
    }));
  };

  const handleCompletionChange = (val) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    setFormData((prev) => ({
      ...prev,
      completionPercent: pct,
      status:
        pct === 100
          ? 'COMPLETED'
          : pct > 0 && prev.status === 'NOT_STARTED'
          ? 'IN_PROGRESS'
          : pct < 100 && prev.status === 'COMPLETED'
          ? 'IN_PROGRESS'
          : prev.status,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const nextErrors = {};
    const title = formData.title.trim();
    if (!title) {
      nextErrors.title = 'Vui lòng nhập tên mốc bàn giao (Milestone).';
    }

    if (!formData.dueDate) {
      nextErrors.dueDate = 'Vui lòng chọn hạn chót hoàn thành mốc.';
    } else if (!isEditing && formData.dueDate < todayStr) {
      nextErrors.dueDate = 'Hạn chót bàn giao không được chọn ngày trong quá khứ (từ hôm nay trở đi).';
    } else if (isEditing && formData.dueDate !== initialData?.dueDate && formData.dueDate < todayStr) {
      nextErrors.dueDate = 'Không thể đổi hạn chót bàn giao sang ngày trong quá khứ.';
    }

    const rawWeight = String(formData.weightPercent ?? '').trim();
    const weight = rawWeight === '' ? NaN : Number(rawWeight);
    if (isNaN(weight) || weight < 0 || !Number.isInteger(weight)) {
      nextErrors.weightPercent = `Vui lòng nhập số nguyên hợp lệ từ 0% đến ${maxAllowedWeight}%.`;
    } else if (weight > maxAllowedWeight) {
      nextErrors.weightPercent =
        maxAllowedWeight === 0
          ? 'Các mốc khác đã chiếm đủ 100% trọng số (còn lại 0%). Vui lòng nhập 0% hoặc giảm bớt trọng số của mốc khác.'
          : `Trọng số tối đa có thể gán cho mốc này là ${maxAllowedWeight}% (còn lại trong tổng 100% dự án).`;
    }

    const cleanUrl = formData.deliverableUrl.trim();
    if (cleanUrl && !/^https?:\/\/\S+/i.test(cleanUrl)) {
      nextErrors.deliverableUrl = 'Liên kết nghiệm thu cần bắt đầu bằng http:// hoặc https:// (hoặc để trống).';
    }

    if (Object.keys(nextErrors).length > 0) {
      const firstMsg = Object.values(nextErrors)[0];
      setFieldErrors(nextErrors);
      setErrorMessage(firstMsg);
      toast?.show('Thông tin chưa hợp lệ', firstMsg, 'warning');
      formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFieldErrors({});

    try {
      setSubmitting(true);
      const payload = {
        title,
        description: formData.description.trim() || null,
        dueDate: formData.dueDate,
        status: formData.status,
        weightPercent: weight,
        completionPercent: isEditing ? Number(formData.completionPercent) || 0 : 0,
        deliverableUrl: cleanUrl || null,
      };

      if (isEditing) {
        await api.put(`/api/tech/projects/${projectId}/milestones/${initialData.id}`, payload);
        toast?.show('Thành công', `Đã cập nhật mốc "${title}"`, 'success');
      } else {
        await api.post(`/api/tech/projects/${projectId}/milestones`, payload);
        toast?.show('Thành công', `Đã thêm mốc tiến độ "${title}"`, 'success');
      }

      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể lưu mốc tiến độ dự án.';
      setErrorMessage(msg);
      toast?.show('Lỗi', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9995] bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-form-title"
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header — Deep Sapphire */}
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between gap-3 shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Flag size={18} />
            </div>
            <div className="min-w-0">
              <h3 id="milestone-form-title" className="text-base font-bold text-white truncate">
                {isEditing ? 'Chỉnh sửa Mốc Tiến độ' : 'Thêm Mốc Bàn giao (Milestone)'}
              </h3>
              <p className="text-xs text-blue-100/80 truncate">{projectName || 'Dự án Công nghệ'}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleClose}
            className="p-2 rounded-xl text-blue-100/80 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0 disabled:opacity-50"
            aria-label="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form ref={formBodyRef} noValidate onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="ms-title" className="block text-xs font-bold text-slate-700">
              Tên mốc tiến độ <span className="text-rose-500">*</span>
            </label>
            <input
              id="ms-title"
              type="text"
              maxLength={200}
              value={formData.title}
              onChange={(e) => {
                setFormData((p) => ({ ...p, title: e.target.value }));
                setFieldErrors((err) => ({ ...err, title: '' }));
              }}
              placeholder="VD: Hoàn thiện Core API & Auth RBAC..."
              className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border transition ${
                fieldErrors.title
                  ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                  : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
              }`}
            />
            {fieldErrors.title && (
              <p className="text-[11px] font-medium text-rose-600">{fieldErrors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="ms-due" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-blue-600" />
                <span>Hạn chót bàn giao <span className="text-rose-500">*</span></span>
              </label>
              <input
                id="ms-due"
                type="date"
                min={minDueDate}
                value={formData.dueDate}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, dueDate: e.target.value }));
                  setFieldErrors((err) => ({ ...err, dueDate: '' }));
                }}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border tabular transition ${
                  fieldErrors.dueDate
                    ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500'
                }`}
              />
              {fieldErrors.dueDate && (
                <p className="text-[11px] font-medium text-rose-600 leading-relaxed">{fieldErrors.dueDate}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ms-status" className="block text-xs font-bold text-slate-700">
                {isEditing ? 'Trạng thái mốc' : 'Trạng thái ban đầu'}
              </label>
              <select
                id="ms-status"
                value={formData.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 items-start">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="ms-weight" className="font-bold text-slate-700 flex items-center gap-1">
                  <Percent size={12} className="text-blue-600" />
                  <span>Trọng số (%)</span>
                </label>
                <span className="text-[11px] font-semibold text-blue-700 tabular">
                  Còn lại: {maxAllowedWeight}%
                </span>
              </div>
              <input
                id="ms-weight"
                type="number"
                min={0}
                max={maxAllowedWeight}
                value={formData.weightPercent}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, weightPercent: e.target.value }));
                  setFieldErrors((err) => ({ ...err, weightPercent: '' }));
                }}
                className={`w-full px-3 py-2 text-xs font-bold text-slate-900 rounded-xl outline-none border tabular transition ${
                  fieldErrors.weightPercent
                    ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500'
                    : 'bg-white border-slate-200 focus:border-blue-500'
                }`}
              />
              {fieldErrors.weightPercent ? (
                <p className="text-[11px] font-medium text-rose-600 leading-relaxed">{fieldErrors.weightPercent}</p>
              ) : maxAllowedWeight === 0 ? (
                <p className="text-[10px] text-orange-700 leading-relaxed">
                  Các mốc khác đã chiếm đủ 100% trọng số. Giữ mức 0% hoặc giảm % mốc khác trước khi phân bổ thêm.
                </p>
              ) : (
                <p className="text-[10px] text-slate-500">Tổng trọng số toàn dự án tối đa 100%.</p>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="ms-comp" className="font-bold text-slate-700">
                    Mức độ hoàn thành
                  </label>
                  <span className="font-extrabold text-[#1E3A8A] tabular">{formData.completionPercent}%</span>
                </div>
                <input
                  id="ms-comp"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={formData.completionPercent}
                  onChange={(e) => handleCompletionChange(e.target.value)}
                  className="w-full accent-[#1E3A8A] cursor-pointer mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-400 tabular">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Tỷ lệ % nghiệm thu thực tế của mốc (dùng để tính Tiến độ Thực tế dự án).
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 rounded-xl bg-white border border-slate-200/80 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Info size={13} className="text-blue-600 shrink-0" />
                    <span>Tiến độ khởi tạo</span>
                  </span>
                  <span className="font-extrabold text-[#1E3A8A] tabular">0%</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Mốc mới tạo tự động khởi đầu ở <strong className="text-slate-700">0%</strong>. Sau khi đội ngũ triển khai, bạn có thể cập nhật % hoặc bấm <strong className="text-slate-700">Nghiệm thu 100%</strong> ở màn hình chi tiết.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ms-url" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Link2 size={13} className="text-blue-600" />
              <span>Liên kết nghiệm thu (Release / PR / Jira)</span>
            </label>
            <input
              id="ms-url"
              type="url"
              maxLength={500}
              value={formData.deliverableUrl}
              onChange={(e) => {
                setFormData((p) => ({ ...p, deliverableUrl: e.target.value }));
                setFieldErrors((err) => ({ ...err, deliverableUrl: '' }));
              }}
              placeholder="https://github.com/..."
              className={`w-full px-3.5 py-2 text-xs rounded-xl outline-none border transition ${
                fieldErrors.deliverableUrl
                  ? 'bg-rose-50/40 border-rose-400 focus:border-rose-500'
                  : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500'
              }`}
            />
            {fieldErrors.deliverableUrl && (
              <p className="text-[11px] font-medium text-rose-600">{fieldErrors.deliverableUrl}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ms-desc" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText size={13} className="text-blue-600" />
              <span>Chi tiết hạng mục bàn giao</span>
            </label>
            <textarea
              id="ms-desc"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="Liệt kê các đầu mục kỹ thuật cần nghiệm thu trong mốc này..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={submitting}
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 size={14} />
              <span>{submitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo mốc tiến độ'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

