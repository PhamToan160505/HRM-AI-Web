import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Field, Select, Status, inputClass } from './SalesComponents';
import { money, dateText, labels } from './salesUtils';

export function ContractFields({ type, form, setForm, data }) {
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const field = (key, label, props = {}) => <Field label={label} value={form[key] || ''} onChange={event => change(key, event.target.value)} {...props} />;
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setQuote(null); setError('');
    if (type === 'contract' && form.quotationId) {
      api.get(`/api/sales/quotations/${form.quotationId}`).then(response => { if (active) setQuote(response.data.data); })
        .catch(() => { if (active) setError('Không tải được nội dung báo giá. Đóng và mở lại biểu mẫu để thử lại.'); });
    }
    return () => { active = false; };
  }, [type, form.quotationId]);

  if (type === 'contractConfirm') return <div className="space-y-4">
    <p className="text-sm text-slate-600">Đối chiếu bản ký với hồ sơ đã được rà soát trước khi xác nhận. Bước này mới ghi nhận cơ hội chốt thành công và cho phép bàn giao.</p>
    <a href={form.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-800 underline">Mở bản đã ký để đối chiếu</a>
    <p className="text-sm">Người ký phía công ty: {form.companySigner} · Khách hàng: {form.customerSigner}</p>
    {[
      ['matchesApprovedContent', 'Nội dung, giá trị, phạm vi và điều khoản khớp hồ sơ đã duyệt.'],
      ['signerAuthorityConfirmed', 'Đã kiểm tra thẩm quyền người ký của hai bên theo hồ sơ công ty.'],
      ['signedCopyVerified', 'Đã đối chiếu bản ký đầy đủ và đúng hợp đồng này.'],
    ].map(([key, label]) => <label key={key} className="flex items-start gap-3 text-sm"><input required type="checkbox" className="mt-1 accent-blue-700" checked={!!form[key]} onChange={event => change(key, event.target.checked)} />{label}</label>)}
    {field('note', 'Ghi chú đối chiếu', { maxLength: 1000 })}
  </div>;

  if (type === 'signedContract') return <div className="space-y-4">
    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Nộp bản đã ký để quản lý khác đối chiếu. Thao tác này ghi nhận hồ sơ ký bên ngoài hệ thống; không thực hiện ký điện tử.</p>
    {field('signedDate', 'Ngày ký thực tế', { required: true, type: 'date' })}
    {field('customerSigner', 'Người ký phía khách hàng theo bản ký', { required: true, maxLength: 150 })}
    {field('companySigner', 'Người ký phía công ty theo bản ký', { required: true, maxLength: 150 })}
    {field('fileUrl', 'Liên kết HTTPS đến bản hợp đồng đã ký', { required: true, type: 'url', maxLength: 1000 })}
    <p className="text-sm text-slate-600">Nhập tên người ký không cấp quyền ký. Người xác nhận hồ sơ phải kiểm tra thẩm quyền và nội dung bản ký.</p>
  </div>;

  return <div className="space-y-4">
    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Số hợp đồng được cấp tự động khi lưu. Giá trị, phạm vi và điều khoản lấy từ báo giá đã chấp thuận. Muốn đổi nội dung thương mại, cần quay lại báo giá để duyệt lại trước khi ký.</p>
    <Field label="Báo giá khách hàng đã chấp thuận"><Select required disabled={!!form.id} value={form.quotationId} onChange={event => change('quotationId', Number(event.target.value) || '')} options={data.quotations.filter(row => row.id === Number(form.quotationId) || row.status === 'ACCEPTED' && !data.contracts.some(contract => contract.quotation_id === row.id)).map(row => ({ value: row.id, label: `#${row.id} · ${row.customer_name} · ${money(row.total_amount)}` }))} /></Field>
    {!form.id && !data.quotations.some(row => row.status === 'ACCEPTED' && !data.contracts.some(contract => contract.quotation_id === row.id)) && <p className="text-sm text-blue-800">Chưa có báo giá đủ điều kiện lập hợp đồng. Hãy hoàn tất duyệt, gửi báo giá và ghi nhận khách hàng chấp thuận tại tab Báo giá trước.</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {form.quotationId && !quote && !error && <p aria-busy="true" className="text-sm text-slate-600">Đang tải nội dung báo giá…</p>}
    {quote && <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
      <p className="font-semibold text-blue-900">Giá trị cố định từ báo giá: {money(quote.quotation.total_amount)}</p>
      <div><b>Phạm vi</b><ul className="mt-1 space-y-1">{quote.lines.map(line => <li key={line.id}>{line.description} · {line.quantity} {line.unit}</li>)}</ul></div>
      <div><b>Điều khoản và thanh toán</b><p className="mt-1 whitespace-pre-wrap">{quote.quotation.terms}</p></div>
      {quote.reviews?.filter(review => review.approved).map(review => <div key={review.id}><b>Tiến độ đã thẩm định</b><p className="mt-1 whitespace-pre-wrap">{review.delivery_plan}</p></div>)}
    </div>}
    <div className="grid gap-4 sm:grid-cols-2">
      {field('signer', 'Người ký phía khách hàng dự kiến', { required: true, maxLength: 150 })}
      {field('endDate', 'Ngày kết thúc / gia hạn dự kiến', { required: true, type: 'date' })}
    </div>
    <Field label="Đầu mối và ghi chú phối hợp triển khai"><textarea rows={3} maxLength={5000} className={inputClass} value={form.implementationNotes || ''} onChange={event => change('implementationNotes', event.target.value)} /></Field>
    <p className="text-sm text-slate-600">Ghi chú phục vụ phối hợp, không bổ sung phạm vi, thay đổi giá hay điều khoản đã duyệt. Ngày ký và tệp bản ký sẽ được nộp sau khi quản lý rà soát.</p>
  </div>;
}

export function ContractDetail({ detail }) {
  const contract = detail.contract;
  return <div className="space-y-5 text-sm">
    <div className="flex flex-wrap items-center gap-3"><Status value={contract.status} /><b className="text-blue-900">{money(contract.total_amount)}</b><span>Báo giá #{contract.quotation_id}</span></div>
    {contract.legacy_record && <p className="rounded-lg bg-blue-50 p-3 text-blue-900">Hồ sơ lịch sử được ghi nhận trước quy trình mới; hệ thống không suy diễn người đã duyệt hoặc xác nhận.</p>}
    <p>Ngày ký: {dateText(contract.signed_date)} · Kết thúc / gia hạn: {dateText(contract.end_date)}</p>
    <div><b>Phạm vi đã chấp thuận</b><p className="mt-1 whitespace-pre-wrap">{contract.scope}</p></div>
    <div><b>Mốc triển khai / điều kiện theo báo giá và thẩm định</b><p className="mt-1 whitespace-pre-wrap">{contract.milestones}</p></div>
    <div><b>Điều khoản và thanh toán</b><p className="mt-1 whitespace-pre-wrap">{contract.payment_terms}</p></div>
    <p className="whitespace-pre-wrap">Ghi chú phối hợp: {contract.implementation_notes || '—'}</p>
    {contract.decision_note && <p className="rounded-lg bg-blue-50 p-3">Phản hồi: {contract.decision_note}</p>}
    {contract.file_url && <a href={contract.file_url} target="_blank" rel="noreferrer" className="block text-blue-800 underline">Mở bản ký đã được ghi nhận</a>}
    <h3 className="font-semibold">Các lần nộp bản ký</h3>
    {!detail.signatures.length && <p className="text-slate-500">Chưa có bản ký nộp qua quy trình mới.</p>}
    {detail.signatures.map(signature => <div key={signature.id} className="space-y-1 border-l-2 border-blue-200 pl-3"><p>{signature.submitter_name} · {dateText(signature.created_at)}</p><p>Ngày ký: {dateText(signature.signed_date)} · Công ty: {signature.company_signer} · Khách hàng: {signature.customer_signer}</p><a href={signature.file_url} target="_blank" rel="noreferrer" className="text-blue-800 underline">Mở bản ký lần #{signature.id}</a></div>)}
    <h3 className="font-semibold">Lịch sử hồ sơ</h3>
    <ol className="space-y-3">{detail.history.map(item => {
      let snapshot = {};
      try { snapshot = typeof item.snapshot === 'string' ? JSON.parse(item.snapshot) : item.snapshot; } catch { /* Display available audit metadata. */ }
      return <li key={item.id} className="border-l-2 border-slate-200 pl-3"><p className="font-medium">v{item.version} · {historyLabel(item.action)}</p><p className="text-slate-500">{item.actor_name} · {dateText(item.created_at)}</p><p>{item.note}</p><details className="mt-1"><summary className="cursor-pointer text-blue-800">Thông tin tại thời điểm này</summary><p>Trạng thái: {labels[snapshot?.status] || snapshot?.status} · Người ký dự kiến: {snapshot?.signer}</p><p>Kết thúc: {dateText(snapshot?.end_date)}</p><p className="whitespace-pre-wrap">Ghi chú: {snapshot?.implementation_notes || '—'}</p></details></li>;
    })}</ol>
  </div>;
}

function historyLabel(action) {
  if (action.includes('_TO_')) return action.split('_TO_').map(value => labels[value] || value).join(' → ');
  return { DRAFT_CREATED: 'Lập nháp', DRAFT_UPDATED: 'Cập nhật thông tin bổ sung', SIGNED_COPY_SUBMITTED: 'Nộp bản ký', LEGACY_IMPORTED: 'Chuyển hồ sơ lịch sử' }[action] || action;
}
