import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Download, ArrowRight, Building2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DataTable, Dialog, Field, Select, Status, buttonClass, primaryClass, inputClass } from './SalesComponents';
import { SalesFormFields } from './SalesForms';
import { ContractDetail } from './SalesContracts';
import { SalesPolicyPanel, QuoteRoutingDetail } from './SalesPricingPanels';
import { labels, money, dateText, approvalLabels } from './salesUtils';

const emptyData = { customers: [], opportunities: [], activities: [], products: [], quotations: [], contracts: [], handovers: [] };
const tabLabels = { overview: 'Tổng quan', customers: 'Khách hàng', opportunities: 'Cơ hội', activities: 'Chăm sóc', products: 'Sản phẩm & dịch vụ', quotations: 'Báo giá', contracts: 'Hợp đồng', handovers: 'Bàn giao', policy: 'Chính sách giá', technical: 'Thẩm định Kỹ thuật' };
const formTitles = { customer: 'Khách hàng', contact: 'Người liên hệ', opportunity: 'Cơ hội bán hàng', activity: 'Lịch chăm sóc', product: 'Sản phẩm / dịch vụ', quotation: 'Lập phiên bản báo giá', contract: 'Nháp hợp đồng', handover: 'Bàn giao hợp đồng' };

export default function SalesPage() {
  const { userId } = useAuth();
  const [params, setParams] = useSearchParams();
  const [context, setContext] = useState(null);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [customerDetail, setCustomerDetail] = useState(null);
  const [quoteDetail, setQuoteDetail] = useState(null);
  const [contractDetail, setContractDetail] = useState(null);
  const [pipeline, setPipeline] = useState(false);
  const [month, setMonth] = useState('');
  const [owner, setOwner] = useState('');
  const tab = params.get('tab') || (context?.sales ? 'overview' : context?.technicalReviewer ? 'technical' : 'handovers');

  const refresh = useCallback(async () => {
    const capabilities = (await api.get('/api/sales/context')).data.data;
    const resources = capabilities.sales ? Object.keys(emptyData) : ['handovers'];
    const results = await Promise.all(resources.map(resource => api.get(`/api/sales/${resource}`)));
    const loaded = { ...emptyData };
    resources.forEach((resource, index) => { loaded[resource] = results[index].data.data; });
    const extra = await Promise.all([
      capabilities.sales ? api.get('/api/sales/pricing-policy') : null,
      capabilities.ceo ? api.get('/api/sales/pricing-delegates') : null,
      capabilities.technicalReviewer ? api.get('/api/sales/technical-reviews') : null,
    ]);
    loaded.policy = extra[0]?.data.data;
    loaded.delegates = extra[1]?.data.data || [];
    loaded.technicalReviews = extra[2]?.data.data || [];
    setContext(capabilities);
    setData(loaded);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try { await refresh(); }
    catch (failure) { setError(failure.response?.data?.message || 'Không thể tải dữ liệu Kinh doanh. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }, [refresh]);

  useEffect(() => { reload(); }, [reload, userId]);

  const closeModal = () => { setModal(null); setFormError(''); };
  const open = (type, values = {}, extra = {}) => {
    setFormError('');
    setForm(values);
    setModal({ type, ...extra });
  };
  const customerForm = row => open('customer', {
    id: row?.id, name: row?.name || '', taxCode: row?.tax_code || '', email: row?.email || '', phone: row?.phone || '',
    address: row?.address || '', source: row?.source || '', notes: row?.notes || '',
    ownerId: row?.owner_id || context.owners.find(person => person.id === userId)?.id || '', active: row ? !!row.active : true, version: row?.version || 0,
  });
  const opportunityForm = row => open('opportunity', {
    id: row?.id, customerId: row?.customer_id || '', title: row?.title || '', requirements: row?.requirements || '',
    expectedValue: row?.expected_value ?? '', expectedClose: row?.expected_close || '', version: row?.version || 0,
  });
  const productForm = row => open('product', {
    id: row?.id, name: row?.name || '', unit: row?.unit || '', unitPrice: row?.unit_price ?? '', active: row ? !!row.active : true, version: row?.version || 0,
    floorPrice: row?.floor_price ?? '', standardPackage: !!row?.standard_package, standardScope: row?.standard_scope || '',
  });
  const quoteForm = async row => {
    try {
      const detail = row ? (await api.get(`/api/sales/quotations/${row.id}`)).data.data : null;
      open('quotation', {
        opportunityId: row?.opportunity_id || '', validUntil: '', discountAmount: row?.discount_amount || 0, terms: row?.terms || data.policy?.standard_terms || '',
        customScope: !!row?.custom_scope, newTechnology: !!row?.new_technology, resourceException: !!row?.resource_exception,
        exclusiveRights: !!row?.exclusive_rights, strategicException: !!row?.strategic_exception, exceptionNote: row?.exception_note || '',
        technicalDepartmentId: row?.technical_department_id || (context.technicalDepartments?.length === 1 ? context.technicalDepartments[0].id : ''),
        lines: detail ? detail.lines.map(line => ({ productId: line.product_id, description: line.description, quantity: line.quantity, unitPrice: line.unit_price })) : [{ productId: '', description: '', quantity: 1, unitPrice: '' }],
      });
    } catch (failure) { setError(failure.response?.data?.message || 'Không tải được phiên bản báo giá.'); }
  };

  const contractForm = row => open('contract', {
    id: row?.id, quotationId: row?.quotation_id || '', endDate: row?.end_date || '', signer: row?.signer || '',
    implementationNotes: row?.implementation_notes || '', version: row?.version || 0,
  }, { title: row ? `Sửa nháp · ${row.contract_number}` : 'Lập nháp hợp đồng' });
  const inspectContract = async row => {
    try { setContractDetail((await api.get(`/api/sales/contracts/${row.id}`)).data.data); }
    catch (failure) { setError(failure.response?.data?.message || 'Không mở được hồ sơ hợp đồng.'); }
  };

  const transition = (resource, row, action, title, noteRequired = false, description = '') => open('transition', {
    action, version: row.version, note: '', noteRequired, description,
  }, { title, endpoint: `/${resource}/${row.id}/transition` });

  const run = async (operation, success, onSuccess) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setFormError('');
    setError('');
    try {
      await operation();
      setNotice(success);
      onSuccess?.();
      try { await refresh(); }
      catch { setError('Đã lưu thay đổi, nhưng chưa tải lại được danh sách. Bấm Làm mới để cập nhật.'); }
    } catch (failure) {
      const message = failure.response?.data?.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.';
      if (modal) setFormError(message); else setError(message);
    } finally { mutationLock.current = false; setBusy(false); }
  };

  const submit = event => {
    event.preventDefault();
    const payload = { ...form };
    let endpoint;
    let method = 'post';
    switch (modal.type) {
      case 'customer': endpoint = `/customers${form.id ? `/${form.id}` : ''}`; method = form.id ? 'put' : 'post'; break;
      case 'contact': endpoint = `/customers/${modal.customerId}/contacts${form.id ? `/${form.id}` : ''}`; method = form.id ? 'put' : 'post'; break;
      case 'opportunity': endpoint = `/opportunities${form.id ? `/${form.id}` : ''}`; method = form.id ? 'put' : 'post'; break;
      case 'activity': endpoint = '/activities'; payload.opportunityId = form.opportunityId || null; break;
      case 'product': endpoint = `/products${form.id ? `/${form.id}` : ''}`; method = form.id ? 'put' : 'post'; break;
      case 'quotation': endpoint = '/quotations'; payload.technicalDepartmentId = form.technicalDepartmentId || null; break;
      case 'policy': endpoint = '/pricing-policy'; payload.ceoDelegateId = form.ceoDelegateId || null; break;
      case 'technicalReview': endpoint = `/quotations/${modal.quoteId}/technical-review`; break;
      case 'contract': endpoint = `/contracts${form.id ? `/${form.id}` : ''}`; method = form.id ? 'put' : 'post'; break;
      case 'signedContract': endpoint = `/contracts/${modal.contractId}/signed-copy`; break;
      case 'contractConfirm': endpoint = `/contracts/${modal.contractId}/transition`; break;
      case 'handover': endpoint = `/contracts/${modal.contractId}/handovers`; break;
      case 'transition': endpoint = modal.endpoint; break;
      default: return;
    }
    run(() => api[method](`/api/sales${endpoint}`, payload), 'Đã lưu thay đổi.', () => { closeModal(); setCustomerDetail(null); setContractDetail(null); });
  };

  const inspectCustomer = async row => {
    try { setCustomerDetail((await api.get(`/api/sales/customers/${row.id}`)).data.data); }
    catch (failure) { setError(failure.response?.data?.message || 'Không thể mở hồ sơ khách hàng.'); }
  };
  const inspectQuote = async row => {
    try { setQuoteDetail((await api.get(`/api/sales/quotations/${row.id}`)).data.data); }
    catch (failure) { setError(failure.response?.data?.message || 'Không thể mở báo giá.'); }
  };
  const download = async row => {
    try {
      const response = await api.get(`/api/sales/quotations/${row.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a'); link.href = url; link.download = `Bao-gia-${row.id}-v${row.revision}.pdf`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Không thể tải PDF báo giá. Vui lòng thử lại.'); }
  };
  const actionButton = (title, onClick) => <button type="button" disabled={busy} onClick={onClick} className={buttonClass}>{title}</button>;
  const actions = children => <div className="flex flex-wrap gap-2">{children}</div>;
  const customerColumn = { key: 'customer_name', label: 'Khách hàng' };
  const ownerColumn = { key: 'owner_name', label: 'Phụ trách' };
  const stateColumn = { key: 'status', label: 'Trạng thái', render: row => <Status value={row.status} /> };
  const valueColumn = key => ({ key, label: 'Giá trị (VND)', render: row => money(row[key]) });
  const dateColumn = (key, label) => ({ key, label, render: row => dateText(row[key]) });
  const confirmedContracts = data.contracts.filter(row => row.status === 'CONFIRMED');
  const selectedOwner = context?.manager ? owner : '';
  const filteredOpportunities = data.opportunities.filter(row => !selectedOwner || row.owner_id === Number(selectedOwner));
  const periodContracts = confirmedContracts.filter(row => (!month || row.signed_date?.startsWith(month)) && (!selectedOwner || row.owner_id === Number(selectedOwner)));
  const overdue = data.activities.filter(row => !row.completed_at && new Date(row.due_at) < new Date());

  if (loading) return <div className="p-6" aria-busy="true"><p className="mb-6 text-slate-600">Đang tải không gian Kinh doanh…</p>{[1, 2, 3].map(item => <div key={item} className="mb-3 h-16 animate-pulse rounded-lg bg-slate-200" />)}</div>;
  if (!context) return <div className="p-8"><p role="alert" className="mb-4 text-rose-700">{error}</p><button className={buttonClass} onClick={reload}>Thử lại</button></div>;
  const visibleTabs = context.sales ? Object.keys(tabLabels).filter(key => key !== 'technical') : context.technicalReviewer ? ['technical', 'handovers'] : ['handovers'];
  const currentTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];

  return <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{context.sales ? 'Phòng Kinh doanh' : context.technicalReviewer ? 'Thẩm định & bàn giao Kỹ thuật' : 'Tiếp nhận bàn giao'}</h1><p className="mt-1 text-sm text-slate-600">{context.sales ? 'Khách hàng, cơ hội và giao dịch trong một luồng làm việc.' : 'Xác nhận hợp đồng và yêu cầu từ phòng Kinh doanh.'}</p></div>
      <button onClick={reload} disabled={busy} className={buttonClass}><RefreshCw size={16} />Làm mới</button>
    </div>
    <nav aria-label="Nghiệp vụ Kinh doanh" className="flex gap-5 overflow-x-auto border-b border-slate-200">{visibleTabs.map(item => <button key={item} onClick={() => setParams({ tab: item })} className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold ${currentTab === item ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-blue-700'}`}>{tabLabels[item]}</button>)}</nav>
    {notice && <div role="status" className="flex justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}<button onClick={() => setNotice('')} className="font-semibold">Đóng</button></div>}
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}

    {currentTab === 'overview' && <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Khách hàng hoạt động', data.customers.filter(row => row.active).length],
        ['Cơ hội đang theo dõi', data.opportunities.filter(row => !['WON', 'LOST'].includes(row.stage)).length],
        ['Chăm sóc quá hạn', overdue.length],
        ['Báo giá chờ duyệt', data.quotations.filter(row => row.status === 'PENDING_APPROVAL').length],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{value}</p></div>)}</div>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-slate-900">{context.manager ? 'Kết quả kinh doanh' : 'Kết quả kinh doanh của tôi'}</h2>
        {!context.manager && <p className="text-sm text-slate-600">Bạn chỉ xem kết quả từ các khách hàng được phân công cho mình.</p>}
        <div className={`grid gap-4 ${context.manager ? 'sm:grid-cols-2' : 'sm:max-w-md'}`}><Field label="Kỳ ký hợp đồng"><input type="month" value={month} onChange={event => setMonth(event.target.value)} className={inputClass} /></Field>{context.manager && <Field label="Người phụ trách"><Select value={owner} onChange={event => setOwner(event.target.value)} options={context.owners.map(person => ({ value: person.id, label: person.ho_ten }))} /></Field>}</div>
        <div className="grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
          <div><p className="text-sm text-slate-600">Giá trị hợp đồng đã ký</p><p className="mt-1 text-xl font-bold text-blue-800">{money(periodContracts.reduce((sum, row) => sum + Number(row.total_amount), 0))}</p></div>
          <div><p className="text-sm text-slate-600">Số hợp đồng trong kỳ</p><p className="mt-1 text-xl font-bold">{periodContracts.length}</p></div>
          <div><p className="text-sm text-slate-600">Tỷ lệ chốt cơ hội đã kết thúc · mọi kỳ</p><p className="mt-1 text-xl font-bold">{(() => { const closed = filteredOpportunities.filter(row => ['WON', 'LOST'].includes(row.stage)); return closed.length ? `${Math.round(closed.filter(row => row.stage === 'WON').length / closed.length * 100)}%` : '—'; })()}</p></div>
        </div>
        <DataTable rows={periodContracts} columns={[{ key: 'contract_number', label: 'Hợp đồng' }, customerColumn, valueColumn('total_amount'), dateColumn('signed_date', 'Ngày ký'), ownerColumn]} empty="Chưa có hợp đồng trong kỳ đã chọn." />
      </section>
      <section className="space-y-4"><h2 className="font-bold text-slate-900">Hợp đồng cần theo dõi gia hạn</h2><p className="text-sm text-slate-600">Lập lịch chăm sóc theo ngày kết thúc và điều khoản đã ký.</p><DataTable rows={[...confirmedContracts].sort((a, b) => a.end_date.localeCompare(b.end_date))} columns={[{ key: 'contract_number', label: 'Hợp đồng' }, customerColumn, dateColumn('end_date', 'Ngày kết thúc / gia hạn'), { key: 'action', label: 'Chăm sóc', render: row => actionButton('Lập lịch', () => open('activity', { customerId: row.customer_id, subject: `Theo dõi gia hạn ${row.contract_number}`, dueAt: `${row.end_date}T09:00`, opportunityId: '', notes: '' })) }]} /></section>
    </div>}

    {currentTab === 'customers' && <section className="space-y-4">
      <Toolbar title="Khách hàng & đầu mối" onAdd={() => customerForm()} />
      <DataTable rows={data.customers} columns={[{ key: 'name', label: 'Khách hàng', render: row => <button className="text-left font-semibold text-blue-800 hover:underline" onClick={() => inspectCustomer(row)}>{row.name}</button> }, { key: 'tax_code', label: 'Mã số thuế' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Điện thoại' }, ownerColumn, { key: 'active', label: 'Tình trạng', render: row => row.active ? 'Hoạt động' : 'Ngừng hoạt động' }, { key: 'action', label: 'Thao tác', render: row => actionButton('Chỉnh sửa', () => customerForm(row)) }]} />
    </section>}

    {currentTab === 'opportunities' && <section className="space-y-4">
      <Toolbar title="Cơ hội bán hàng" onAdd={() => opportunityForm()} extra={actionButton(pipeline ? 'Dạng bảng' : 'Theo giai đoạn', () => setPipeline(!pipeline))} />
      {pipeline && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map(stage => <div key={stage} className="rounded-xl border border-slate-200 bg-white p-4"><Status value={stage} /><p className="mt-3 text-2xl font-bold">{data.opportunities.filter(row => row.stage === stage).length}</p><ul className="mt-3 divide-y divide-slate-100">{data.opportunities.filter(row => row.stage === stage).map(row => <li key={row.id} className="py-2 text-sm"><b>{row.title}</b><p className="text-slate-600">{row.customer_name}</p></li>)}</ul></div>)}</div>}
      <DataTable rows={data.opportunities} columns={[{ key: 'title', label: 'Cơ hội' }, customerColumn, valueColumn('expected_value'), dateColumn('expected_close', 'Dự kiến chốt'), { key: 'stage', label: 'Giai đoạn', render: row => <><Status value={row.stage} />{row.loss_reason && <p className="mt-1 text-xs text-slate-600">{row.loss_reason}</p>}</> }, ownerColumn, { key: 'action', label: 'Thao tác', render: row => !['WON', 'LOST'].includes(row.stage) && actions(<>
        {actionButton('Sửa', () => opportunityForm(row))}
        {{ NEW: 'QUALIFIED', QUALIFIED: 'PROPOSAL', PROPOSAL: 'NEGOTIATION' }[row.stage] && actionButton('Chuyển bước', () => transition('opportunities', row, { NEW: 'QUALIFIED', QUALIFIED: 'PROPOSAL', PROPOSAL: 'NEGOTIATION' }[row.stage], 'Chuyển giai đoạn', false, `Chuyển sang ${labels[{ NEW: 'QUALIFIED', QUALIFIED: 'PROPOSAL', PROPOSAL: 'NEGOTIATION' }[row.stage]]}.`))}
        {actionButton('Thất bại', () => transition('opportunities', row, 'LOST', 'Đóng cơ hội thất bại', true))}
      </>) }]} />
    </section>}

    {currentTab === 'activities' && <section className="space-y-4">
      <Toolbar title="Lịch chăm sóc & công việc" onAdd={() => open('activity', { customerId: '', opportunityId: '', subject: '', notes: '', dueAt: '' })} />
      <DataTable rows={data.activities} columns={[{ key: 'subject', label: 'Công việc', render: row => <><b>{row.subject}</b><p className="mt-1 whitespace-pre-wrap text-slate-600">{row.notes}</p></> }, customerColumn, dateColumn('due_at', 'Thời hạn'), ownerColumn, { key: 'state', label: 'Tình trạng', render: row => row.completed_at ? 'Đã hoàn tất' : new Date(row.due_at) < new Date() ? <span className="font-semibold text-rose-700">Quá hạn</span> : 'Sắp tới' }, { key: 'action', label: 'Thao tác', render: row => !row.completed_at && actionButton('Hoàn tất', () => run(() => api.post(`/api/sales/activities/${row.id}/complete`), 'Đã hoàn tất công việc.')) }]} />
    </section>}

    {currentTab === 'products' && <section className="space-y-4">
      <Toolbar title="Danh mục sản phẩm & dịch vụ" onAdd={context.director ? () => productForm() : null} />
      <p className="text-sm text-slate-600">Giám đốc Kinh doanh / CEO quản lý giá niêm yết, giá sàn và phạm vi gói chuẩn.</p>
      <DataTable rows={data.products} columns={[{ key: 'name', label: 'Sản phẩm / dịch vụ' }, { key: 'unit', label: 'Đơn vị' }, valueColumn('unit_price'), { key: 'floor_price', label: 'Giá sàn', render: row => money(row.floor_price) }, { key: 'standard_scope', label: 'Phạm vi chuẩn', render: row => <><p>{row.standard_scope}</p><p className="mt-1 text-blue-800">{row.standard_package ? 'Gói chuẩn' : 'Cần thẩm định Kỹ thuật'}</p></> }, { key: 'active', label: 'Tình trạng', render: row => row.active ? 'Đang cung cấp' : 'Ngừng cung cấp' }, { key: 'action', label: 'Thao tác', render: row => context.director && actionButton('Chỉnh sửa', () => productForm(row)) }]} />
    </section>}

    {currentTab === 'quotations' && <section className="space-y-4">
      <Toolbar title="Báo giá theo phiên bản" onAdd={() => quoteForm()} />
      {!data.policy?.enabled && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">CEO cần công bố hạn mức tại Chính sách giá trước khi trình báo giá mới. Bạn vẫn có thể lưu nháp; báo giá đã duyệt tiếp tục xử lý.</p>}
      <DataTable rows={data.quotations} columns={[{ key: 'revision', label: 'Báo giá', render: row => <button className="font-semibold text-blue-800 hover:underline" onClick={() => inspectQuote(row)}>#{row.id} · v{row.revision}</button> }, customerColumn, { key: 'opportunity_title', label: 'Cơ hội' }, valueColumn('total_amount'), dateColumn('valid_until', 'Hiệu lực đến'), { key: 'approval_level', label: 'Cấp duyệt', render: row => <><p>{approvalLabels[row.approval_level] || 'Chưa xác định'}</p><p className="mt-1 text-xs text-slate-500">{row.routing_reasons}</p></> }, stateColumn, { key: 'action', label: 'Thao tác', render: row => actions(<>
        <button className={buttonClass} onClick={() => download(row)} aria-label={`Tải PDF báo giá ${row.id}`}><Download size={16} />PDF</button>
        {row.status === 'DRAFT' && <>{actionButton('Xác định tuyến duyệt', () => transition('quotations', row, 'SUBMIT', 'Kiểm tra chính sách và chuyển duyệt', false, 'Gói chuẩn đủ điều kiện được hệ thống xác nhận ngay; các trường hợp khác chuyển Kỹ thuật hoặc cấp duyệt tương ứng.'))}{actionButton('Gửi trực tiếp theo giá chuẩn', () => transition('quotations', row, 'SEND', 'Ghi nhận gửi báo giá chuẩn', false, 'Chỉ thành công khi hệ thống xác nhận đúng chính sách chuẩn. Xác nhận bạn đã chuyển đúng phiên bản này cho khách hàng.'))}</>}
        {row.can_approve && row.status === 'PENDING_APPROVAL' && <>{actionButton('Duyệt', () => transition('quotations', row, 'APPROVE', 'Duyệt báo giá', false, row.routing_reasons))}{actionButton('Trả về', () => transition('quotations', row, 'RETURN', 'Trả về báo giá', true))}</>}
        {row.status === 'APPROVED' && actionButton('Ghi nhận đã gửi', () => transition('quotations', row, 'SEND', 'Ghi nhận gửi báo giá', false, 'Xác nhận bạn đã chuyển đúng bản báo giá này cho khách hàng qua kênh trao đổi đã thống nhất.'))}
        {row.status === 'SENT' && <>{actionButton('Chấp thuận', () => transition('quotations', row, 'ACCEPT', 'Khách hàng chấp thuận', true, 'Ghi ngày, kênh trao đổi và căn cứ xác nhận của khách hàng.'))}{actionButton('Từ chối', () => transition('quotations', row, 'DECLINE', 'Khách hàng từ chối'))}</>}
        {row.status !== 'ACCEPTED' && actionButton('Tạo phiên bản', () => quoteForm(row))}
      </>) }]} />
    </section>}

    {currentTab === 'contracts' && <section className="space-y-4">
      <Toolbar title="Hợp đồng thương mại" extra={<button className={primaryClass} onClick={() => contractForm()}>Lập nháp hợp đồng</button>} />
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Nháp → Rà soát → Sẵn sàng ký → Nộp bản ký → Quản lý đối chiếu → Bàn giao. Chỉ hợp đồng đã xác nhận bản ký được tính vào kết quả kinh doanh.</p>
      <DataTable rows={data.contracts} columns={[
        { key: 'contract_number', label: 'Hợp đồng', render: row => <button className="text-left font-semibold text-blue-800 hover:underline" onClick={() => inspectContract(row)}>{row.contract_number}</button> },
        customerColumn, valueColumn('total_amount'), stateColumn, dateColumn('signed_date', 'Ngày ký đã xác nhận'), dateColumn('end_date', 'Kết thúc'), ownerColumn,
        { key: 'action', label: 'Thao tác', render: row => actions(<>
          {row.can_edit && <>{actionButton('Sửa nháp', () => contractForm(row))}{actionButton('Gửi rà soát', () => transition('contracts', row, 'SUBMIT', 'Gửi hợp đồng rà soát'))}</>}
          {row.can_review && <>{actionButton('Thông qua để ký', () => transition('contracts', row, 'APPROVE', 'Rà soát hợp đồng', false, 'Đối chiếu phạm vi, giá trị, tiến độ và điều khoản với báo giá đã chấp thuận trước khi cho phép ký.'))}{actionButton('Trả về', () => transition('contracts', row, 'RETURN', 'Yêu cầu sửa hồ sơ hợp đồng', true))}</>}
          {row.can_submit_signed && actionButton('Nộp bản đã ký', () => open('signedContract', { version: row.version, signedDate: '', customerSigner: row.signer || '', companySigner: '', fileUrl: '' }, { contractId: row.id, title: `Nộp bản ký · ${row.contract_number}` }))}
          {row.can_confirm && <>{actionButton('Đối chiếu và xác nhận', () => open('contractConfirm', { action: 'CONFIRM', version: row.version, note: '', matchesApprovedContent: false, signerAuthorityConfirmed: false, signedCopyVerified: false, fileUrl: row.submitted_file_url, companySigner: row.company_signer, customerSigner: row.submitted_customer_signer }, { contractId: row.id, title: `Xác nhận bản ký · ${row.contract_number}` }))}{actionButton('Trả bản ký', () => transition('contracts', row, 'RETURN_SIGNED', 'Yêu cầu bổ sung bản ký', true))}</>}
          {row.can_revise_quote && actionButton('Cần đổi báo giá', () => transition('contracts', row, 'REQUEST_QUOTE_REVISION', 'Quay lại báo giá để duyệt thay đổi', true, 'Hủy nháp hợp đồng này và đánh dấu báo giá nguồn đã được thay thế. Sau đó tạo phiên bản báo giá mới, trình duyệt và ghi nhận khách chấp thuận lại. Lịch sử được giữ nguyên.'))}
          {row.status === 'CONFIRMED' && actionButton('Bàn giao', () => open('handover', { recipientDepartmentId: '' }, { contractId: row.id }))}
        </>) },
      ]} />
    </section>}

    {currentTab === 'policy' && <SalesPolicyPanel policy={data.policy} ceo={context.ceo} open={open} />}

    {currentTab === 'technical' && <section className="space-y-4">
      <Toolbar title="Báo giá được giao thẩm định Kỹ thuật" />
      <DataTable rows={data.technicalReviews || []} columns={[{ key: 'id', label: 'Báo giá', render: row => `#${row.id} · v${row.revision}` }, { key: 'opportunity_title', label: 'Dự án' }, dateColumn('valid_until', 'Hạn báo giá'), { key: 'scope', label: 'Phạm vi', render: row => <div className="space-y-2"><ul>{row.lines.map(line => <li key={line.id}>{line.description} · {line.quantity} {line.unit}</li>)}</ul><p>{row.exception_note}</p><p className="whitespace-pre-wrap">{row.terms}</p></div> }, { key: 'action', label: 'Thao tác', render: row => actionButton('Thẩm định', () => open('technicalReview', { version: row.version, approved: true, effortDays: '', feasibility: '', deliveryPlan: '', resourceNeeds: '', requiresExecutive: false, scopeSummary: row.lines.map(line => `${line.description} · ${line.quantity} ${line.unit}`).join('\n') }, { quoteId: row.id, title: `Thẩm định báo giá #${row.id}` })) }]} />
    </section>}

    {currentTab === 'handovers' && <section className="space-y-4">
      <Toolbar title={context.sales ? 'Theo dõi bàn giao' : 'Phiếu chờ tiếp nhận'} />
      <DataTable rows={data.handovers} columns={[{ key: 'contract_number', label: 'Hợp đồng' }, customerColumn, { key: 'recipient_name', label: 'Phòng nhận' }, valueColumn('total_amount'), stateColumn, { key: 'details', label: 'Thông tin bàn giao', render: row => <details><summary className="cursor-pointer font-semibold text-blue-800">Mở hồ sơ</summary><div className="mt-2 space-y-2 whitespace-pre-wrap"><p>{row.customer_email} · {row.customer_phone}</p><p><b>Phạm vi</b><br />{row.scope}</p><p><b>Nghiệm thu</b><br />{row.milestones}</p><p><b>Thanh toán</b><br />{row.payment_terms}</p><p><b>Phản hồi</b><br />{row.response_note || 'Chưa có'}</p><a href={row.file_url} target="_blank" rel="noreferrer" className="text-blue-800 underline">Mở hợp đồng đã ký</a></div></details> }, { key: 'action', label: 'Thao tác', render: row => actions(<>
        {!context.sales && row.status === 'PENDING' && <>{actionButton('Tiếp nhận', () => transition('handovers', row, 'ACCEPT', 'Tiếp nhận bàn giao'))}{actionButton('Yêu cầu bổ sung', () => transition('handovers', row, 'RETURN', 'Yêu cầu bổ sung', true))}</>}
        {context.sales && row.status === 'RETURNED' && actionButton('Gửi lại', () => transition('handovers', row, 'RESUBMIT', 'Giải trình và gửi lại bàn giao', true))}
      </>) }]} />
    </section>}

    {customerDetail && !modal && <Dialog title={customerDetail.customer.name} onClose={() => setCustomerDetail(null)}>
      <div className="space-y-5">
        <div className="grid gap-3 text-sm sm:grid-cols-2"><p>Email · {customerDetail.customer.email || '—'}</p><p>Điện thoại · {customerDetail.customer.phone || '—'}</p><p>Địa chỉ · {customerDetail.customer.address || '—'}</p><p>Nguồn · {customerDetail.customer.source || '—'}</p></div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{customerDetail.customer.notes}</p>
        <Toolbar title="Người liên hệ" onAdd={() => open('contact', { name: '', jobTitle: '', email: '', phone: '' }, { customerId: customerDetail.customer.id })} />
        <DataTable rows={customerDetail.contacts} columns={[{ key: 'name', label: 'Họ tên' }, { key: 'job_title', label: 'Chức vụ' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Điện thoại' }, { key: 'action', label: 'Thao tác', render: row => actionButton('Sửa', () => open('contact', { id: row.id, name: row.name, jobTitle: row.job_title || '', email: row.email || '', phone: row.phone || '' }, { customerId: customerDetail.customer.id })) }]} />
        <h3 className="font-bold">Lịch sử làm việc</h3>
        <ol className="space-y-3 border-l-2 border-blue-100 pl-4">{customerDetail.events.map(event => <li key={event.id} className="text-sm"><p className="font-semibold">{event.entity_type} · {event.action}</p><p className="text-slate-600">{event.actor_name} · {dateText(event.created_at)}</p><p>{event.details}</p></li>)}</ol>
      </div>
    </Dialog>}

    {contractDetail && !modal && <Dialog title={contractDetail.contract.contract_number} onClose={() => setContractDetail(null)}><ContractDetail detail={contractDetail} /></Dialog>}

    {quoteDetail && <Dialog title={`Báo giá #${quoteDetail.quotation.id} · phiên bản ${quoteDetail.quotation.revision}`} onClose={() => setQuoteDetail(null)}>
      <div className="mb-4"><QuoteRoutingDetail detail={quoteDetail} /></div>
      <div className="space-y-4"><Status value={quoteDetail.quotation.status} /><DataTable rows={quoteDetail.lines} columns={[{ key: 'description', label: 'Hạng mục' }, { key: 'quantity', label: 'Số lượng' }, { key: 'unit', label: 'Đơn vị' }, valueColumn('unit_price')]} /><p>Giảm giá · {money(quoteDetail.quotation.discount_amount)}</p><p className="text-lg font-bold text-blue-800">Tổng thanh toán · {money(quoteDetail.quotation.total_amount)}</p><p className="whitespace-pre-wrap text-sm">{quoteDetail.quotation.terms}</p>{quoteDetail.quotation.decision_note && <p className="rounded-lg bg-blue-50 p-3 text-sm">Ghi chú · {quoteDetail.quotation.decision_note}</p>}</div>
    </Dialog>}

    {modal && <Dialog title={modal.title || `${form.id ? 'Chỉnh sửa' : 'Thêm'} ${formTitles[modal.type]}`} busy={busy} onClose={closeModal}>
      <form onSubmit={submit} className="space-y-5">
        <SalesFormFields type={modal.type} form={form} setForm={setForm} data={data} context={context} />
        {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{formError}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" className={buttonClass} disabled={busy} onClick={closeModal}>Hủy</button><button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Đang lưu…' : 'Xác nhận'}<ArrowRight size={16} /></button></div>
      </form>
    </Dialog>}
  </div>;
}

function Toolbar({ title, onAdd, extra }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold text-slate-900"><Building2 size={18} className="text-blue-700" />{title}</h2><div className="flex gap-2">{extra}{onAdd && <button onClick={onAdd} className={primaryClass}><Plus size={16} />Thêm mới</button>}</div></div>;
}
