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
    label: 'Mobile Developer',
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
  },
};

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

export const sortSkillsByLevel = (skills = []) => {
  return [...skills].sort((a, b) => {
    const orderA = LEVEL_ORDER[a.proficiencyLevel] ?? 99;
    const orderB = LEVEL_ORDER[b.proficiencyLevel] ?? 99;
    if (orderA !== orderB) return orderB - orderA; // Highest level first for Executive scan
    const yA = a.yearsOfExperience ?? 0;
    const yB = b.yearsOfExperience ?? 0;
    if (yA !== yB) return yB - yA;
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

