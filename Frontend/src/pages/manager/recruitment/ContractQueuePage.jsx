import React, { useEffect, useState } from 'react';
import { Bot, FileCheck2, FileSignature, Filter, Loader2, Scale, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useNotification } from '../../../context/NotificationContext';

const FILTERS = [
  ['', 'Tất cả'], ['DRAFT', 'Bản nháp'], ['PENDING_LEGAL_REVIEW', 'Chờ pháp chế'],
  ['LEGAL_CHANGES_REQUESTED', 'Trả sửa'], ['LEGAL_APPROVED', 'Đã duyệt'],
  ['ISSUED', 'Đã phát hành'], ['COMPANY_SIGNED', 'Công ty đã ký'],
  ['SENT_TO_CANDIDATE', 'Đã gửi ứng viên'], ['CANDIDATE_VIEWED', 'Ứng viên đã xem'],
  ['CANDIDATE_SIGNED', 'Hai bên đã ký'], ['ACTIVE', 'Đang hiệu lực'],
  ['TERMINATION_PENDING', 'Chờ chấm dứt'], ['TERMINATED', 'Đã chấm dứt'], ['EXPIRED', 'Hết hạn'],
  ['DECLINED', 'Từ chối ký'], ['SIGNING_EXPIRED', 'Link ký hết hạn'],
];

const STATUS = Object.fromEntries(FILTERS.slice(1).map(([value, label]) => [value, label]));

export default function ContractQueuePage() {
  const [contracts, setContracts] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [assistant, setAssistant] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const { role } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const basePath = role === 'ceo' ? '/ceo/recruitment' : role === 'giam_doc_phong_ban' ? '/director/recruitment' : '/manager/recruitment';

  useEffect(() => {
    setLoading(true);
    api.get('/api/contracts', { params: filter ? { status: filter } : {} })
      .then(response => setContracts(response.data.data || []))
      .catch(error => showNotification('Lỗi', error.response?.data?.message || 'Không thể tải danh sách hợp đồng', 'error'))
      .finally(() => setLoading(false));
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/api/contracts/lifecycle/dashboard').then(response => setDashboard(response.data.data)).catch(() => {});
  }, []);

  const runAssistant = async () => {
    setAiBusy(true);
    try { const response = await api.post('/api/contracts/lifecycle/assistant'); setAssistant(response.data.data?.summary || ''); }
    catch (error) { showNotification('Lỗi AI', error.response?.data?.message || 'Không thể phân tích', 'error'); }
    finally { setAiBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Contract Management</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Hợp đồng & Pháp chế</h1><p className="mt-1 text-sm text-slate-500">Theo dõi từ bản nháp, pháp chế, ký hai bên đến hợp đồng đang hiệu lực.</p></div>
        <div className="flex gap-2"><button onClick={runAssistant} disabled={aiBusy} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{aiBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Trợ lý AI</button><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600"><Filter size={16} /><select value={filter} onChange={event => setFilter(event.target.value)} className="bg-transparent outline-none">{FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><Scale className="text-amber-500" /><p className="mt-3 text-2xl font-bold">{dashboard?.acceptanceRate ?? 0}%</p><p className="text-sm text-slate-500">Tỷ lệ nhận offer</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><FileCheck2 className="text-blue-600" /><p className="mt-3 text-2xl font-bold">{dashboard?.activeContracts ?? 0}</p><p className="text-sm text-slate-500">Đang hiệu lực</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><FileSignature className="text-violet-600" /><p className="mt-3 text-2xl font-bold">{dashboard?.pendingSignatures ?? 0}</p><p className="text-sm text-slate-500">Đang chờ ký</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><FileCheck2 className="text-rose-500" /><p className="mt-3 text-2xl font-bold">{dashboard?.expiringWithin60Days ?? 0}</p><p className="text-sm text-slate-500">Hết hạn trong 60 ngày</p></div>
      </div>

      {assistant && <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><Bot className="shrink-0 text-blue-600" /><div><p className="font-bold">Tóm tắt vận hành hợp đồng</p><p className="mt-1 whitespace-pre-line leading-6">{assistant}</p></div></div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="grid min-h-56 place-items-center"><Loader2 className="animate-spin text-blue-600" /></div> : contracts.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">Chưa có hợp đồng trong trạng thái này.</div> : (
          <div className="divide-y divide-slate-100">{contracts.map(contract => {
            const employee = contract.contractData?.employee || {};
            const job = contract.contractData?.job || {};
            return <button key={contract.id} onClick={() => navigate(`${basePath}/applications/${contract.applicationId}`)} className="grid w-full gap-3 p-5 text-left transition hover:bg-slate-50 sm:grid-cols-[1.4fr_1fr_0.8fr_auto] sm:items-center">
              <div><p className="font-bold text-slate-900">{employee.fullName || `Ứng viên #${contract.applicationId}`}</p><p className="mt-1 text-xs text-slate-500">{contract.contractNumber || `Hợp đồng nháp #${contract.id}`} · phiên bản {contract.versionNumber}</p></div>
              <div><p className="text-sm font-semibold text-slate-700">{job.title || 'Chưa có chức danh'}</p><p className="text-xs text-slate-500">{job.department || 'Chưa có phòng ban'}</p></div>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{STATUS[contract.status] || contract.status}</span>
              <span className="text-xs font-semibold text-slate-500">Mở hồ sơ →</span>
            </button>;
          })}</div>
        )}
      </div>
    </div>
  );
}
