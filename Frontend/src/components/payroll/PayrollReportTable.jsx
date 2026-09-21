import React from 'react';
import Button from '../common/Button';

function PayrollReportTable({ reports, onViewDetail, onApprove, onReject, role }) {
    const getStatusBadge = (status) => {
        switch (status) {
            case 'APPROVED_BY_CEO':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">Đã duyệt (CEO)</span>;
            case 'PENDING_CEO':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Chờ CEO duyệt</span>;
            case 'APPROVED_BY_DIRECTOR':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">Đã duyệt (GĐ)</span>;
            case 'PENDING_DIRECTOR':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Chờ GĐ duyệt</span>;
            case 'REJECTED':
            case 'REJECTED_BY_CEO':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700">Bị từ chối</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
        }
    };

    return (
        <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-sm text-gray-600 bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Tên phòng ban</th>
                            <th className="px-6 py-4 font-semibold">Người gửi</th>
                            <th className="px-6 py-4 font-semibold">Cấp báo cáo</th>
                            <th className="px-6 py-4 font-semibold text-center">Tổng nhân sự</th>
                            <th className="px-6 py-4 font-semibold text-right">Tổng quỹ lương (Gross)</th>
                            <th className="px-6 py-4 font-semibold text-center">Trạng thái</th>
                            <th className="px-6 py-4 font-semibold text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {reports.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                    Không có báo cáo nào
                                </td>
                            </tr>
                        ) : (
                            reports.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800">{s.departmentName || `Phòng ${s.departmentId}`}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-800">{s.senderName || 'Hệ thống'}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{s.senderRole || ''}</div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {s.reportLevel === 'MANAGER_LEVEL' ? 'Báo cáo Trưởng phòng' : 'Báo cáo Giám đốc'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-center">{s.totalEmployees}</td>
                                    <td className="px-6 py-4 text-slate-600 font-medium text-right">
                                        {(s.totalGrossSalary || 0).toLocaleString('vi-VN')} ₫
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {getStatusBadge(s.status)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {(role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' && s.status === 'PENDING_DIRECTOR') && onApprove && (
                                                <button 
                                                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors" 
                                                    onClick={() => onApprove(s.id)}
                                                >
                                                    Duyệt
                                                </button>
                                            )}
                                            {(role?.toUpperCase() === 'CEO' && s.status === 'PENDING_CEO') && onApprove && (
                                                <>
                                                    <button 
                                                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors" 
                                                        onClick={() => onApprove(s.id)}
                                                    >
                                                        Duyệt
                                                    </button>
                                                    <button 
                                                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors" 
                                                        onClick={() => onReject(s.id, s.departmentName)}
                                                    >
                                                        Từ chối
                                                    </button>
                                                </>
                                            )}
                                            <button 
                                                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors" 
                                                onClick={() => onViewDetail(s.departmentId, s.departmentName || `Phòng ${s.departmentId}`)}
                                            >
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
    );
}

export default PayrollReportTable;
