import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  Home,
  Info,
  Link2Off,
  ShieldAlert,
} from 'lucide-react';
import { formatHours } from '../techHelpers';

const SEVERITY_PILL_CLASSES = {
  INFO: 'bg-sky-50 text-sky-800 border-sky-200',
  OK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WARNING: 'bg-orange-50 text-orange-800 border-orange-200',
  DANGER: 'bg-rose-50 text-rose-700 border-rose-200 font-bold',
};

const SEVERITY_DOT_CLASSES = {
  INFO: 'bg-sky-500',
  OK: 'bg-emerald-500',
  WARNING: 'bg-orange-500',
  DANGER: 'bg-rose-600',
};

function renderAlertIcon(alert) {
  const { code, category, severity } = alert || {};
  if (code === 'ATTENDANCE_WFH' || code === 'ATTENDANCE_WFH_OVER_HOURS') {
    return <Home size={11} className="shrink-0" />;
  }
  if (code === 'ATTENDANCE_MATCHED') {
    return <CheckCircle2 size={11} className="shrink-0" />;
  }
  if (
    code === 'ATTENDANCE_OVERTIME' ||
    code === 'ATTENDANCE_HALF_DAY' ||
    code === 'ATTENDANCE_HALF_DAY_EXCEEDED' ||
    code === 'ATTENDANCE_CHECKED_IN_OPEN'
  ) {
    return <Clock size={11} className="shrink-0" />;
  }
  if (category === 'EVIDENCE' || code === 'MISSING_EVIDENCE_URL') {
    return <Link2Off size={11} className="shrink-0" />;
  }
  if (category === 'ALLOCATION' || code === 'ALLOCATION_OVERLOAD') {
    return <Gauge size={11} className="shrink-0" />;
  }
  if (severity === 'DANGER') {
    return <ShieldAlert size={11} className="shrink-0" />;
  }
  return <AlertTriangle size={11} className="shrink-0" />;
}

export default function WorklogAuditBadges({ worklog, expanded = false, onToggleExpand }) {
  const alerts = worklog?.auditAlerts || [];
  if (alerts.length === 0) return null;

  const expectedDailyProjHours =
    worklog?.projectAllocationPercent != null
      ? Math.round((worklog.projectAllocationPercent / 100) * 8 * 100) / 100
      : null;

  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {alerts.map((alert) => {
          const pillCls =
            SEVERITY_PILL_CLASSES[alert.severity] || 'bg-slate-100 text-slate-700 border-slate-200';
          return (
            <span
              key={`${worklog.id}-${alert.code}`}
              title={alert.detail}
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${pillCls}`}
            >
              {renderAlertIcon(alert)}
              <span>{alert.label}</span>
            </span>
          );
        })}

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-[#1E3A8A] px-1.5 py-0.5 rounded hover:bg-slate-100 transition cursor-pointer whitespace-nowrap"
          >
            <Info size={11} className="shrink-0" />
            <span>{expanded ? 'Ẩn đối chiếu' : 'Chi tiết'}</span>
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-[11px] space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500 pb-1 border-b border-slate-200/80 tabular">
            {worklog?.dailyLoggedHours != null && (
              <span>
                Tổng log ngày:{' '}
                <strong className="text-slate-800">{formatHours(worklog.dailyLoggedHours)}</strong>
              </span>
            )}
            {worklog?.projectDailyLoggedHours != null && (
              <span>
                Riêng dự án này:{' '}
                <strong className="text-slate-800">
                  {formatHours(worklog.projectDailyLoggedHours)}
                </strong>
              </span>
            )}
            {worklog?.projectAllocationPercent != null && (
              <span>
                Phân bổ dự án:{' '}
                <strong className="text-slate-800">
                  {worklog.projectAllocationPercent}% (~{formatHours(expectedDailyProjHours)}/ngày)
                </strong>
              </span>
            )}
          </div>

          <ul className="space-y-1">
            {alerts.map((alert) => {
              const dotCls = SEVERITY_DOT_CLASSES[alert.severity] || 'bg-slate-400';
              return (
                <li key={`detail-${worklog.id}-${alert.code}`} className="flex items-start gap-2 text-slate-700 leading-relaxed text-pretty">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotCls}`} />
                  <span>
                    <strong className="text-slate-900">{alert.label}:</strong> {alert.detail}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

