import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, CornerDownLeft, Loader2, ShieldCheck, X, XCircle } from 'lucide-react';
import api from '../../../../services/api';

const REQUEST_STATUS = {
  OPEN: ['Đang chờ duyệt', 'bg-amber-50 text-amber-700 border-amber-200'],
  APPROVED: ['Đã duyệt', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  RETURNED: ['Đã trả về', 'bg-orange-50 text-orange-700 border-orange-200'],
  REJECTED: ['Đã từ chối', 'bg-rose-50 text-rose-700 border-rose-200'],
  CANCELLED: ['Đã thu hồi', 'bg-slate-100 text-slate-600 border-slate-200'],
};

const STEP_META = {
  PENDING: { label: 'Đang chờ', icon: Clock3, className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Đã duyệt', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700' },
  RETURNED: { label: 'Trả về', icon: CornerDownLeft, className: 'bg-orange-100 text-orange-700' },
  REJECTED: { label: 'Từ chối', icon: XCircle, className: 'bg-rose-100 text-rose-700' },
  SKIPPED: { label: 'Bỏ qua', icon: XCircle, className: 'bg-slate-100 text-slate-500' },
};

const ROLE_LABEL = {
  TRUONG_PHONG: 'Trưởng phòng',
  GIAM_DOC_PHONG_BAN: 'Giám đốc phòng ban',
  CEO: 'Tổng Giám đốc',
  ADMIN: 'Quản trị viên',
};

const formatDateTime = value => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  : 'Chưa xử lý';

export default function ApprovalTimelineModal({ requisition, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/approvals/JOB_REQUISITION/${requisition.id}`)
      .then(response => {
        if (active) setHistory(response.data.data || []);
      })
      .catch(requestError => {
        if (active) setError(requestError.response?.data?.message || 'Không thể tải lịch sử phê duyệt.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requisition.id]);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="approval-timeline-title" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Kiểm toán phê duyệt</p>
            <h2 id="approval-timeline-title" className="mt-1 text-xl font-bold text-slate-950">{requisition.title}</h2>
            <p className="mt-1 text-sm text-slate-500">Mỗi lần gửi lại là một phiên phê duyệt riêng, không ghi đè lịch sử cũ.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng lịch sử phê duyệt" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="grid min-h-52 place-items-center text-slate-500"><Loader2 className="animate-spin text-blue-600" /></div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
          ) : history.length === 0 ? (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-300 text-center">
              <div><ShieldCheck className="mx-auto text-slate-300" size={38} /><p className="mt-3 font-semibold text-slate-700">Chưa có phiên phê duyệt</p><p className="mt-1 text-sm text-slate-500">Yêu cầu đang ở bản nháp hoặc chưa từng được gửi.</p></div>
            </div>
          ) : (
            <div className="space-y-5">
              {history.map((request, requestIndex) => {
                const requestMeta = REQUEST_STATUS[request.status] || [request.status, 'bg-slate-100 text-slate-600 border-slate-200'];
                return (
                  <section key={request.id} className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4">
                      <div>
                        <p className="font-bold text-slate-900">Lần gửi {history.length - requestIndex}</p>
                        <p className="mt-1 text-xs text-slate-500">Entity version {request.entityVersion} · {formatDateTime(request.createdAt)}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${requestMeta[1]}`}>{requestMeta[0]}</span>
                    </div>
                    <div className="space-y-0 px-5 py-2">
                      {(request.steps || []).map((step, index) => {
                        const meta = STEP_META[step.status] || STEP_META.PENDING;
                        const Icon = meta.icon;
                        return (
                          <div key={step.id} className="relative flex gap-4 py-4">
                            {index < request.steps.length - 1 && <span className="absolute left-4 top-12 h-[calc(100%-32px)] w-px bg-slate-200" />}
                            <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ${meta.className}`}><Icon size={16} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">Bước {step.stepOrder}: {ROLE_LABEL[step.approverRole] || step.approverRole}</p>
                                <span className="text-xs font-semibold text-slate-500">{meta.label}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTime(step.decidedAt)}</p>
                              {step.comment && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{step.comment}</p>}
                              {step.resolutionNote && <p className="mt-2 text-xs text-slate-500">{step.resolutionNote}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
