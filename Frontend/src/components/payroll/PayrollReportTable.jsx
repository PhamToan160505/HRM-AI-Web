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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Tên phòng ban</th>
                            <th className="px-6 py-4 font-semibold">Người gửi</th>
                            <th className="px-6 py-4 font-semibold">Cấp báo cáo</th>
                            <th className="px-6 py-4 font-semibold">Tổng nhân sự</th>
                            <th className="px-6 py-4 font-semibold">Tổng quỹ lương (Gross)</th>
                            <th className="px-6 py-4 font-semibold">Trạng thái</th>
                            <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
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
                                    <td className="px-6 py-4 text-slate-600">{s.totalEmployees}</td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">
                                        {(s.totalGrossSalary || 0).toLocaleString('vi-VN')} ₫
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(s.status)}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {(role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' && s.status === 'PENDING_DIRECTOR') && onApprove && (
                                            <Button 
                                                variant="outline" 
                                                className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200" 
                                                onClick={() => onApprove(s.id)}
                                            >
                                                Duyệt
                                            </Button>
                                        )}
                                        {(role?.toUpperCase() === 'CEO' && s.status === 'PENDING_CEO') && onApprove && (
                                            <>
                                                <Button 
                                                    variant="outline" 
                                                    className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200" 
                                                    onClick={() => onApprove(s.id)}
                                                >
                                                    Duyệt
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    className="text-xs px-2 py-1 text-rose-600 hover:bg-rose-50 border-rose-200" 
                                                    onClick={() => onReject(s.id, s.departmentName)}
                                                >
                                                    Từ chối
                                                </Button>
                                            </>
                                        )}
                                        <Button 
                                            variant="outline" 
                                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 border-blue-200" 
                                            onClick={() => onViewDetail(s.departmentId, s.departmentName || `Phòng ${s.departmentId}`)}
                                        >
                                            Xem chi tiết
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default PayrollReportTable;
