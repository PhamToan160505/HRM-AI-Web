import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  Clock,
  Calendar,
  FolderGit2,
  Flag,
  Link2,
  FileText,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';
import { WORKLOG_TYPE_OPTIONS, formatDateVN } from '../techHelpers';

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const QUICK_HOURS = [1, 2, 4, 6, 8];
const MAX_DAILY_HOURS = 16;

const formatHoursCompact = (hours) => {
  const num = Math.round(Number(hours || 0) * 100) / 100;
  return `${Number.isInteger(num) ? num : Number(num.toFixed(2))}h`;
};

const isValidHttpUrl = (val) => {
  const clean = String(val || '').trim();
  if (!clean) return true;
  if (!/^https?:\/\/\S+$/i.test(clean)) return false;
  try {
    const parsed = new URL(clean);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
};

const mapServerErrorToFieldErrors = (msg = '') => {
  const lower = String(msg).toLowerCase();
  const mapped = {};
  if (lower.includes('dự án')) mapped.projectId = msg;
  if (lower.includes('mốc tiến độ')) mapped.milestoneId = msg;
  if (lower.includes('tương lai') || lower.includes('ngày làm việc')) mapped.workDate = msg;
  if (lower.includes('số giờ') || lower.includes('tổng giờ công')) mapped.hoursSpent = msg;
  if (lower.includes('mô tả') || lower.includes('công việc')) mapped.taskSummary = msg;
  if (lower.includes('liên kết') || lower.includes('url') || lower.includes('link')) mapped.referenceUrl = msg;
  return mapped;
};

export default function WorklogModal({
  isOpen,
  onClose,
  projects = [],
  existingWorklogs = [],
  initialProjectId = null,
  initialData = null,
  onSuccess,
}) {
  const toast = useToast();
  const formBodyRef = useRef(null);
  const isEditing = Boolean(initialData?.id);
  const todayStr = getTodayStr();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverFieldErrors, setServerFieldErrors] = useState({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [milestones, setMilestones] = useState([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  const [formData, setFormData] = useState({
    projectId: '',
    milestoneId: '',
    workDate: todayStr,
    hoursSpent: 4,
    workType: 'DEVELOPMENT',
    isBillable: true,
    taskSummary: '',
    referenceUrl: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    setServerError('');
    setServerFieldErrors({});
    setHasAttemptedSubmit(false);
    setTouchedFields({});

    if (initialData?.id) {
      setFormData({
        projectId: String(initialData.projectId || ''),
        milestoneId: initialData.milestoneId ? String(initialData.milestoneId) : '',
        workDate: initialData.workDate || todayStr,
        hoursSpent: initialData.hoursSpent ?? 4,
        workType: initialData.workType || 'DEVELOPMENT',
        isBillable: Boolean(initialData.isBillable),
        taskSummary: initialData.taskSummary || '',
        referenceUrl: initialData.referenceUrl || '',
      });
    } else {
      const targetProjId = initialProjectId
        ? String(initialProjectId)
        : projects[0]?.id
        ? String(projects[0].id)
        : '';
      const matchedProj = projects.find((p) => String(p.id) === targetProjId);
      setFormData({
        projectId: targetProjId,
        milestoneId: '',
        workDate: todayStr,
        hoursSpent: 4,
        workType: 'DEVELOPMENT',
        isBillable: matchedProj ? matchedProj.projectType === 'CLIENT' : false,
        taskSummary: '',
        referenceUrl: '',
      });
    }
  }, [isOpen, initialData, initialProjectId, projects, todayStr]);

  useEffect(() => {
    if (!isOpen || !formData.projectId) {
      setMilestones([]);
      return;
    }

    let cancelled = false;
    const fetchProjectMilestones = async () => {
      try {
        setLoadingMilestones(true);
        const res = await api.get(`/api/tech/projects/${formData.projectId}/milestones`);
        if (!cancelled) {
          setMilestones(res.data?.data?.milestones || []);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách milestone:', err);
        if (!cancelled) setMilestones([]);
      } finally {
        if (!cancelled) setLoadingMilestones(false);
      }
    };
    fetchProjectMilestones();
    return () => {
      cancelled = true;
    };
  }, [isOpen, formData.projectId]);

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

  const dailyQuotaInfo = useMemo(() => {
    if (!formData.workDate || !Array.isArray(existingWorklogs) || existingWorklogs.length === 0) {
      return { loggedHours: 0, remainingHours: MAX_DAILY_HOURS };
    }
    const logged = existingWorklogs.reduce((sum, w) => {
      if (!w || w.workDate !== formData.workDate) return sum;
      if (w.approvalStatus === 'REJECTED') return sum;
      if (initialData?.id && String(w.id) === String(initialData.id)) return sum;
      const h = Number(w.hoursSpent);
      return sum + (Number.isFinite(h) ? h : 0);
    }, 0);
    const roundedLogged = Math.round(logged * 100) / 100;
    const remaining = Math.max(0, Math.round((MAX_DAILY_HOURS - roundedLogged) * 100) / 100);
    return { loggedHours: roundedLogged, remainingHours: remaining };
  }, [existingWorklogs, formData.workDate, initialData]);

  const validationErrors = useMemo(() => {
    const errors = {};

    if (!formData.projectId) {
      errors.projectId =
        projects.length === 0
          ? 'Bạn chưa tham gia dự án công nghệ nào để ghi nhận giờ công.'
          : 'Vui lòng chọn dự án bạn đang tham gia.';
    }

    if (!formData.workDate) {
      errors.workDate = 'Vui lòng chọn ngày thực hiện.';
    } else if (formData.workDate > todayStr) {
      errors.workDate = `Không thể ghi nhận giờ công cho ngày trong tương lai (tối đa hôm nay ${formatDateVN(todayStr)}).`;
    }

    const rawHours = String(formData.hoursSpent ?? '').trim();
    const hrs = rawHours === '' ? NaN : Number(rawHours);
    if (rawHours === '' || !Number.isFinite(hrs)) {
      errors.hoursSpent = 'Vui lòng nhập số giờ thực hiện hợp lệ (lớn hơn 0 và tối đa 16 giờ).';
    } else if (hrs <= 0 || hrs > MAX_DAILY_HOURS) {
      errors.hoursSpent = 'Số giờ phải lớn hơn 0 và tối đa 16 giờ cho mỗi bản ghi.';
    } else if (dailyQuotaInfo.loggedHours + hrs > MAX_DAILY_HOURS) {
      errors.hoursSpent =
        dailyQuotaInfo.remainingHours <= 0
          ? `Ngày ${formatDateVN(formData.workDate)} đã ghi đủ ${formatHoursCompact(dailyQuotaInfo.loggedHours)} / 16 giờ cho phép.`
          : `Tổng giờ công ngày ${formatDateVN(formData.workDate)} vượt giới hạn 16 giờ/ngày (đã ghi ${formatHoursCompact(
              dailyQuotaInfo.loggedHours
            )}, còn tối đa ${formatHoursCompact(dailyQuotaInfo.remainingHours)}).`;
    }

    if (!formData.taskSummary.trim()) {
      errors.taskSummary = 'Vui lòng mô tả nội dung công việc kỹ thuật đã thực hiện.';
    }

    const cleanRefUrl = formData.referenceUrl.trim();
    if (cleanRefUrl && !isValidHttpUrl(cleanRefUrl)) {
      errors.referenceUrl = 'Link Git Pull Request / Jira Task cần bắt đầu bằng http:// hoặc https:// (hoặc để trống).';
    }

    return errors;
  }, [formData, projects.length, todayStr, dailyQuotaInfo]);

  const visibleFieldErrors = useMemo(() => {
    const out = {};
    const fields = ['projectId', 'milestoneId', 'workDate', 'hoursSpent', 'taskSummary', 'referenceUrl'];
    for (const key of fields) {
      const clientErr =
        (hasAttemptedSubmit || touchedFields[key]) && validationErrors[key] ? validationErrors[key] : '';
      const srvErr = serverFieldErrors[key] || '';
      if (clientErr || srvErr) {
        out[key] = clientErr || srvErr;
      }
    }
    return out;
  }, [hasAttemptedSubmit, touchedFields, validationErrors, serverFieldErrors]);

  const bannerErrors = useMemo(() => {
    if (hasAttemptedSubmit) {
      const list = Object.values(validationErrors).filter(Boolean);
      if (list.length > 0) return list;
    }
    return serverError ? [serverError] : [];
  }, [hasAttemptedSubmit, validationErrors, serverError]);

  if (!isOpen) return null;

  const markTouched = (field) => {
    setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const clearServerFieldError = (field) => {
    if (serverError) setServerError('');
    if (serverFieldErrors[field]) {
      setServerFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleProjectChange = (projId) => {
    const matched = projects.find((p) => String(p.id) === String(projId));
    clearServerFieldError('projectId');
    markTouched('projectId');
    setFormData((prev) => ({
      ...prev,
      projectId: projId,
      milestoneId: '',
      isBillable: matched ? matched.projectType === 'CLIENT' : prev.isBillable,
    }));
  };

  const handleWorkDateChange = (nextDate) => {
    clearServerFieldError('workDate');
    clearServerFieldError('hoursSpent');
    if (!nextDate || nextDate > todayStr) {
      markTouched('workDate');
    }
    setFormData((p) => ({ ...p, workDate: nextDate }));
  };

  const handleHoursChange = (nextVal) => {
    clearServerFieldError('hoursSpent');
    const raw = String(nextVal ?? '').trim();
    const num = raw === '' ? NaN : Number(raw);
    if (raw !== '' && (!Number.isFinite(num) || num < 0 || num > MAX_DAILY_HOURS || dailyQuotaInfo.loggedHours + num > MAX_DAILY_HOURS)) {
      markTouched('hoursSpent');
    }
    setFormData((p) => ({ ...p, hoursSpent: nextVal }));
  };

  const handleQuickHourSelect = (h) => {
    clearServerFieldError('hoursSpent');
    markTouched('hoursSpent');
    setFormData((p) => ({ ...p, hoursSpent: h }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setServerError('');
    setServerFieldErrors({});

    const errorList = Object.values(validationErrors).filter(Boolean);
    if (errorList.length > 0) {
      const toastSummary =
        errorList.length === 1
          ? errorList[0]
          : `${errorList[0]} (+${errorList.length - 1} lỗi khác cần kiểm tra)`;
      toast?.show('Thông tin chưa hợp lệ', toastSummary, 'error');
      formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const hrs = Number(formData.hoursSpent);
    try {
      setSubmitting(true);
      if (isEditing) {
        await api.put(`/api/tech/worklogs/${initialData.id}`, {
          milestoneId: formData.milestoneId ? Number(formData.milestoneId) : null,
          workDate: formData.workDate,
          hoursSpent: hrs,
          workType: formData.workType,
          isBillable: formData.isBillable,
          taskSummary: formData.taskSummary.trim(),
          referenceUrl: formData.referenceUrl.trim() || null,
        });
        toast?.show(
          'Thành công',
          initialData.approvalStatus === 'REJECTED'
            ? 'Đã chỉnh sửa và gửi duyệt lại nhật ký giờ công!'
            : 'Đã cập nhật nhật ký giờ công!',
          'success'
        );
      } else {
        await api.post('/api/tech/worklogs', {
          projectId: Number(formData.projectId),
          milestoneId: formData.milestoneId ? Number(formData.milestoneId) : null,
          workDate: formData.workDate,
          hoursSpent: hrs,
          workType: formData.workType,
          isBillable: formData.isBillable,
          taskSummary: formData.taskSummary.trim(),
          referenceUrl: formData.referenceUrl.trim() || null,
        });
        toast?.show('Thành công', 'Đã ghi nhận nhật ký giờ công (Chờ Trưởng phòng thẩm định)!', 'success');
      }

      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể lưu nhật ký giờ công.';
      setServerError(msg);
      setServerFieldErrors(mapServerErrorToFieldErrors(msg));
      toast?.show('Không thể gửi nhật ký', msg, 'error');
      formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      data-tech-modal="true"
      className="fixed inset-0 z-[9990] bg-slate-900/55 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worklog-modal-title"
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header — Deep Sapphire */}
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between gap-3 shrink-0 border-b border-blue-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div className="min-w-0">
              <h3 id="worklog-modal-title" className="text-base font-bold text-white truncate">
                {isEditing ? 'Chỉnh sửa Nhật ký Giờ công' : 'Ghi nhận Giờ công Kỹ thuật (Log Work)'}
              </h3>
              <p className="text-xs text-blue-100/80 truncate">
                Tối đa 16 giờ/ngày qua tất cả dự án bạn đang tham gia
              </p>
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

        {/* Form Body & Pinned Footer */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div ref={formBodyRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            {isEditing && initialData?.approvalStatus === 'REJECTED' && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-orange-600" />
                <div className="space-y-0.5">
                  <p className="font-bold">Bản ghi trước đó bị từ chối:</p>
                  <p className="whitespace-pre-line leading-relaxed">
                    {initialData.rejectionReason || 'Chưa đạt yêu cầu kiểm tra'}
                  </p>
                  <p className="text-[11px] text-orange-700">Lưu chỉnh sửa để gửi lại cho Trưởng phòng duyệt.</p>
                </div>
              </div>
            )}

            {bannerErrors.length > 0 && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 min-w-0 space-y-1">
                  {bannerErrors.length === 1 ? (
                    <p className="font-medium leading-relaxed">{bannerErrors[0]}</p>
                  ) : (
                    <>
                      <p className="font-bold text-rose-800">
                        Vui lòng kiểm tra lại {bannerErrors.length} thông tin chưa hợp lệ:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
                        {bannerErrors.map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <label htmlFor="wl-project" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FolderGit2 size={13} className="text-blue-600" />
                  <span>Dự án tham gia <span className="text-rose-500">*</span></span>
                </label>
                <select
                  id="wl-project"
                  disabled={isEditing}
                  value={formData.projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  onBlur={() => markTouched('projectId')}
                  aria-invalid={Boolean(visibleFieldErrors.projectId)}
                  className={`w-full px-3 py-2.5 text-xs font-semibold text-slate-800 rounded-xl outline-none border transition cursor-pointer disabled:bg-slate-100 disabled:text-slate-500 ${
                    visibleFieldErrors.projectId
                      ? 'bg-rose-50/40 border-rose-400 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                      : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                  }`}
                >
                  {projects.length === 0 ? (
                    <option value="">Chưa có dự án đang tham gia</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        [{p.projectCode}] {p.projectName}
                      </option>
                    ))
                  )}
                </select>
                {visibleFieldErrors.projectId && (
                  <p role="alert" className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                    <AlertCircle size={12} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{visibleFieldErrors.projectId}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="wl-milestone" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Flag size={13} className="text-blue-600" />
                  <span>Gắn Mốc Tiến độ (Tùy chọn)</span>
                </label>
                <select
                  id="wl-milestone"
                  disabled={loadingMilestones}
                  value={formData.milestoneId}
                  onChange={(e) => {
                    clearServerFieldError('milestoneId');
                    setFormData((p) => ({ ...p, milestoneId: e.target.value }));
                  }}
                  aria-invalid={Boolean(visibleFieldErrors.milestoneId)}
                  className={`w-full px-3 py-2.5 text-xs font-medium text-slate-700 rounded-xl outline-none border transition cursor-pointer ${
                    visibleFieldErrors.milestoneId
                      ? 'bg-rose-50/40 border-rose-400 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                      : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                  }`}
                >
                  <option value="">
                    {loadingMilestones ? 'Đang tải mốc...' : '-- Chung cho toàn dự án --'}
                  </option>
                  {milestones.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.title} ({m.completionPercent}%)
                    </option>
                  ))}
                </select>
                {visibleFieldErrors.milestoneId && (
                  <p role="alert" className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                    <AlertCircle size={12} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{visibleFieldErrors.milestoneId}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <label htmlFor="wl-date" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  <span>Ngày thực hiện <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="wl-date"
                  type="date"
                  max={todayStr}
                  value={formData.workDate}
                  onChange={(e) => handleWorkDateChange(e.target.value)}
                  onBlur={() => markTouched('workDate')}
                  aria-invalid={Boolean(visibleFieldErrors.workDate)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border tabular transition ${
                    visibleFieldErrors.workDate
                      ? 'bg-rose-50/40 border-rose-400 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                      : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                  }`}
                />
                {visibleFieldErrors.workDate && (
                  <p role="alert" className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                    <AlertCircle size={12} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{visibleFieldErrors.workDate}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="wl-type" className="block text-xs font-bold text-slate-700">
                  Loại công việc kỹ thuật
                </label>
                <select
                  id="wl-type"
                  value={formData.workType}
                  onChange={(e) => setFormData((p) => ({ ...p, workType: e.target.value }))}
                  className="w-full px-3 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 cursor-pointer"
                >
                  {WORKLOG_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hours + Billable Box */}
            <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
              <div className="min-w-0 space-y-2">
                <label htmlFor="wl-hours" className="block text-xs font-bold text-slate-700">
                  Số giờ thực hiện <span className="text-rose-500">*</span>
                </label>
                <input
                  id="wl-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="16"
                  value={formData.hoursSpent}
                  onChange={(e) => handleHoursChange(e.target.value)}
                  onBlur={() => markTouched('hoursSpent')}
                  placeholder="VD: 4 (tối đa 16)"
                  aria-invalid={Boolean(visibleFieldErrors.hoursSpent)}
                  className={`w-full px-3 py-2 text-xs font-bold rounded-xl outline-none border tabular transition ${
                    visibleFieldErrors.hoursSpent
                      ? 'bg-rose-50/50 border-rose-400 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                  }`}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-0.5">Chọn nhanh:</span>
                  {QUICK_HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleQuickHourSelect(h)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition cursor-pointer tabular ${
                        Number(formData.hoursSpent) === h
                          ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
                {visibleFieldErrors.hoursSpent ? (
                  <p role="alert" className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                    <AlertCircle size={12} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{visibleFieldErrors.hoursSpent}</span>
                  </p>
                ) : dailyQuotaInfo.loggedHours > 0 ? (
                  <p className="text-[11px] text-slate-500 leading-snug tabular">
                    Đã ghi ngày {formatDateVN(formData.workDate)}: <strong className="text-slate-700">{formatHoursCompact(dailyQuotaInfo.loggedHours)}</strong> / 16h (còn tối đa <strong className="text-blue-700">{formatHoursCompact(dailyQuotaInfo.remainingHours)}</strong>)
                  </p>
                ) : null}
              </div>

              <div className="min-w-0 space-y-2">
                <span className="block text-xs font-bold text-slate-700">Phân loại giá trị giờ công</span>
                <label className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-slate-200 cursor-pointer">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 block">
                      {formData.isBillable ? 'Billable (Tính phí Khách hàng)' : 'Internal (Nội bộ / Họp)'}
                    </span>
                    <span className="text-[10px] text-slate-500">Phục vụ thống kê tỷ lệ Billable dự án</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isBillable}
                    onChange={(e) => setFormData((p) => ({ ...p, isBillable: e.target.checked }))}
                    className="w-4 h-4 accent-[#1E3A8A] cursor-pointer shrink-0"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="wl-summary" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-600" />
                  <span>Nội dung công việc đã hoàn thành <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[10px] text-slate-400 tabular">{formData.taskSummary.length}/500</span>
              </div>
              <textarea
                id="wl-summary"
                rows={3}
                maxLength={500}
                value={formData.taskSummary}
                onChange={(e) => {
                  clearServerFieldError('taskSummary');
                  const nextText = e.target.value;
                  if (formData.taskSummary.trim() && !nextText.trim()) {
                    markTouched('taskSummary');
                  }
                  setFormData((p) => ({ ...p, taskSummary: nextText }));
                }}
                onBlur={() => markTouched('taskSummary')}
                placeholder="VD: Hoàn thiện API CRUD Milestone & viết unit test kiểm tra tổng trọng số <= 100%..."
                aria-invalid={Boolean(visibleFieldErrors.taskSummary)}
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-none border resize-none transition ${
                  visibleFieldErrors.taskSummary
                    ? 'bg-rose-50/40 border-rose-400 text-rose-900 placeholder:text-rose-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                }`}
              />
              {visibleFieldErrors.taskSummary && (
                <p role="alert" className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                  <AlertCircle size={12} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>{visibleFieldErrors.taskSummary}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="wl-ref" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Link2 size={13} className="text-blue-600" />
                <span>Link Git Pull Request / Jira Task</span>
              </label>
              <input
                id="wl-ref"
                type="url"
                maxLength={500}
                value={formData.referenceUrl}
                onChange={(e) => {
                  clearServerFieldError('referenceUrl');
                  setFormData((p) => ({ ...p, referenceUrl: e.target.value }));
                }}
                onBlur={() => markTouched('referenceUrl')}
                placeholder="https://github.com/company/repo/pull/..."
                aria-invalid={Boolean(visibleFieldErrors.referenceUrl)}
                className={`w-full px-3.5 py-2 text-xs rounded-xl outline-none border transition ${
                  visibleFieldErrors.referenceUrl
                    ? 'bg-rose-50/40 border-rose-400 text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15'
                    : 'bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'
                }`}
              />
              {visibleFieldErrors.referenceUrl && (
                <p role="alert" className="text-[11px] font-medium text-rose-600 flex items-start gap-1 leading-snug">
                  <AlertCircle size={12} className="shrink-0 mt-0.5 text-rose-500" />
                  <span>{visibleFieldErrors.referenceUrl}</span>
                </p>
              )}
              {(formData.workType === 'DEVELOPMENT' || formData.workType === 'BUG_FIX') &&
                Number(formData.hoursSpent) >= 2 &&
                !formData.referenceUrl.trim() && (
                  <p className="text-[11px] text-orange-700 bg-orange-50/80 border border-orange-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 leading-relaxed">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5 text-orange-600" />
                    <span>
                      Khuyến nghị: Công việc Phát triển / Sửa lỗi từ 2h trở lên nên đính kèm link PR hoặc Jira Task để quản lý đối chiếu nhanh hơn.
                    </span>
                  </p>
                )}
            </div>
          </div>

          <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || (!isEditing && projects.length === 0)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3A8A] hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 size={14} />
              <span>
                {submitting
                  ? 'Đang gửi...'
                  : isEditing
                  ? initialData?.approvalStatus === 'REJECTED'
                    ? 'Lưu & Gửi duyệt lại'
                    : 'Cập nhật Worklog'
                  : 'Gửi Nhật ký Giờ công'}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}

