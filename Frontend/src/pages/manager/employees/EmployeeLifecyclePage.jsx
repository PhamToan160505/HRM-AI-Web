import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarCheck, Check, CircleAlert, Loader2, RefreshCw, UserRoundCheck, X } from 'lucide-react';
import api from '../../../services/api';
import { useNotification } from '../../../context/NotificationContext';

const STATUS = {
  PRE_BOARDING: { label: 'Chờ nhận việc', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  EMPLOYED: { label: 'Đang làm việc', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ONBOARD_CANCELLED: { label: 'Hủy nhận việc', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const ACCOUNT_STATUS = {
  NOT_CREATED: { label: 'Chờ tạo yêu cầu', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  PENDING_ADMIN: { label: 'Chờ cấp quyền', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED_REQUEST: { label: 'Đã duyệt cấp quyền', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  PROVISIONING: { label: 'Đang cấp quyền', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  PROVISIONED: { label: 'Đã kích hoạt', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED: { label: 'Cấp quyền lỗi', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const accountMeta = value => ACCOUNT_STATUS[value] || { label: value || 'Chưa có', className: 'bg-slate-100 text-slate-600 border-slate-200' };

const formatDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa có';

export default function EmployeeLifecyclePage() {
  const { showNotification } = useNotification();
  const notificationRef = useRef(showNotification);
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState('PRE_BOARDING');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ joinDate: new Date().toISOString().slice(0, 10), checklistOverrideReason: '', earlyJoinReason: '', reasonCode: '' });

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/lifecycle/employees', { params: filter ? { status: filter } : {} });
      setEmployees(response.data.data || []);
    } catch (error) {
      notificationRef.current('Không thể tải dữ liệu', error.response?.data?.message || 'Vui lòng thử lại', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { notificationRef.current = showNotification; }, [showNotification]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const openDetail = async employeeId => {
    try {
      const response = await api.get(`/api/lifecycle/employees/${employeeId}`);
      setDetail(response.data.data);
    } catch (error) {
      showNotification('Không thể mở hồ sơ', error.response?.data?.message || 'Vui lòng thử lại', 'error');
    }
  };

  const completeItem = async itemId => {
    try {
      await api.post(`/api/lifecycle/employees/${detail.employee.id}/checklist/${itemId}/complete`);
      await openDetail(detail.employee.id);
      await loadEmployees();
    } catch (error) {
      showNotification('Không thể cập nhật', error.response?.data?.message || 'Vui lòng thử lại', 'error');
    }
  };

  const submitAction = async () => {
    setSubmitting(true);
    try {
      const url = action === 'JOIN'
        ? `/api/lifecycle/employees/${detail.employee.id}/join`
        : `/api/lifecycle/employees/${detail.employee.id}/cancel-onboarding`;
      const body = action === 'JOIN'
        ? { joinDate: form.joinDate, checklistOverrideReason: form.checklistOverrideReason || null, earlyJoinReason: form.earlyJoinReason || null }
        : { reasonCode: form.reasonCode };
      await api.post(url, body, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      showNotification('Thành công', action === 'JOIN' ? 'Đã xác nhận nhân viên nhận việc' : 'Đã ghi nhận hủy nhận việc', 'success');
      setAction(null);
      setDetail(null);
      await loadEmployees();
    } catch (error) {
      showNotification('Không thể thực hiện', error.response?.data?.message || 'Vui lòng kiểm tra lại dữ liệu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Vòng đời nhân viên</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Nhân viên mới</h1>
          <p className="mt-2 text-sm text-slate-600">Theo dõi từ lúc chấp nhận offer đến ngày chính thức nhận việc.</p>
        </div>
        <button onClick={loadEmployees} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={17} /> Làm mới
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-200">
        {[['PRE_BOARDING', 'Chờ nhận việc'], ['EMPLOYED', 'Đã nhận việc'], ['ONBOARD_CANCELLED', 'Đã hủy'], ['', 'Tất cả']].map(([value, label]) => (
          <button key={label} onClick={() => setFilter(value)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${filter === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="grid min-h-56 place-items-center text-slate-500"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : employees.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div><UserRoundCheck className="mx-auto text-slate-300" size={44} /><p className="mt-3 font-semibold text-slate-700">Chưa có nhân viên ở trạng thái này</p><p className="mt-1 text-sm text-slate-500">Dữ liệu sẽ xuất hiện sau khi ứng viên chấp nhận offer.</p></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Nhân viên</th><th className="px-6 py-4">Vị trí</th><th className="px-6 py-4">Ngày dự kiến</th><th className="px-6 py-4">Checklist</th><th className="px-6 py-4">Tài khoản</th><th className="px-6 py-4">Trạng thái</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(employee => {
                  const status = STATUS[employee.status] || STATUS.PRE_BOARDING;
                  const account = accountMeta(employee.accountStatus);
                  return <tr key={employee.id} onClick={() => openDetail(employee.id)} className="cursor-pointer hover:bg-blue-50/40">
                    <td className="px-6 py-4"><p className="font-semibold text-slate-900">{employee.fullName}</p><p className="mt-0.5 text-xs text-slate-500">{employee.employeeCode} · {employee.personStatus}</p></td>
                    <td className="px-6 py-4 text-slate-700">{employee.positionTitle}</td>
                    <td className="px-6 py-4 text-slate-700">{formatDate(employee.startDatePlanned)}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{employee.checklistCompleted}/{employee.checklistTotal}</td>
                    <td className="px-6 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${account.className}`}>{account.label}</span></td>
                    <td className="px-6 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl sm:p-8" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">{detail.employee.employeeCode}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{detail.employee.fullName}</h2><p className="mt-1 text-sm text-slate-500">{detail.employee.positionTitle} · dự kiến {formatDate(detail.employee.startDatePlanned)}</p></div><button onClick={() => setDetail(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X /></button></div>

            <div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-600">Trạng thái nhân sự</p><p className="mt-1 font-bold text-blue-950">{STATUS[detail.employee.status]?.label || detail.employee.status}</p></div><div className={`rounded-xl border p-4 ${accountMeta(detail.employee.accountStatus).className}`}><p className="text-xs font-semibold">Cấp quyền tài khoản</p><p className="mt-1 font-bold">{accountMeta(detail.employee.accountStatus).label}</p></div></div>

            {detail.employee.status === 'EMPLOYED' && detail.employee.accountStatus !== 'PROVISIONED' && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Nhân viên đã được xác nhận nhận việc. Việc cấp quyền đang xử lý độc lập và không làm thay đổi trạng thái <strong>Đang làm việc</strong>.
              </div>
            )}

            <section className="mt-8"><h3 className="font-bold text-slate-900">Checklist pre-boarding</h3><div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">{detail.checklist.map(item => <div key={item.id} className="flex items-center gap-3 p-4"><div className={`grid size-8 shrink-0 place-items-center rounded-full ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{item.status === 'COMPLETED' ? <Check size={17} /> : <CalendarCheck size={17} />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{item.label}</p><p className="mt-0.5 text-xs text-slate-500">Hạn {formatDate(item.dueDate)}</p></div>{detail.employee.status === 'PRE_BOARDING' && item.status === 'PENDING' && <button onClick={() => completeItem(item.id)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">Hoàn tất</button>}</div>)}</div></section>

            <section className="mt-8"><h3 className="font-bold text-slate-900">Timeline</h3><div className="mt-3 space-y-4 border-l-2 border-blue-100 pl-5">{detail.events.map(event => <div key={event.id}><p className="text-sm font-semibold text-slate-800">{event.eventType}</p><p className="mt-0.5 text-sm text-slate-600">{event.summary}</p><p className="mt-1 text-xs text-slate-400">{new Date(event.eventDate).toLocaleString('vi-VN')}</p></div>)}</div></section>

            {detail.employee.status === 'PRE_BOARDING' && <div className="mt-9 flex gap-3 border-t border-slate-200 pt-6"><button onClick={() => setAction('CANCEL')} className="flex-1 rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50">Hủy nhận việc</button><button onClick={() => setAction('JOIN')} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Xác nhận đã đi làm</button></div>}
          </aside>
        </div>
      )}

      {action && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 px-5" onClick={() => setAction(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-950">{action === 'JOIN' ? 'Xác nhận đã đi làm' : 'Ghi nhận hủy nhận việc'}</h2>
            {action === 'JOIN' ? <div className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">Ngày nhận việc<input type="date" value={form.joinDate} onChange={event => setForm({ ...form, joinDate: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 p-3" /></label><label className="block text-sm font-semibold text-slate-700">Ngoại lệ checklist (nếu còn thiếu)<textarea value={form.checklistOverrideReason} onChange={event => setForm({ ...form, checklistOverrideReason: event.target.value })} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 p-3" /></label><label className="block text-sm font-semibold text-slate-700">Lý do nhận việc sớm (nếu có)<textarea value={form.earlyJoinReason} onChange={event => setForm({ ...form, earlyJoinReason: event.target.value })} className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 p-3" /></label></div> : <div className="mt-5"><label className="block text-sm font-semibold text-slate-700">Lý do *<textarea value={form.reasonCode} onChange={event => setForm({ ...form, reasonCode: event.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3" placeholder="Ví dụ: Ứng viên không đến nhận việc" /></label></div>}
            <div className="mt-6 flex gap-3"><button onClick={() => setAction(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Quay lại</button><button disabled={submitting || (action === 'CANCEL' && !form.reasonCode.trim())} onClick={submitAction} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? <Loader2 className="animate-spin" size={17} /> : <CircleAlert size={17} />} Xác nhận</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
