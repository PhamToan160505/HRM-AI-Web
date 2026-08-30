import React from 'react';
import Button from '../common/Button';

function DepartmentPayrollSummaryTable({ summaries, onViewDetail, onApprove, role }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Tên phòng ban</th>
                            <th className="px-6 py-4 font-semibold">Tổng nhân sự</th>
                            <th className="px-6 py-4 font-semibold">Tổng quỹ lương (Gross)</th>
                            <th className="px-6 py-4 font-semibold">Trạng thái</th>
                            <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {summaries.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                    Không có dữ liệu phòng ban
                                </td>
                            </tr>
                        ) : (
                            summaries.map((s) => (
                                <tr key={s.departmentId} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-800">{s.departmentName}</td>
                                    <td className="px-6 py-4 text-slate-600">{s.totalEmployees}</td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">
                                        {s.totalGrossSalary.toLocaleString('vi-VN')} ₫
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            s.status === 'Đã duyệt' ? 'bg-emerald-100 text-emerald-700' :
                                            s.status === 'Bị từ chối' ? 'bg-rose-100 text-rose-700' :
                                            s.status === 'Chờ Giám đốc duyệt' ? 'bg-amber-100 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {(role?.toUpperCase() === 'GIAM_DOC_PHONG_BAN' || role?.toUpperCase() === 'CEO') && s.status === 'Chờ Giám đốc duyệt' && onApprove && (
                                            <Button 
                                                variant="outline" 
                                                className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200" 
                                                onClick={() => onApprove(s.departmentId)}
                                            >
                                                Duyệt
                                            </Button>
                                        )}
                                        <Button 
                                            variant="outline" 
                                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 border-blue-200" 
                                            onClick={() => onViewDetail(s.departmentId, s.departmentName)}
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

export default DepartmentPayrollSummaryTable;
