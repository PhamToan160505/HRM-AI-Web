export const PROJECT_STATUS_CONFIG = {
  PLANNING: {
    label: 'Lên kế hoạch',
    shortLabel: 'Kế hoạch',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClass: 'bg-sky-500',
    chartColor: '#0284C7',
  },
  IN_PROGRESS: {
    label: 'Đang phát triển',
    shortLabel: 'Đang chạy',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    chartColor: '#059669',
  },
  MAINTENANCE: {
    label: 'Bảo trì & Hỗ trợ',
    shortLabel: 'Bảo trì',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    dotClass: 'bg-orange-500',
    chartColor: '#EA580C',
  },
  COMPLETED: {
    label: 'Đã hoàn thành',
    shortLabel: 'Hoàn thành',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-600',
    chartColor: '#2563EB',
  },
  PAUSED: {
    label: 'Tạm dừng',
    shortLabel: 'Tạm dừng',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
    chartColor: '#E11D48',
  },
};

export const PROJECT_ROLE_LABELS = {
  TECH_LEAD: {
    label: 'Tech Lead (Trưởng nhóm kỹ thuật)',
    shortLabel: 'Tech Lead',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
  },
  BACKEND_DEV: {
    label: 'Backend Developer',
    shortLabel: 'Backend',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  FRONTEND_DEV: {
    label: 'Frontend Developer',
    shortLabel: 'Frontend',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  FULLSTACK_DEV: {
    label: 'Fullstack Developer',
    shortLabel: 'Fullstack',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  MOBILE_DEV: {
    label: 'Mobile Developer (iOS/Android)',
    shortLabel: 'Mobile',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  QA_TESTER: {
    label: 'QA / Automation Tester',
    shortLabel: 'QA / Test',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  DEVOPS: {
    label: 'DevOps / Cloud Engineer',
    shortLabel: 'DevOps',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  UI_UX_DESIGNER: {
    label: 'UI/UX Designer',
    shortLabel: 'UI/UX',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export const PROJECT_ROLES = [
  { value: 'TECH_LEAD', ...PROJECT_ROLE_LABELS.TECH_LEAD },
  { value: 'BACKEND_DEV', ...PROJECT_ROLE_LABELS.BACKEND_DEV },
  { value: 'FRONTEND_DEV', ...PROJECT_ROLE_LABELS.FRONTEND_DEV },
  { value: 'FULLSTACK_DEV', ...PROJECT_ROLE_LABELS.FULLSTACK_DEV },
  { value: 'MOBILE_DEV', ...PROJECT_ROLE_LABELS.MOBILE_DEV },
  { value: 'QA_TESTER', ...PROJECT_ROLE_LABELS.QA_TESTER },
  { value: 'DEVOPS', ...PROJECT_ROLE_LABELS.DEVOPS },
  { value: 'UI_UX_DESIGNER', ...PROJECT_ROLE_LABELS.UI_UX_DESIGNER },
];

export const PROFICIENCY_CONFIG = {
  FRESHER: {
    label: 'Fresher',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  JUNIOR: {
    label: 'Junior',
    bg: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  MIDDLE: {
    label: 'Middle',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  SENIOR: {
    label: 'Senior',
    bg: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',
    dot: 'bg-orange-500',
  },
  EXPERT: {
    label: 'Expert',
    bg: 'bg-slate-900 text-white border-slate-800 font-bold',
    dot: 'bg-blue-400',
    isDark: true,
  },
};

export const PROFICIENCY_OPTIONS = [
  {
    value: 'FRESHER',
    label: 'Fresher (Mới tiếp cận - Dưới 1 năm)',
    desc: 'Nắm nền tảng kỹ thuật, thực hiện task dưới sự hướng dẫn của mentor',
    badgeClass: PROFICIENCY_CONFIG.FRESHER.bg,
  },
  {
    value: 'JUNIOR',
    label: 'Junior (Cơ bản - 1 đến 2 năm)',
    desc: 'Độc lập triển khai các tính năng vừa và nhỏ theo thiết kế có sẵn',
    badgeClass: PROFICIENCY_CONFIG.JUNIOR.bg,
  },
  {
    value: 'MIDDLE',
    label: 'Middle (Thành thạo - 2 đến 4 năm)',
    desc: 'Xử lý nghiệp vụ phức tạp, tối ưu hiệu năng và phối hợp liên nhóm',
    badgeClass: PROFICIENCY_CONFIG.MIDDLE.bg,
  },
  {
    value: 'SENIOR',
    label: 'Senior (Chuyên sâu - 4 đến 6 năm)',
    desc: 'Làm chủ kiến trúc module, giải quyết bottleneck và review code',
    badgeClass: PROFICIENCY_CONFIG.SENIOR.bg,
  },
  {
    value: 'EXPERT',
    label: 'Expert (Chuyên gia - Trên 6 năm)',
    desc: 'Định hướng kiến trúc hệ thống toàn dự án và dẫn dắt công nghệ lõi',
    badgeClass: PROFICIENCY_CONFIG.EXPERT.bg,
  },
];

export const LEVEL_ORDER = {
  FRESHER: 0,
  JUNIOR: 1,
  MIDDLE: 2,
  SENIOR: 3,
  EXPERT: 4,
};

export const RADAR_DIMENSIONS = [
  { key: 'BACKEND', label: 'Backend' },
  { key: 'FRONTEND', label: 'Frontend' },
  { key: 'DATABASE', label: 'Database' },
  { key: 'DEVOPS_CLOUD', label: 'DevOps & Cloud' },
  { key: 'TESTING', label: 'Testing / QA' },
  { key: 'ARCHITECTURE', label: 'Architecture' },
];

// Chuẩn hóa sắp xếp từ thấp đến cao: Fresher -> Junior -> Middle -> Senior -> Expert
export const sortSkillsByLevel = (skills = []) => {
  return [...skills].sort((a, b) => {
    const orderA = LEVEL_ORDER[a.proficiencyLevel] ?? 99;
    const orderB = LEVEL_ORDER[b.proficiencyLevel] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    const yA = a.yearsOfExperience ?? 0;
    const yB = b.yearsOfExperience ?? 0;
    if (yA !== yB) return yA - yB;
    return (a.skillName || '').localeCompare(b.skillName || '');
  });
};

export const formatDateVN = (dateStr) => {
  if (!dateStr) return 'Chưa định';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const formatDateTimeVN = (isoStr) => {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return isoStr;
  }
};

export const computeTimelineHealth = (project) => {
  if (!project) return { daysRemaining: null, elapsedPercent: 0, tone: 'neutral', text: 'Chưa xác định' };
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = project.startDate ? new Date(project.startDate) : null;
  const end = project.endDate ? new Date(project.endDate) : null;
  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(0, 0, 0, 0);

  let daysRemaining = null;
  if (end && !isNaN(end.getTime())) {
    daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  let elapsedPercent = 0;
  if (project.status === 'COMPLETED') {
    elapsedPercent = 100;
  } else if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    if (total <= 0) {
      elapsedPercent = now >= end ? 100 : 0;
    } else {
      elapsedPercent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    }
  }

  let tone = 'normal';
  let text = 'Đúng tiến độ';
  if (project.status === 'COMPLETED') {
    tone = 'completed';
    text = 'Đã bàn giao';
  } else if (project.status === 'PAUSED') {
    tone = 'paused';
    text = 'Đang tạm dừng';
  } else if (daysRemaining !== null) {
    if (daysRemaining < 0) {
      tone = 'overdue';
      text = `Quá hạn ${Math.abs(daysRemaining)} ngày`;
    } else if (daysRemaining === 0) {
      tone = 'dueSoon';
      text = 'Đến hạn hôm nay';
    } else if (daysRemaining <= 7) {
      tone = 'dueSoon';
      text = `Còn ${daysRemaining} ngày`;
    } else {
      tone = 'normal';
      text = `Còn ${daysRemaining} ngày`;
    }
  } else {
    tone = 'neutral';
    text = 'Chưa có hạn chót';
  }

  return { daysRemaining, elapsedPercent, tone, text };
};

export const getShortEngineerName = (fullName) => {
  if (!fullName) return 'Kỹ sư';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
};

export const MILESTONE_STATUS_CONFIG = {
  NOT_STARTED: {
    label: 'Chưa bắt đầu',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  IN_PROGRESS: {
    label: 'Đang thực hiện',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-600',
  },
  COMPLETED: {
    label: 'Đã nghiệm thu',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-600',
  },
  DELAYED: {
    label: 'Chậm tiến độ',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-600',
  },
};

export const MILESTONE_STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Chưa bắt đầu' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'COMPLETED', label: 'Đã nghiệm thu (100%)' },
  { value: 'DELAYED', label: 'Chậm tiến độ' },
];

export const WORKLOG_TYPE_CONFIG = {
  DEVELOPMENT: {
    label: 'Phát triển tính năng',
    shortLabel: 'Phát triển',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  CODE_REVIEW: {
    label: 'Review mã nguồn / Hỗ trợ',
    shortLabel: 'Code Review',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  TESTING_QA: {
    label: 'Kiểm thử & Automation Test',
    shortLabel: 'QA / Test',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  BUG_FIX: {
    label: 'Sửa lỗi / Hotfix',
    shortLabel: 'Bug Fix',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  ARCHITECTURE: {
    label: 'Thiết kế Kiến trúc & DB',
    shortLabel: 'Kiến trúc',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
  DEPLOYMENT: {
    label: 'Triển khai CI/CD & Cloud',
    shortLabel: 'Triển khai',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  MEETING: {
    label: 'Họp kỹ thuật / Sprint Planning',
    shortLabel: 'Họp kỹ thuật',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
  },
};

export const WORKLOG_TYPE_OPTIONS = Object.entries(WORKLOG_TYPE_CONFIG).map(([value, cfg]) => ({
  value,
  label: cfg.label,
  shortLabel: cfg.shortLabel,
}));

export const WORKLOG_STATUS_CONFIG = {
  PENDING: {
    label: 'Chờ thẩm định',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  APPROVED: {
    label: 'Đã phê duyệt',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  REJECTED: {
    label: 'Từ chối',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const formatHours = (hours) => {
  const num = Number(hours || 0);
  return Number.isInteger(num) ? `${num}h` : `${Number(num.toFixed(2))}h`;
};

export const formatCurrencyVND = (amount) => {
  if (amount === null || amount === undefined) return 'Chưa cấu hình';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const getCurrentMonthStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const formatMonthShortVN = (monthStr) => {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(String(monthStr))) {
    const now = new Date();
    return `${now.getMonth() + 1} - ${now.getFullYear()}`;
  }
  const [year, month] = String(monthStr).split('-');
  return `${Number(month)} - ${year}`;
};

export const scrollElementIntoViewCleanly = (element, block = 'center') => {
  if (!element || typeof window === 'undefined') return;
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollableY =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight + 24;
    if (isScrollableY) {
      const parentRect = parent.getBoundingClientRect();
      const elemRect = element.getBoundingClientRect();
      const offsetWithinParent =
        block === 'center'
          ? elemRect.top - parentRect.top - Math.max(24, (parent.clientHeight - elemRect.height) / 2)
          : elemRect.top - parentRect.top - 24;
      const targetTop = Math.max(0, parent.scrollTop + offsetWithinParent);
      parent.scrollTo({ top: targetTop, behavior: 'smooth' });
      return;
    }
    parent = parent.parentElement;
  }
  element.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });
};

export const matchWorklogFromFocusRequest = (list = [], focusRequest = null, roleMode = 'manager') => {
  if (!Array.isArray(list) || list.length === 0 || !focusRequest) return null;

  if (focusRequest.worklogId) {
    return list.find((w) => String(w.id) === String(focusRequest.worklogId)) || null;
  }

  if (focusRequest.notificationContent) {
    const content = String(focusRequest.notificationContent);
    const codeMatch = content.match(/\[([A-Z0-9_-]+)\]/i);
    const dateMatch = content.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    const hoursMatch = content.match(/(\d+(?:\.\d+)?)h\b/i);

    if (codeMatch || dateMatch) {
      const codeUpper = codeMatch ? codeMatch[1].toUpperCase() : null;
      const dateStr = dateMatch ? dateMatch[1] : null;
      const targetHours = hoursMatch ? Number(hoursMatch[1]) : null;

      const exactHint = list.find((w) => {
        if (roleMode === 'manager' && w.approvalStatus !== 'PENDING') return false;
        if (codeUpper && String(w.projectCode || '').toUpperCase() !== codeUpper) return false;
        if (dateStr && String(w.workDate || '') !== dateStr) return false;
        if (targetHours !== null && Math.abs(Number(w.hoursSpent || 0) - targetHours) > 0.05) return false;
        return true;
      });
      if (exactHint) return exactHint;

      const looseHint = list.find((w) => {
        if (codeUpper && String(w.projectCode || '').toUpperCase() !== codeUpper) return false;
        if (dateStr && String(w.workDate || '') !== dateStr) return false;
        return true;
      });
      if (looseHint) return looseHint;
    }
  }

  if (roleMode === 'engineer') {
    return (
      list.find((w) => w.approvalStatus === 'APPROVED' || w.approvalStatus === 'REJECTED') ||
      list[0] ||
      null
    );
  }
  return list.find((w) => w.approvalStatus === 'PENDING') || list[0] || null;
};


