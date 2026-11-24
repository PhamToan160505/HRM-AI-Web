import React from 'react';
import { formatCurrencyVND } from '../../utils/currency';
import { BatchStatusBadge } from './PayrollBatchTable';

/** Bảng chi tiết phiếu lương của một kỳ lương phòng ban (chỉ xem). */
export default function PayrollTable({ payrolls = [], departmentName = '' }) {
    const isTechDept = Boolean(
        departmentName && (
            departmentName.toLowerCase().includes('công nghệ') ||
            departmentName.toLowerCase().includes('kỹ thuật')
        )
    );
    const hasAnyCertReimb = payrolls.some((p) => Number(p.certReimbursementAmount || 0) > 0);
    const showCertCol = isTechDept || hasAnyCertReimb;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-gray-500 border-b border-gray-100">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Nhân viên</th>
                        <th className="px-6 py-4 font-semibold">Lương cơ bản</th>
                        <th className="px-6 py-4 font-semibold">Phụ cấp</th>
                        <th className="px-6 py-4 font-semibold">Công chuẩn/Thực tế</th>
                        <th className="px-6 py-4 font-semibold">
                            Lương gộp
                            <span className="ml-1 text-xs text-blue-500 cursor-help" title="(Lương CB + Phụ cấp) * (Thực tế/Chuẩn) - Phạt đi muộn + Tăng ca">(?)</span>
                        </th>
                        <th className="px-6 py-4 font-semibold text-red-600">BHXH (8%)</th>
                        <th className="px-6 py-4 font-semibold text-red-600">BHYT (1.5%)</th>
                        <th className="px-6 py-4 font-semibold text-red-600">BHTN (1%)</th>
                        <th className="px-6 py-4 font-semibold">TN tính thuế</th>
                        <th className="px-6 py-4 font-semibold text-red-600">Thuế TNCN</th>
                        {showCertCol && (
                            <th className="px-6 py-4 font-semibold text-indigo-700 text-right">
                                Hoàn ứng chứng chỉ (miễn thuế)
                                <span
                                    className="ml-1 text-xs text-indigo-500 cursor-help"
                                    title="Khoản hỗ trợ lệ phí chứng chỉ quốc tế gộp kỳ lương (miễn thuế TNCN, không tính vào BHXH)"
                                >
                                    (?)
                                </span>
                            </th>
                        )}
                        <th className="px-6 py-4 font-semibold text-blue-600 text-right">Thực nhận</th>
                        <th className="px-6 py-4 font-semibold">Trạng thái</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {payrolls.length === 0 ? (
                        <tr>
                            <td colSpan={showCertCol ? 13 : 12} className="px-6 py-8 text-center text-gray-500">Không có dữ liệu</td>
                        </tr>
                    ) : (
                        payrolls.map((p) => {
                            const certAmount = Number(p.certReimbursementAmount || 0);
                            const totalPayout = Number(p.totalPayoutAmount ?? (Number(p.netSalary || 0) + certAmount));
                            return (
                                <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-800">{p.employeeName || 'Chưa cập nhật'}</div>
                                        <div className="text-xs text-gray-400">{[p.maNhanVien, p.chucVu].filter(Boolean).join(' · ')}</div>
                                    </td>
                                    <td className="px-6 py-4 tabular-nums">{formatCurrencyVND(p.baseSalary)}</td>
                                    <td className="px-6 py-4 tabular-nums">{formatCurrencyVND(p.allowance || 0)}</td>
                                    <td className="px-6 py-4 font-mono text-center">{p.standardDays} / {p.actualDays}</td>
                                    <td className="px-6 py-4 tabular-nums font-semibold">{formatCurrencyVND(p.grossSalary)}</td>
                                    <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.bhxhAmount)}</td>
                                    <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.bhytAmount)}</td>
                                    <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.bhtnAmount)}</td>
                                    <td className="px-6 py-4 tabular-nums">{formatCurrencyVND(p.thuNhapTinhThue)}</td>
                                    <td className="px-6 py-4 text-red-600 tabular-nums">-{formatCurrencyVND(p.thuTncn)}</td>
                                    {showCertCol && (
                                        <td className="px-6 py-4 text-right tabular-nums">
                                            {certAmount > 0 ? (
                                                <div>
                                                    <div className="font-semibold text-indigo-700">+{formatCurrencyVND(certAmount)}</div>
                                                    {p.certReimbursementSummary && (
                                                        <div className="text-[11px] text-slate-400 max-w-[220px] truncate ml-auto" title={p.certReimbursementSummary}>
                                                            {p.certReimbursementSummary}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">—</span>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right tabular-nums">
                                        <div className="font-bold text-blue-600">{formatCurrencyVND(p.netSalary)}</div>
                                        {certAmount > 0 && (
                                            <div className="text-[11px] font-semibold text-emerald-700">
                                                Tổng chi: {formatCurrencyVND(totalPayout)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4"><BatchStatusBadge status={p.status} /></td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
