import React, { useEffect, useState } from 'react';
import { CalendarClock, FilePlus2, Loader2, Power, Send, ShieldCheck } from 'lucide-react';
import api from '../../../../services/api';
import { useNotification } from '../../../../context/NotificationContext';

const LABEL = {
  DRAFT: 'Bản nháp', PENDING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt',
  EFFECTIVE: 'Đang hiệu lực', REJECTED: 'Bị từ chối', CANCELLED: 'Đã hủy',
};

export default function ContractLifecyclePanel({ contract, canEdit, canApprove, onChanged }) {
  const { showNotification } = useNotification();
  const [amendments, setAmendments] = useState([]);
  const [terminations, setTerminations] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showAmendment, setShowAmendment] = useState(false);
  const [showTermination, setShowTermination] = useState(false);
  const [amendment, setAmendment] = useState({ type: 'RENEWAL', title: '', reason: '', effectiveDate: '', newEndDate: '', changes: {} });
  const [termination, setTermination] = useState({ type: 'MUTUAL', effectiveDate: '', reason: '', settlementNotes: '' });

  const load = async () => {
    const [a, t] = await Promise.all([
      api.get(`/api/contracts/lifecycle/${contract.id}/amendments`),
      api.get(`/api/contracts/lifecycle/${contract.id}/terminations`),
    ]);
    setAmendments(a.data.data || []); setTerminations(t.data.data || []);
  };
  useEffect(() => { load().catch(() => {}); }, [contract.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const action = async (request, message) => {
    if (busy) return; setBusy(true);
    try { await request(); await load(); await onChanged?.(); showNotification('Thành công', message, 'success'); }
    catch (error) { showNotification('Không thể xử lý', error.response?.data?.message || 'Vui lòng thử lại', 'error'); }
    finally { setBusy(false); }
  };

  if (!['ACTIVE', 'TERMINATION_PENDING', 'TERMINATED', 'EXPIRED'].includes(contract.status)) return null;
  return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-950">Quản trị vòng đời hợp đồng</h3><p className="mt-1 text-sm text-slate-600">Phụ lục, gia hạn và chấm dứt có phê duyệt; bản PDF đã ký vẫn bất biến.</p></div>{canEdit && contract.status === 'ACTIVE' && <div className="flex gap-2"><button onClick={() => setShowAmendment(v => !v)} className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white">+ Phụ lục / gia hạn</button><button onClick={() => setShowTermination(v => !v)} className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-bold text-rose-700">Đề xuất chấm dứt</button></div>}</div>

    {showAmendment && <div className="mt-4 grid gap-3 rounded-xl border border-blue-200 bg-white p-4 sm:grid-cols-2">
      <select value={amendment.type} onChange={e => setAmendment({ ...amendment, type: e.target.value })} className="rounded-lg border p-2.5 text-sm"><option value="RENEWAL">Gia hạn</option><option value="SALARY">Điều chỉnh lương</option><option value="POSITION">Chức danh/phòng ban</option><option value="GENERAL">Nội dung khác</option></select>
      <input value={amendment.title} onChange={e => setAmendment({ ...amendment, title: e.target.value })} placeholder="Tên phụ lục" className="rounded-lg border p-2.5 text-sm" />
      <label className="text-xs font-semibold">Ngày hiệu lực<input type="date" value={amendment.effectiveDate} onChange={e => setAmendment({ ...amendment, effectiveDate: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label>
      {amendment.type === 'RENEWAL' && <label className="text-xs font-semibold">Ngày kết thúc mới<input type="date" value={amendment.newEndDate} onChange={e => setAmendment({ ...amendment, newEndDate: e.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm" /></label>}
      {amendment.type === 'SALARY' && <input type="number" placeholder="Lương cơ bản mới" onChange={e => setAmendment({ ...amendment, changes: { baseSalary: Number(e.target.value) } })} className="rounded-lg border p-2.5 text-sm" />}
      {amendment.type === 'POSITION' && <><input placeholder="Chức danh mới" onChange={e => setAmendment({ ...amendment, changes: { ...amendment.changes, title: e.target.value } })} className="rounded-lg border p-2.5 text-sm" /><input placeholder="Phòng ban mới" onChange={e => setAmendment({ ...amendment, changes: { ...amendment.changes, department: e.target.value } })} className="rounded-lg border p-2.5 text-sm" /></>}
      <textarea value={amendment.reason} onChange={e => setAmendment({ ...amendment, reason: e.target.value })} placeholder="Lý do và nội dung thay đổi" className="min-h-20 rounded-lg border p-2.5 text-sm sm:col-span-2" />
      <button disabled={busy} onClick={() => action(() => api.post(`/api/contracts/lifecycle/${contract.id}/amendments`, { ...amendment, newEndDate: amendment.newEndDate || null }), 'Đã tạo phụ lục bản nháp')} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white sm:col-span-2">Tạo bản nháp</button>
    </div>}

    {showTermination && <div className="mt-4 grid gap-3 rounded-xl border border-rose-200 bg-white p-4 sm:grid-cols-2">
      <select value={termination.type} onChange={e => setTermination({ ...termination, type: e.target.value })} className="rounded-lg border p-2.5 text-sm"><option value="MUTUAL">Thỏa thuận hai bên</option><option value="RESIGNATION">Người lao động nghỉ</option><option value="DISMISSAL">Công ty chấm dứt</option><option value="EXPIRY">Hết hạn</option><option value="OTHER">Khác</option></select>
      <input type="date" value={termination.effectiveDate} onChange={e => setTermination({ ...termination, effectiveDate: e.target.value })} className="rounded-lg border p-2.5 text-sm" />
      <textarea value={termination.reason} onChange={e => setTermination({ ...termination, reason: e.target.value })} placeholder="Lý do" className="min-h-20 rounded-lg border p-2.5 text-sm" />
      <textarea value={termination.settlementNotes} onChange={e => setTermination({ ...termination, settlementNotes: e.target.value })} placeholder="Bàn giao, quyết toán, nghĩa vụ còn lại" className="min-h-20 rounded-lg border p-2.5 text-sm" />
      <button disabled={busy} onClick={() => action(() => api.post(`/api/contracts/lifecycle/${contract.id}/terminations`, termination), 'Đã tạo đề xuất chấm dứt')} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white sm:col-span-2">Tạo đề xuất</button>
    </div>}

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-white p-4"><h4 className="flex items-center gap-2 font-bold"><FilePlus2 size={17} className="text-blue-600" />Phụ lục & gia hạn</h4><div className="mt-3 space-y-3">{amendments.length === 0 ? <p className="text-sm text-slate-500">Chưa có phụ lục.</p> : amendments.map(item => <div key={item.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><b className="text-sm">{item.title}</b><span className="text-xs font-bold text-blue-700">{LABEL[item.status] || item.status}</span></div><p className="mt-1 text-xs text-slate-500">{item.amendment_number} · {item.amendment_type} · hiệu lực {item.effective_date}</p><p className="mt-1 text-sm text-slate-700">{item.reason}</p><div className="mt-2 flex flex-wrap gap-2">{canEdit && item.status === 'DRAFT' && <button disabled={busy} onClick={() => action(() => api.post(`/api/contracts/lifecycle/amendments/${item.id}/submit`), 'Đã gửi duyệt')} className="text-xs font-bold text-blue-600"><Send size={13} className="mr-1 inline" />Gửi duyệt</button>}{canApprove && item.status === 'PENDING_APPROVAL' && <><button onClick={() => action(() => api.post(`/api/contracts/lifecycle/amendments/${item.id}/decision`, { decision: 'APPROVE' }), 'Đã duyệt phụ lục')} className="text-xs font-bold text-emerald-600">Duyệt</button><button onClick={() => action(() => api.post(`/api/contracts/lifecycle/amendments/${item.id}/decision`, { decision: 'REJECT' }), 'Đã từ chối phụ lục')} className="text-xs font-bold text-rose-600">Từ chối</button></>}{canEdit && item.status === 'APPROVED' && <button onClick={() => action(() => api.post(`/api/contracts/lifecycle/amendments/${item.id}/activate`), 'Phụ lục đã có hiệu lực')} className="text-xs font-bold text-emerald-700"><ShieldCheck size={13} className="mr-1 inline" />Cho hiệu lực</button>}</div></div>)}</div></div>
      <div className="rounded-xl bg-white p-4"><h4 className="flex items-center gap-2 font-bold"><Power size={17} className="text-rose-600" />Chấm dứt hợp đồng</h4><div className="mt-3 space-y-3">{terminations.length === 0 ? <p className="text-sm text-slate-500">Chưa có hồ sơ chấm dứt.</p> : terminations.map(item => <div key={item.id} className="rounded-lg border p-3"><div className="flex justify-between"><b className="text-sm">{item.termination_type}</b><span className="text-xs font-bold text-rose-700">{LABEL[item.status] || item.status}</span></div><p className="mt-1 text-xs text-slate-500">Hiệu lực {item.effective_date}</p><p className="mt-1 text-sm">{item.reason}</p><div className="mt-2 flex gap-2">{canEdit && item.status === 'DRAFT' && <button onClick={() => action(() => api.post(`/api/contracts/lifecycle/terminations/${item.id}/submit`), 'Đã gửi duyệt chấm dứt')} className="text-xs font-bold text-blue-600">Gửi duyệt</button>}{canApprove && item.status === 'PENDING_APPROVAL' && <><button onClick={() => action(() => api.post(`/api/contracts/lifecycle/terminations/${item.id}/decision`, { decision: 'APPROVE' }), 'Đã duyệt chấm dứt')} className="text-xs font-bold text-emerald-600">Duyệt</button><button onClick={() => action(() => api.post(`/api/contracts/lifecycle/terminations/${item.id}/decision`, { decision: 'REJECT' }), 'Đã từ chối chấm dứt')} className="text-xs font-bold text-rose-600">Từ chối</button></>}{canEdit && item.status === 'APPROVED' && <button onClick={() => action(() => api.post(`/api/contracts/lifecycle/terminations/${item.id}/activate`), 'Hợp đồng đã chấm dứt')} className="text-xs font-bold text-rose-700"><CalendarClock size={13} className="mr-1 inline" />Cho hiệu lực</button>}</div></div>)}</div></div>
    </div>
    {busy && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Đang xử lý...</div>}
  </div>;
}
