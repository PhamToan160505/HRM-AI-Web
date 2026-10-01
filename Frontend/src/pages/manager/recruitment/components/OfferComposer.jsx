import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, BriefcaseBusiness, Check, Coins, Eye,
  Gift, Plus, Printer, ShieldCheck, Trash2,
} from 'lucide-react';
import OfferPreview from './OfferPreview';

const STEPS = [
  { title: 'Công việc', icon: BriefcaseBusiness },
  { title: 'Thu nhập', icon: Coins },
  { title: 'Phúc lợi', icon: Gift },
  { title: 'Điều kiện', icon: ShieldCheck },
  { title: 'Xem trước', icon: Eye },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

function Field({ label, required, children, className = '' }) {
  return <div className={className}><label className={labelClass}>{label}{required && <span className="text-rose-500"> *</span>}</label>{children}</div>;
}

function Select({ value, onChange, children }) {
  return <select className={inputClass} value={value} onChange={onChange}>{children}</select>;
}

export default function OfferComposer({ application, fields, onFieldsChange, terms, onTermsChange }) {
  const [step, setStep] = useState(0);
  const update = (name, value) => onFieldsChange({ ...fields, [name]: value });
  const updateCollection = (name, index, key, value) => {
    const next = [...fields[name]];
    next[index] = { ...next[index], [key]: value };
    update(name, next);
  };
  const removeCollection = (name, index) => update(name, fields[name].filter((_, itemIndex) => itemIndex !== index));

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden !important; } .offer-print-area, .offer-print-area * { visibility: visible !important; } .offer-print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; box-shadow: none !important; } }`}</style>
      <div className="mb-6 overflow-x-auto pb-1">
        <div className="flex min-w-[620px] items-center">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const active = index === step;
            const complete = index < step;
            return (
              <React.Fragment key={item.title}>
                <button type="button" onClick={() => setStep(index)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? 'bg-slate-950 text-white' : complete ? 'text-emerald-700' : 'text-slate-400 hover:bg-slate-50'}`}>
                  <span className={`grid size-7 place-items-center rounded-full ${active ? 'bg-emerald-400 text-slate-950' : complete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
                    {complete ? <Check size={15} /> : <Icon size={15} />}
                  </span>
                  {item.title}
                </button>
                {index < STEPS.length - 1 && <div className={`mx-1 h-px flex-1 ${complete ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 md:col-span-2">
            Thông tin được lấy từ chiến dịch tuyển dụng. HR cần xác nhận lại trước khi trình duyệt.
          </div>
          <Field label="Pháp nhân tuyển dụng" required><input className={inputClass} value={fields.employerName} onChange={event => update('employerName', event.target.value)} placeholder="Tên pháp lý đầy đủ của doanh nghiệp" /></Field>
          <Field label="Mã số thuế"><input className={inputClass} value={fields.employerTaxCode} onChange={event => update('employerTaxCode', event.target.value)} /></Field>
          <Field label="Chức danh" required><input className={inputClass} value={fields.jobTitle} onChange={event => update('jobTitle', event.target.value)} /></Field>
          <Field label="Phòng ban" required><input className={inputClass} value={fields.departmentName} onChange={event => update('departmentName', event.target.value)} /></Field>
          <Field label="Quản lý trực tiếp"><input className={inputClass} value={fields.managerName} onChange={event => update('managerName', event.target.value)} placeholder="Họ tên/chức danh người quản lý" /></Field>
          <Field label="Địa điểm làm việc" required><input className={inputClass} value={fields.workplace} onChange={event => update('workplace', event.target.value)} /></Field>
          <Field label="Hình thức làm việc"><Select value={fields.workMode} onChange={event => update('workMode', event.target.value)}><option value="ONSITE">Tại văn phòng</option><option value="HYBRID">Kết hợp</option><option value="REMOTE">Từ xa</option></Select></Field>
          <Field label="Tính chất công việc"><Select value={fields.employmentType} onChange={event => update('employmentType', event.target.value)}><option value="FULL_TIME">Toàn thời gian</option><option value="PART_TIME">Bán thời gian</option></Select></Field>
          <Field label="Loại hợp đồng dự kiến" required><Select value={fields.contractType} onChange={event => update('contractType', event.target.value)}><option value="FIXED_TERM">Xác định thời hạn</option><option value="INDEFINITE">Không xác định thời hạn</option></Select></Field>
          {fields.contractType === 'FIXED_TERM' && <Field label="Thời hạn (tháng)" required><input type="number" min="1" className={inputClass} value={fields.contractDurationMonths} onChange={event => update('contractDurationMonths', event.target.value)} /></Field>}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Lương cơ bản" required className="md:col-span-2"><input className={inputClass} value={fields.luongCoBan} onChange={event => { const raw = event.target.value.replace(/\D/g, ''); update('luongCoBan', raw ? Number(raw).toLocaleString('vi-VN') : ''); }} placeholder="20.000.000" /></Field>
            <Field label="Cách tính"><Select value={fields.salaryType} onChange={event => update('salaryType', event.target.value)}><option value="GROSS">Gross</option><option value="NET">Net</option></Select></Field>
            <Field label="Chu kỳ trả lương"><Select value={fields.payCycle} onChange={event => update('payCycle', event.target.value)}><option value="MONTHLY">Hàng tháng</option></Select></Field>
            <Field label="Ngày trả lương"><input type="number" min="1" max="31" className={inputClass} value={fields.payDay} onChange={event => update('payDay', event.target.value)} /></Field>
            <Field label="Tiền tệ"><Select value={fields.currency} onChange={event => update('currency', event.target.value)}><option value="VND">VND</option><option value="USD">USD</option></Select></Field>
            <Field label="Thời gian thử việc (tháng)"><input type="number" min="0" className={inputClass} value={fields.probationMonths} onChange={event => update('probationMonths', event.target.value)} /></Field>
            <Field label="Lương thử việc (%)"><input type="number" min="1" max="100" className={inputClass} value={fields.probationRate} onChange={event => update('probationRate', event.target.value)} /></Field>
            <Field label="Ngày bắt đầu" required><input type="date" className={inputClass} value={fields.startDate} onChange={event => update('startDate', event.target.value)} /></Field>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><h4 className="font-bold text-slate-900">Phụ cấp và khoản thu nhập</h4><p className="mt-0.5 text-xs text-slate-500">Tách riêng từng khoản để duyệt và thương lượng rõ ràng.</p></div>
              <button type="button" onClick={() => update('compensationItems', [...fields.compensationItems, { type: 'ALLOWANCE', label: '', amount: '', unit: 'VND_MONTH', note: '' }])} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Plus size={15} />Thêm khoản</button>
            </div>
            <div className="mt-4 space-y-3">
              {fields.compensationItems.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Chưa có phụ cấp hoặc khoản thu nhập bổ sung.</p>}
              {fields.compensationItems.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_160px_1fr_auto]">
                  <input className={inputClass} value={item.label} onChange={event => updateCollection('compensationItems', index, 'label', event.target.value)} placeholder="Ví dụ: Phụ cấp ăn trưa" />
                  <input className={inputClass} value={item.amount} onChange={event => updateCollection('compensationItems', index, 'amount', event.target.value.replace(/\D/g, ''))} placeholder="Số tiền/tháng" />
                  <input className={inputClass} value={item.note} onChange={event => updateCollection('compensationItems', index, 'note', event.target.value)} placeholder="Ghi chú/điều kiện" />
                  <button type="button" onClick={() => removeCollection('compensationItems', index)} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={17} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Chính sách thưởng"><textarea className={`${inputClass} min-h-20`} value={fields.bonusPolicy} onChange={event => update('bonusPolicy', event.target.value)} /></Field>
            <Field label="Hoa hồng/KPI"><textarea className={`${inputClass} min-h-20`} value={fields.commissionPolicy} onChange={event => update('commissionPolicy', event.target.value)} /></Field>
            <Field label="Chu kỳ xem xét lương"><input className={inputClass} value={fields.salaryReviewCycle} onChange={event => update('salaryReviewCycle', event.target.value)} /></Field>
            <Field label="Chính sách làm thêm"><input className={inputClass} value={fields.overtimePolicy} onChange={event => update('overtimePolicy', event.target.value)} /></Field>
            <Field label="Lý do vượt khung lương (nếu có)" className="md:col-span-2"><input className={inputClass} value={fields.salaryRangeReason} onChange={event => update('salaryRangeReason', event.target.value)} /></Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ngày làm việc" required><input className={inputClass} value={fields.workingDays} onChange={event => update('workingDays', event.target.value)} /></Field>
            <Field label="Giờ làm việc" required><input className={inputClass} value={fields.workingHours} onChange={event => update('workingHours', event.target.value)} /></Field>
            <Field label="Phép năm (ngày)"><input type="number" min="0" className={inputClass} value={fields.annualLeaveDays} onChange={event => update('annualLeaveDays', event.target.value)} /></Field>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div><h4 className="font-bold text-slate-900">Danh sách phúc lợi</h4><p className="mt-0.5 text-xs text-slate-500">Ví dụ: bảo hiểm, khám sức khỏe, thiết bị, đào tạo.</p></div>
              <button type="button" onClick={() => update('benefits', [...fields.benefits, { label: '', description: '' }])} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><Plus size={15} />Thêm phúc lợi</button>
            </div>
            <div className="mt-4 space-y-3">
              {fields.benefits.length === 0 && <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Chưa khai báo phúc lợi bổ sung.</p>}
              {fields.benefits.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[220px_1fr_auto]">
                  <input className={inputClass} value={item.label} onChange={event => updateCollection('benefits', index, 'label', event.target.value)} placeholder="Tên phúc lợi" />
                  <input className={inputClass} value={item.description} onChange={event => updateCollection('benefits', index, 'description', event.target.value)} placeholder="Mô tả chi tiết" />
                  <button type="button" onClick={() => removeCollection('benefits', index)} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={17} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Mẫu offer"><Select value={fields.templateCode} onChange={event => { const code = event.target.value; onFieldsChange({ ...fields, templateCode: code, templateName: code === 'SALES_VI' ? 'Offer Kinh doanh - Tiếng Việt' : 'Offer tiêu chuẩn - Tiếng Việt' }); }}><option value="STANDARD_VI">Offer tiêu chuẩn - Tiếng Việt</option><option value="SALES_VI">Offer Kinh doanh - Tiếng Việt</option></Select></Field>
            <Field label="Hồ sơ cần bổ sung"><input className={inputClass} value={fields.requiredDocuments} onChange={event => update('requiredDocuments', event.target.value)} /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['backgroundCheck', 'Kiểm tra tham chiếu'],
              ['confidentiality', 'Điều khoản bảo mật'],
              ['intellectualProperty', 'Sở hữu trí tuệ'],
            ].map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <input type="checkbox" checked={fields[key]} onChange={event => update(key, event.target.checked)} className="size-4 rounded text-emerald-600" />{label}
              </label>
            ))}
          </div>
          <Field label="Lưu ý hiệu lực offer"><textarea className={`${inputClass} min-h-20`} value={fields.offerValidityNote} onChange={event => update('offerValidityNote', event.target.value)} /></Field>
          <Field label="Điều khoản offer" required><textarea className={`${inputClass} min-h-36`} value={terms} onChange={event => onTermsChange(event.target.value)} placeholder="Nhập các điều khoản đã được công ty/pháp chế phê duyệt..." /></Field>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Offer là đề nghị làm việc, chưa phải hợp đồng lao động đã ký. Hợp đồng sẽ được sinh ở giai đoạn tiếp theo sau khi ứng viên chấp nhận.</div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h4 className="font-bold text-slate-900">Bản xem trước sẽ gửi cho ứng viên</h4><p className="mt-1 text-xs text-slate-500">Nội dung này sẽ được khóa theo version sau khi duyệt.</p></div>
            <button type="button" onClick={() => window.print()} className="print:hidden inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Printer size={16} />In / Lưu PDF</button>
          </div>
          <OfferPreview application={application} candidateName={application?.fullName} draftFields={fields} terms={terms} />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5 print:hidden">
        <button type="button" disabled={step === 0} onClick={() => setStep(value => value - 1)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:invisible"><ArrowLeft size={17} />Quay lại</button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep(value => value + 1)} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Tiếp tục<ArrowRight size={17} /></button>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check size={17} />Sẵn sàng trình duyệt</span>
        )}
      </div>
    </div>
  );
}
