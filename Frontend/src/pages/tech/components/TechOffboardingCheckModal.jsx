import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X, Loader2, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../components/common/Toast';

/**
 * Modal Kiểm tra Ràng buộc Kỹ thuật & Khởi tạo Bàn giao khi Nghỉ việc / Điều chuyển phòng ban (Module 5).
 * Dùng chung cho HR (EmployeeLifecyclePage) và Quản lý Phòng Công nghệ (CapacityBenchTab).
 */
export default function TechOffboardingCheckModal({
  userId,
  lifecycleEmployeeId,
  employeeName = '',
  onClose,
  onHandoverCreated,
  isReadOnly = false,
}) {
  const toast = useToast();
  const [impact, setImpact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState(
    () => new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-CA')
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const todayIso = new Date().toLocaleDateString('en-CA');
  const maxDateIso = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('en-CA');
  })();

  useEffect(() => {
    if (!userId && !lifecycleEmployeeId) return;
    let cancelled = false;
    setLoading(true);
    const endpoint = userId
      ? `/api/tech-hr/offboarding-impact/${userId}`
      : `/api/tech-hr/offboarding-impact/by-lifecycle/${lifecycleEmployeeId}`;
    api
      .get(endpoint)
      .then((res) => {
        if (!cancelled) setImpact(res.data?.data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          toast?.show('Lỗi kiểm tra bàn giao', err.response?.data?.message || 'Không thể tải dữ liệu', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, lifecycleEmployeeId, toast]);

  if (!userId && !lifecycleEmployeeId) return null;

  const effectiveUserId = impact?.userId || userId;

  const handleTriggerHandover = async (e) => {
    e.preventDefault();
    if (!effectiveUserId) return;

    const errors = {};
    const trimmedDate = (lastWorkingDate || '').trim();
    if (!trimmedDate) {
      errors.lastWorkingDate = 'Vui lòng chọn ngày dự kiến rời đi / chuyển phòng.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      errors.lastWorkingDate = 'Định dạng ngày không hợp lệ.';
    } else if (trimmedDate < todayIso) {
      errors.lastWorkingDate = 'Ngày dự kiến rời đi / chuyển phòng không được nằm trong quá khứ.';
    } else if (trimmedDate > maxDateIso) {
      errors.lastWorkingDate = 'Ngày dự kiến rời đi / chuyển phòng không được vượt quá 1 năm kể từ hôm nay.';
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      errors.reason = 'Vui lòng nhập lý do bàn giao.';
    } else if (trimmedReason.length < 5) {
      errors.reason = 'Lý do bàn giao phải có ít nhất 5 ký tự.';
    } else if (trimmedReason.length > 500) {
      errors.reason = 'Lý do bàn giao không được vượt quá 500 ký tự.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast?.show('Thông tin chưa hợp lệ', Object.values(errors)[0], 'error');
      return;
    }

    setFieldErrors({});
    try {
      setSubmitting(true);
      const res = await api.post(`/api/tech-hr/offboarding-handover/${effectiveUserId}`, {
        reason: trimmedReason,
        lastWorkingDate: trimmedDate,
      });
      toast?.show(
        'Đã gửi yêu cầu bàn giao',
        'Tác vụ Bàn giao Kỹ thuật đã được gửi tới Trưởng phòng & Giám đốc Công nghệ',
        'success'
      );
      onHandoverCreated?.(res.data?.data);
      onClose?.();
    } catch (err) {
      toast?.show('Lỗi', err.response?.data?.message || 'Không thể tạo tác vụ bàn giao', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const riskColors = {
    CRITICAL: 'bg-rose-50 border-rose-300 text-rose-800',
    HIGH: 'bg-amber-50 border-amber-300 text-amber-800',
    MEDIUM: 'bg-blue-50 border-blue-200 text-blue-800',
    NONE: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center overflow-y-auto"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto"
      >
        <div className="bg-[#0F2557] px-6 py-4 text-white flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <ShieldAlert size={17} className="text-amber-300" />
              <span>Kiểm tra Ràng buộc Kỹ thuật (Offboarding / Điều chuyển)</span>
            </h3>
            <p className="text-xs text-blue-200/85 mt-0.5">
              Nhân sự: <strong>{impact?.hoTen || employeeName}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="p-1.5 text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto text-xs">
          {loading ? (
            <div className="py-10 text-center text-slate-400 flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              <span>Đang quét ràng buộc dự án, Mentorship &amp; hạ tầng server...</span>
            </div>
          ) : !impact ? (
            <div className="py-8 text-center text-slate-400">Không lấy được dữ liệu ràng buộc kỹ thuật.</div>
          ) : (
            <>
              <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${riskColors[impact.riskLevel] || riskColors.NONE}`}>
                {impact.hasBlockers ? (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-bold">
                    Mức độ rủi ro bàn giao: {impact.riskLevel}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {impact.hasBlockers
                      ? `Phát hiện ${impact.activeProjectsCount} dự án active (${impact.techLeadProjectsCount} vai trò TECH_LEAD), ${impact.activeMentorshipsCount} kèm cặp 1-1, ${impact.ownedEnvironmentsCount} môi trường server và ${impact.pendingWorklogsCount} giờ công chờ duyệt.`
                      : 'Nhân sự đã sạch ràng buộc kỹ thuật. HR có thể tiến hành đóng hồ sơ / điều chuyển an toàn.'}
                  </p>
                </div>
              </div>

              {impact.projectDetails?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700">Dự án đang tham gia ({impact.activeProjectsCount})</h4>
                  <ul className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {impact.projectDetails.map((d, i) => (
                      <li key={i} className="text-slate-700">• {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {impact.mentorshipDetails?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700">Chương trình Kèm cặp 1-1 đang hoạt động ({impact.activeMentorshipsCount})</h4>
                  <ul className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {impact.mentorshipDetails.map((d, i) => (
                      <li key={i} className="text-slate-700">• {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {impact.environmentDetails?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-rose-700">Môi trường Server đang phụ trách ({impact.ownedEnvironmentsCount})</h4>
                  <ul className="space-y-1 bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                    {impact.environmentDetails.map((d, i) => (
                      <li key={i} className="text-rose-900">• {d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {impact.openHandoverTaskExists ? (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-semibold">
                  Đã có tác vụ Bàn giao Kỹ thuật (#{impact.existingHandoverTaskId}) đang mở tại Phòng Công nghệ.
                </div>
              ) : (
                !isReadOnly && impact.hasBlockers && (
                  <form noValidate onSubmit={handleTriggerHandover} className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Ngày dự kiến rời đi / chuyển phòng <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          min={todayIso}
                          max={maxDateIso}
                          value={lastWorkingDate}
                          onChange={(e) => {
                            setLastWorkingDate(e.target.value);
                            if (fieldErrors.lastWorkingDate) {
                              setFieldErrors((prev) => ({ ...prev, lastWorkingDate: undefined }));
                            }
                          }}
                          className={`w-full px-3 py-1.5 text-xs border rounded-lg outline-none focus:border-blue-500 ${
                            fieldErrors.lastWorkingDate ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200'
                          }`}
                        />
                        {fieldErrors.lastWorkingDate && (
                          <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.lastWorkingDate}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Lý do bàn giao <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={500}
                          value={reason}
                          onChange={(e) => {
                            setReason(e.target.value);
                            if (fieldErrors.reason) {
                              setFieldErrors((prev) => ({ ...prev, reason: undefined }));
                            }
                          }}
                          placeholder="VD: Nhân sự xin nghỉ việc / Điều chuyển phòng ban..."
                          className={`w-full px-3 py-1.5 text-xs border rounded-lg outline-none focus:border-blue-500 ${
                            fieldErrors.reason ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200'
                          }`}
                        />
                        {fieldErrors.reason && (
                          <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        <span>Khởi tạo Tác vụ Bàn giao Kỹ thuật (gửi Phòng CN)</span>
                      </button>
                    </div>
                  </form>
                )
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
