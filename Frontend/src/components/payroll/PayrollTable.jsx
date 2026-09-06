import React from 'react';
import { formatCurrencyVND } from '../../utils/currency';
import Button from '../common/Button';

export default function PayrollTable({ payrolls, onApprove, onReject, role }) {
    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Đã duyệt</span>;
            case 'MANAGER_APPROVED': return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">Trưởng phòng đã duyệt</span>;
            case 'DIRECTOR_APPROVED': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">Giám đốc đã duyệt</span>;
            case 'REJECTED': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">Từ chối</span>;
            case 'DRAFT': return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">Bản nháp</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold">{status}</span>;
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-gray-500 border-b border-gray-100">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Nhân viên</th>
                        <th className="px-6 py-4 font-semibold">Lương cơ bản</th>
                        <th className="px-6 py-4 font-semibold">Phụ cấp</th>
                        <th className="px-6 py-4 font-semibold">Công chuẩn/Thực tế</th>
                        <th className="px-6 py-4 font-semibold group relative">
                            Lương gộp 
                            <span className="ml-1 text-xs text-blue-500 cursor-help" title="(Lương CB + Phụ cấp) * (Thực tế/Chuẩn) - Phạt đi muộn + Tăng ca">(?)</span>
                        </th>
                        <th className="px-6 py-4 font-semibold text-red-600">BHXH (8%)</th>
                        <th className="px-6 py-4 font-semibold text-red-600">BHYT (1.5%)</th>
                        <th className="px-6 py-4 font-semibold text-red-600">BHTN (1%)</th>
                        <th className="px-6 py-4 font-semibold">TN tính thuế</th>
                        <th className="px-6 py-4 font-semibold text-red-600">Thuế TNCN</th>
                        <th className="px-6 py-4 font-semibold text-blue-600 text-right">Thực nhận</th>
                        <th className="px-6 py-4 font-semibold">Trạng thái</th>
                        {(role?.toUpperCase() === 'TRUONG_PHONG' || role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' || role?.toUpperCase() === 'CEO') && <th className="px-6 py-4 font-semibold text-right">Thao tác</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {payrolls.length === 0 ? (
                        <tr>
                            <td colSpan={(role?.toUpperCase() === 'TRUONG_PHONG' || role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' || role?.toUpperCase() === 'CEO') ? 10 : 9} className="px-6 py-8 text-center text-gray-500">Không có dữ liệu</td>
                        </tr>
                    ) : (
                        payrolls.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-800">{p.employeeName || 'Chưa cập nhật'}</div>
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
                                <td className="px-6 py-4 font-bold text-blue-600 tabular-nums text-right">{formatCurrencyVND(p.netSalary)}</td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(p.status)}
                                    {p.status === 'REJECTED' && p.rejectionReason && (
                                        <div className="text-[10px] text-red-500 mt-1 truncate max-w-[150px]" title={p.rejectionReason}>
                                            Lý do: {p.rejectionReason}
                                        </div>
                                    )}
                                </td>
                                {(role?.toUpperCase() === 'TRUONG_PHONG' || role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' || role?.toUpperCase() === 'CEO') && (
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {p.status === 'DRAFT' && (
                                            <>
                                                <Button variant="outline" className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200" onClick={() => onApprove(p.id)}>Duyệt</Button>
                                                <Button variant="outline" className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 border-red-200" onClick={() => onReject(p)}>Từ chối</Button>
                                            </>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
