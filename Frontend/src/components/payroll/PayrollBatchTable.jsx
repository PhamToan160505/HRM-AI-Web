import React from 'react';
import { formatCurrencyVND } from '../../utils/currency';
import { BATCH_STATUS, REJECT_STAGE_LABEL } from '../../utils/payrollStatus';

export function BatchStatusBadge({ status }) {
    const meta = BATCH_STATUS[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${meta.className}`}>
            {meta.label}
        </span>
    );
}

const ACTION_BUTTONS = [
    { action: 'CLOSE_ATTENDANCE', label: 'Chốt công', tone: 'primary' },
    { action: 'REOPEN_ATTENDANCE', label: 'Mở lại công', tone: 'neutral' },
    { action: 'GENERATE', label: 'Tính lương', tone: 'primary' },
    { action: 'SUBMIT', label: 'Gửi duyệt', tone: 'primary' },
    { action: 'DIRECTOR_CONFIRM', label: 'Xác nhận', tone: 'success' },
    { action: 'DIRECTOR_REJECT', label: 'Từ chối', tone: 'danger' },
    { action: 'CHIEF_APPROVE', label: 'Duyệt & gửi CEO', tone: 'success' },
    { action: 'CHIEF_REJECT', label: 'Trả lại', tone: 'danger' },
    { action: 'CEO_APPROVE', label: 'Chốt lương', tone: 'success' },
    { action: 'CEO_REJECT', label: 'Từ chối', tone: 'danger' },
    { action: 'MARK_PAID', label: 'Xác nhận đã chi', tone: 'success' },
    { action: 'DOWNLOAD_BANK_FILE', label: 'File ngân hàng', tone: 'neutral' },
    { action: 'VIEW_ITEMS', label: 'Xem chi tiết', tone: 'info' },
];

const TONE_CLASS = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
    neutral: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    info: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
};

function StatusDetail({ b }) {
    return (
        <>
            <BatchStatusBadge status={b.status} />
            {b.status === 'REJECTED' && b.rejectionReason && (
                <div className="text-xs text-rose-600 mt-1.5 max-w-[260px] whitespace-normal">
                    {REJECT_STAGE_LABEL[b.rejectedStage] || 'Người duyệt'}
                    {b.rejectedByName ? ` (${b.rejectedByName})` : ''}: {b.rejectionReason}
                </div>
            )}
            {b.status === 'PAID' && b.paymentReference && (
                <div className="text-xs text-slate-500 mt-1.5">Mã chứng từ: {b.paymentReference}</div>
            )}
        </>
    );
}

function ActionButtons({ b, onAction, busyKey, className = '' }) {
    const buttons = ACTION_BUTTONS.filter(a => b.actions?.includes(a.action));
    if (buttons.length === 0) return <span className="text-xs text-slate-400">—</span>;
    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            {buttons.map(a => {
                const key = `${b.departmentId}:${a.action}`;
                return (
                    <button
                        key={a.action}
                        disabled={busyKey === key}
                        onClick={() => onAction(a.action, b)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${TONE_CLASS[a.tone]}`}
                    >
                        {busyKey === key ? 'Đang xử lý...' : a.label}
                    </button>
                );
            })}
        </div>
    );
}

const closedByText = (b) => b.attendanceClosedByName ? `Chốt công: ${b.attendanceClosedByName}` : 'Trưởng phòng chưa chốt công';
const money = (v) => v != null ? formatCurrencyVND(v) : '—';

export default function PayrollBatchTable({ batches, onAction, busyKey }) {
    if (batches.length === 0) {
        return <div className="px-6 py-10 text-center text-gray-500">Không có phòng ban nào</div>;
    }
    return (
        <>
            {/* Màn hình hẹp: dạng thẻ để nút thao tác luôn nhìn thấy */}
            <ul className="lg:hidden divide-y divide-gray-100">
                {batches.map(b => (
                    <li key={b.departmentId} className="px-5 py-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="font-medium text-slate-800">{b.departmentName}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{closedByText(b)}</div>
                            </div>
                            <div className="text-right"><StatusDetail b={b} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div><div className="text-slate-400">Nhân sự</div><div className="font-medium text-slate-700">{b.totalEmployees ?? '—'}</div></div>
                            <div><div className="text-slate-400">Tổng gross</div><div className="font-medium text-slate-700 tabular-nums">{money(b.totalGrossSalary)}</div></div>
                            <div><div className="text-slate-400">Thực nhận</div><div className="font-semibold text-blue-700 tabular-nums">{money(b.totalNetSalary)}</div></div>
                        </div>
                        <ActionButtons b={b} onAction={onAction} busyKey={busyKey} />
                    </li>
                ))}
            </ul>

            <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-gray-600 bg-gray-50/50 border-b border-gray-100 whitespace-nowrap">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Phòng ban</th>
                            <th className="px-6 py-4 font-semibold">Trạng thái</th>
                            <th className="px-6 py-4 font-semibold text-center">Nhân sự</th>
                            <th className="px-6 py-4 font-semibold text-right">Tổng gross</th>
                            <th className="px-6 py-4 font-semibold text-right">Tổng thực nhận</th>
                            <th className="px-6 py-4 font-semibold">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {batches.map((b) => (
                            <tr key={b.departmentId} className="hover:bg-gray-50/50 transition-colors align-top">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-slate-800">{b.departmentName}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{closedByText(b)}</div>
                                </td>
                                <td className="px-6 py-4"><StatusDetail b={b} /></td>
                                <td className="px-6 py-4 text-center text-slate-600">{b.totalEmployees ?? '—'}</td>
                                <td className="px-6 py-4 text-right text-slate-600 tabular-nums whitespace-nowrap">{money(b.totalGrossSalary)}</td>
                                <td className="px-6 py-4 text-right font-semibold text-blue-700 tabular-nums whitespace-nowrap">{money(b.totalNetSalary)}</td>
                                <td className="px-6 py-4"><ActionButtons b={b} onAction={onAction} busyKey={busyKey} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
