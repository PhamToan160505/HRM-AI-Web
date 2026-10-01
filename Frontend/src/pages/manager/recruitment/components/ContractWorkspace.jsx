import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle2, FileCheck2, FileSignature, Gavel, History,
  Loader2, Plus, Printer, RefreshCw, Send, ShieldCheck, UploadCloud,
} from 'lucide-react';
import api from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { useNotification } from '../../../../context/NotificationContext';
import ContractLifecyclePanel from './ContractLifecyclePanel';

const STATUS = {
  DRAFT: ['Bản nháp', 'bg-slate-100 text-slate-700'],
  PENDING_LEGAL_REVIEW: ['Chờ pháp chế', 'bg-amber-100 text-amber-800'],
  LEGAL_CHANGES_REQUESTED: ['Pháp chế trả sửa', 'bg-rose-100 text-rose-700'],
  LEGAL_APPROVED: ['Pháp chế đã duyệt', 'bg-emerald-100 text-emerald-700'],
  ISSUED: ['Đã phát hành', 'bg-blue-100 text-blue-700'],
  SIGNED_UPLOADED: ['Công ty đã ký (dữ liệu cũ)', 'bg-violet-100 text-violet-700'],
  COMPANY_SIGNED: ['Công ty đã ký', 'bg-violet-100 text-violet-700'],
  SENT_TO_CANDIDATE: ['Đã gửi ứng viên ký', 'bg-cyan-100 text-cyan-800'],
  CANDIDATE_VIEWED: ['Ứng viên đã xem', 'bg-sky-100 text-sky-800'],
  CANDIDATE_SIGNED: ['Hai bên đã ký', 'bg-emerald-100 text-emerald-800'],
  ACTIVE: ['Hợp đồng đang hiệu lực', 'bg-green-100 text-green-800'],
  TERMINATION_PENDING: ['Chờ duyệt chấm dứt', 'bg-amber-100 text-amber-800'],
  TERMINATED: ['Đã chấm dứt', 'bg-rose-100 text-rose-700'],
  EXPIRED: ['Đã hết hạn', 'bg-slate-100 text-slate-700'],
  DECLINED: ['Ứng viên từ chối ký', 'bg-rose-100 text-rose-700'],
  SIGNING_EXPIRED: ['Link ký hết hạn', 'bg-amber-100 text-amber-800'],
};

const FIELD_GROUPS = [
  ['Thông tin người lao động', [
    ['employee.fullName', 'Họ và tên'], ['employee.identityNumber', 'Số CCCD'],
    ['employee.address', 'Địa chỉ'], ['employee.identityIssuedDate', 'Ngày cấp CCCD', 'date'],
    ['employee.identityIssuedPlace', 'Nơi cấp CCCD'],
  ]],
  ['Công việc và thời hạn', [
    ['job.title', 'Chức danh'], ['job.department', 'Phòng ban'],
    ['job.workLocation', 'Địa điểm làm việc'], ['job.contractType', 'Loại hợp đồng', 'contractType'],
    ['employment.startDate', 'Ngày bắt đầu', 'date'], ['employment.endDate', 'Ngày kết thúc', 'date'],
  ]],
  ['Đại diện doanh nghiệp', [
    ['employer.companyName', 'Tên doanh nghiệp'], ['employer.address', 'Địa chỉ doanh nghiệp'],
    ['employer.representativeName', 'Người đại diện'], ['employer.representativeTitle', 'Chức danh đại diện'],
  ]],
  ['Thu nhập', [
    ['compensation.baseSalary', 'Lương cơ bản', 'number'], ['compensation.payDay', 'Ngày trả lương'],
  ]],
];

function deepGet(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object) ?? '';
}

function deepSet(object, path, value) {
  const clone = structuredClone(object || {});
  const keys = path.split('.');
  let cursor = clone;
  keys.slice(0, -1).forEach(key => {
    cursor[key] = cursor[key] && typeof cursor[key] === 'object' ? cursor[key] : {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
  return clone;
}

function formatTime(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function normalizeText(value) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function Field({ path, label, type, data, disabled, onChange }) {
  const value = deepGet(data, path);
  const common = {
    value,
    disabled,
    onChange: event => onChange(path, type === 'number' ? Number(event.target.value) : event.target.value),
    className: 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500',
  };
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      {type === 'contractType' ? (
        <select {...common}><option value="FIXED_TERM">Xác định thời hạn</option><option value="INDEFINITE">Không xác định thời hạn</option></select>
      ) : <input {...common} type={type || 'text'} />}
    </label>
  );
}

export default function ContractWorkspace({ applicationId, applicationStatus }) {
  const { role, user } = useAuth();
  const { showNotification } = useNotification();
  const [contract, setContract] = useState(null);
  const [clauses, setClauses] = useState([]);
  const [data, setData] = useState({});
  const [selectedClauseIds, setSelectedClauseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [legalComment, setLegalComment] = useState('');
  const [signedFile, setSignedFile] = useState(null);
  const [signatureDeadline, setSignatureDeadline] = useState(() => {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [showLibrary, setShowLibrary] = useState(false);
  const [newClause, setNewClause] = useState({ code: '', title: '', category: '', content: '', requiredClause: false });

  const department = normalizeText(user?.tenPhong);
  const canEdit = ['ceo', 'admin'].includes(role) || department.includes('nhan su');
  const canReviewLegal = ['ceo', 'admin'].includes(role) || department.includes('phap che');
  const editable = contract && ['DRAFT', 'LEGAL_CHANGES_REQUESTED'].includes(contract.status) && canEdit;
  const statusMeta = STATUS[contract?.status] || [contract?.status, 'bg-slate-100 text-slate-700'];

  const activeClauseIds = useMemo(() => {
    if (!contract) return [];
    const codes = new Set((contract.clauses || []).map(item => item.code));
    return clauses.filter(item => codes.has(item.code)).map(item => item.id);
  }, [clauses, contract]);

  const load = async () => {
    if (applicationStatus !== 'OFFER_ACCEPTED') { setLoading(false); return; }
    try {
      const [contractResponse, clauseResponse] = await Promise.all([
        api.get(`/api/contracts/application/${applicationId}`),
        api.get('/api/contracts/clauses'),
      ]);
      const current = contractResponse.data.data?.[0] || null;
      setClauses(clauseResponse.data.data || []);
      setContract(current);
      setData(current?.contractData || {});
      setLegalComment(current?.legalComment || '');
    } catch (error) {
      showNotification('Lỗi hợp đồng', error.response?.data?.message || 'Không thể tải module hợp đồng', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [applicationId, applicationStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeClauseIds.length) setSelectedClauseIds(activeClauseIds); }, [activeClauseIds]);

  if (applicationStatus !== 'OFFER_ACCEPTED') return null;
  if (loading) return <section className="rounded-2xl border border-slate-200 bg-white p-6"><Loader2 className="animate-spin text-blue-600" /></section>;

  const execute = async (request, successMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await request();
      const next = response.data.data;
      setContract(next);
      setData(next.contractData || {});
      setLegalComment(next.legalComment || '');
      showNotification('Thành công', successMessage, 'success');
    } catch (error) {
      showNotification('Lỗi hợp đồng', error.response?.data?.message || 'Không thể thực hiện thao tác', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createContract = () => execute(
    () => api.post(`/api/contracts/application/${applicationId}`, null, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    'Đã khởi tạo hợp đồng từ offer được chấp nhận',
  );

  const generate = () => execute(
    () => api.post(`/api/contracts/${contract.id}/generate`, { contractData: data, clauseIds: selectedClauseIds }, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    'Đã sinh lại nội dung hợp đồng',
  );

  const simpleAction = (path, message, body = null) => execute(
    () => api.post(`/api/contracts/${contract.id}/${path}`, body, { headers: { 'Idempotency-Key': crypto.randomUUID() } }),
    message,
  );

  const uploadSigned = async () => {
    if (!signedFile) return showNotification('Thiếu file', 'Vui lòng chọn file PDF đã ký', 'error');
    const form = new FormData();
    form.append('file', signedFile);
    await execute(() => api.post(`/api/contracts/${contract.id}/signed-copy`, form, {
      headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': crypto.randomUUID() },
    }), 'Đã lưu bản hợp đồng đã ký');
    setSignedFile(null);
  };

  const sendForSignature = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/api/contracts/${contract.id}/send-for-signature`, {
        expiresAt: signatureDeadline ? `${signatureDeadline}:00` : null,
      }, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
      showNotification('Đã gửi ứng viên ký', 'Ứng viên sẽ nhận email chứa link bảo mật và xác thực OTP trước khi ký.', 'success');
      await load();
    } catch (error) {
      showNotification('Không thể gửi ký', error.response?.data?.message || 'Vui lòng thử lại', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createClause = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/api/contracts/clauses', newClause);
      const clauseResponse = await api.get('/api/contracts/clauses');
      setClauses(clauseResponse.data.data || []);
      setNewClause({ code: '', title: '', category: '', content: '', requiredClause: false });
      showNotification('Thành công', 'Đã thêm phiên bản điều khoản mới', 'success');
    } catch (error) {
      showNotification('Lỗi hợp đồng', error.response?.data?.message || 'Không thể tạo điều khoản', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!contract) {
    return (
      <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Offer-to-Contract · Giai đoạn 2</p><h2 className="mt-1 text-xl font-bold text-slate-950">Hồ sơ hợp đồng lao động</h2><p className="mt-2 text-sm text-slate-600">Ứng viên đã chấp nhận offer. Khởi tạo hợp đồng để bổ sung thông tin và gửi pháp chế.</p></div>
          {canEdit && <button disabled={busy} onClick={createContract} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <Loader2 size={17} className="animate-spin" /> : <FileSignature size={17} />}Khởi tạo hợp đồng</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Offer-to-Contract · Giai đoạn 2</p><h2 className="mt-1 text-xl font-bold text-slate-950">Hợp đồng {contract.contractNumber || `bản nháp #${contract.id}`}</h2><p className="mt-1 text-sm text-slate-500">Phiên bản {contract.versionNumber} · cập nhật {formatTime(contract.updatedAt)}</p></div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusMeta[1]}`}>{statusMeta[0]}</span>
      </div>

      {contract.status === 'PENDING_LEGAL_REVIEW' && (
        <div className={`mt-5 rounded-2xl border p-5 ${canReviewLegal ? 'border-amber-300 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-start gap-3">
            <ShieldCheck className={canReviewLegal ? 'text-amber-700' : 'text-blue-700'} size={22} />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-slate-950">{canReviewLegal ? 'Việc cần xử lý của Pháp chế' : 'Đã chuyển hồ sơ sang Pháp chế'}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                {canReviewLegal
                  ? 'Kiểm tra bản xem trước và điều khoản hợp đồng, sau đó phê duyệt hoặc ghi rõ nội dung cần chỉnh sửa.'
                  : 'Hợp đồng đang chờ Trưởng/Giám đốc Pháp chế, CEO hoặc Admin xử lý. Kết quả sẽ hiển thị tại đây và gửi thông báo cho người lập.'}
              </p>
              {canReviewLegal && <>
                <textarea value={legalComment} onChange={e => setLegalComment(e.target.value)} placeholder="Nhận xét pháp chế; bắt buộc khi trả chỉnh sửa" className="mt-3 min-h-24 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => simpleAction('legal-decision', 'Pháp chế đã phê duyệt', { decision: 'APPROVE', comment: legalComment || null })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><ShieldCheck size={16} />Phê duyệt pháp chế</button>
                  <button disabled={busy || !legalComment.trim()} onClick={() => simpleAction('legal-decision', 'Đã trả hợp đồng về chỉnh sửa', { decision: 'RETURN', comment: legalComment })} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Gavel size={16} />Trả HR chỉnh sửa</button>
                </div>
              </>}
            </div>
          </div>
        </div>
      )}

      {contract.status === 'LEGAL_APPROVED' && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3"><CheckCircle2 className="text-emerald-600" size={22} /><div><h3 className="font-bold text-emerald-950">Đầu ra pháp chế: Đã phê duyệt</h3><p className="mt-1 text-sm text-emerald-800">Người duyệt: {contract.legalReviewerName || 'Pháp chế'} · {formatTime(contract.legalReviewedAt)}{contract.legalComment ? ` · ${contract.legalComment}` : ''}</p></div></div>
          {canEdit && <button disabled={busy} onClick={() => simpleAction('issue', 'Đã phát hành hợp đồng')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><FileCheck2 size={16} />Phát hành hợp đồng</button>}
        </div>
      )}

      {contract.status === 'LEGAL_CHANGES_REQUESTED' && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3"><Gavel className="text-rose-600" size={22} /><div><h3 className="font-bold text-rose-950">Đầu ra pháp chế: Yêu cầu chỉnh sửa</h3><p className="mt-1 text-sm text-rose-800">Người rà soát: {contract.legalReviewerName || 'Pháp chế'} · {formatTime(contract.legalReviewedAt)}</p><p className="mt-2 text-sm font-semibold text-rose-950">{contract.legalComment || 'Chưa có nội dung góp ý.'}</p></div></div>
        </div>
      )}

      {contract.status === 'ISSUED' && (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="flex items-center gap-2 font-bold text-blue-950"><FileCheck2 size={20} />Đầu ra hợp đồng: {contract.contractNumber || 'Đã phát hành'}</h3>
          <p className="mt-1 text-sm text-blue-800">Phát hành lúc {formatTime(contract.issuedAt)} · Bước tiếp theo: upload PDF mà phía công ty đã ký.</p>
        </div>
      )}

      {['COMPANY_SIGNED', 'SIGNED_UPLOADED'].includes(contract.status) && (
        <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <h3 className="flex items-center gap-2 font-bold text-violet-950"><FileSignature size={20} />Công ty đã ký · Chờ gửi ứng viên</h3>
          <p className="mt-1 text-sm text-violet-800">Bản PDF phía công ty đã ký được lưu lúc {formatTime(contract.signedUploadedAt)}. Ứng viên chưa ký ở bước này.</p>
          {canEdit && <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold text-violet-950">Hạn ký<input type="datetime-local" value={signatureDeadline} onChange={e => setSignatureDeadline(e.target.value)} className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm" /></label><button disabled={busy || !signatureDeadline} onClick={sendForSignature} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />Gửi ứng viên ký</button></div>}
        </div>
      )}

      {['SENT_TO_CANDIDATE', 'CANDIDATE_VIEWED'].includes(contract.status) && (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
          <h3 className="flex items-center gap-2 font-bold text-cyan-950"><Send size={20} />Đang chờ ứng viên ký</h3>
          <p className="mt-1 text-sm text-cyan-800">{contract.status === 'CANDIDATE_VIEWED' ? `Ứng viên đã mở link lúc ${formatTime(contract.candidateViewedAt)}.` : 'Email ký đã được gửi; ứng viên chưa mở link.'} Hạn ký: {formatTime(contract.signingExpiresAt)}.</p>
          {canEdit && <button disabled={busy} onClick={sendForSignature} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 py-2 text-sm font-bold text-cyan-800"><RefreshCw size={15} />Thu hồi link cũ và gửi lại</button>}
        </div>
      )}

      {contract.status === 'CANDIDATE_SIGNED' && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div><h3 className="flex items-center gap-2 font-bold text-emerald-950"><CheckCircle2 size={20} />Hai bên đã ký hợp đồng</h3><p className="mt-1 text-sm text-emerald-800">Ứng viên: {contract.candidateSignerName || '—'} · {formatTime(contract.candidateSignedAt)} · {contract.candidateSignMethod || 'OTP'}</p>{contract.finalFileUrl && <a href={contract.finalFileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><FileSignature size={16} />Mở bản hợp đồng hoàn tất</a>}</div>
          {canEdit && <button disabled={busy} onClick={() => simpleAction('activate', 'Đã kích hoạt hợp đồng và chuyển ứng viên sang Nhân viên mới')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><ShieldCheck size={16} />Kích hoạt hợp đồng</button>}
        </div>
      )}

      {contract.status === 'ACTIVE' && (
        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5"><h3 className="flex items-center gap-2 font-bold text-green-950"><CheckCircle2 size={20} />Hợp đồng hoàn tất và đang hiệu lực</h3><p className="mt-1 text-sm text-green-800">Kích hoạt lúc {formatTime(contract.activatedAt)}. Hồ sơ PRE_BOARDING đã được chuyển sang mục Nhân viên mới; tài khoản chỉ được kích hoạt khi HR xác nhận người lao động thực tế đi làm.</p>{contract.finalFileUrl && <a href={contract.finalFileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-green-700"><FileSignature size={16} />Xem bản hợp đồng bất biến</a>}</div>
      )}

      <ContractLifecyclePanel contract={contract} canEdit={canEdit} canApprove={canReviewLegal} onChanged={load} />

      {contract.missingFields?.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Còn thiếu dữ liệu pháp lý:</b> {contract.missingFields.join(', ')}</div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <div className="space-y-5">
          {FIELD_GROUPS.map(([title, fields]) => (
            <div key={title} className="rounded-xl border border-slate-200 p-4">
              <h3 className="font-bold text-slate-900">{title}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{fields.map(([path, label, type]) => <Field key={path} path={path} label={label} type={type} data={data} disabled={!editable} onChange={(key, value) => setData(current => deepSet(current, key, value))} />)}</div>
            </div>
          ))}

          <label className="block text-sm font-semibold text-slate-700">Điều khoản bổ sung<textarea disabled={!editable} value={data.additionalTerms || ''} onChange={event => setData(current => ({ ...current, additionalTerms: event.target.value }))} className="mt-1.5 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100" /></label>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-slate-900"><BookOpen size={18} className="text-blue-600" />Thư viện điều khoản</h3>{canEdit && <button onClick={() => setShowLibrary(value => !value)} className="text-sm font-bold text-blue-600">{showLibrary ? 'Đóng' : 'Thêm điều khoản'}</button>}</div>
            <div className="mt-3 space-y-2">{clauses.map(clause => (
              <label key={clause.id} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                <input type="checkbox" className="mt-1" disabled={!editable || clause.requiredClause} checked={clause.requiredClause || selectedClauseIds.includes(clause.id)} onChange={event => setSelectedClauseIds(current => event.target.checked ? [...current, clause.id] : current.filter(id => id !== clause.id))} />
                <span><b>{clause.title}</b> <span className="text-xs text-slate-500">v{clause.versionNumber} · {clause.category}{clause.requiredClause ? ' · Bắt buộc' : ''}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{clause.content}</span></span>
              </label>
            ))}</div>
            {showLibrary && <div className="mt-4 grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2">
              <input placeholder="Mã điều khoản" value={newClause.code} onChange={e => setNewClause({ ...newClause, code: e.target.value })} className="rounded-lg border p-2.5 text-sm" />
              <input placeholder="Nhóm" value={newClause.category} onChange={e => setNewClause({ ...newClause, category: e.target.value })} className="rounded-lg border p-2.5 text-sm" />
              <input placeholder="Tên điều khoản" value={newClause.title} onChange={e => setNewClause({ ...newClause, title: e.target.value })} className="rounded-lg border p-2.5 text-sm sm:col-span-2" />
              <textarea placeholder="Nội dung" value={newClause.content} onChange={e => setNewClause({ ...newClause, content: e.target.value })} className="min-h-24 rounded-lg border p-2.5 text-sm sm:col-span-2" />
              <label className="text-sm"><input type="checkbox" checked={newClause.requiredClause} onChange={e => setNewClause({ ...newClause, requiredClause: e.target.checked })} /> Điều khoản bắt buộc</label>
              <button onClick={createClause} disabled={busy} className="justify-self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Plus size={15} className="mr-1 inline" />Tạo phiên bản</button>
            </div>}
          </div>

          <div className="flex flex-wrap gap-2">
            {editable && <button disabled={busy} onClick={generate} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><RefreshCw size={16} />Lưu và sinh hợp đồng</button>}
            {editable && <button disabled={busy} onClick={() => simpleAction('submit-legal', 'Đã gửi pháp chế rà soát')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"><Send size={16} />Gửi pháp chế</button>}
          </div>

          {contract.status === 'ISSUED' && canEdit && <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><h3 className="flex items-center gap-2 font-bold text-violet-950"><UploadCloud size={18} />Upload PDF phía công ty đã ký</h3><p className="mt-1 text-xs text-violet-700">PDF tối đa 5MB; hệ thống lưu bản gốc bất biến, URL, tên file, SHA-256 và người upload. Đây chưa phải bản đủ chữ ký hai bên.</p><div className="mt-3 flex flex-wrap gap-2"><input type="file" accept="application/pdf,.pdf" onChange={e => setSignedFile(e.target.files?.[0] || null)} className="min-w-0 flex-1 rounded-lg bg-white p-2 text-sm" /><button disabled={busy || !signedFile} onClick={uploadSigned} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Lưu bản công ty ký</button></div></div>}
        </div>

        <div className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <div className="flex items-center justify-between border-b bg-white px-4 py-3"><b className="text-sm text-slate-800">Bản xem trước hợp đồng</b><button onClick={() => { const win = window.open('', '_blank'); win.document.write(contract.generatedHtml || ''); win.document.close(); win.print(); }} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600"><Printer size={15} />In / lưu PDF</button></div>
            <iframe title="Bản xem trước hợp đồng" srcDoc={contract.generatedHtml || '<p>Chưa sinh nội dung hợp đồng.</p>'} className="h-[650px] w-full bg-white" />
          </div>
          <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-bold text-slate-900"><History size={17} className="text-blue-600" />Nhật ký hợp đồng</h3><div className="mt-3 space-y-3">{(contract.events || []).slice().reverse().map((event, index) => <div key={`${event.occurredAt}-${index}`} className="border-l-2 border-blue-200 pl-3"><p className="text-sm font-bold text-slate-800">{event.eventType}</p><p className="text-xs text-slate-500">{event.fromStatus || 'Khởi tạo'} → {event.toStatus} · {formatTime(event.occurredAt)}</p>{event.comment && <p className="mt-1 text-xs text-slate-600">{event.comment}</p>}</div>)}</div></div>
        </div>
      </div>
    </section>
  );
}
