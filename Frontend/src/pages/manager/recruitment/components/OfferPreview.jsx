import React from 'react';
import { BriefcaseBusiness, Building2, CalendarDays, Clock3, Coins, FileText, MapPin } from 'lucide-react';
import { formatCurrencyVND } from '../../../../utils/currency';
import { parseJson } from '../../../../utils/offer';

const LABELS = {
  ONSITE: 'Tại văn phòng', HYBRID: 'Kết hợp', REMOTE: 'Từ xa',
  FULL_TIME: 'Toàn thời gian', PART_TIME: 'Bán thời gian',
  FIXED_TERM: 'Xác định thời hạn', INDEFINITE: 'Không xác định thời hạn',
  MONTHLY: 'Hàng tháng', GROSS: 'Gross', NET: 'Net',
};

export default function OfferPreview({ offer, candidateName, draftFields, terms }) {
  const details = draftFields ? {
    employer: { name: draftFields.employerName },
    job: {
      title: draftFields.jobTitle, departmentName: draftFields.departmentName,
      managerName: draftFields.managerName, workplace: draftFields.workplace,
      workMode: draftFields.workMode, employmentType: draftFields.employmentType,
      contractType: draftFields.contractType, contractDurationMonths: draftFields.contractDurationMonths,
    },
    compensation: {
      salaryType: draftFields.salaryType, payCycle: draftFields.payCycle, payDay: draftFields.payDay,
      bonusPolicy: draftFields.bonusPolicy, commissionPolicy: draftFields.commissionPolicy,
      salaryReviewCycle: draftFields.salaryReviewCycle, overtimePolicy: draftFields.overtimePolicy,
      items: draftFields.compensationItems,
    },
    benefits: draftFields.benefits,
    workSchedule: {
      workingDays: draftFields.workingDays, workingHours: draftFields.workingHours,
      annualLeaveDays: draftFields.annualLeaveDays,
    },
    conditions: { requiredDocuments: draftFields.requiredDocuments },
  } : parseJson(offer?.offerDetailsJson, {});
  const baseSalary = draftFields ? Number(String(draftFields.luongCoBan).replace(/\D/g, '')) : offer?.baseSalary;
  const probationMonths = draftFields?.probationMonths ?? offer?.probationMonths;
  const probationRate = draftFields?.probationRate ?? offer?.probationSalaryRate;
  const startDate = draftFields?.startDate ?? offer?.expectedStartDate;
  const contractTerms = terms ?? offer?.contractTerms;
  const items = details.compensation?.items || [];
  const benefits = details.benefits || [];

  return (
    <article className="offer-print-area overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="bg-slate-950 px-6 py-6 text-white sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Thư mời nhận việc</p>
            <h3 className="mt-2 text-2xl font-bold">{details.employer?.name || 'Doanh nghiệp'}</h3>
          </div>
          <BriefcaseBusiness className="text-emerald-300" size={32} />
        </div>
      </header>
      <div className="space-y-7 p-6 sm:p-8">
        <div>
          <p className="text-sm text-slate-500">Kính gửi <strong className="text-slate-900">{candidateName || 'Ứng viên'}</strong>,</p>
          <h4 className="mt-3 text-xl font-bold text-slate-950">{details.job?.title || 'Chức danh tuyển dụng'}</h4>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Building2 size={16} />{details.job?.departmentName || 'Phòng ban'}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={16} />{details.job?.workplace || 'Nơi làm việc'}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={16} />{LABELS[details.job?.workMode] || details.job?.workMode}</span>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Lương cơ bản</dt>
            <dd className="mt-1 text-xl font-bold text-emerald-900">{formatCurrencyVND(baseSalary)} <span className="text-sm font-medium">({LABELS[details.compensation?.salaryType] || 'Gross'})</span></dd>
          </div>
          <div className="rounded-xl bg-blue-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-blue-700">Ngày bắt đầu</dt>
            <dd className="mt-1 flex items-center gap-2 font-bold text-blue-950"><CalendarDays size={18} />{startDate || 'Chưa xác định'}</dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thử việc</dt>
            <dd className="mt-1 font-semibold text-slate-900">{probationMonths} tháng · {probationRate}% lương</dd>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hợp đồng dự kiến</dt>
            <dd className="mt-1 font-semibold text-slate-900">{LABELS[details.job?.contractType] || details.job?.contractType}{details.job?.contractType === 'FIXED_TERM' && details.job?.contractDurationMonths ? ` · ${details.job.contractDurationMonths} tháng` : ''}</dd>
          </div>
        </dl>

        {(items.length > 0 || benefits.length > 0) && (
          <section>
            <h5 className="flex items-center gap-2 font-bold text-slate-900"><Coins size={18} className="text-emerald-600" />Thu nhập và phúc lợi</h5>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {items.map((item, index) => <li key={`item-${index}`} className="rounded-lg bg-slate-50 px-3 py-2"><strong>{item.label}</strong>{item.amount ? `: ${formatCurrencyVND(item.amount)}` : ''}{item.note ? ` — ${item.note}` : ''}</li>)}
              {benefits.map((item, index) => <li key={`benefit-${index}`} className="rounded-lg bg-slate-50 px-3 py-2"><strong>{item.label}</strong>{item.description ? `: ${item.description}` : ''}</li>)}
            </ul>
          </section>
        )}

        <section className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-bold text-slate-900">Thời gian làm việc</p>
            <p className="mt-1 leading-6 text-slate-600">{details.workSchedule?.workingDays} · {details.workSchedule?.workingHours}<br />Phép năm: {details.workSchedule?.annualLeaveDays || 0} ngày</p>
          </div>
          <div>
            <p className="font-bold text-slate-900">Thanh toán lương</p>
            <p className="mt-1 leading-6 text-slate-600">{LABELS[details.compensation?.payCycle] || details.compensation?.payCycle}, ngày {details.compensation?.payDay || '--'}<br />Rà soát lương: {details.compensation?.salaryReviewCycle || 'Theo chính sách'}</p>
          </div>
        </section>

        <section className="border-t border-slate-100 pt-5">
          <h5 className="flex items-center gap-2 font-bold text-slate-900"><FileText size={18} className="text-blue-600" />Điều khoản offer</h5>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{contractTerms || 'Chưa có điều khoản.'}</p>
        </section>
      </div>
    </article>
  );
}
