import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, Select, inputClass, buttonClass } from './SalesComponents';
import { money } from './salesUtils';
import { ContractFields } from './SalesContracts';

const options = (rows, label) => rows.map(row => ({ value: row.id, label: label(row) }));
const numberValue = value => value === '' ? '' : Number(value);

export function SalesFormFields({ type, form, setForm, data, context }) {
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const field = (key, label, attributes = {}) => <Field key={key} label={label} value={form[key] ?? ''} onChange={event => change(key, event.target.value)} {...attributes} />;
  const area = (key, label, required = true) => <Field label={label}><textarea required={required} maxLength={10000} rows={3} value={form[key] || ''} onChange={event => change(key, event.target.value)} className={inputClass} /></Field>;
  const check = (key, label) => <label className="flex items-start gap-3 text-sm text-slate-700"><input type="checkbox" className="mt-1 accent-blue-700" checked={!!form[key]} onChange={event => change(key, event.target.checked)} />{label}</label>;
  const select = (key, label, choices, required = true, disabled = false) => <Field label={label}><Select required={required} disabled={disabled} value={form[key] ?? ''} onChange={event => change(key, numberValue(event.target.value))} options={choices} /></Field>;
  const activeCustomers = data.customers.filter(row => row.active || row.id === Number(form.customerId));
  const openOpportunities = data.opportunities.filter(row => !['WON', 'LOST'].includes(row.stage));

  if (type === 'customer') return <div className="grid gap-4 sm:grid-cols-2">
    {field('name', 'Tên công ty / khách hàng', { required: true, maxLength: 200 })}
    {field('taxCode', 'Mã số thuế', { maxLength: 30 })}
    {field('email', 'Email', { type: 'email', maxLength: 150 })}
    {field('phone', 'Điện thoại', { maxLength: 30 })}
    {field('address', 'Địa chỉ', { maxLength: 500 })}
    {field('source', 'Nguồn tiếp cận', { maxLength: 150 })}
    {select('ownerId', 'Người phụ trách', options(context.owners, row => row.ho_ten), true, !context.manager)}
    <Field label="Tình trạng"><select className={inputClass} value={String(form.active)} onChange={event => change('active', event.target.value === 'true')}><option value="true">Hoạt động</option><option value="false">Ngừng hoạt động</option></select></Field>
    <div className="sm:col-span-2">{area('notes', 'Ghi chú', false)}</div>
  </div>;

  if (type === 'contact') return <div className="grid gap-4 sm:grid-cols-2">
    {field('name', 'Họ tên', { required: true, maxLength: 150 })}
    {field('jobTitle', 'Chức vụ', { maxLength: 150 })}
    {field('email', 'Email', { type: 'email', maxLength: 150 })}
    {field('phone', 'Điện thoại', { maxLength: 30 })}
  </div>;

  if (type === 'opportunity') return <div className="space-y-4">
    {select('customerId', 'Khách hàng', options(activeCustomers, row => row.name), true, !!form.id)}
    {field('title', 'Tên cơ hội', { required: true, maxLength: 200 })}
    {area('requirements', 'Nhu cầu và giải pháp dự kiến')}
    <div className="grid gap-4 sm:grid-cols-2">
      {field('expectedValue', 'Giá trị dự kiến (VND)', { required: true, type: 'number', min: 0, step: '0.01', max: '999999999999999' })}
      {field('expectedClose', 'Ngày dự kiến chốt', { required: true, type: 'date' })}
    </div>
  </div>;

  if (type === 'activity') return <div className="space-y-4">
    {select('customerId', 'Khách hàng', options(activeCustomers, row => row.name))}
    {select('opportunityId', 'Cơ hội liên quan (tùy chọn)', options(data.opportunities.filter(row => row.customer_id === Number(form.customerId)), row => row.title), false)}
    {field('subject', 'Công việc / lịch chăm sóc', { required: true, maxLength: 200 })}
    {field('dueAt', 'Thời hạn', { required: true, type: 'datetime-local' })}
    {area('notes', 'Nội dung trao đổi hoặc việc cần làm', false)}
  </div>;

  if (type === 'product') return <div className="grid gap-4 sm:grid-cols-2">
    {field('name', 'Tên sản phẩm / dịch vụ', { required: true, maxLength: 200 })}
    {field('unit', 'Đơn vị tính', { required: true, maxLength: 50 })}
    {field('unitPrice', 'Đơn giá niêm yết (VND)', { required: true, type: 'number', min: 0, step: '0.01', max: '999999999999999' })}
    {field('floorPrice', 'Giá sàn mỗi đơn vị (VND)', { required: true, type: 'number', min: 0, step: '0.01', max: '999999999999999' })}
    <div className="sm:col-span-2">{field('standardScope', 'Phạm vi / mô tả chuẩn của một đơn vị', { required: true, maxLength: 500 })}</div>
    <div className="sm:col-span-2">{check('standardPackage', 'Gói đã chuẩn hóa phạm vi, công nghệ và tiến độ; đủ điều kiện xét gửi trực tiếp theo chính sách.')}</div>
    <Field label="Tình trạng"><select value={String(form.active)} onChange={event => change('active', event.target.value === 'true')} className={inputClass}><option value="true">Đang cung cấp</option><option value="false">Ngừng cung cấp</option></select></Field>
  </div>;

  if (type === 'quotation') {
    const updateLine = (index, key, value) => setForm(previous => ({ ...previous, lines: previous.lines.map((line, position) => position === index ? { ...line, [key]: value } : line) }));
    const subtotal = form.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    return <div className="space-y-5">
      <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Mỗi lần lưu tạo một phiên bản. Hệ thống đối chiếu khung giá, giá sàn, phạm vi và điều khoản để xác định cấp duyệt. Thay đổi sau khi trình duyệt cần phiên bản mới.</p>
      {select('opportunityId', 'Cơ hội bán hàng', options(openOpportunities, row => `${row.customer_name} · ${row.title}`))}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('validUntil', 'Có hiệu lực đến', { required: true, type: 'date' })}
        {field('discountAmount', 'Giảm giá toàn báo giá (VND)', { required: true, type: 'number', min: 0, step: '0.01' })}
      </div>
      <div className="space-y-4">{form.lines.map((line, index) => <div key={index} className="grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-6">
        <div className="sm:col-span-3"><Field label={`Hạng mục ${index + 1}`}><Select required value={line.productId} options={options(data.products.filter(product => product.active), product => `${product.name} · ${product.unit}`)} onChange={event => {
          const product = data.products.find(item => item.id === Number(event.target.value));
          setForm(previous => ({ ...previous, lines: previous.lines.map((item, position) => position === index ? { ...item, productId: product?.id || '', description: product?.standard_scope || product?.name || '', unitPrice: product?.unit_price ?? '' } : item) }));
        }} /></Field></div>
        <Field label="Số lượng"><input required type="number" min="0.01" max="99999999" step="0.01" className={inputClass} value={line.quantity} onChange={event => updateLine(index, 'quantity', event.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Đơn giá (VND)"><input required type="number" min="0" max="999999999999999" step="0.01" className={inputClass} value={line.unitPrice} onChange={event => updateLine(index, 'unitPrice', event.target.value)} /></Field></div>
        <div className="sm:col-span-5"><Field label="Mô tả chi tiết"><input required maxLength={500} className={inputClass} value={line.description} onChange={event => updateLine(index, 'description', event.target.value)} /></Field></div>
        <button type="button" disabled={form.lines.length === 1} onClick={() => change('lines', form.lines.filter((_, position) => position !== index))} className={`${buttonClass} self-end`} aria-label={`Xóa hạng mục ${index + 1}`}><Trash2 size={16} /></button>
      </div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" className={buttonClass} disabled={form.lines.length >= 100} onClick={() => change('lines', [...form.lines, { productId: '', quantity: 1, unitPrice: '', description: '' }])}><Plus size={16} />Thêm hạng mục</button>
        <p className="text-right font-bold text-blue-800">Tổng dự kiến {money(subtotal - Number(form.discountAmount || 0))}</p>
      </div>
      {area('terms', 'Điều khoản báo giá và cách thanh toán')}
      {data.policy?.standard_terms && <button type="button" className={buttonClass} onClick={() => change('terms', data.policy.standard_terms)}>Dùng điều khoản chuẩn hiện hành</button>}
      <fieldset className="space-y-3 border-t border-slate-200 pt-4"><legend className="font-semibold">Yêu cầu và ngoại lệ cần khai báo</legend>
        {check('customScope', 'Phạm vi tùy chỉnh hoặc cam kết tiến độ đặc biệt')}
        {check('newTechnology', 'Công nghệ mới / ngoài giải pháp đã chuẩn hóa')}
        {check('resourceException', 'Tuyển thêm người, mua bản quyền hoặc đổi ưu tiên nguồn lực vượt thẩm quyền/ngân sách')}
        {check('exclusiveRights', 'Chuyển giao độc quyền nền tảng / thư viện dùng chung (bàn giao mã nguồn đã có trong gói chuẩn không cần chọn)')}
        {check('strategicException', 'Ngoại lệ chiến lược, miễn phí hoặc chấp nhận bán lỗ')}
      </fieldset>
      {field('exceptionNote', 'Giải trình yêu cầu khác chuẩn / ngoại lệ', { maxLength: 2000, required: ['customScope', 'newTechnology', 'resourceException', 'exclusiveRights', 'strategicException'].some(key => form[key]) })}
      {select('technicalDepartmentId', 'Phòng Kỹ thuật thẩm định (cần khi tùy chỉnh phạm vi / công nghệ)', options(context.technicalDepartments || [], row => row.ten_phong), false)}
    </div>;
  }

  if (type === 'policy') return <div className="space-y-4">
    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Công bố tạo phiên bản mới. Báo giá đã trình giữ nguyên chính sách đã lưu. Mức giảm được tính cả từ đơn giá hạng mục và chiết khấu toàn báo giá.</p>
    {check('enabled', 'Kích hoạt chính sách cho báo giá mới')}
    <div className="grid gap-4 sm:grid-cols-2">
      {field('standardMax', 'Hạn mức gửi chuẩn trực tiếp (VND)', { required: true, type: 'number', min: 0, step: '0.01' })}
      {field('managerMax', 'Hạn mức Trưởng phòng (VND)', { required: true, type: 'number', min: 0, step: '0.01' })}
      {field('directorMax', 'Hạn mức Giám đốc Kinh doanh (VND)', { required: true, type: 'number', min: 0, step: '0.01' })}
      {field('managerDiscount', 'Chiết khấu tối đa Trưởng phòng (%)', { required: true, type: 'number', min: 0, max: 100, step: '0.01' })}
      {field('directorDiscount', 'Chiết khấu tối đa Giám đốc (%)', { required: true, type: 'number', min: 0, max: 100, step: '0.01' })}
    </div>
    {area('standardTerms', 'Điều khoản chuẩn', !!form.enabled)}
    {select('ceoDelegateId', 'Giám đốc Kinh doanh được CEO ủy quyền duyệt ngoại lệ (tùy chọn)', options(data.delegates || [], row => row.ho_ten), false)}
    <p className="text-sm text-slate-600">Ủy quyền cho phép người được chọn duyệt các báo giá thuộc cấp CEO trong phạm vi phòng mình, trừ báo giá do chính họ lập.</p>
    {field('changeReason', 'Lý do công bố / phạm vi ủy quyền', { required: true, maxLength: 1000 })}
  </div>;

  if (type === 'technicalReview') return <div className="space-y-4">
    <p className="whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{form.scopeSummary}</p>
    <Field label="Kết luận"><select className={inputClass} value={String(form.approved)} onChange={event => change('approved', event.target.value === 'true')}><option value="true">Khả thi, chuyển duyệt thương mại</option><option value="false">Trả về, cần phiên bản báo giá mới</option></select></Field>
    {field('effortDays', 'Ước tính công sức (ngày công)', { required: true, type: 'number', min: '0.01', max: '99999999', step: '0.01' })}
    {field('feasibility', 'Đánh giá tính khả thi / lý do trả về', { required: true, maxLength: 1000 })}
    {field('deliveryPlan', 'Tiến độ và điều kiện triển khai', { required: true, maxLength: 2000 })}
    {field('resourceNeeds', 'Nhân sự, công nghệ, bản quyền và chi phí cần thiết', { required: true, maxLength: 2000 })}
    {check('requiresExecutive', 'Cần CEO quyết định chi phí hoặc ưu tiên nguồn lực vượt thẩm quyền/ngân sách')}
  </div>;

  if (['contract', 'signedContract', 'contractConfirm'].includes(type)) return <ContractFields type={type} form={form} setForm={setForm} data={data} />;

  if (type === 'handover') return <div className="space-y-4">
    <p className="text-sm text-slate-600">Phòng nhận sẽ xem thông tin khách hàng, hợp đồng, phạm vi, mốc nghiệm thu và điều kiện thanh toán.</p>
    {select('recipientDepartmentId', 'Phòng nhận', options(context.recipients, row => row.ten_phong))}
    {context.recipients.length === 0 && <p role="alert" className="text-sm text-rose-700">Cần tạo phòng Kế toán hoặc Kỹ thuật trong quản lý phòng ban trước khi bàn giao.</p>}
  </div>;

  if (type === 'transition') return <div className="space-y-4">
    <p className="text-sm text-slate-600">{form.description}</p>
    {area('note', form.noteLabel || 'Ghi chú / lý do', form.noteRequired)}
  </div>;
  return null;
}
