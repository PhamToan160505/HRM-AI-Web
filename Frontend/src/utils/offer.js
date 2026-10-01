export const createEmptyOfferFields = (application = null, departmentName = '') => ({
  luongCoBan: '',
  probationMonths: '2',
  probationRate: '85',
  startDate: '',
  salaryRangeReason: '',
  responseDeadline: '',
  overbookConfirmed: false,
  overbookReason: '',
  employerName: '',
  employerTaxCode: '',
  jobTitle: application?.jobPosting?.title || '',
  departmentName: departmentName || '',
  managerName: '',
  workplace: application?.jobPosting?.diaDiem || '',
  workMode: application?.jobPosting?.hinhThucLamViec || 'ONSITE',
  employmentType: 'FULL_TIME',
  contractType: 'FIXED_TERM',
  contractDurationMonths: '12',
  salaryType: 'GROSS',
  currency: 'VND',
  payCycle: 'MONTHLY',
  payDay: '05',
  bonusPolicy: '',
  commissionPolicy: '',
  salaryReviewCycle: '12 tháng/lần',
  overtimePolicy: 'Theo quy định công ty và pháp luật hiện hành',
  compensationItems: [],
  benefits: [],
  workingDays: 'Thứ Hai - Thứ Sáu',
  workingHours: '08:00 - 17:30',
  annualLeaveDays: '12',
  requiredDocuments: 'CCCD, sơ yếu lý lịch và hồ sơ theo hướng dẫn của HR',
  backgroundCheck: false,
  confidentiality: true,
  intellectualProperty: true,
  offerValidityNote: 'Offer chỉ có hiệu lực trong thời hạn phản hồi được ghi trên thư.',
  templateCode: 'STANDARD_VI',
  templateName: 'Offer tiêu chuẩn - Tiếng Việt',
  locale: 'vi-VN',
});

export function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function offerToFields(offer, application, departmentName = '') {
  const base = createEmptyOfferFields(application, departmentName);
  if (!offer) return base;
  const details = parseJson(offer.offerDetailsJson, {});
  const legacyAllowances = parseJson(offer.allowancesJson, {});
  const items = Array.isArray(details.compensation?.items)
    ? details.compensation.items
    : legacyAllowances.description
      ? [{ type: 'ALLOWANCE', label: 'Phụ cấp', amount: '', unit: 'VND_MONTH', note: legacyAllowances.description }]
      : [];
  return {
    ...base,
    luongCoBan: Number(offer.baseSalary || 0).toLocaleString('vi-VN'),
    probationMonths: String(offer.probationMonths ?? base.probationMonths),
    probationRate: String(offer.probationSalaryRate ?? base.probationRate),
    startDate: offer.expectedStartDate || '',
    salaryRangeReason: offer.outOfRangeReason || '',
    employerName: details.employer?.name || base.employerName,
    employerTaxCode: details.employer?.taxCode || '',
    jobTitle: details.job?.title || base.jobTitle,
    departmentName: details.job?.departmentName || base.departmentName,
    managerName: details.job?.managerName || '',
    workplace: details.job?.workplace || base.workplace,
    workMode: details.job?.workMode || base.workMode,
    employmentType: details.job?.employmentType || base.employmentType,
    contractType: details.job?.contractType || base.contractType,
    contractDurationMonths: String(details.job?.contractDurationMonths ?? base.contractDurationMonths),
    salaryType: details.compensation?.salaryType || base.salaryType,
    currency: details.compensation?.currency || base.currency,
    payCycle: details.compensation?.payCycle || base.payCycle,
    payDay: String(details.compensation?.payDay ?? base.payDay),
    bonusPolicy: details.compensation?.bonusPolicy || '',
    commissionPolicy: details.compensation?.commissionPolicy || '',
    salaryReviewCycle: details.compensation?.salaryReviewCycle || base.salaryReviewCycle,
    overtimePolicy: details.compensation?.overtimePolicy || base.overtimePolicy,
    compensationItems: items,
    benefits: Array.isArray(details.benefits) ? details.benefits : [],
    workingDays: details.workSchedule?.workingDays || base.workingDays,
    workingHours: details.workSchedule?.workingHours || base.workingHours,
    annualLeaveDays: String(details.workSchedule?.annualLeaveDays ?? base.annualLeaveDays),
    requiredDocuments: details.conditions?.requiredDocuments || base.requiredDocuments,
    backgroundCheck: Boolean(details.conditions?.backgroundCheck),
    confidentiality: details.conditions?.confidentiality !== false,
    intellectualProperty: details.conditions?.intellectualProperty !== false,
    offerValidityNote: details.conditions?.offerValidityNote || base.offerValidityNote,
    templateCode: details.template?.code || base.templateCode,
    templateName: details.template?.name || base.templateName,
    locale: details.template?.locale || base.locale,
  };
}

export function buildOfferDetails(fields) {
  return {
    schemaVersion: 1,
    employer: {
      name: fields.employerName.trim(),
      taxCode: fields.employerTaxCode.trim() || null,
    },
    job: {
      title: fields.jobTitle.trim(),
      departmentName: fields.departmentName.trim(),
      managerName: fields.managerName.trim() || null,
      workplace: fields.workplace.trim(),
      workMode: fields.workMode,
      employmentType: fields.employmentType,
      contractType: fields.contractType,
      contractDurationMonths: fields.contractType === 'FIXED_TERM'
        ? Number(fields.contractDurationMonths) || null
        : null,
    },
    compensation: {
      salaryType: fields.salaryType,
      currency: fields.currency,
      payCycle: fields.payCycle,
      payDay: Number(fields.payDay) || null,
      bonusPolicy: fields.bonusPolicy.trim() || null,
      commissionPolicy: fields.commissionPolicy.trim() || null,
      salaryReviewCycle: fields.salaryReviewCycle.trim() || null,
      overtimePolicy: fields.overtimePolicy.trim() || null,
      items: fields.compensationItems
        .filter(item => item.label?.trim())
        .map(item => ({ ...item, label: item.label.trim(), amount: Number(String(item.amount || '').replace(/\D/g, '')) || null })),
    },
    benefits: fields.benefits
      .filter(item => item.label?.trim())
      .map(item => ({ label: item.label.trim(), description: item.description?.trim() || null })),
    workSchedule: {
      workingDays: fields.workingDays.trim(),
      workingHours: fields.workingHours.trim(),
      annualLeaveDays: Number(fields.annualLeaveDays) || null,
    },
    conditions: {
      requiredDocuments: fields.requiredDocuments.trim() || null,
      backgroundCheck: fields.backgroundCheck,
      confidentiality: fields.confidentiality,
      intellectualProperty: fields.intellectualProperty,
      offerValidityNote: fields.offerValidityNote.trim() || null,
    },
    template: {
      code: fields.templateCode,
      name: fields.templateName,
      locale: fields.locale,
    },
  };
}

export function legacyAllowancesFromFields(fields) {
  return {
    items: fields.compensationItems,
    benefits: fields.benefits,
    description: [
      ...fields.compensationItems.map(item => [item.label, item.note].filter(Boolean).join(': ')),
      ...fields.benefits.map(item => [item.label, item.description].filter(Boolean).join(': ')),
    ].filter(Boolean).join('; '),
  };
}

export function validateOfferFields(fields, terms) {
  const required = [
    ['employerName', 'pháp nhân tuyển dụng'],
    ['jobTitle', 'chức danh'],
    ['departmentName', 'phòng ban'],
    ['workplace', 'địa điểm làm việc'],
    ['luongCoBan', 'lương cơ bản'],
    ['startDate', 'ngày bắt đầu'],
    ['workingDays', 'ngày làm việc'],
    ['workingHours', 'giờ làm việc'],
  ];
  const missing = required.find(([key]) => !String(fields[key] ?? '').trim());
  if (missing) return `Vui lòng nhập ${missing[1]}`;
  if (!terms.trim()) return 'Vui lòng nhập điều khoản offer';
  const salary = Number(String(fields.luongCoBan).replace(/\D/g, ''));
  if (!salary) return 'Lương cơ bản phải lớn hơn 0';
  if (Number(fields.probationRate) <= 0 || Number(fields.probationRate) > 100) return 'Tỷ lệ lương thử việc không hợp lệ';
  if (fields.contractType === 'FIXED_TERM' && Number(fields.contractDurationMonths) <= 0) return 'Vui lòng nhập thời hạn hợp đồng';
  return null;
}

export function summarizeOfferDiff(current, previous) {
  if (!current || !previous) return [];
  const currentDetails = parseJson(current.offerDetailsJson, {});
  const previousDetails = parseJson(previous.offerDetailsJson, {});
  const rows = [
    ['Lương cơ bản', previous.baseSalary, current.baseSalary, 'currency'],
    ['Ngày bắt đầu', previous.expectedStartDate, current.expectedStartDate],
    ['Tỷ lệ thử việc', previous.probationSalaryRate, current.probationSalaryRate, 'percent'],
    ['Nơi làm việc', previousDetails.job?.workplace, currentDetails.job?.workplace],
    ['Loại hợp đồng', previousDetails.job?.contractType, currentDetails.job?.contractType],
    ['Điều khoản', previous.contractTerms, current.contractTerms],
  ];
  return rows.filter(([, before, after]) => String(before ?? '') !== String(after ?? ''));
}
